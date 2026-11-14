#!/usr/bin/env python3
"""Export the Hoa Lich daily cube to the TASK 03A binary artifacts.

Implements docs/backend/TASK_03A_ARTIFACT_SPEC.md (schemaVersion 1.0.0):
  daily-values.f32, daily-source.u8, daily-input-count.i16,
  daily-source-input-valid.u8 and dataset-manifest.json.

Two modes:
  Snapshot: python tools/data/export_daily_artifacts.py --dataset-root <root> [--replace]
  Fixture:  python tools/data/export_daily_artifacts.py --fixture <dir> --cells-source <cells_025.csv> [--replace]

Everything is written to a temporary sibling directory first. The manifest is
written last, and the temporary directory replaces <root>/derived only after
every check has passed. On any failure the temporary directory is removed and
derived/ is left untouched.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import platform
import shutil
import sys
import time

import numpy as np
import pandas as pd

SCHEMA_VERSION = "1.0.0"
SCRIPT = "tools/data/export_daily_artifacts.py"

# Canonical IDs for the v1.0 snapshot (Decision Log D08). A different source
# snapshot MUST get a different dataVersion (spec section 10).
KNOWN_SNAPSHOTS = {
    "ce62f017494b758b4a6a8cfe889601e1974dc3c4bb10113cd1e1b8a901900b93": {
        "dataVersion": "hoalich-data-v1-2026-11-13",
        "modelVersion": "lai-clim-s2-k60-kappa3",
    }
}
DEFAULT_DATA_VERSION = "hoalich-data-v1-2026-11-13"
DEFAULT_MODEL_VERSION = "lai-clim-s2-k60-kappa3"

FILES = [  # name, numpy dtype, dtype label, bytes per value, description
    ("daily-values.f32", "<f4", "float32", 4, "harmonized snpp_eq per cell-day, bit-exact copy of the source cube"),
    ("daily-source.u8", "u1", "uint8", 1, "source code 1-4 per cell-day"),
    ("daily-input-count.i16", "<i2", "int16", 2, "daytime non-static detection count of the satellite selected by the source code"),
    ("daily-source-input-valid.u8", "u1", "uint8", 1, "validity flag (0/1) of the satellite selected by the source code"),
]
SOURCE_CODES = {  # code: (source, origin, NPZ satellite key)
    1: ("TERRA", "MODEL_REDISTRIBUTED", "Terra"),
    2: ("AQUA", "MODEL_REDISTRIBUTED", "Aqua"),
    3: ("SNPP", "DIRECT_OBSERVATION", "SNPP"),
    4: ("NOAA20", "SCALED_OBSERVATION", "N20"),
}
TERRA_END = dt.date(2002, 8, 1)      # no code 1 from this date
VIIRS_START = dt.date(2012, 1, 20)   # no code 3|4 before this date

WARNING_CATALOG = [
    {"code": "PARTIAL_PERIOD", "trigger": "PERIOD_IN_PARTIAL", "params": {},
     "appliesTo": ["/calendar", "/trends", "/map/cells"],
     "description": "Kỳ được hỏi nằm trong periods.partial (chưa đủ ngày trong dataset)."},
    {"code": "DATASET_EDGE_DATE", "trigger": "DATE_IS_DATA_THROUGH", "params": {},
     "appliesTo": ["/daily", "/map/cells"],
     "description": "Ngày được hỏi là ngày dữ liệu cuối (dataThrough)."},
    {"code": "TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY", "trigger": "ANY_SOURCE_CODE", "params": {"codes": [1]},
     "appliesTo": ["/calendar", "/trends", "/map/cells", "/daily"],
     "description": "Có cell-day đóng góp dựng từ Terra (11/2000-7/2002), độ tin cậy thấp."},
    {"code": "MODEL_REDISTRIBUTED_DAILY_VALUE", "trigger": "ANY_SOURCE_CODE", "params": {"codes": [1, 2]},
     "appliesTo": ["/daily", "/map/cells"],
     "description": "Giá trị ngày là ước lượng mô hình cấp tháng được phân bổ xuống ngày."},
    {"code": "NO_DAILY_UNCERTAINTY_INTERVAL", "trigger": "ALWAYS_FOR_ENDPOINT", "params": {},
     "appliesTo": ["/daily", "/map/cells?date"],
     "description": "Không có khoảng bất định cấp ngày."},
    {"code": "DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY", "trigger": "AREA_TYPE", "params": {"areaTypes": ["diagnostic_region"]},
     "appliesTo": ["/calendar", "/trends", "/map/cells", "/daily", "/seasonality"],
     "description": "Vùng chẩn đoán không phải ranh giới hành chính."},
    {"code": "AQUA_FALLBACK_AFTER_ORBIT_DRIFT", "trigger": "ANY_SOURCE_CODE_FROM_DATE",
     "params": {"codes": [2], "fromDate": "2022-01-01"},
     "appliesTo": ["/calendar", "/trends", "/map/cells", "/daily"],
     "description": "Có cell-day dùng Aqua dự phòng sau khi quỹ đạo Aqua đã trôi."},
]
LIMITATIONS = [
    {"code": "SNPP_EQ_NOT_FIRE_EVENT_COUNT", "description": "snpp_eq là số phát hiện tương đương S-NPP, không phải số vụ cháy hay diện tích cháy."},
    {"code": "HISTORICAL_ANALYSIS_NOT_REALTIME_ALERT", "description": "Phân tích lịch sử, không phải cảnh báo thời gian thực hay dự báo."},
    {"code": "DAYTIME_STATIC_SOURCES_FILTERED", "description": "Chỉ phát hiện ban ngày; đã lọc nguồn nhiệt tĩnh."},
    {"code": "NO_DAILY_UNCERTAINTY_INTERVAL", "description": "Không có khoảng bất định cấp ngày."},
    {"code": "DAILY_VALIDATION_AT_MONTH_PENTAD", "description": "Kiểm định phát hành ở cấp tháng/pentad, chưa có kiểm định riêng cấp ngày."},
    {"code": "TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY", "description": "11/2000-7/2002 dựng từ Terra, độ tin cậy thấp."},
    {"code": "AQUA_ERA_MODEL_ESTIMATED", "description": "8/2002-1/2012 là ước lượng từ Aqua đã hiệu chuẩn."},
    {"code": "TAY_NGUYEN_PRE_2012_POSSIBLE_OVERESTIMATE", "description": "Tây Nguyên trước 2012 có thể bị ước lượng cao khoảng 6-10%."},
    {"code": "BASELINE_MIXES_SENSOR_ERAS", "description": "Baseline 2003-2025 gồm giai đoạn Aqua ước lượng và S-NPP/NOAA-20."},
    {"code": "DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY", "description": "Vùng chẩn đoán không phải ranh giới hành chính."},
    {"code": "PENTAD_73_INCLUDES_LEAP_DAY", "description": "Pentad 73 có 6 ngày ở năm nhuận."},
]
OPTIONAL_ARTIFACTS = {
    "calendar_regions_pentad": ("tables/calendar_regions_pentad.csv", "Lịch khí hậu, cửa sổ 50%/80% theo vùng (pipeline >= 1.3)"),
    "anomaly_regions_pentad": ("tables/anomaly_regions_pentad.csv", "Ngưỡng và cờ bất thường theo vùng (pipeline >= 1.3)"),
}
SNAPSHOT_SOURCES = ["tables/cube_daily_day_veg.npz", "tables/cells_025.csv", "tables/harmonized_025_month.csv",
                    "tables/harmonized_regions_pentad.csv", "web_cells_pentad.json", "summary.json"]

# Spec section 8.3: real regression samples of the v1.0 snapshot (keyed by NPZ hash).
REGRESSION = {
    "ce62f017494b758b4a6a8cfe889601e1974dc3c4bb10113cd1e1b8a901900b93": [
        {"id": "R1", "kind": "area_day", "area": "TayNguyen", "date": "2005-03-25", "value": 171.635599, "tol": 1e-6,
         "codes": [2], "inputCount": 21, "validCells": 122, "cells": 122},
        {"id": "R2", "kind": "area_day", "area": "ToanQuoc", "date": "2012-03-06", "value": 2275.0, "tol": 0.0,
         "codes": [3], "inputCount": 2275, "validCells": 587, "cells": 587},
        {"id": "R3", "kind": "area_day", "area": "ToanQuoc", "date": "2026-04-29", "value": 193.948132, "tol": 1e-6,
         "codes": [4], "inputCount": 196, "validCells": 587, "cells": 587},
        {"id": "R4", "kind": "cell_day", "cell": "59_430", "date": "2019-01-07", "value": 2.0, "bits": "0x40000000",
         "code": 3, "inputCount": 2, "valid": 1},
        {"id": "R5", "kind": "cell_day", "cell": "87_422", "date": "2024-09-27", "value": 0.9895312786102295, "bits": "0x3F7D51EC",
         "code": 4, "inputCount": 1, "valid": 1},
        {"id": "R6", "kind": "code_count_day", "date": "2026-11-06", "code": 2, "cellDays": 328},
        {"id": "R7", "kind": "seasonality_pentad", "area": "TayNguyen", "pentad": 15, "startYear": 2003, "endYear": 2025,
         "n": 23, "mean": 1672.6, "median": 1373.0},
    ]
}

# Spec section 11: synthetic, self-contained fixture. [date][cell] -> (value, code, count, valid)
FIXTURE_START = dt.date(2026, 11, 10)
FIXTURE_CELLS = ["34_419", "34_420", "45_428", "45_429"]
FIXTURE_GRID = [
    [(0.0, 3, 0, 1), (1.0, 3, 1, 1), (2.0, 3, 2, 1), (154.0, 3, 154, 1)],
    [(0.0, 4, 0, 1), (0.75, 4, 1, 1), (1.5, 4, 2, 1), (255.25, 4, 258, 1)],
    [(0.5, 2, 0, 1), (1.5, 2, 1, 1), (0.0, 4, 0, 1), (3.0, 4, 3, 1)],
    [(0.25, 1, 0, 0), (3.75, 1, 0, 0), (0.0, 2, 0, 1), (5.0, 3, 5, 1)],
]
FIXTURE_GENERATED_AT = "2026-11-14T00:00:00Z"  # fixed so the committed fixture is reproducible


class CheckFailed(Exception):
    pass


# --------------------------------------------------------------------------- helpers
def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def source_entry(root: str, rel: str) -> dict:
    p = os.path.join(root, rel)
    return {"path": rel, "byteSize": os.path.getsize(p), "sha256": sha256_file(p)}


def pentad_of(d: dt.date) -> int:
    return min((d.timetuple().tm_yday - 1) // 5, 72) + 1


def pentad_bounds(year: int, p: int) -> tuple[dt.date, dt.date]:
    start = dt.date(year, 1, 1) + dt.timedelta(days=5 * (p - 1))
    end = dt.date(year, 12, 31) if p == 73 else start + dt.timedelta(days=4)
    return start, end


def month_bounds(year: int, m: int) -> tuple[dt.date, dt.date]:
    start = dt.date(year, m, 1)
    nxt = dt.date(year + (m == 12), m % 12 + 1, 1)
    return start, nxt - dt.timedelta(days=1)


def partial_periods(start: dt.date, end: dt.date) -> list[dict]:
    """Years/months/pentads that intersect [start, end] but are not fully covered (spec 6.3)."""
    out = []

    def add(gran, year, period, ps, pe):
        if pe < start or ps > end:
            return
        cf, ct = max(ps, start), min(pe, end)
        if cf == ps and ct == pe:
            return
        item = {"granularity": gran, "year": year}
        if period is not None:
            item["period"] = period
        item.update({"periodStart": ps.isoformat(), "periodEnd": pe.isoformat(),
                     "coveredFrom": cf.isoformat(), "coveredTo": ct.isoformat()})
        out.append(item)

    for y in range(start.year, end.year + 1):
        add("year", y, None, dt.date(y, 1, 1), dt.date(y, 12, 31))
        for m in range(1, 13):
            add("month", y, m, *month_bounds(y, m))
        for p in range(1, 74):
            add("pentad", y, p, *pentad_bounds(y, p))
    return out


def transitions(dates: list[dt.date], src: np.ndarray) -> list[dict]:
    """Source transitions derived from the data (spec 6.3)."""
    has = {c: (src == c).any(axis=1) for c in SOURCE_CODES}
    out = []
    if has[2].any() and has[1].any():
        i2 = int(np.flatnonzero(has[2])[0])
        if has[1][:i2].any():
            out.append({"date": dates[i2].isoformat(), "event": "TERRA_TO_AQUA"})
    if has[3].any():
        i3 = int(np.flatnonzero(has[3])[0])
        if i3 > 0:
            out.append({"date": dates[i3].isoformat(), "event": "SNPP_START"})
        last3 = int(np.flatnonzero(has[3])[-1])
        if last3 + 1 < len(dates) and has[4][last3 + 1:].any():
            out.append({"date": dates[last3 + 1].isoformat(), "event": "SNPP_END_NOAA20_PRIMARY"})
    return out


def write_json(path: str, obj) -> None:
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
        f.write("\n")


class Checks:
    def __init__(self):
        self.items = []

    def add(self, cid: str, name: str, ok: bool, observed, expected) -> None:
        self.items.append({"id": cid, "name": name, "status": "PASS" if ok else "FAIL",
                           "observed": observed, "expected": expected})
        flag = "PASS" if ok else "FAIL"
        print(f"  [{flag}] {cid} {name}: {observed}")
        if not ok:
            raise CheckFailed(f"{cid} {name}: observed {observed}, expected {expected}")


# --------------------------------------------------------------------------- arrays
def write_binaries(tmp: str, arrays: dict) -> list[dict]:
    files = []
    for name, npdt, label, nbytes, desc in FILES:
        a = np.ascontiguousarray(arrays[name], dtype=np.dtype(npdt))
        path = os.path.join(tmp, name)
        with open(path, "wb") as f:
            f.write(a.tobytes(order="C"))
        files.append({"name": name, "dtype": label, "bytesPerValue": nbytes, "shape": list(a.shape),
                      "byteSize": os.path.getsize(path), "sha256": sha256_file(path), "description": desc})
    return files


def reread_matches(tmp: str, arrays: dict) -> bool:
    for name, npdt, _label, _n, _d in FILES:
        expect = np.ascontiguousarray(arrays[name], dtype=np.dtype(npdt))
        got = np.fromfile(os.path.join(tmp, name), dtype=np.dtype(npdt)).reshape(expect.shape)
        if got.tobytes() != expect.tobytes():
            return False
    return True


def source_code_table(dates: list[dt.date], src: np.ndarray, divisor=None) -> list[dict]:
    out = []
    for code, (source, origin, sat) in SOURCE_CODES.items():
        rows = np.flatnonzero((src == code).any(axis=1))
        item = {"code": code, "source": source, "origin": origin, "inputSatellite": sat,
                "firstDate": dates[rows[0]].isoformat() if len(rows) else None,
                "lastDate": dates[rows[-1]].isoformat() if len(rows) else None,
                "cellDays": int((src == code).sum())}
        if code == 4 and divisor is not None:
            item["scaleDivisor"], item["scaleDivisorReported"] = divisor
        out.append(item)
    return out


def finalize(tmp: str, out_dir: str, replace: bool) -> None:
    """Swap the validated temp dir into place (spec section 12)."""
    if os.path.exists(out_dir):
        if not replace:
            raise CheckFailed(f"{out_dir} already exists; rerun with --replace to swap it")
        prev = f"{out_dir}.prev-{time.strftime('%Y%m%d%H%M%S')}"
        os.replace(out_dir, prev)
        os.replace(tmp, out_dir)
        shutil.rmtree(prev)
    else:
        os.replace(tmp, out_dir)


def generator_info(generated_at: str) -> dict:
    return {"script": SCRIPT, "python": platform.python_version(), "numpy": np.__version__,
            "pandas": pd.__version__, "generatedAt": generated_at}


# --------------------------------------------------------------------------- snapshot
def export_snapshot(root: str, replace: bool, data_version: str, model_version: str, generated_at: str) -> None:
    out_dir = os.path.join(root, "derived")
    tmp = os.path.join(root, f"derived.tmp-{os.getpid()}")
    os.makedirs(tmp)
    try:
        ck = Checks()
        npz_path = os.path.join(root, "tables", "cube_daily_day_veg.npz")
        npz_hash = sha256_file(npz_path)
        known = KNOWN_SNAPSHOTS.get(npz_hash)
        ck.add("E1", "NPZ source hash recorded", True, npz_hash, "recorded")
        if known is None and data_version == DEFAULT_DATA_VERSION:
            raise CheckFailed("new source snapshot detected: pass a new --data-version (spec section 10)")

        z = np.load(npz_path)  # allow_pickle=False: the object array 'cell' is never read
        dates = [dt.datetime.strptime(str(v), "%Y%m%d").date() for v in z["dates"]]
        contiguous = all((b - a).days == 1 for a, b in zip(dates, dates[1:]))
        ck.add("E2", "dates contiguous", contiguous and len(dates) == (dates[-1] - dates[0]).days + 1,
               {"dayCount": len(dates), "start": dates[0].isoformat(), "end": dates[-1].isoformat()}, "contiguous")

        cells = pd.read_csv(os.path.join(root, "tables", "cells_025.csv"))
        ok_order = len(cells) == z["lat"].shape[0] and np.allclose(z["lat"], cells["lat"]) and np.allclose(z["lon"], cells["lon"])
        ck.add("E3", "cell order lat/lon matches cells_025.csv", bool(ok_order), int(len(cells)), "all cells match")

        values = z["harmonized"]
        if values.dtype != np.float32:
            raise CheckFailed(f"harmonized dtype {values.dtype}, expected float32")
        ck.add("E4", "values finite and non-negative", bool(np.isfinite(values).all() and (values >= 0).all()),
               {"nan": int(np.isnan(values).sum()), "negative": int((values < 0).sum()), "max": float(values.max())}, "0 NaN, 0 negative")

        src = z["src_code"].astype(np.int16)
        d64 = np.array([d.toordinal() for d in dates])
        bad1 = int(((src == 1) & (d64 >= TERRA_END.toordinal())[:, None]).sum())
        bad34 = int((((src == 3) | (src == 4)) & (d64 < VIIRS_START.toordinal())[:, None]).sum())
        ck.add("E5", "source codes in 1..4 and consistent with time", bool(src.min() >= 1 and src.max() <= 4 and bad1 == 0 and bad34 == 0),
               {"codeRange": [int(src.min()), int(src.max())], "code1From2002_08": bad1, "code34Before2012_01_20": bad34}, "1..4, 0, 0")

        m3 = src == 3
        ck.add("E6", "code 3 equals S-NPP count", bool(np.array_equal(values[m3], z["SNPP"][m3].astype(np.float32))),
               int(m3.sum()), "exact")

        m4 = (src == 4) & (z["N20"] > 0)
        ratio = z["N20"][m4].astype(np.float64) / values[m4].astype(np.float64)
        k_meas = float(np.median(ratio))
        summary = json.load(open(os.path.join(root, "summary.json"), encoding="utf-8"))
        k_rep = float(summary["viirs_consistency_day_veg"]["N20_per_SNPP"])
        dev_meas = float(np.abs(ratio / k_meas - 1).max())
        dev_rep = float(np.abs(ratio / k_rep - 1).max())
        ck.add("E7", "code 4 equals N20 / divisor", dev_meas <= 1e-6 and dev_rep <= 3e-5,
               {"scaleDivisor": round(k_meas, 7), "scaleDivisorReported": k_rep,
                "maxRelDevMeasured": dev_meas, "maxRelDevReported": dev_rep}, "<=1e-6 measured, <=3e-5 reported")

        v64 = values.astype(np.float64)
        year = np.array([d.year for d in dates])
        month = np.array([d.month for d in dates])
        pent = np.array([pentad_of(d) for d in dates])
        cell_ids = cells["cell"].tolist()

        hm = pd.read_csv(os.path.join(root, "tables", "harmonized_025_month.csv"))
        key_m = year * 100 + month
        daily_month = pd.DataFrame(v64, columns=cell_ids).groupby(key_m).sum()
        hm["ym"] = hm["year"] * 100 + hm["month"]
        tab_m = hm.pivot(index="ym", columns="cell", values="snpp_eq").reindex(index=daily_month.index, columns=cell_ids)
        e8 = float(np.nanmax(np.abs(daily_month.values - tab_m.values)))
        ck.add("E8", "daily sums vs harmonized_025_month.csv", e8 <= 0.01, round(e8, 6), "<=0.01")

        rp = pd.read_csv(os.path.join(root, "tables", "harmonized_regions_pentad.csv"))
        key_p = year * 100 + pent
        regions = cells["region"].values
        e9 = 0.0
        for name in list(pd.unique(regions)) + ["ToanQuoc"]:
            m = np.ones(len(regions), bool) if name == "ToanQuoc" else regions == name
            s = pd.Series(v64[:, m].sum(axis=1)).groupby(key_p).sum()
            r = rp[rp["vung"] == name]
            t = r.set_index(r["year"] * 100 + r["pentad"])["snpp_eq"].reindex(s.index)
            e9 = max(e9, float(np.nanmax(np.abs(s.values - t.values))))
        ck.add("E9", "daily sums vs harmonized_regions_pentad.csv", e9 <= 0.01, round(e9, 6), "<=0.01")

        web = json.load(open(os.path.join(root, "web_cells_pentad.json"), encoding="utf-8"))
        cell_pent = pd.DataFrame(v64).groupby(key_p).sum()
        first_k, last_k = int(key_p[0]), int(key_p[-1])
        e10, null_in, null_out = 0.0, 0, 0
        col = {c: i for i, c in enumerate(cell_ids)}
        for c in web["cells"]:
            arr = web["pentad"][c["id"]]
            j = col[c["id"]]
            for yi, y in enumerate(web["meta"]["years"]):
                for p, v in enumerate(arr[yi]):
                    k = y * 100 + p + 1
                    inside = first_k <= k <= last_k
                    if v is None:
                        null_in += inside
                        null_out += not inside
                    elif inside:
                        e10 = max(e10, abs(v - cell_pent.at[k, j]))
        ck.add("E10", "daily sums vs web_cells_pentad.json (1 decimal)", e10 <= 0.05 + 1e-9, round(e10, 6), "<=0.05")
        ck.add("E11", "web_cells_pentad.json nulls only outside range", null_in == 0, {"insideRange": null_in, "outsideRange": null_out}, "0 inside")

        count = np.zeros(src.shape, np.int64)
        valid = np.zeros(src.shape, np.uint8)
        for code, (_s, _o, sat) in SOURCE_CODES.items():
            m = src == code
            count[m] = z[sat][m]
            valid[m] = z["valid_" + sat][m]
        ck.add("E12", "input count in int16 range", bool(count.min() >= 0 and count.max() <= 32767),
               [int(count.min()), int(count.max())], "[0, 32767]")
        inval = valid == 0
        ck.add("E13", "validity in {0,1}", bool(set(np.unique(valid).tolist()) <= {0, 1}),
               {"invalidCellDays": int(inval.sum()), "byCode": {str(c): int((inval & (src == c)).sum()) for c in SOURCE_CODES}}, "0/1")

        arrays = {"daily-values.f32": values, "daily-source.u8": src.astype(np.uint8),
                  "daily-input-count.i16": count.astype(np.int16), "daily-source-input-valid.u8": valid}
        files = write_binaries(tmp, arrays)
        ck.add("E14", "files re-read bit-exact", reread_matches(tmp, arrays), [f["name"] for f in files], "bit-exact")

        samples = run_regression(npz_hash, dates, cells, arrays, rp)
        ck.add("E15", "regression samples", all(s["status"] == "PASS" for s in samples) if samples else True,
               [f'{s["id"]}:{s["status"]}' for s in samples] or "no samples for this snapshot", "all PASS")

        manifest = {
            "schemaVersion": SCHEMA_VERSION, "kind": "snapshot",
            "dataVersion": data_version, "modelVersion": model_version,
            "pipelineVersion": str(summary.get("pipeline_version")),
            "metric": "snpp_eq", "unit": "S-NPP-equivalent daytime detections", "timeZone": "UTC",
            "dateRange": {"start": dates[0].isoformat(), "end": dates[-1].isoformat(), "dayCount": len(dates)},
            "dataThrough": dates[-1].isoformat(),
            "grid": {"degrees": 0.25, "cellCount": len(cell_ids), "cellOrderSource": "tables/cells_025.csv", "cellIds": cell_ids},
            "layout": {"order": "row-major[date][cell]", "byteOrder": "little-endian", "header": "none"},
            "files": files,
            "sourceCodes": source_code_table(dates, src, (round(k_meas, 7), k_rep)),
            "periods": {"partial": partial_periods(dates[0], dates[-1]), "transitions": transitions(dates, src)},
            "sources": [source_entry(root, rel) for rel in SNAPSHOT_SOURCES],
            "capabilities": {"optionalArtifacts": [dict(name=n, **source_entry(root, rel), description=desc)
                                                   for n, (rel, desc) in OPTIONAL_ARTIFACTS.items()
                                                   if os.path.exists(os.path.join(root, rel))]},
            "warningCatalog": WARNING_CATALOG, "limitations": LIMITATIONS,
            "validation": {"status": "PASS", "checks": ck.items, "regressionSamples": samples},
            "generator": generator_info(generated_at),
        }
        write_json(os.path.join(tmp, "dataset-manifest.json"), manifest)  # written last
        finalize(tmp, out_dir, replace)
        print(f"OK: {out_dir}")
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise


def run_regression(npz_hash: str, dates, cells, arrays, rp) -> list[dict]:
    spec = REGRESSION.get(npz_hash, [])
    if not spec:
        return []
    di = {d: i for i, d in enumerate(dates)}
    col = {c: i for i, c in enumerate(cells["cell"])}
    vals, src = arrays["daily-values.f32"], arrays["daily-source.u8"]
    cnt, val = arrays["daily-input-count.i16"], arrays["daily-source-input-valid.u8"]
    out = []
    for s in spec:
        r = dict(s)
        if s["kind"] == "area_day":
            i = di[dt.date.fromisoformat(s["date"])]
            m = np.ones(len(cells), bool) if s["area"] == "ToanQuoc" else (cells["region"] == s["area"]).values
            got = {"value": float(vals[i, m].astype(np.float64).sum()), "codes": sorted(np.unique(src[i, m]).tolist()),
                   "inputCount": int(cnt[i, m].sum()), "validCells": int(val[i, m].sum()), "cells": int(m.sum())}
            ok = (abs(got["value"] - s["value"]) <= max(s["tol"], 1e-9) and got["codes"] == s["codes"]
                  and got["inputCount"] == s["inputCount"] and got["validCells"] == s["validCells"] and got["cells"] == s["cells"])
        elif s["kind"] == "cell_day":
            i, j = di[dt.date.fromisoformat(s["date"])], col[s["cell"]]
            bits = "0x%08X" % int(np.array(vals[i, j], dtype="<f4").view("<u4"))
            got = {"value": float(vals[i, j]), "bits": bits, "code": int(src[i, j]), "inputCount": int(cnt[i, j]), "valid": int(val[i, j])}
            ok = (bits == s["bits"] and got["code"] == s["code"] and got["inputCount"] == s["inputCount"] and got["valid"] == s["valid"])
        elif s["kind"] == "code_count_day":
            i = di[dt.date.fromisoformat(s["date"])]
            got = {"cellDays": int((src[i] == s["code"]).sum())}
            ok = got["cellDays"] == s["cellDays"]
        elif s["kind"] == "seasonality_pentad":
            x = rp[(rp["vung"] == s["area"]) & (rp["pentad"] == s["pentad"]) & rp["year"].between(s["startYear"], s["endYear"])]["snpp_eq"]
            got = {"n": int(len(x)), "mean": round(float(x.mean()), 1), "median": round(float(x.median()), 1)}
            ok = got == {"n": s["n"], "mean": s["mean"], "median": s["median"]}
        else:
            raise CheckFailed(f"unknown regression kind {s['kind']}")
        r["observed"], r["status"] = got, "PASS" if ok else "FAIL"
        print(f"    {s['id']} {r['status']} {got}")
        out.append(r)
    return out


# --------------------------------------------------------------------------- fixture
def export_fixture(fixture_dir: str, cells_source: str, replace: bool) -> None:
    src_cells = pd.read_csv(cells_source)
    sub = src_cells.set_index("cell").loc[FIXTURE_CELLS].reset_index()
    tables = os.path.join(fixture_dir, "tables")
    os.makedirs(tables, exist_ok=True)
    sub.to_csv(os.path.join(tables, "cells_025.csv"), index=False, lineterminator="\n")

    out_dir = os.path.join(fixture_dir, "derived")
    tmp = os.path.join(fixture_dir, f"derived.tmp-{os.getpid()}")
    os.makedirs(tmp)
    try:
        ck = Checks()
        n_days, n_cells = len(FIXTURE_GRID), len(FIXTURE_CELLS)
        dates = [FIXTURE_START + dt.timedelta(days=i) for i in range(n_days)]
        grid = np.array(FIXTURE_GRID, dtype=object)
        values = np.array([[c[0] for c in row] for row in FIXTURE_GRID], dtype=np.float32)
        src = np.array([[c[1] for c in row] for row in FIXTURE_GRID], dtype=np.uint8)
        count = np.array([[c[2] for c in row] for row in FIXTURE_GRID], dtype=np.int16)
        valid = np.array([[c[3] for c in row] for row in FIXTURE_GRID], dtype=np.uint8)
        ck.add("E2", "dates contiguous", True, {"dayCount": n_days, "start": dates[0].isoformat(), "end": dates[-1].isoformat()}, "contiguous")
        ck.add("E4", "values finite and non-negative", bool(np.isfinite(values).all() and (values >= 0).all()), float(values.max()), "ok")
        exact = all(float(np.float32(c[0])) == c[0] for row in FIXTURE_GRID for c in row)
        ck.add("E4b", "fixture values exactly representable in float32", exact, exact, True)
        ck.add("E12", "input count in int16 range", bool(count.min() >= 0 and count.max() <= 32767), [int(count.min()), int(count.max())], "[0, 32767]")
        ck.add("E13", "validity in {0,1}", bool(set(np.unique(valid).tolist()) <= {0, 1}), int((valid == 0).sum()), "0/1")
        arrays = {"daily-values.f32": values, "daily-source.u8": src, "daily-input-count.i16": count, "daily-source-input-valid.u8": valid}
        files = write_binaries(tmp, arrays)
        ck.add("E14", "files re-read bit-exact", reread_matches(tmp, arrays), [f["name"] for f in files], "bit-exact")

        regions = sub["region"].tolist()
        expected = build_fixture_expected(dates, regions, values, src, count, valid, tmp)
        ck.add("FX1", "endian probe bytes", expected["endianProbes"][0]["bytes"] == "02 01" and expected["endianProbes"][1]["bytes"] == "00 40 7f 43",
               [p["bytes"] for p in expected["endianProbes"]], ["02 01", "00 40 7f 43"])
        ck.add("FX2", "daily totals", expected["dailyTotals"] == [157.0, 257.5, 5.0, 9.0], expected["dailyTotals"], [157.0, 257.5, 5.0, 9.0])

        cells_rel = "tables/cells_025.csv"
        manifest = {
            "schemaVersion": SCHEMA_VERSION, "kind": "fixture",
            "dataVersion": "fixture-daily-mini-1", "modelVersion": "fixture",
            "pipelineVersion": "fixture",
            "metric": "snpp_eq", "unit": "S-NPP-equivalent daytime detections", "timeZone": "UTC",
            "dateRange": {"start": dates[0].isoformat(), "end": dates[-1].isoformat(), "dayCount": n_days},
            "dataThrough": dates[-1].isoformat(),
            "grid": {"degrees": 0.25, "cellCount": n_cells, "cellOrderSource": cells_rel, "cellIds": FIXTURE_CELLS},
            "layout": {"order": "row-major[date][cell]", "byteOrder": "little-endian", "header": "none"},
            "files": files,
            "sourceCodes": source_code_table(dates, src.astype(np.int16), (1.0105795, 1.0106)),
            "periods": {"partial": partial_periods(dates[0], dates[-1]), "transitions": transitions(dates, src.astype(np.int16))},
            "sources": [source_entry(fixture_dir, cells_rel)],
            "capabilities": {"optionalArtifacts": []},
            "warningCatalog": WARNING_CATALOG, "limitations": LIMITATIONS,
            "validation": {"status": "PASS", "checks": ck.items, "regressionSamples": []},
            "generator": generator_info(FIXTURE_GENERATED_AT),
        }
        write_json(os.path.join(tmp, "dataset-manifest.json"), manifest)
        finalize(tmp, out_dir, replace)
        expected["manifestPeriods"] = manifest["periods"]
        expected["files"] = {f["name"]: {"byteSize": f["byteSize"], "sha256": f["sha256"]} for f in files}
        write_json(os.path.join(fixture_dir, "fixture-expected.json"), expected)
        print(f"OK: {out_dir}")
    except Exception:
        shutil.rmtree(tmp, ignore_errors=True)
        raise


def build_fixture_expected(dates, regions, values, src, count, valid, tmp) -> dict:
    cells_out = []
    for i, d in enumerate(dates):
        for j, cid in enumerate(FIXTURE_CELLS):
            cells_out.append({"date": d.isoformat(), "dateIndex": i, "cellId": cid, "cellIndex": j,
                              "value": float(values[i, j]), "bits": "0x%08X" % int(values[i, j:j + 1].view("<u4")[0]),
                              "sourceCode": int(src[i, j]), "inputCount": int(count[i, j]), "valid": int(valid[i, j])})

    def area(name, mask, i):
        codes = sorted(set(src[i, mask].tolist()))
        origins = sorted({SOURCE_CODES[c][1] for c in codes})
        return {"area": name, "date": dates[i].isoformat(), "value": float(values[i, mask].astype(np.float64).sum()),
                "sourceCodes": codes, "origin": origins[0] if len(origins) == 1 else "MIXED",
                "inputCount": int(count[i, mask].sum()), "validCells": int(valid[i, mask].sum()), "cellCount": int(mask.sum())}

    reg = np.array(regions)
    areas = []
    for i in range(len(dates)):
        areas.append(area("ToanQuoc", np.ones(len(regions), bool), i))
        for r in sorted(set(regions)):
            areas.append(area(r, reg == r, i))
    raw = {name: open(os.path.join(tmp, name), "rb").read() for name, *_ in FILES}
    probes = [
        {"file": "daily-input-count.i16", "byteOffset": 14, "length": 2, "meaning": "2026-11-11 cell 45_429 count 258",
         "bytes": raw["daily-input-count.i16"][14:16].hex(" ")},
        {"file": "daily-values.f32", "byteOffset": 28, "length": 4, "meaning": "2026-11-11 cell 45_429 value 255.25",
         "bytes": raw["daily-values.f32"][28:32].hex(" ")},
    ]
    return {"description": "Expected values for the synthetic daily-mini fixture (TASK 03A spec section 11). Values are synthetic and not realistic in time.",
            "dateRange": {"start": dates[0].isoformat(), "end": dates[-1].isoformat()}, "cellIds": FIXTURE_CELLS,
            "cells": cells_out, "areaDays": areas,
            "dailyTotals": [float(values[i].astype(np.float64).sum()) for i in range(len(dates))],
            "endianProbes": probes}


# --------------------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(description="Export TASK 03A daily artifacts")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--dataset-root", help="snapshot dataset root (contains tables/, summary.json, web_cells_pentad.json)")
    g.add_argument("--fixture", help="fixture directory to (re)generate")
    ap.add_argument("--cells-source", help="real cells_025.csv used to copy the fixture cell rows")
    ap.add_argument("--replace", action="store_true", help="replace an existing derived/ after all checks pass")
    ap.add_argument("--data-version", default=DEFAULT_DATA_VERSION)
    ap.add_argument("--model-version", default=DEFAULT_MODEL_VERSION)
    args = ap.parse_args()
    generated_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    try:
        if args.dataset_root:
            export_snapshot(args.dataset_root, args.replace, args.data_version, args.model_version, generated_at)
        else:
            if not args.cells_source:
                ap.error("--fixture requires --cells-source")
            export_fixture(args.fixture, args.cells_source, args.replace)
    except CheckFailed as e:
        print(f"FAILED: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
