"""Build the frontend mock fixtures for the Hoa Lich Explore / Compare / Data Notes screens.

Two kinds of fixtures are written to ``frontend/src/mocks/fixtures``:

* ``backend``: responses captured verbatim from a running backend (``--api``) for every endpoint that
  exists in the backend today (metadata, areas, map/cells, calendar, calendar/days, daily) plus a few
  real error responses.
* ``generated``: responses for endpoints that OpenAPI v0.4 defines but the backend does not implement
  yet (TASK 03B3: trends, seasonality, cell period-details; optional harmonization comparison). They are
  computed here from the same validated derived binaries, following the OpenAPI v0.4 schema and the
  backend rules (coverage clipping, origin from positive contributions / cell-day majority, baseline
  minimum sample size 5). Replace them with captured responses once TASK 03B3 is merged.

Every fixture is listed in ``index.json`` with its request and provenance. The frontend mock adapter
matches requests against that index; anything else is reported as "no mock fixture".

Usage (backend running on the committed snapshot):
    python tools/frontend/build_mock_fixtures.py --api http://localhost:8080
"""

from __future__ import annotations

import argparse
import calendar
import csv
import json
import statistics
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
DATASET = REPO / "backend" / "hoalich_data_v1" / "hoalich_data_v1"
OUT = REPO / "frontend" / "src" / "mocks" / "fixtures"

BBOX = {"west": "107", "south": "12", "east": "108", "north": "13"}
NATIONAL = {"areaType": "national", "areaId": "ToanQuoc"}
TAY_NGUYEN = {"areaType": "diagnostic_region", "areaId": "TayNguyen"}
EMPTY_BBOX = {"west": "100", "south": "0", "east": "101", "north": "1"}

ORIGIN_BY_CODE = {1: "MODEL_REDISTRIBUTED", 2: "MODEL_REDISTRIBUTED", 3: "DIRECT_OBSERVATION", 4: "SCALED_OBSERVATION"}
SOURCE_BY_CODE = {1: "TERRA", 2: "AQUA", 3: "SNPP", 4: "NOAA20"}


# --------------------------------------------------------------------------- live backend capture

def fetch(api: str, path: str, query: dict[str, str]) -> tuple[int, dict]:
    url = api.rstrip("/") + "/api/v1" + path
    if query:
        url += "?" + urllib.parse.urlencode(query)
    try:
        with urllib.request.urlopen(url, timeout=60) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read().decode("utf-8"))


# --------------------------------------------------------------------------- dataset access

class Cube:
    def __init__(self) -> None:
        manifest = json.loads((DATASET / "derived" / "dataset-manifest.json").read_text(encoding="utf-8"))
        self.manifest = manifest
        days = manifest["dateRange"]["dayCount"]
        cells = manifest["grid"]["cellCount"]
        derived = DATASET / "derived"
        self.values = np.fromfile(derived / "daily-values.f32", "<f4").reshape(days, cells).astype(np.float64)
        self.sources = np.fromfile(derived / "daily-source.u8", "u1").reshape(days, cells)
        self.inputs = np.fromfile(derived / "daily-input-count.i16", "<i2").reshape(days, cells).astype(np.int64)
        self.valid = np.fromfile(derived / "daily-source-input-valid.u8", "u1").reshape(days, cells)
        self.start = date.fromisoformat(manifest["dateRange"]["start"])
        self.end = date.fromisoformat(manifest["dateRange"]["end"])
        self.cell_ids = manifest["grid"]["cellIds"]
        self.index = {cell: i for i, cell in enumerate(self.cell_ids)}

    def coverage(self, requested_start: date, requested_end: date) -> dict:
        expected = (requested_end - requested_start).days + 1
        covered_start = max(requested_start, self.start)
        covered_end = min(requested_end, self.end)
        if covered_end < covered_start:
            return {
                "requestedStartDate": requested_start.isoformat(), "requestedEndDate": requested_end.isoformat(),
                "coveredStartDate": None, "coveredEndDate": None,
                "expectedDayCount": expected, "coveredDayCount": 0, "uncoveredDayCount": expected, "partial": True,
            }
        covered = (covered_end - covered_start).days + 1
        return {
            "requestedStartDate": requested_start.isoformat(), "requestedEndDate": requested_end.isoformat(),
            "coveredStartDate": covered_start.isoformat(), "coveredEndDate": covered_end.isoformat(),
            "expectedDayCount": expected, "coveredDayCount": covered, "uncoveredDayCount": expected - covered,
            "partial": covered < expected,
        }

    def composition(self, cells: list[str], first: date, last: date) -> tuple[float, list[dict]]:
        cols = [self.index[c] for c in cells]
        i, j = (first - self.start).days, (last - self.start).days + 1
        values = self.values[i:j][:, cols]
        sources = self.sources[i:j][:, cols]
        total = float(values.sum(axis=1).sum())
        out = []
        for code in (1, 2, 3, 4):
            mask = sources == code
            if not mask.any():
                continue
            out.append({
                "sourceCode": code,
                "source": SOURCE_BY_CODE[code],
                "origin": ORIGIN_BY_CODE[code],
                "cellCount": int(mask.any(axis=0).sum()),
                "contributingCellDayCount": int(mask.sum()),
                "harmonizedValue": round(float(values[mask].sum()), 6),
                "inputObservationCount": int(self.inputs[i:j][:, cols][mask].sum()),
                "sourceInputValidCellCount": int(self.valid[i:j][:, cols][mask].sum()),
            })
        return round(total, 6), out


def resolve_origin(sources: list[dict]) -> str:
    positive = [s for s in sources if s["harmonizedValue"] > 0]
    if positive:
        origins = {s["origin"] for s in positive}
        return origins.pop() if len(origins) == 1 else "MIXED"
    by_origin: dict[str, int] = {}
    for s in sources:
        by_origin[s["origin"]] = by_origin.get(s["origin"], 0) + s["contributingCellDayCount"]
    ranked = sorted(by_origin.items(), key=lambda item: -item[1])
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return "MIXED"
    return ranked[0][0]


def period_range(year: int, granularity: str, period: int | None) -> tuple[date, date]:
    if granularity == "year":
        return date(year, 1, 1), date(year, 12, 31)
    if granularity == "month":
        return date(year, period, 1), date(year, period, calendar.monthrange(year, period)[1])
    start = date(year, 1, 1) + timedelta(days=(period - 1) * 5)
    end = date(year, 12, 31) if period == 73 else start + timedelta(days=4)
    return start, end


def aggregate_warnings(selection: dict, partial: bool, sources: list[dict], last_covered: str | None) -> list[str]:
    warnings = []
    if partial:
        warnings.append("PARTIAL_PERIOD")
    codes = {s["sourceCode"] for s in sources}
    if 1 in codes:
        warnings.append("TERRA_EARLY_PERIOD_HIGHER_UNCERTAINTY")
    if selection.get("area", {}).get("type") == "diagnostic_region":
        warnings.append("DIAGNOSTIC_REGION_NOT_ADMIN_BOUNDARY")
    if 2 in codes and last_covered is not None and last_covered >= "2022-01-01":
        warnings.append("AQUA_FALLBACK_AFTER_ORBIT_DRIFT")
    return warnings


def meta(base_meta: dict, warnings: list[str]) -> dict:
    return {**base_meta, "warnings": warnings}


def generated_trends(cube: Cube, selection: dict, base_meta: dict, granularity: str, period: int | None,
                     start_year: int, end_year: int) -> dict:
    points, all_warnings = [], []
    for year in range(start_year, end_year + 1):
        first, last = period_range(year, granularity, period)
        coverage = cube.coverage(first, last)
        point = {"year": year}
        if granularity != "year":
            point["period"] = period
        if coverage["coveredDayCount"] == 0:
            point.update({"value": None, "valueStatus": "OUTSIDE_DATASET_RANGE", "partial": False,
                          "origin": None, "coverage": coverage})
        else:
            total, sources = cube.composition(
                selection["cellIds"], date.fromisoformat(coverage["coveredStartDate"]),
                date.fromisoformat(coverage["coveredEndDate"]))
            point.update({"value": total, "valueStatus": "AVAILABLE", "partial": coverage["partial"],
                          "origin": resolve_origin(sources), "coverage": coverage})
            for w in aggregate_warnings(selection, coverage["partial"], sources, coverage["coveredEndDate"]):
                if w not in all_warnings:
                    all_warnings.append(w)
        points.append(point)
    response = {"selection": selection, "granularity": granularity}
    if granularity != "year":
        response["period"] = period
    response.update({"points": points, "meta": meta(base_meta, all_warnings)})
    return response


def generated_seasonality(cube: Cube, selection: dict, base_meta: dict, granularity: str,
                          start_year: int = 2003, end_year: int = 2025) -> dict:
    count = 12 if granularity == "month" else 73
    periods, all_warnings = [], []
    for period in range(1, count + 1):
        samples = []
        for year in range(start_year, end_year + 1):
            first, last = period_range(year, granularity, period)
            coverage = cube.coverage(first, last)
            if coverage["coveredDayCount"] == 0 or coverage["partial"]:
                continue
            total, sources = cube.composition(selection["cellIds"], first, last)
            samples.append(total)
            for w in aggregate_warnings(selection, False, sources, coverage["coveredEndDate"]):
                if w not in all_warnings:
                    all_warnings.append(w)
        if len(samples) < 5:
            periods.append({"period": period, "sampleSize": len(samples), "mean": None, "median": None,
                            "valueStatus": "INSUFFICIENT_BASELINE"})
        else:
            periods.append({"period": period, "sampleSize": len(samples),
                            "mean": round(statistics.fmean(samples), 6),
                            "median": round(statistics.median(samples), 6), "valueStatus": "AVAILABLE"})
    return {"selection": selection, "granularity": granularity, "referenceStartYear": start_year,
            "referenceEndYear": end_year, "minimumSampleSize": 5, "periods": periods,
            "meta": meta(base_meta, all_warnings)}


def generated_period_details(cube: Cube, cell: dict, base_meta: dict, query: dict[str, str]) -> dict:
    if "date" in query:
        day = date.fromisoformat(query["date"])
        selector = {"type": "DATE", "date": day.isoformat(), "startDate": day.isoformat(), "endDate": day.isoformat()}
        first, last = day, day
    elif "month" in query:
        year, month = int(query["year"]), int(query["month"])
        first, last = period_range(year, "month", month)
        selector = {"type": "MONTH", "year": year, "month": month,
                    "startDate": first.isoformat(), "endDate": last.isoformat()}
    elif "pentad" in query:
        year, pentad = int(query["year"]), int(query["pentad"])
        first, last = period_range(year, "pentad", pentad)
        selector = {"type": "PENTAD", "year": year, "pentad": pentad,
                    "startDate": first.isoformat(), "endDate": last.isoformat()}
    else:
        year = int(query["year"])
        first, last = period_range(year, "year", None)
        selector = {"type": "YEAR", "year": year, "startDate": first.isoformat(), "endDate": last.isoformat()}
    coverage = cube.coverage(first, last)
    selector["coverage"] = coverage
    response = {"cell": cell, "temporalSelector": selector}
    if coverage["coveredDayCount"] == 0:
        response.update({"value": None, "valueStatus": "OUTSIDE_DATASET_RANGE", "origin": None,
                         "sourceComposition": [], "meta": meta(base_meta, [])})
        return response
    total, sources = cube.composition(
        [cell["id"]], date.fromisoformat(coverage["coveredStartDate"]), date.fromisoformat(coverage["coveredEndDate"]))
    warnings = aggregate_warnings({}, coverage["partial"], sources, coverage["coveredEndDate"])
    if selector["type"] == "DATE":
        if any(s["sourceCode"] in (1, 2) for s in sources):
            warnings.append("MODEL_REDISTRIBUTED_DAILY_VALUE")
        warnings.append("NO_DAILY_UNCERTAINTY_INTERVAL")
        if first == cube.end:
            warnings.insert(0, "DATASET_EDGE_DATE")
    response.update({"value": total, "valueStatus": "AVAILABLE", "origin": resolve_origin(sources),
                     "sourceComposition": sources, "meta": meta(base_meta, warnings)})
    return response


def generated_harmonization_comparison(base_meta: dict) -> dict:
    rows = list(csv.DictReader((DATASET / "tables" / "harmonized_national_year.csv").open(encoding="utf-8")))

    def series(series_type: str, column: str, label: str, metric: str, unit: str, cast) -> dict:
        return {"seriesType": series_type, "label": label, "metric": metric, "unit": unit,
                "points": [{"year": int(r["year"]), "value": cast(r[column]) if r[column] != "" else None}
                           for r in rows]}

    return {
        "series": [
            series("HARMONIZED", "hai_hoa_snpp_eq", "Chuỗi đã hài hòa (toàn quốc, theo năm)", "snpp_eq",
                   "S-NPP-equivalent daytime detections", float),
            series("RAW_MODIS", "aqua_tho_ngay", "MODIS Aqua thô, ban ngày, đã lọc nguồn tĩnh",
                   "raw_detections_aqua_day", "Aqua daytime detections", int),
            series("RAW_VIIRS_SNPP", "snpp_tho_ngay", "VIIRS S-NPP thô, ban ngày, đã lọc nguồn tĩnh",
                   "raw_detections_snpp_day", "S-NPP daytime detections", int),
            series("RAW_MERGED_REFERENCE", "ghep_tho_moi_ve_tinh",
                   "Cộng thô mọi vệ tinh (chỉ để tham khảo, không so sánh được)",
                   "raw_detections_all_satellites", "detections (not comparable)", int),
        ],
        "explanationKeys": ["RAW_SERIES_NOT_COMPARABLE", "HARMONIZED_SNPP_EQ_NOT_FIRE_COUNT",
                            "PARTIAL_YEARS_2000_2026"],
        "meta": meta(base_meta, ["PARTIAL_PERIOD"]),
    }


# --------------------------------------------------------------------------- main

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://localhost:8080")
    args = parser.parse_args()

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.json"):
        old.unlink()
    commit = subprocess.run(["git", "-C", str(REPO), "rev-parse", "--short", "HEAD"],
                            capture_output=True, text=True, check=True).stdout.strip()
    index: list[dict] = []

    def save(name: str, path: str, query: dict[str, str], status: int, body: dict, provenance: str) -> dict:
        (OUT / f"{name}.json").write_text(
            json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        index.append({"file": name, "path": path, "query": query, "status": status, "provenance": provenance})
        return body

    def live(name: str, path: str, query: dict[str, str] | None = None, expect: int = 200) -> dict:
        query = query or {}
        status, body = fetch(args.api, path, query)
        if status != expect:
            raise SystemExit(f"{name}: expected HTTP {expect}, got {status}: {body}")
        return save(name, path, query, status, body, f"backend@{commit}")

    metadata = live("metadata", "/metadata")
    areas = live("areas", "/areas")

    # Golden bounding box of Document 08 (13 Tay Nguyen cells).
    bbox_year = live("map-bbox-2024", "/map/cells", {**BBOX, "year": "2024"})
    live("map-bbox-2024-p15", "/map/cells", {**BBOX, "year": "2024", "pentad": "15"})
    live("map-bbox-2026", "/map/cells", {**BBOX, "year": "2026"})
    # Every month of the demo year (Explore) and of 2005 (Compare March 2005 vs 2024 and other months).
    for year in (2024, 2005):
        for month in range(1, 13):
            live(f"map-bbox-{year}-{month:02d}", "/map/cells", {**BBOX, "year": str(year), "month": str(month)})
    for month in range(1, 13):
        live(f"days-bbox-2024-{month:02d}", "/calendar/days", {**BBOX, "year": "2024", "month": str(month)})
    live("map-bbox-2026-11", "/map/cells", {**BBOX, "year": "2026", "month": "11"})
    live("days-bbox-2026-11", "/calendar/days", {**BBOX, "year": "2026", "month": "11"})
    # Every clickable day of March 2024 and of the partial November 2026.
    demo_days = [date(2024, 3, d) for d in range(1, 32)] + [date(2026, 11, d) for d in range(1, 14)]
    for day in demo_days:
        iso = day.isoformat()
        live(f"map-bbox-{iso}", "/map/cells", {**BBOX, "date": iso})
        live(f"daily-bbox-{iso}", "/daily", {**BBOX, "date": iso, "includeCells": "false"})
    live("calendar-bbox-2024-month", "/calendar",
         {**BBOX, "year": "2024", "granularity": "month", "includeBaseline": "true"})
    live("calendar-bbox-2024-pentad", "/calendar",
         {**BBOX, "year": "2024", "granularity": "pentad", "includeBaseline": "true"})
    live("calendar-bbox-2026-month", "/calendar",
         {**BBOX, "year": "2026", "granularity": "month", "includeBaseline": "true"})

    # Named areas.
    # The Explore flow starts at ToanQuoc: every month of 2024, the partial 2026 and its November.
    for month in range(1, 13):
        live(f"map-national-2024-{month:02d}", "/map/cells", {**NATIONAL, "year": "2024", "month": str(month)})
        live(f"days-national-2024-{month:02d}", "/calendar/days", {**NATIONAL, "year": "2024", "month": str(month)})
    live("map-national-2024-p15", "/map/cells", {**NATIONAL, "year": "2024", "pentad": "15"})
    live("map-national-2024-03-18", "/map/cells", {**NATIONAL, "date": "2024-03-18"})
    live("map-national-2026", "/map/cells", {**NATIONAL, "year": "2026"})
    live("map-national-2026-11", "/map/cells", {**NATIONAL, "year": "2026", "month": "11"})
    live("days-national-2026-11", "/calendar/days", {**NATIONAL, "year": "2026", "month": "11"})
    for year in (2024, 2026):
        live(f"calendar-national-{year}-month", "/calendar",
             {**NATIONAL, "year": str(year), "granularity": "month", "includeBaseline": "true"})
    live("calendar-national-2024-pentad", "/calendar",
         {**NATIONAL, "year": "2024", "granularity": "pentad", "includeBaseline": "true"})
    live("daily-national-2024-03-18", "/daily", {**NATIONAL, "date": "2024-03-18", "includeCells": "false"})
    live("map-taynguyen-2024-03", "/map/cells", {**TAY_NGUYEN, "year": "2024", "month": "3"})
    live("calendar-taynguyen-2024-month", "/calendar",
         {**TAY_NGUYEN, "year": "2024", "granularity": "month", "includeBaseline": "true"})
    live("days-taynguyen-2024-03", "/calendar/days", {**TAY_NGUYEN, "year": "2024", "month": "3"})

    # Real error responses.
    live("error-date-outside-range", "/daily", {**BBOX, "date": "2026-11-14", "includeCells": "false"}, expect=422)
    live("error-no-cells-in-bounds", "/map/cells", {**EMPTY_BBOX, "year": "2024"}, expect=422)
    live("error-invalid-temporal-selector", "/map/cells", {**BBOX, "year": "2024", "month": "3", "pentad": "2"},
         expect=400)

    # Endpoints not implemented by the backend yet (TASK 03B3): generated from the same binaries.
    cube = Cube()
    base_meta = {k: v for k, v in metadata["meta"].items() if k != "warnings"}
    bbox_selection = bbox_year["selection"]
    named_selection = live("map-national-2024", "/map/cells", {**NATIONAL, "year": "2024"})["selection"]
    generated = f"generated:tools/frontend/build_mock_fixtures.py@{commit}"

    for month in range(1, 13):
        save(f"trends-bbox-month-{month}", "/trends",
             {**BBOX, "startYear": "2000", "endYear": "2026", "granularity": "month", "period": str(month)}, 200,
             generated_trends(cube, bbox_selection, base_meta, "month", month, 2000, 2026), generated)
    for month in range(1, 13):
        save(f"trends-national-month-{month}", "/trends",
             {**NATIONAL, "startYear": "2000", "endYear": "2026", "granularity": "month", "period": str(month)}, 200,
             generated_trends(cube, named_selection, base_meta, "month", month, 2000, 2026), generated)
    save("trends-national-pentad-15", "/trends",
         {**NATIONAL, "startYear": "2000", "endYear": "2026", "granularity": "pentad", "period": "15"}, 200,
         generated_trends(cube, named_selection, base_meta, "pentad", 15, 2000, 2026), generated)
    save("seasonality-national-pentad", "/seasonality",
         {**NATIONAL, "granularity": "pentad", "startYear": "2003", "endYear": "2025"}, 200,
         generated_seasonality(cube, named_selection, base_meta, "pentad"), generated)
    for selection, spatial, label in ((bbox_selection, BBOX, "bbox"), (named_selection, NATIONAL, "national")):
        save(f"trends-{label}-year", "/trends",
             {**spatial, "startYear": "2000", "endYear": "2026", "granularity": "year"}, 200,
             generated_trends(cube, selection, base_meta, "year", None, 2000, 2026), generated)
        save(f"seasonality-{label}-month", "/seasonality",
             {**spatial, "granularity": "month", "startYear": "2003", "endYear": "2025"}, 200,
             generated_seasonality(cube, selection, base_meta, "month"), generated)
    save("trends-bbox-pentad-15", "/trends",
         {**BBOX, "startYear": "2000", "endYear": "2026", "granularity": "pentad", "period": "15"}, 200,
         generated_trends(cube, bbox_selection, base_meta, "pentad", 15, 2000, 2026), generated)
    save("seasonality-bbox-pentad", "/seasonality",
         {**BBOX, "granularity": "pentad", "startYear": "2003", "endYear": "2025"}, 200,
         generated_seasonality(cube, bbox_selection, base_meta, "pentad"), generated)

    cells_by_id = {item["id"]: item for item in areas["items"] if item["type"] == "cell"}
    for cell_id in bbox_selection["cellIds"]:
        cell = cells_by_id[cell_id]
        queries = [("2024", {"year": "2024"}), ("2024-p15", {"year": "2024", "pentad": "15"}),
                   ("2024-03-18", {"date": "2024-03-18"}), ("2005-03", {"year": "2005", "month": "3"}),
                   ("2026-11", {"year": "2026", "month": "11"}), ("2026-11-13", {"date": "2026-11-13"})]
        queries += [(f"2024-{m:02d}", {"year": "2024", "month": str(m)}) for m in range(1, 13)]
        for suffix, query in queries:
            save(f"cell-{cell_id}-{suffix}", f"/cells/{cell_id}/period-details", query, 200,
                 generated_period_details(cube, cell, base_meta, query), generated)

    save("harmonization-comparison", "/harmonization/comparison", {}, 200,
         generated_harmonization_comparison(base_meta), generated)

    (OUT.parent / "index.json").write_text(
        json.dumps({"generatedFromCommit": commit, "fixtures": index}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    print(f"wrote {len(index)} fixtures to {OUT}")


if __name__ == "__main__":
    main()
