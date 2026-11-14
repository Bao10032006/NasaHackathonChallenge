#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HỎA LỊCH - pipeline dữ liệu sạch và hiệu chuẩn MODIS -> tương đương S-NPP VIIRS
(NASA FIRMS, Việt Nam). Chỉ cần numpy + pandas.

Chạy:
    python hoalich_pipeline.py --raw <thư mục chứa 4 tệp zip hoặc JSON FIRMS> --out <thư mục kết quả>

Các bước:
  1. Nạp 4 sản phẩm FIRMS (MODIS C6.1, VIIRS S-NPP / NOAA-20 / NOAA-21), cả archive và NRT.
  2. Chuẩn hóa cột, gắn cờ nguồn tĩnh bằng mặt nạ 0,01 độ dựng từ type 2/3 của phần archive.
  3. Đếm theo ô 0,25 độ x ngày cho từng vệ tinh (ban ngày, đã lọc nguồn tĩnh).
  4. Dò mất dữ liệu: toàn quốc (chuỗi ngày) và cục bộ theo dải vĩ độ (VIIRS thiếu một lượt bay).
  5. Hiệu chuẩn Aqua -> S-NPP ở mức ô x tháng; kiểm định hai chiều, cuốn chiếu và bỏ-một-năm.
  6. Phân bổ tổng tháng xuống ngày/pentad; lập bảng bất định theo mức đếm.
  7. Xuất chuỗi hài hòa 2000-2026, summary.json và các bảng cho nhóm.

Đơn vị chuẩn: số phát hiện BAN NGÀY, đã lọc nguồn tĩnh, tương đương MỘT cảm biến VIIRS
quỹ đạo 13:30 (S-NPP). Ngày tính theo acq_date của FIRMS (UTC).
Xem README.md để biết định nghĩa cột và kết quả kiểm định.
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import os
import sys
import zipfile

import numpy as np
import pandas as pd

VERSION = "1.0"
GRID = 0.25            # độ, lưới hiệu chuẩn
MASK_RES = 0.01        # độ, mặt nạ nguồn tĩnh
SATS = ["Terra", "Aqua", "SNPP", "N20", "N21"]
SAT_MAP = {
    "terra": "Terra", "t": "Terra", "aqua": "Aqua", "a": "Aqua",
    "snpp": "SNPP", "n": "SNPP", "npp": "SNPP", "suomi npp": "SNPP", "suomi-npp": "SNPP",
    "n20": "N20", "1": "N20", "noaa-20": "N20", "noaa20": "N20", "j1": "N20",
    "n21": "N21", "2": "N21", "noaa-21": "N21", "noaa21": "N21", "j2": "N21",
}
REGION_NAMES = ["Khac", "TayBac", "DBSH", "TayNguyen", "DBSCL"]
CAL_START, CAL_END = (2012, 2), (2021, 12)        # giai đoạn hiệu chuẩn Aqua -> S-NPP (quỹ đạo Aqua ổn định)
TA_START, TA_END = (2003, 1), (2007, 12)          # giai đoạn nối Terra -> Aqua (gần 2000-2002 nhất)
AQUA_ERA_START = (2002, 8)                        # tháng đầy đủ đầu tiên của Aqua
DIRECTIONS = [("doan_nguoc", (2017, 2021), (2012, 2016)), ("doan_xuoi", (2012, 2016), (2017, 2021))]
ROLLING = [((2013, 2014), [(2015, 2016), (2015, 2018), (2015, 2021)]),      # đích ở đầu chuỗi, cửa sổ huấn luyện dài dần
           ((2020, 2021), [(2018, 2019), (2016, 2019), (2012, 2019)])]      # đích ở cuối chuỗi
REF_ORDER = {"Aqua": ["SNPP", "N20", "Terra"], "Terra": ["Aqua", "SNPP", "N20"], "SNPP": ["N20", "N21", "Aqua"],
             "N20": ["SNPP", "N21", "Aqua"], "N21": ["N20", "SNPP", "Aqua"]}
YB = np.array([1, 3, 6, 11, 21, 51, 101, 301])      # mép khoảng của số phát hiện vệ tinh tham chiếu
BAND_EDGES = [13.5, 18.5]                            # ba dải vĩ độ: Nam, Trung, Bắc (xấp xỉ một granule VIIRS)
BINS = np.array([0, 1, 3, 10, 30, 100, 300, 1000, np.inf])
SEASONS = {
    1: np.zeros(12, dtype=int),
    2: np.array([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1]),            # khô (1-5) / mưa (6-12)
    4: np.array([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3]),            # theo quý
}


def log(msg):
    print(msg, flush=True)


# --------------------------------------------------------------------------- 1. NẠP VÀ CHUẨN HÓA
def region_index(lat, lon):
    """Vùng chẩn đoán theo khung chữ nhật (không phải ranh giới hành chính)."""
    lat = np.asarray(lat)
    lon = np.asarray(lon)
    r = np.zeros(len(lat), dtype=np.int8)
    r[(lat >= 20.3) & (lat <= 23.0) & (lon >= 102.1) & (lon < 104.9)] = 1
    r[(lat >= 19.9) & (lat <= 21.4) & (lon >= 105.4) & (lon <= 107.1)] = 2
    r[(lat >= 11.2) & (lat <= 15.5) & (lon >= 107.0) & (lon <= 109.0)] = 3
    r[(lat >= 8.5) & (lat < 11.0) & (lon >= 104.4) & (lon <= 106.9)] = 4
    return r


def _to_frame(recs, src):
    df = pd.DataFrame.from_records(recs)
    out = pd.DataFrame({
        "lat": pd.to_numeric(df["latitude"]).astype("float64").values,
        "lon": pd.to_numeric(df["longitude"]).astype("float64").values,
    })
    hhmm = df["acq_time"].astype(str).str.replace(":", "", regex=False).str.zfill(4)
    out["dt"] = pd.to_datetime(df["acq_date"].astype(str) + " " + hhmm, format="%Y-%m-%d %H%M").values
    sat_raw = df["satellite"].astype(str).str.strip().str.lower()
    sat = sat_raw.map(SAT_MAP)
    if sat.isna().any():
        raise ValueError("Tên vệ tinh lạ: %s" % sorted(sat_raw[sat.isna()].unique()))
    out["sat"] = sat.values
    out["dn"] = df["daynight"].astype(str).str.upper().str[0].values
    out["frp"] = pd.to_numeric(df["frp"], errors="coerce").astype("float32").values
    conf_raw = df["confidence"].astype(str).str.strip().str.lower()
    conf_num = pd.to_numeric(conf_raw, errors="coerce")
    conf = conf_raw.str[0]
    is_num = conf_num.notna()
    conf = conf.where(~is_num, np.where(conf_num < 30, "l", np.where(conf_num < 80, "n", "h")))
    out["conf"] = conf.values
    out["conf_modis"] = conf_num.astype("float32").values
    if "type" in df.columns:
        out["type"] = pd.to_numeric(df["type"], errors="coerce").fillna(-1).astype("int8").values
    else:
        out["type"] = np.int8(-1)
    out["src"] = src
    out["version"] = df["version"].astype(str).values if "version" in df.columns else ""
    for name, cands in (("scan", ["scan"]), ("track", ["track"]),
                        ("bright", ["brightness", "bright_ti4"]), ("bright31", ["bright_t31", "bright_ti5"])):
        col = next((c for c in cands if c in df.columns), None)
        out[name] = pd.to_numeric(df[col], errors="coerce").astype("float32").values if col else np.float32(np.nan)
    return out


def load_points(raw_dir):
    """Đọc mọi fire_archive_*.json / fire_nrt_*.json trong thư mục (kể cả nằm trong tệp zip)."""
    frames, inputs, seen = [], [], set()

    def take(name, fobj, where):
        base = os.path.basename(name)
        low = base.lower()
        if not (low.endswith(".json") and (low.startswith("fire_archive") or low.startswith("fire_nrt"))):
            return
        if low in seen:
            log("  bỏ qua bản trùng: %s (%s)" % (base, where))
            return
        seen.add(low)
        recs = json.load(fobj)
        src = "archive" if "archive" in low else "nrt"
        fr = _to_frame(recs, src)
        del recs
        frames.append(fr)
        inputs.append({"file": base, "from": os.path.basename(where), "rows": int(len(fr)),
                       "sats": sorted(fr["sat"].unique().tolist())})
        log("  %-34s %9d dòng  %s" % (base, len(fr), inputs[-1]["sats"]))

    for p in sorted(glob.glob(os.path.join(raw_dir, "**", "*"), recursive=True)):
        if os.path.isdir(p):
            continue
        if p.lower().endswith(".zip"):
            with zipfile.ZipFile(p) as z:
                for name in z.namelist():
                    with z.open(name) as fh:
                        take(name, fh, p)
        else:
            low = os.path.basename(p).lower()
            if low.endswith(".json") and (low.startswith("fire_archive") or low.startswith("fire_nrt")):
                with open(p, "rb") as fh:
                    take(p, fh, p)
    if not frames:
        raise SystemExit("Không thấy fire_archive_*.json / fire_nrt_*.json trong %s" % raw_dir)
    df = pd.concat(frames, ignore_index=True)
    del frames
    ndup = int(df.duplicated(subset=["lat", "lon", "dt", "sat"]).sum())
    if ndup:
        log("  loại %d bản ghi trùng (lat, lon, dt, sat)" % ndup)
        df = df.drop_duplicates(subset=["lat", "lon", "dt", "sat"]).reset_index(drop=True)
    return df, inputs, ndup


def add_derived(df):
    d = df["dt"].dt
    df["date"] = df["dt"].dt.floor("D")
    df["year"] = d.year.astype("int16")
    df["month"] = d.month.astype("int8")
    doy = d.dayofyear.values
    df["pentad"] = (np.minimum((doy - 1) // 5, 72) + 1).astype("int8")
    df["lst"] = ((d.hour + d.minute / 60.0 + df["lon"] / 15.0) % 24).astype("float32")
    df["cy"] = np.floor(df["lat"].values / GRID).astype("int32")
    df["cx"] = np.floor(df["lon"].values / GRID).astype("int32")
    df["region"] = region_index(df["lat"].values, df["lon"].values)
    df["sat_i"] = df["sat"].map({s: i for i, s in enumerate(SATS)}).astype("int8")
    df["dn_i"] = (df["dn"] == "N").astype("int8")
    return df


# --------------------------------------------------------------------------- 2. MẶT NẠ NGUỒN TĨNH
def static_mask(df):
    """Ô 0,01 độ từng có phát hiện type 2 (nguồn tĩnh trên đất liền) hoặc type 3 (ngoài khơi).
    Phần NRT không có type nên mọi điểm (archive lẫn NRT) rơi vào các ô này đều bị coi là nguồn tĩnh."""
    iy = np.round(df["lat"].values / MASK_RES).astype(np.int64)
    ix = np.round(df["lon"].values / MASK_RES).astype(np.int64)
    key = iy * 100000 + ix
    st = df["type"].isin([2, 3]).values
    mk = pd.DataFrame({"key": key[st], "iy": iy[st], "ix": ix[st], "type": df["type"].values[st],
                       "sat": df["sat"].values[st]})
    tab = mk.groupby("key").agg(iy=("iy", "first"), ix=("ix", "first"),
                                n_type2=("type", lambda s: int((s == 2).sum())),
                                n_type3=("type", lambda s: int((s == 3).sum())),
                                sats=("sat", lambda s: "|".join(sorted(set(s))))).reset_index(drop=True)
    tab.insert(0, "lat", (tab["iy"] * MASK_RES).round(2))
    tab.insert(1, "lon", (tab["ix"] * MASK_RES).round(2))
    df["static"] = np.isin(key, np.unique(key[st]))
    return df, tab.sort_values(["n_type2", "n_type3"], ascending=False).reset_index(drop=True)


# --------------------------------------------------------------------------- 3. TRỤC THỜI GIAN, Ô LƯỚI, MA TRẬN NGÀY
def time_axes(d0, d1):
    days = pd.date_range(d0, d1, freq="D")
    year = days.year.values
    month = days.month.values
    doy = days.dayofyear.values
    pent = np.minimum((doy - 1) // 5, 72) + 1
    m_idx = (year * 12 + month - 1)
    m_idx = m_idx - m_idx[0]
    p_idx = (year - year[0]) * 73 + (pent - 1)
    p_idx = p_idx - p_idx[0]
    m_start = np.flatnonzero(np.r_[True, np.diff(m_idx) != 0])
    p_start = np.flatnonzero(np.r_[True, np.diff(p_idx) != 0])
    ax = dict(days=days, year=year, month=month, doy=doy, pent=pent, m_idx=m_idx, p_idx=p_idx,
              m_start=m_start, p_start=p_start, n=len(days),
              m_end=np.r_[m_start[1:], len(days)], p_end=np.r_[p_start[1:], len(days)])
    ax["m_year"] = year[m_start]
    ax["m_month"] = month[m_start]
    ax["m_ndays"] = ax["m_end"] - m_start
    ax["m_caldays"] = np.array([pd.Timestamp(year=int(y), month=int(m), day=1).days_in_month
                                for y, m in zip(ax["m_year"], ax["m_month"])])
    ax["p_year"] = year[p_start]
    ax["p_pent"] = pent[p_start]
    ax["p_ndays"] = ax["p_end"] - p_start
    return ax


def msum(Md, ax):
    return np.add.reduceat(Md, ax["m_start"], axis=0, dtype=np.float64)


def psum(Md, ax):
    return np.add.reduceat(Md, ax["p_start"], axis=0, dtype=np.float64)


def build_cells(df):
    key = df["cy"].values.astype(np.int64) * 100000 + df["cx"].values
    uk = np.unique(key)
    cy = (uk // 100000).astype(int)
    cx = (uk % 100000).astype(int)
    cells = pd.DataFrame({"cell": ["%d_%d" % (a, b) for a, b in zip(cy, cx)], "cy": cy, "cx": cx})
    cells["lat"] = (cells["cy"] + 0.5) * GRID
    cells["lon"] = (cells["cx"] + 0.5) * GRID
    cells["lat_s"] = cells["cy"] * GRID
    cells["lon_w"] = cells["cx"] * GRID
    cells["region"] = [REGION_NAMES[i] for i in region_index(cells["lat"].values, cells["lon"].values)]
    df["cell_i"] = np.searchsorted(uk, key).astype("int32")
    return df, cells


def daily_matrix(df, sel, ax, n_cells, d0):
    sub = df.loc[sel, ["date", "cell_i"]]
    di = ((sub["date"].values - np.datetime64(d0)) / np.timedelta64(1, "D")).astype(np.int64)
    M = np.zeros((ax["n"], n_cells), dtype=np.int16)
    np.add.at(M, (di, sub["cell_i"].values), 1)
    return M


def nb_sum(M, iy, ix, ny, nx, R):
    """Tổng trên các ô lân cận (cửa sổ (2R+1)x(2R+1), không tính ô trung tâm). M: (T, C)."""
    T = M.shape[0]
    G = np.zeros((T, ny + 2 * R, nx + 2 * R), dtype=np.float64)
    G[:, iy + R, ix + R] = M
    S = np.zeros_like(G)
    for dy in range(-R, R + 1):
        for dx in range(-R, R + 1):
            if dy == 0 and dx == 0:
                continue
            S[:, R:R + ny, R:R + nx] += G[:, R + dy:R + dy + ny, R + dx:R + dx + nx]
    return S[:, iy + R, ix + R]


# --------------------------------------------------------------------------- 4. ĐỢT MẤT DỮ LIỆU
def detect_outages(nat, rec, doy, sat, log10_p=-6.0, log10_p_self=-4.0, min_len=2):
    """Mất dữ liệu toàn quốc: chuỗi ngày liên tiếp vệ tinh `sat` không có phát hiện nào, trong khi xác suất
    'không thấy gì' (ước lượng thực nghiệm theo số phát hiện của vệ tinh tham chiếu cùng ngày) nhân dồn lại
    nhỏ hơn 10^log10_p. Cách này phân biệt được mất dữ liệu với những đợt mưa bão cả nước không có cháy.
    Khi chưa có vệ tinh tham chiếu (Terra trước 7/2002) thì dùng tần suất ngày-không của chính nó theo mùa."""
    n = len(nat[sat])
    idx = np.arange(n)
    inrec = {s: (idx >= rec[s][0]) & (idx <= rec[s][1]) for s in nat}
    x = nat[sat]
    first, last = rec[sat]
    excl = np.zeros(n, bool)
    runs = []
    for _ in range(2):
        logp = np.zeros(n)
        assigned = np.zeros(n, bool)
        selfday = np.zeros(n, bool)
        for ref in REF_ORDER[sat]:
            est = inrec[sat] & inrec[ref] & ~excl
            if est.sum() < 365:
                continue
            yb = np.digitize(nat[ref], YB)
            p0 = np.array([((x[est & (yb == k)] == 0).sum() + 0.5) / ((est & (yb == k)).sum() + 1.0) for k in range(len(YB) + 1)])
            use = inrec[sat] & inrec[ref] & ~assigned
            logp[use] = np.log10(p0[yb[use]])
            assigned |= use
        rest = inrec[sat] & ~assigned
        if rest.any():
            d = np.minimum(doy, 365) - 1
            est = inrec[sat] & ~excl
            zc = np.bincount(d[est], weights=(x[est] == 0).astype(float), minlength=365)
            c = np.bincount(d[est], minlength=365).astype(float)
            k = np.ones(15)
            p0d = (np.convolve(np.r_[zc[-7:], zc, zc[:7]], k, "valid") + 0.5) / (np.convolve(np.r_[c[-7:], c, c[:7]], k, "valid") + 1.0)
            logp[rest] = np.log10(p0d[d[rest]])
            selfday[rest] = True
        runs = []
        i = first
        while i <= last:
            if x[i] == 0:
                j = i
                while j + 1 <= last and x[j + 1] == 0:
                    j += 1
                lp = float(logp[i:j + 1].sum())
                thr = log10_p_self if selfday[i:j + 1].all() else log10_p
                if (j - i + 1) >= min_len and lp <= thr:
                    runs.append((i, j, j - i + 1, lp))
                i = j + 1
            else:
                i += 1
        excl[:] = False
        for (i, j, _L, _lp) in runs:
            excl[i:j + 1] = True
    return runs


def detect_band_gaps(Md, rec, valid_nat, band, target, p_max=0.02, y_min=6):
    """Mất dữ liệu cục bộ của VIIRS (thiếu một lượt bay/granule): trong một dải vĩ độ, vệ tinh `target` không có
    phát hiện ban ngày nào trong khi vệ tinh tham chiếu thấy >= y_min và xác suất thực nghiệm của việc đó <= p_max.
    Trả về cờ (ngày, dải)."""
    n = Md[target].shape[0]
    nb = int(band.max()) + 1
    idx = np.arange(n)
    X = np.stack([Md[target][:, band == k].sum(1, dtype=np.int64) for k in range(nb)], 1)
    in_t = (idx >= rec[target][0]) & (idx <= rec[target][1]) & valid_nat[target]
    flag = np.zeros((n, nb), bool)
    assigned = np.zeros(n, bool)
    for ref in REF_ORDER[target]:
        in_r = (idx >= rec[ref][0]) & (idx <= rec[ref][1]) & valid_nat[ref]
        est = in_t & in_r
        if est.sum() < 365:
            continue
        use = est & ~assigned
        Y = np.stack([Md[ref][:, band == k].sum(1, dtype=np.int64) for k in range(nb)], 1)
        yb = np.digitize(Y, YB)
        f = np.zeros((n, nb), bool)
        for _ in range(2):
            ok = est[:, None] & ~f & ~flag
            p0 = np.array([((X[ok & (yb == k)] == 0).sum() + 0.5) / ((ok & (yb == k)).sum() + 1.0) for k in range(len(YB) + 1)])
            f = use[:, None] & (X == 0) & (Y >= y_min) & (p0[yb] <= p_max)
        flag |= f
        assigned |= use
    return flag


# --------------------------------------------------------------------------- 5. MÔ HÌNH
def fit_global(A, V, W):
    return {"r": (W * V).sum() / (W * A).sum()}


def fit_monthly(A, V, W, month):
    r = np.array([(W[month == m] * V[month == m]).sum() / max((W[month == m] * A[month == m]).sum(), 1e-9) for m in range(1, 13)])
    return {"r": r}


def _spatial_prior(nc, dc, r_g, grid, k_nb):
    iy, ix, ny, nx, R = grid
    nn = nb_sum(nc[None, :], iy, ix, ny, nx, R)[0] + nc
    dn = nb_sum(dc[None, :], iy, ix, ny, nx, R)[0] + dc
    return (nn + k_nb * r_g) / (dn + k_nb)


def fit_cell_ratio(A, V, W, grid, k_cell=60.0, k_nb=20.0):
    """Phương án lùi: một tỉ số cho mỗi ô, co về tỉ số của vùng lân cận (5x5 ô) rồi về tỉ số toàn cục."""
    nc, dc = (W * V).sum(0), (W * A).sum(0)
    r_g = nc.sum() / dc.sum()
    prior = _spatial_prior(nc, dc, r_g, grid, k_nb)
    return {"r_g": float(r_g), "r_c": (nc + k_cell * prior) / (dc + k_cell)}


def fit_hurdle(A, V, W, month, som, grid, floor="clim", Anb=None, k_cell=60.0, k_season=60.0, k_nb=20.0, k_floor=2.0, legacy=False):
    """Hurdle có cấu trúc nhân.
    - Ô-tháng có nguồn > 0:  đích = r[ô, mùa] * nguồn   (tỉ số theo ô x mùa; co dần: ô x mùa -> ô -> lân cận 5x5 -> toàn cục)
    - Ô-tháng có nguồn = 0:  đích = g[ô, tháng] * X     (mức sàn)
         floor='clim': X = 1                -> trung bình của đích khi nguồn không thấy gì
         floor='nb'  : X = nguồn lân cận + 1 -> sàn tỉ lệ với hoạt động cháy quanh đó
    A (nguồn), V (đích), W (trọng số, 0 = bỏ qua): (T, C); month: (T,) 1..12; som: (12,) mã mùa của từng tháng."""
    S = int(som.max()) + 1
    seas = som[month - 1]
    pos = A > 0
    Wp = np.where(pos, W, 0.0)
    Wz = np.where(pos, 0.0, W)
    num_cs = np.stack([(Wp[seas == s] * V[seas == s]).sum(0) for s in range(S)])
    den_cs = np.stack([(Wp[seas == s] * A[seas == s]).sum(0) for s in range(S)])
    r_g = num_cs.sum() / den_cs.sum()
    r_s = num_cs.sum(1) / np.maximum(den_cs.sum(1), 1e-9)
    if legacy:
        r_cs = (num_cs + 20.0 * r_s[:, None]) / (den_cs + 20.0)
    else:
        nc, dc = num_cs.sum(0), den_cs.sum(0)
        r_c = (nc + k_cell * _spatial_prior(nc, dc, r_g, grid, k_nb)) / (dc + k_cell)
        r_cs = (num_cs + k_season * r_c[None, :] * (r_s[:, None] / r_g)) / (den_cs + k_season)
    X = (Anb + 1.0) if floor == "nb" else np.ones(A.shape)
    num_cm = np.stack([(Wz[month == m] * V[month == m]).sum(0) for m in range(1, 13)])
    den_cm = np.stack([(Wz[month == m] * X[month == m]).sum(0) for m in range(1, 13)])
    if legacy:
        g_cm = np.where(den_cm > 0, num_cm / np.maximum(den_cm, 1e-9), 0.0)
    else:
        num_s0 = np.stack([num_cm[som == s].sum(0) for s in range(S)])
        den_s0 = np.stack([den_cm[som == s].sum(0) for s in range(S)])
        g_s = num_s0.sum(1) / np.maximum(den_s0.sum(1), 1e-9)
        g_cs = (num_s0 + k_floor * g_s[:, None]) / (den_s0 + k_floor)
        g_cm = (num_cm + k_floor * g_cs[som]) / (den_cm + k_floor)
    return {"r_cs": r_cs, "g_cm": g_cm, "som": som, "floor": floor, "r_g": float(r_g), "r_s": r_s}


def predict_hurdle(par, A, Anb, month):
    r = par["r_cs"][par["som"][month - 1]]
    g = par["g_cm"][month - 1]
    X = (Anb + 1.0) if par["floor"] == "nb" else 1.0
    return np.where(A > 0, r * A, g * X)


# --------------------------------------------------------------------------- 6. CHỈ SỐ
def kge(o, s):
    if o.std() == 0 or o.mean() == 0 or s.std() == 0:
        return float("nan")
    r = np.corrcoef(o, s)[0, 1]
    return float(1 - math.sqrt((r - 1) ** 2 + (s.std() / o.std() - 1) ** 2 + (s.mean() / o.mean() - 1) ** 2))


def evaluate(pred, obs, years, reg_i):
    out = {"lech_toan_quoc_pct": 100 * (pred.sum() / obs.sum() - 1)}
    ae = [abs(pred[years == y].sum() / obs[years == y].sum() - 1) for y in np.unique(years)]
    out["sai_so_nam_tb_pct"] = 100 * float(np.mean(ae))
    out["kge"] = kge(obs.sum(1), pred.sum(1))
    out["rmse_o"] = float(np.sqrt(((pred - obs) ** 2).mean()))
    out["mae_o"] = float(np.abs(pred - obs).mean())
    out["r_o"] = float(np.corrcoef(pred.ravel(), obs.ravel())[0, 1])
    worst = 0.0
    for k, name in enumerate(REGION_NAMES):
        m = reg_i == k
        b = 100 * (pred[:, m].sum() / obs[:, m].sum() - 1)
        out["lech_%s_pct" % name] = float(b)
        worst = max(worst, abs(b))
    out["lech_vung_xau_nhat_pct"] = float(worst)
    return {k: float(v) for k, v in out.items()}


def shortest_window(x, frac):
    """Chuỗi pentad liên tiếp ngắn nhất chứa >= frac tổng cả năm. Trả về (bắt đầu, kết thúc), chỉ số từ 0."""
    tot = float(np.sum(x))
    if tot <= 0:
        return None
    n = len(x)
    cs = np.r_[0.0, np.cumsum(x)]
    best = None
    for i in range(n):
        k = int(np.searchsorted(cs, cs[i] + frac * tot - 1e-9, side="left"))
        if k <= n and k - 1 >= i:
            L = k - i
            if best is None or L < best[0]:
                best = (L, i, k - 1)
    return (best[1], best[2]) if best else None


def calendar_stats(Y, year_now=None):
    """Thống kê lịch đốt cho một vùng. Y: (số năm, 73) số phát hiện tương đương S-NPP theo pentad.
    Trả về khí hậu (trung vị, p10, p90), cửa sổ đốt nguy cấp (chứa 50% và 80% tổng năm của khí hậu trung bình)
    và, nếu có year_now (chỉ số hàng), cờ bất thường = pentad vượt p90 khí hậu của các năm còn lại."""
    Y = np.asarray(Y, float)
    clim_mean = Y.mean(0)
    out = {"clim_mean": clim_mean, "clim_median": np.median(Y, 0), "clim_p10": np.quantile(Y, 0.10, 0),
           "clim_p90": np.quantile(Y, 0.90, 0), "w50": shortest_window(clim_mean, 0.5),
           "w80": shortest_window(clim_mean, 0.8)}
    if year_now is not None:
        ref = np.delete(Y, year_now, axis=0)
        p90 = np.quantile(ref, 0.90, 0)
        out["anomaly"] = (Y[year_now] > np.maximum(p90, 1.0))
    return out


# --------------------------------------------------------------------------- 7. PHÂN BỔ XUỐNG NGÀY / PENTAD
def daily_clim(Vd, ax, day_sel, half=7):
    """Hồ sơ khí hậu theo ngày-trong-năm của từng ô (tổng S-NPP qua các năm được chọn, làm trơn +-half ngày)."""
    d = np.minimum(ax["doy"], 365) - 1
    C = Vd.shape[1]
    Cl = np.zeros((365, C))
    np.add.at(Cl, d[day_sel], Vd[day_sel].astype(np.float64))
    ext = np.concatenate([Cl[-half:], Cl, Cl[:half]], 0)
    cs = np.cumsum(np.concatenate([np.zeros((1, C)), ext], 0), 0)
    k = 2 * half + 1
    return cs[k:] - cs[:-k]


def allocate(Hm, Ad, clim, ax, months, kappa):
    """Chia tổng tháng Hm[j] xuống ngày: trọng số = Aqua của ngày + kappa x hồ sơ khí hậu (chuẩn hóa trong tháng).
    kappa = 0: chỉ theo Aqua; kappa = inf: chỉ theo khí hậu."""
    out = np.zeros(Ad.shape, dtype=np.float32)
    d365 = np.minimum(ax["doy"], 365) - 1
    for j in months:
        a, b = ax["m_start"][j], ax["m_end"][j]
        nd = b - a
        q = clim[d365[a:b]]
        qs = q.sum(0)
        q = np.where(qs > 0, q / np.where(qs > 0, qs, 1.0), 1.0 / nd)
        if np.isinf(kappa):
            w = q
        else:
            w = Ad[a:b].astype(np.float64) + kappa * q
            ws = w.sum(0)
            w = np.where(ws > 0, w / np.where(ws > 0, ws, 1.0), 1.0 / nd)
        out[a:b] = Hm[j][None, :] * w
    return out


# --------------------------------------------------------------------------- 8. BẤT ĐỊNH THEO MỨC ĐẾM
def ratio_table(pred, obs, qs=(0.05, 0.5, 0.95)):
    """Phân vị của (thực đo + 0,5) / (dự đoán + 0,5) theo khoảng giá trị dự đoán."""
    pred = np.asarray(pred, float).ravel()
    obs = np.asarray(obs, float).ravel()
    rho = (obs + 0.5) / (pred + 0.5)
    b = np.digitize(pred, BINS[1:-1])
    rows = []
    for i in range(len(BINS) - 1):
        m = b == i
        if m.sum() >= 30:
            q = np.quantile(rho[m], qs)
            rows.append([BINS[i], BINS[i + 1], int(m.sum()), float(q[0]), float(q[1]), float(q[2])])
        else:
            rows.append([BINS[i], BINS[i + 1], int(m.sum()), np.nan, np.nan, np.nan])
    tab = pd.DataFrame(rows, columns=["pred_lo", "pred_hi", "n", "q05", "q50", "q95"])
    tab[["q05", "q50", "q95"]] = tab[["q05", "q50", "q95"]].ffill().bfill()
    return tab


def apply_table(tab, pred):
    pred = np.asarray(pred, float)
    b = np.digitize(pred, BINS[1:-1])
    lo = np.maximum((pred + 0.5) * tab["q05"].values[b] - 0.5, 0.0)
    hi = np.maximum((pred + 0.5) * tab["q95"].values[b] - 0.5, 0.0)
    return lo, hi


def block_sum(M, blk, nb):
    out = np.zeros((M.shape[0], nb))
    np.add.at(out.T, blk, M.T)
    return out


# --------------------------------------------------------------------------- 9. CHUẨN BỊ DỮ LIỆU
def prepare(raw_dir, out_dir, drop_lowconf=False, save_points=False):
    """Nạp, làm sạch, xuất các bảng dữ liệu và trả về ngữ cảnh (ma trận ngày, cờ hợp lệ...) cho bước hiệu chuẩn."""
    T = os.path.join(out_dir, "tables")
    E = os.path.join(out_dir, "evidence")
    for d in (out_dir, T, E):
        os.makedirs(d, exist_ok=True)
    summary = {"pipeline_version": VERSION, "grid_deg": GRID, "mask_res_deg": MASK_RES,
               "unit": "so phat hien ban ngay, da loc nguon tinh, tuong duong mot VIIRS quy dao 13:30 (S-NPP)"}
    log("[1] Nạp dữ liệu từ %s" % raw_dir)
    df, inputs, ndup = load_points(raw_dir)
    df = add_derived(df)
    df, mask_tab = static_mask(df)
    df, cells = build_cells(df)
    n_cells = len(cells)
    satv = df["sat"].values
    veg = ~df["static"].values
    day = (df["dn"] == "D").values
    low = (df["conf"] == "l").values
    summary["inputs"] = inputs
    summary["counts"] = {"total": int(len(df)), "duplicates_removed": ndup,
                         "by_sat": {s: int((satv == s).sum()) for s in SATS},
                         "by_src": {k: int(v) for k, v in df["src"].value_counts().items()},
                         "date_min": str(df["dt"].min()), "date_max": str(df["dt"].max()),
                         "bbox": [float(df["lat"].min()), float(df["lat"].max()), float(df["lon"].min()), float(df["lon"].max())]}
    summary["static_mask"] = {
        "cells_001deg": int(len(mask_tab)),
        "share_static_day_pct": {s: round(100 * float((~veg)[day & (satv == s)].mean()), 2) for s in SATS},
        "share_static_all_pct": {s: round(100 * float((~veg)[satv == s].mean()), 2) for s in SATS}}
    summary["low_confidence_share_day_veg_pct"] = {s: round(100 * float(low[day & veg & (satv == s)].mean()), 2) for s in SATS}
    log("    tổng %d điểm, %d ô 0,25 độ, mặt nạ nguồn tĩnh %d ô 0,01 độ" % (len(df), n_cells, len(mask_tab)))
    mask_tab.to_csv(os.path.join(T, "static_mask_001.csv"), index=False)
    cells.to_csv(os.path.join(T, "cells_025.csv"), index=False)

    log("[2] Bảng lưới ô x tháng và ô x pentad")
    dd = pd.DataFrame({"cell_i": df["cell_i"].values, "year": df["year"].values, "month": df["month"].values,
                       "pentad": df["pentad"].values, "sat": satv, "dn": df["dn"].values,
                       "n": veg.astype(np.int32), "n_low": (veg & low).astype(np.int32),
                       "n_static": (~veg).astype(np.int32), "frp_sum": np.where(veg, df["frp"].values, 0.0)})
    summary["tables"] = {}
    for keys, fname in ((["cell_i", "year", "month", "sat", "dn"], "grid_025_month.csv"),
                        (["cell_i", "year", "pentad", "sat", "dn"], "grid_025_pentad.csv")):
        g = dd.groupby(keys, sort=True)[["n", "n_low", "n_static", "frp_sum"]].sum().reset_index()
        g.insert(0, "cell", cells["cell"].values[g["cell_i"].values])
        g = g.drop(columns="cell_i")
        g["frp_sum"] = g["frp_sum"].round(1)
        g.to_csv(os.path.join(T, fname), index=False)
        summary["tables"][fname] = {"rows": int(len(g)), "sum_n": int(g["n"].sum()), "sum_n_static": int(g["n_static"].sum())}
    del dd

    d0 = pd.Timestamp(df["date"].min()).replace(day=1)
    d1 = pd.Timestamp(df["date"].max())
    ax = time_axes(d0, d1)
    keep = veg & day
    if drop_lowconf:
        keep = keep & ~low
    Md = {s: daily_matrix(df, keep & (satv == s), ax, n_cells, d0) for s in SATS}
    iy = (cells["cy"] - cells["cy"].min()).values
    ix = (cells["cx"] - cells["cx"].min()).values
    ny, nx = int(iy.max()) + 1, int(ix.max()) + 1
    reg_i = np.array([REGION_NAMES.index(r) for r in cells["region"]])
    blk_id = (iy // 3) * 1000 + (ix // 3)
    blk = np.searchsorted(np.unique(blk_id), blk_id)
    band = np.digitize(cells["lat"].values, BAND_EDGES)

    log("[3] Dò đợt mất dữ liệu")
    di_all = ((df["date"].values - np.datetime64(d0)) / np.timedelta64(1, "D")).astype(np.int64)
    nat = {s: np.bincount(di_all[satv == s], minlength=ax["n"]).astype(float) for s in SATS}
    rec = {s: (int(np.flatnonzero(nat[s] > 0)[0]), int(np.flatnonzero(nat[s] > 0)[-1])) for s in SATS}
    valid_nat, gaps_rows = {}, []
    for s in SATS:
        v = np.zeros(ax["n"], bool)
        v[rec[s][0]:rec[s][1] + 1] = True
        for (i, j, L, lp) in detect_outages(nat, rec, ax["doy"], s):
            v[i:j + 1] = False
            gaps_rows.append({"sat": s, "pham_vi": "toan_quoc", "start": str(ax["days"][i].date()), "end": str(ax["days"][j].date()),
                              "days": int(L), "log10_p": round(lp, 1)})
        valid_nat[s] = v
    valid = {}
    band_names = ["Nam(<13.5N)", "Trung(13.5-18.5N)", "Bac(>18.5N)"]
    for s in SATS:
        vc = np.repeat(valid_nat[s][:, None], n_cells, axis=1)
        if s in ("SNPP", "N20", "N21"):
            fl = detect_band_gaps(Md, rec, valid_nat, band, s)
            vc &= ~fl[:, band]
            for k in range(fl.shape[1]):
                for i in np.flatnonzero(fl[:, k]):
                    gaps_rows.append({"sat": s, "pham_vi": band_names[k], "start": str(ax["days"][i].date()),
                                      "end": str(ax["days"][i].date()), "days": 1, "log10_p": np.nan})
        valid[s] = vc
    gaps = pd.DataFrame(gaps_rows)
    gaps.to_csv(os.path.join(T, "data_gaps.csv"), index=False)
    expo = {s: msum(valid[s], ax) / ax["m_caldays"][:, None] for s in SATS}
    em = pd.DataFrame({"year": ax["m_year"], "month": ax["m_month"]})
    for s in SATS:
        em["expo_" + s] = expo[s].mean(1).round(3)
    em.to_csv(os.path.join(T, "exposure_month.csv"), index=False)
    summary["records"] = {s: {"first": str(ax["days"][rec[s][0]].date()), "last": str(ax["days"][rec[s][1]].date())} for s in SATS}
    summary["gaps_national"] = [g for g in gaps_rows if g["pham_vi"] == "toan_quoc"]
    bg = gaps[gaps["pham_vi"] != "toan_quoc"] if len(gaps) else gaps
    summary["gaps_band_days_by_sat_year"] = ({} if not len(bg) else
        {s: {int(y): int(c) for y, c in bg[bg["sat"] == s]["start"].str[:4].astype(int).value_counts().sort_index().items()} for s in bg["sat"].unique()})
    log("    %d đợt mất dữ liệu toàn quốc, %d ngày-dải mất cục bộ" % (len(summary["gaps_national"]), len(bg)))

    Mm = {s: msum(Md[s], ax) for s in SATS}
    nM = len(ax["m_start"])
    wide = pd.DataFrame({"cell": np.repeat(cells["cell"].values, nM), "year": np.tile(ax["m_year"], n_cells),
                         "month": np.tile(ax["m_month"], n_cells)})
    for s in SATS:
        wide[s.lower() + "_d"] = Mm[s].T.ravel().astype(np.int32)
    for s in ("Aqua", "SNPP"):
        wide["expo_" + s.lower()] = expo[s].T.ravel().round(3)
    wide.to_csv(os.path.join(T, "model_025_month.csv"), index=False)

    log("[4] Bảng bằng chứng")
    ev = df.groupby(["year", "sat", "dn"])["lst"].agg(["median", "size"]).reset_index()
    ev.columns = ["year", "sat", "dn", "median_lst_h", "n"]
    ev["median_lst_h"] = ev["median_lst_h"].round(2)
    ev.to_csv(os.path.join(E, "overpass_lst_by_year.csv"), index=False)
    ann = df.groupby(["year", "sat"]).size().unstack(fill_value=0).reindex(columns=SATS, fill_value=0)
    ann["tong_ghep_tho"] = ann.sum(axis=1)
    ann.to_csv(os.path.join(E, "annual_counts_all_detections.csv"))
    df[keep].groupby(["year", "sat"]).size().unstack(fill_value=0).reindex(columns=SATS, fill_value=0).to_csv(
        os.path.join(E, "annual_counts_day_veg.csv"))
    sh = df[keep & (satv == "SNPP")].groupby(["region", "month"]).size().unstack(fill_value=0)
    sh = (100 * sh.div(sh.sum(axis=1), axis=0)).round(1)
    sh.index = [REGION_NAMES[i] for i in sh.index]
    sh.to_csv(os.path.join(E, "season_share_snpp_region_pct.csv"))
    summary["season_share_snpp_pct"] = {r: {int(m): float(v) for m, v in sh.loc[r].items()} for r in sh.index}
    # chỉ báo chế độ cháy chỉ dựa vào MODIS (có cho cả 2003-2026): tỉ số Aqua/Terra và tỉ lệ điểm Aqua có FRP > 30 MW
    kd = df[keep]
    g = kd.groupby(["region", "year", "sat"]).size().unstack(fill_value=0).reindex(columns=SATS, fill_value=0)
    aq = kd[kd["sat"] == "Aqua"]
    ri = pd.DataFrame({"aqua": g["Aqua"], "terra": g["Terra"], "snpp": g["SNPP"],
                       "aqua_frp_median": aq.groupby(["region", "year"])["frp"].median().round(1),
                       "aqua_share_frp_gt30": aq.groupby(["region", "year"])["frp"].apply(lambda x: float((x > 30).mean())).round(3)}).reset_index()
    ri["aqua_per_terra"] = (ri["aqua"] / ri["terra"].where(ri["terra"] > 0)).round(2)
    ri["snpp_per_aqua_tho"] = (ri["snpp"] / ri["aqua"].where((ri["aqua"] > 0) & (ri["snpp"] > 0))).round(2)
    ri["region"] = [REGION_NAMES[i] for i in ri["region"]]
    ri.to_csv(os.path.join(E, "regime_indicators_region_year.csv"), index=False)

    if save_points:
        cols = ["lat", "lon", "dt", "sat", "dn", "frp", "conf", "conf_modis", "type", "src", "version", "scan", "track",
                "bright", "bright31", "static", "lst", "year", "month", "pentad"]
        out_p = df[cols].copy()
        out_p["cell"] = cells["cell"].values[df["cell_i"].values]
        out_p.to_csv(os.path.join(out_dir, "points_clean.csv.gz"), index=False, compression="gzip")
    return dict(summary=summary, cells=cells, ax=ax, Md=Md, Mm=Mm, valid=valid, valid_nat=valid_nat, rec=rec, expo=expo,
                iy=iy, ix=ix, ny=ny, nx=nx, reg_i=reg_i, blk=blk, n_blk=int(blk.max()) + 1, band=band, ann=ann, T=T, E=E)


# --------------------------------------------------------------------------- 10. HIỆU CHUẨN, KIỂM ĐỊNH, CHUỖI HÀI HÒA
def calibrate(ctx, args, out_dir):
    summary, cells, ax, Md, Mm, valid, rec, expo = (ctx[k] for k in ("summary", "cells", "ax", "Md", "Mm", "valid", "rec", "expo"))
    iy, ix, ny, nx, reg_i, blk, n_blk, T, E = (ctx[k] for k in ("iy", "ix", "ny", "nx", "reg_i", "blk", "n_blk", "T", "E"))
    n_cells = len(cells)
    nM = len(ax["m_start"])
    mon, yrs = ax["m_month"], ax["m_year"]
    ym = yrs * 100 + mon
    grid = (iy, ix, ny, nx, 2)
    som = SEASONS[args.seasons]
    summary["options"] = {k: (v if not isinstance(v, float) or np.isfinite(v) else None) for k, v in vars(args).items()}

    # tính nhất quán giữa ba VIIRS trên các ô-ngày cả hai cùng hợp lệ
    def kratio(a, b):
        both = valid[a] & valid[b]
        return float((Md[a] * both).sum(dtype=np.int64) / max((Md[b] * both).sum(dtype=np.int64), 1)), int(both.any(axis=1).sum())
    k20, nd20 = kratio("N20", "SNPP")
    k21, nd21 = kratio("N21", "SNPP")
    summary["viirs_consistency_day_veg"] = {"N20_per_SNPP": round(k20, 4), "N21_per_SNPP": round(k21, 4),
                                            "N21_per_N20": round(kratio("N21", "N20")[0], 4), "common_days_N20": nd20, "common_days_N21": nd21}
    both = valid["N20"] & valid["SNPP"]
    rows = []
    for y in range(2018, int(yrs.max()) + 1):
        m = (ax["year"] == y)[:, None] & both
        b2 = (ax["year"] == y)[:, None] & valid["N21"] & valid["SNPP"]
        rows.append({"year": y, "N20_per_SNPP": round(float((Md["N20"] * m).sum(dtype=np.int64) / max((Md["SNPP"] * m).sum(dtype=np.int64), 1)), 4),
                     "N21_per_SNPP": (round(float((Md["N21"] * b2).sum(dtype=np.int64) / max((Md["SNPP"] * b2).sum(dtype=np.int64), 1)), 4) if b2.any() else np.nan)})
    pd.DataFrame(rows).to_csv(os.path.join(E, "viirs_consistency_by_year.csv"), index=False)
    log("    NOAA-20/S-NPP = %.4f, NOAA-21/S-NPP = %.4f (ban ngày, đã lọc nguồn tĩnh)" % (k20, k21))

    A, V, Tm = Mm["Aqua"], Mm["SNPP"], Mm["Terra"]
    Ad, Vd, Td = Md["Aqua"], Md["SNPP"], Md["Terra"]
    in_cal_t = (ym >= CAL_START[0] * 100 + CAL_START[1]) & (ym <= CAL_END[0] * 100 + CAL_END[1])
    Wcal = (in_cal_t[:, None] & (expo["Aqua"] >= 0.999) & (expo["SNPP"] >= 0.999)).astype(float)
    Anb = nb_sum(A, iy, ix, ny, nx, args.radius)
    summary["calibration_units"] = {"cell_months": int(Wcal.sum()), "months_any": int((Wcal.sum(1) > 0).sum()),
                                    "months_all_cells": int((Wcal.min(1) > 0).sum())}
    # tỉ số thô theo vùng trên đúng các ô-tháng hiệu chuẩn (đáp án đối chiếu)
    summary["ratio_snpp_aqua_cal_units"] = {name: round(float((V * Wcal)[:, reg_i == k].sum() / (A * Wcal)[:, reg_i == k].sum()), 2)
                                            for k, name in enumerate(REGION_NAMES)}
    summary["ratio_snpp_aqua_cal_units"]["ToanQuoc"] = round(float((V * Wcal).sum() / (A * Wcal).sum()), 2)
    rm = pd.DataFrame([{"vung": name, "month": m, "aqua": float((A * Wcal)[mon == m][:, reg_i == k].sum()), "snpp": float((V * Wcal)[mon == m][:, reg_i == k].sum())}
                       for k, name in enumerate(REGION_NAMES) for m in range(1, 13)])
    rm["snpp_per_aqua"] = (rm["snpp"] / rm["aqua"].where(rm["aqua"] > 0)).round(2)
    rm.to_csv(os.path.join(E, "ratio_snpp_aqua_region_month.csv"), index=False)

    def tweights(edge, tau):
        return np.ones(nM) if not tau else np.exp(-np.abs(yrs - edge) / float(tau))

    def fit_predict(cfg, tr_t, rows_t, edge):
        W = Wcal * (tr_t * tweights(edge, cfg.get("tau")))[:, None]
        kind = cfg["kind"]
        if kind == "global":
            return fit_global(A, V, W)["r"] * A[rows_t]
        if kind == "monthly":
            return fit_monthly(A, V, W, mon)["r"][mon[rows_t] - 1][:, None] * A[rows_t]
        if kind == "cell":
            return fit_cell_ratio(A, V, W, grid)["r_c"][None, :] * A[rows_t]
        par = fit_hurdle(A, V, W, mon, SEASONS[cfg["seasons"]], grid, floor=cfg["floor"], Anb=Anb, legacy=cfg.get("legacy", False))
        Ph = predict_hurdle(par, A[rows_t], Anb[rows_t], mon[rows_t])
        if kind == "blend":
            return 0.5 * (Ph + fit_cell_ratio(A, V, W, grid)["r_c"][None, :] * A[rows_t])
        return Ph

    def hname(floor, seasons, tau, model="hurdle"):
        return "%s_%s_s%d%s" % (model, floor, seasons, ("_tau%g" % tau) if tau else "")
    chosen = "ti_so_theo_o" if args.model == "cell" else hname(args.floor, args.seasons, args.tau, {"hurdle": "hurdle", "blend": "lai"}[args.model])
    variants = [("ti_so_toan_cuc", dict(kind="global")), ("ti_so_theo_thang", dict(kind="monthly")),
                ("ti_so_theo_o", dict(kind="cell")), ("ti_so_theo_o_tau4", dict(kind="cell", tau=4.0)),
                ("hurdle_v0_sang_nay", dict(kind="hurdle", floor="clim", seasons=2, legacy=True))]
    for fl, sn, tau in (("clim", 1, None), ("clim", 2, None), ("clim", 4, None), ("nb", 2, None), ("clim", 2, 4.0), ("clim", 2, 8.0)):
        variants.append((hname(fl, sn, tau), dict(kind="hurdle", floor=fl, seasons=sn, tau=tau)))
    variants.append((hname("clim", 2, None, "lai"), dict(kind="blend", floor="clim", seasons=2)))
    if chosen not in [v[0] for v in variants]:
        variants.append((chosen, dict(kind=("blend" if args.model == "blend" else "hurdle"), floor=args.floor, seasons=args.seasons, tau=args.tau)))
    cfg_chosen = dict(variants)[chosen]

    def blocks(ta, tb, sa, sb):
        tr_t = ((yrs >= ta) & (yrs <= tb)).astype(float)
        te_t = (yrs >= sa) & (yrs <= sb) & (Wcal.sum(1) > 0)
        return tr_t, te_t, (ta if sb < ta else tb)

    log("[5] Kiểm định hai chiều (ô x tháng)")
    val_rows, preds = [], {}
    for dname, (ta, tb), (sa, sb) in DIRECTIONS:
        tr_t, te_t, edge = blocks(ta, tb, sa, sb)
        Mte = Wcal[te_t]
        for name, cfg in variants:
            P = fit_predict(cfg, tr_t, te_t, edge)
            m = evaluate(P * Mte, V[te_t] * Mte, yrs[te_t], reg_i)
            val_rows.append(dict(mo_hinh=name, chieu=dname, huan_luyen="%d-%d" % (ta, tb), kiem="%d-%d" % (sa, sb), **{k: round(v, 3) for k, v in m.items()}))
            if name == chosen:
                preds[dname] = (P, te_t, tr_t)
    val = pd.DataFrame(val_rows)
    val.to_csv(os.path.join(T, "validation_month.csv"), index=False)
    log(val[["mo_hinh", "chieu", "lech_toan_quoc_pct", "sai_so_nam_tb_pct", "kge", "rmse_o", "lech_TayNguyen_pct", "lech_DBSCL_pct", "lech_vung_xau_nhat_pct"]].to_string(index=False))
    summary["validation_month"] = {name: {r["chieu"]: {k: r[k] for k in r if k not in ("mo_hinh", "chieu")}
                                          for r in val_rows if r["mo_hinh"] == name} for name, _ in variants}
    summary["chosen_model"] = chosen

    # kiểm định cuốn chiếu: sai số thay đổi thế nào khi cửa sổ huấn luyện kéo xa dần khỏi năm đích
    roll_rows = []
    for (sa, sb), wins in ROLLING:
        for (ta, tb) in wins:
            tr_t, te_t, edge = blocks(ta, tb, sa, sb)
            Mte = Wcal[te_t]
            for name in ("ti_so_theo_o", hname("clim", 2, None), hname("clim", 2, None, "lai"), chosen):
                P = fit_predict(dict(variants)[name], tr_t, te_t, edge)
                m = evaluate(P * Mte, V[te_t] * Mte, yrs[te_t], reg_i)
                roll_rows.append(dict(mo_hinh=name, kiem="%d-%d" % (sa, sb), huan_luyen="%d-%d" % (ta, tb), **{k: round(v, 2) for k, v in m.items()}))
    roll = pd.DataFrame(roll_rows).drop_duplicates()
    roll.to_csv(os.path.join(T, "validation_rolling.csv"), index=False)
    log(roll[["mo_hinh", "kiem", "huan_luyen", "lech_toan_quoc_pct", "rmse_o", "lech_TayNguyen_pct", "lech_TayBac_pct", "lech_DBSCL_pct"]].to_string(index=False))
    # bỏ từng năm ra kiểm (leave-one-year-out)
    loyo = []
    for y in range(CAL_START[0], CAL_END[0] + 1):
        tr_t = (yrs != y).astype(float)
        te_t = (yrs == y) & (Wcal.sum(1) > 0)
        P = fit_predict(dict(cfg_chosen, tau=None), tr_t, te_t, y)
        Mte = Wcal[te_t]
        m = evaluate(P * Mte, V[te_t] * Mte, yrs[te_t], reg_i)
        loyo.append(dict(year=y, **{k: round(v, 2) for k, v in m.items() if k.startswith("lech")}))
    pd.DataFrame(loyo).to_csv(os.path.join(T, "validation_leave_one_year_out.csv"), index=False)
    ly = np.array([r["lech_toan_quoc_pct"] for r in loyo])
    summary["leave_one_year_out_national_pct"] = {"by_year": {r["year"]: r["lech_toan_quoc_pct"] for r in loyo},
                                                  "mean": round(float(ly.mean()), 2), "rms": round(float(np.sqrt((ly ** 2).mean())), 2),
                                                  "max_abs": round(float(np.abs(ly).max()), 2)}
    log("    bỏ-một-năm: lệch toàn quốc theo năm %s" % summary["leave_one_year_out_national_pct"]["by_year"])

    log("[6] Kiểm định phân bổ xuống pentad (mô hình %s)" % chosen)
    pen_rows, pent_keep = [], {}
    kappas = sorted(set([0.0, 1.0, 3.0, 10.0, 30.0, float("inf"), float(args.kappa)]))
    for dname, (ta, tb), (sa, sb) in DIRECTIONS:
        P, te_t, tr_t = preds[dname]
        te_full = te_t & (Wcal.min(1) > 0)                       # chỉ các tháng mọi ô đều hợp lệ
        Hm = np.zeros(A.shape)
        Hm[te_t] = P
        tr_days = (tr_t > 0)[ax["m_idx"]] & in_cal_t[ax["m_idx"]]
        te_days = te_full[ax["m_idx"]]
        clim = daily_clim(np.where(valid["SNPP"], Vd, 0), ax, tr_days)
        obs_p = psum(np.where(te_days[:, None], Vd, 0), ax)
        psel = np.add.reduceat(te_days.astype(int), ax["p_start"]) > 0
        py = ax["p_year"][psel]
        for kappa in kappas:
            Hd_ = allocate(Hm, Ad, clim, ax, np.flatnonzero(te_full), kappa)
            pp = psum(Hd_, ax)
            o, p = obs_p[psel], pp[psel]
            row = {"chieu": dname, "kappa": kappa, "rmse_o_pentad": float(np.sqrt(((p - o) ** 2).mean())),
                   "r_o_pentad": float(np.corrcoef(p.ravel(), o.ravel())[0, 1]),
                   "rmse_khoi3x3_pentad": float(np.sqrt(((block_sum(p, blk, n_blk) - block_sum(o, blk, n_blk)) ** 2).mean())),
                   "kge_toan_quoc_pentad": kge(o.sum(1), p.sum(1))}
            jac, dpk = [], []
            for k, name in enumerate(REGION_NAMES):
                m = reg_i == k
                row["kge_%s_pentad" % name] = kge(o[:, m].sum(1), p[:, m].sum(1))
                if name in ("Khac", "DBSH"):
                    continue                                      # hai vùng không có một mùa cháy rõ rệt
                for y in np.unique(py):
                    oo, pq = o[py == y][:, m].sum(1), p[py == y][:, m].sum(1)
                    if len(oo) < 60 or oo.sum() < 50:
                        continue
                    wo, wp = shortest_window(oo, 0.5), shortest_window(pq, 0.5)
                    so, sp = set(range(wo[0], wo[1] + 1)), set(range(wp[0], wp[1] + 1))
                    jac.append(len(so & sp) / len(so | sp))
                    dpk.append(abs(int(np.argmax(oo)) - int(np.argmax(pq))))
            row["cua_so_50pct_jaccard"] = float(np.mean(jac)) if jac else float("nan")
            row["lech_dinh_pentad_trung_vi"] = float(np.median(dpk)) if dpk else float("nan")
            pen_rows.append({k: (round(v, 3) if isinstance(v, float) and np.isfinite(v) else (None if isinstance(v, float) and not np.isfinite(v) and k != "kappa" else v)) for k, v in row.items()})
            if kappa == float(args.kappa):
                pent_keep[dname] = (p, o)
    pen = pd.DataFrame(pen_rows)
    pen.to_csv(os.path.join(T, "validation_pentad.csv"), index=False)
    log(pen[["chieu", "kappa", "rmse_o_pentad", "r_o_pentad", "rmse_khoi3x3_pentad", "kge_toan_quoc_pentad", "kge_TayNguyen_pentad", "kge_DBSCL_pentad",
             "cua_so_50pct_jaccard", "lech_dinh_pentad_trung_vi"]].to_string(index=False))
    summary["validation_pentad"] = [{k: (None if isinstance(v, float) and not np.isfinite(v) else v) for k, v in r.items()} for r in pen_rows]

    log("[7] Bảng bất định")
    def levels(p, o):
        return {"o": (p, o), "khoi3x3": (block_sum(p, blk, n_blk), block_sum(o, blk, n_blk)),
                "vung": (np.stack([p[:, reg_i == k].sum(1) for k in range(5)] + [p.sum(1)], 1),
                         np.stack([o[:, reg_i == k].sum(1) for k in range(5)] + [o.sum(1)], 1))}
    unc, cov_rows = {}, []
    d_a, d_b = DIRECTIONS[0][0], DIRECTIONS[1][0]
    for unit in ("thang", "pentad"):
        lv = {}
        for dname in (d_a, d_b):
            if unit == "thang":
                P, te_t, _ = preds[dname]
                lv[dname] = levels(P * Wcal[te_t], V[te_t] * Wcal[te_t])
            else:
                lv[dname] = levels(*pent_keep[dname])
        for level in ("o", "khoi3x3", "vung"):
            for src, dst in ((d_a, d_b), (d_b, d_a)):
                tab = ratio_table(*lv[src][level])
                p, o = lv[dst][level]
                lo, hi = apply_table(tab, p)
                inside = (o >= lo - 1e-9) & (o <= hi + 1e-9)
                act = o > 0
                cov_rows.append({"don_vi": unit, "cap": level, "bang_tu": src, "kiem_tren": dst,
                                 "phu_90_pct": round(100 * float(inside.mean()), 1),
                                 "phu_90_khi_co_chay_pct": round(100 * float(inside[act].mean()), 1), "n": int(inside.size)})
            tab = ratio_table(np.concatenate([lv[d][level][0].ravel() for d in (d_a, d_b)]),
                              np.concatenate([lv[d][level][1].ravel() for d in (d_a, d_b)]))
            tab.insert(0, "cap", level)
            tab.insert(0, "don_vi", unit)
            unc[(unit, level)] = tab
    pd.concat(unc.values(), ignore_index=True).round(4).to_csv(os.path.join(T, "uncertainty_table.csv"), index=False)
    cov = pd.DataFrame(cov_rows)
    cov.to_csv(os.path.join(T, "validation_coverage.csv"), index=False)
    log(cov.to_string(index=False))
    summary["coverage_90"] = cov_rows

    # ---------------- mô hình cuối và chuỗi hài hòa
    log("[8] Chuỗi hài hòa cuối")
    Wfin = Wcal * tweights(CAL_START[0], args.tau)[:, None]
    par = fit_hurdle(A, V, Wfin, mon, som, grid, floor=args.floor, Anb=Anb)
    par_fb = fit_cell_ratio(A, V, Wfin, grid)
    Wearly = Wcal * (yrs <= 2016)[:, None]
    par_early = fit_hurdle(A, V, Wearly, mon, som, grid, floor=args.floor, Anb=Anb)
    co = pd.DataFrame({"cell": cells["cell"], "ti_so_theo_o_du_phong": par_fb["r_c"].round(4)})
    for sidx in range(int(som.max()) + 1):
        co["r_mua%d" % sidx] = par["r_cs"][sidx].round(4)
    for m in range(12):
        co["san_thang%02d" % (m + 1)] = par["g_cm"][m].round(5)
    co.to_csv(os.path.join(T, "calib_coeffs_025.csv"), index=False)
    summary["model"] = {"name": chosen, "floor": args.floor, "seasons": args.seasons, "season_of_month": som.tolist(),
                        "tau_years": args.tau, "r_global": round(par["r_g"], 4), "r_season": [round(float(x), 4) for x in par["r_s"]],
                        "fallback_r_global": round(par_fb["r_g"], 4), "kappa": args.kappa,
                        "shrinkage": {"k_cell": 60, "k_season": 60, "k_neighbourhood": 20, "k_floor": 2, "prior_window": "5x5 o"}}

    midx = np.arange(nM)
    aqua_first = int(np.flatnonzero(ym == AQUA_ERA_START[0] * 100 + AQUA_ERA_START[1])[0])
    snpp_day0 = rec["SNPP"][0]
    d_aq0 = int(ax["m_start"][aqua_first])
    aq_months = midx[midx >= aqua_first]
    eA = expo["Aqua"]
    Sm = np.where(eA >= 0.5, A / np.maximum(eA, 0.5), 0.0)
    Sm[:aqua_first] = 0.0
    Snb = nb_sum(Sm, iy, ix, ny, nx, args.radius)
    par_fb_early = fit_cell_ratio(A, V, Wearly, grid)
    H_aq_fb = par_fb["r_c"][None, :] * Sm

    def main_estimate(par_h, par_c, S_, Snb_, rows):
        """Ước lượng tháng của mô hình chính cho các hàng `rows` từ ma trận nguồn S_ (đã bù exposure)."""
        if args.model == "cell":
            return par_c["r_c"][None, :] * S_[rows]
        Ph = predict_hurdle(par_h, S_[rows], Snb_[rows], mon[rows])
        return 0.5 * (Ph + par_c["r_c"][None, :] * S_[rows]) if args.model == "blend" else Ph
    H_aq = np.zeros(A.shape)
    H_aq[aq_months] = main_estimate(par, par_fb, Sm, Snb, aq_months)
    H_aq_early = np.zeros(A.shape)
    H_aq_early[aq_months] = main_estimate(par_early, par_fb_early, Sm, Snb, aq_months)
    clim_full = daily_clim(np.where(valid["SNPP"], Vd, 0), ax, in_cal_t[ax["m_idx"]])
    Hd_aq = allocate(H_aq, Ad, clim_full, ax, aq_months, args.kappa)

    # Terra -> tương đương Aqua (học trên 2003-2007) -> áp mô hình Aqua -> S-NPP, cho 11/2000 - 7/2002
    in_ta_t = (ym >= TA_START[0] * 100 + TA_START[1]) & (ym <= TA_END[0] * 100 + TA_END[1])
    ok_ta = ((expo["Aqua"] >= 0.999) & (expo["Terra"] >= 0.999)).astype(float)
    Tnb = nb_sum(Tm, iy, ix, ny, nx, args.radius)
    par_ta = fit_hurdle(Tm, A, ok_ta * in_ta_t[:, None], mon, som, grid, floor=args.floor, Anb=Tnb)
    ta_val, ta_res = {}, []
    for dname, (ta, tb), (sa, sb) in (("doan_nguoc", (2008, 2011), (2003, 2007)), ("doan_xuoi", (2003, 2007), (2008, 2011))):
        tr_t = (yrs >= ta) & (yrs <= tb)
        te_t = (yrs >= sa) & (yrs <= sb)
        p_ = fit_hurdle(Tm, A, ok_ta * tr_t[:, None], mon, som, grid, floor=args.floor, Anb=Tnb)
        Pt = predict_hurdle(p_, Tm[te_t], Tnb[te_t], mon[te_t]) * ok_ta[te_t]
        Ot = A[te_t] * ok_ta[te_t]
        ta_val[dname] = {k: round(v, 3) for k, v in evaluate(Pt, Ot, yrs[te_t], reg_i).items()}
        ta_res.append((Pt, Ot))
    summary["validation_terra_to_aqua_month"] = ta_val
    tab_ta = ratio_table(np.concatenate([r[0].ravel() for r in ta_res]), np.concatenate([r[1].ravel() for r in ta_res]))
    te_months = midx[midx < aqua_first]
    eT = expo["Terra"]
    Tadj = np.where(eT >= 0.5, Tm / np.maximum(eT, 0.5), 0.0)
    Tadj[aqua_first:] = 0.0
    Aeq = np.zeros(A.shape)
    Aeq[te_months] = predict_hurdle(par_ta, Tadj[te_months], nb_sum(Tadj, iy, ix, ny, nx, args.radius)[te_months], mon[te_months])
    H_te = np.zeros(A.shape)
    H_te[te_months] = main_estimate(par, par_fb, Aeq, nb_sum(Aeq, iy, ix, ny, nx, args.radius), te_months)
    Hd_te = allocate(H_te, Td, clim_full, ax, te_months, args.kappa)

    # ghép: 1 Terra nối chuỗi | 2 Aqua hiệu chuẩn | 3 S-NPP thực đo | 4 NOAA-20 quy đổi (S-NPP mất dữ liệu hoặc đã dừng)
    Hd = np.zeros(Ad.shape, dtype=np.float32)
    src = np.zeros(Ad.shape, dtype=np.int8)
    Hd[:d_aq0] = Hd_te[:d_aq0]
    src[:d_aq0] = 1
    Hd[d_aq0:snpp_day0] = Hd_aq[d_aq0:snpp_day0]
    src[d_aq0:snpp_day0] = 2
    vS, vN = valid["SNPP"][snpp_day0:], valid["N20"][snpp_day0:]
    Hd[snpp_day0:] = np.where(vS, Md["SNPP"][snpp_day0:], np.where(vN, Md["N20"][snpp_day0:] / np.float32(k20), Hd_aq[snpp_day0:]))
    src[snpp_day0:] = np.where(vS, 3, np.where(vN, 4, 2))
    Hm_final = msum(Hd, ax)
    Hp_final = psum(Hd, ax)
    src_name = {1: "terra_noi_chuoi", 2: "aqua_hieu_chuan", 3: "snpp", 4: "noaa20_quy_doi"}

    def major(starts, ends):
        code, other = [], []
        for a_, b_ in zip(starts, ends):
            u, c = np.unique(src[a_:b_], return_counts=True)
            j = int(np.argmax(c))
            code.append(int(u[j]))
            other.append(round(100.0 * (1 - c[j] / c.sum()), 1))
        return np.array(code), np.array(other)
    m_code, m_other = major(ax["m_start"], ax["m_end"])
    p_code, p_other = major(ax["p_start"], ax["p_end"])
    summary["source_months"] = {src_name[k]: int((m_code == k).sum()) for k in src_name}
    filled = pd.DataFrame({"year": ax["m_year"], "month": ax["m_month"], "src": [src_name[k] for k in m_code], "pct_o_ngay_nguon_khac": m_other})
    filled[filled["pct_o_ngay_nguon_khac"] > 0].to_csv(os.path.join(T, "gap_filled_months.csv"), index=False)

    # khoảng 90% ở cấp ô-tháng cho phần ước lượng từ MODIS; đoạn Terra cộng thêm sai số khâu Terra -> Aqua (cộng bình phương trên thang log)
    tabm = unc[("thang", "o")]
    lo_m, hi_m = apply_table(tabm, Hm_final)
    bte = np.digitize(Hm_final, BINS[1:-1])
    q05c = np.exp(-np.sqrt(np.log(tab_ta["q05"].values[bte]) ** 2 + np.log(tabm["q05"].values[bte]) ** 2))
    q95c = np.exp(np.sqrt(np.log(tab_ta["q95"].values[bte]) ** 2 + np.log(tabm["q95"].values[bte]) ** 2))
    is_te = (m_code == 1)[:, None] & np.ones((1, n_cells), bool)
    lo_m = np.where(is_te, np.maximum((Hm_final + 0.5) * q05c - 0.5, 0), lo_m)
    hi_m = np.where(is_te, (Hm_final + 0.5) * q95c - 0.5, hi_m)
    obs_m = (m_code >= 3)[:, None] & np.ones((1, n_cells), bool)
    lo_m = np.where(obs_m, Hm_final, lo_m)
    hi_m = np.where(obs_m, Hm_final, hi_m)
    hm = pd.DataFrame({"cell": np.repeat(cells["cell"].values, nM), "year": np.tile(ax["m_year"], n_cells),
                       "month": np.tile(ax["m_month"], n_cells), "snpp_eq": Hm_final.T.ravel().round(2),
                       "lo90": lo_m.T.ravel().round(2), "hi90": hi_m.T.ravel().round(2),
                       "src": np.tile(np.array([src_name[k] for k in m_code]), n_cells)})
    hm.to_csv(os.path.join(T, "harmonized_025_month.csv"), index=False)

    years = np.unique(ax["p_year"])
    cube = np.full((len(years), 73, n_cells), np.nan, dtype=np.float32)
    cube_src = np.zeros((len(years), 73), dtype=np.int8)
    for j in range(len(ax["p_start"])):
        cube[ax["p_year"][j] - years[0], ax["p_pent"][j] - 1] = Hp_final[j]
        cube_src[ax["p_year"][j] - years[0], ax["p_pent"][j] - 1] = p_code[j]
    np.savez_compressed(os.path.join(T, "harmonized_cells_pentad.npz"), snpp_eq=cube, years=years, src_code=cube_src,
                        cell=cells["cell"].values.astype(str), lat=cells["lat"].values, lon=cells["lon"].values)
    tabp = unc[("pentad", "vung")]
    rp = []
    for k, name in list(enumerate(REGION_NAMES)) + [(-1, "ToanQuoc")]:
        m = np.ones(n_cells, bool) if k < 0 else (reg_i == k)
        v = Hp_final[:, m].sum(1)
        lo, hi = apply_table(tabp, v)
        lo = np.where(p_code >= 3, v, lo)
        hi = np.where(p_code >= 3, v, hi)
        rp.append(pd.DataFrame({"vung": name, "year": ax["p_year"], "pentad": ax["p_pent"], "snpp_eq": v.round(2),
                                "lo90": lo.round(2), "hi90": hi.round(2), "src": [src_name[c] for c in p_code]}))
    pd.concat(rp, ignore_index=True).to_csv(os.path.join(T, "harmonized_regions_pentad.csv"), index=False)
    np.savez_compressed(os.path.join(T, "cube_daily_day_veg.npz"),
                        dates=np.array([int(d.strftime("%Y%m%d")) for d in ax["days"]]),
                        cell=cells["cell"].values.astype(str), lat=cells["lat"].values, lon=cells["lon"].values,
                        **{s: Md[s] for s in SATS}, **{"valid_" + s: valid[s] for s in SATS}, harmonized=Hd, src_code=src)

    # ---------------- con số tổng hợp
    yr_m = ax["m_year"]
    ann = ctx["ann"]
    naive = ann["tong_ghep_tho"]

    def ymean(M, y0, y1):
        return float(np.mean([M[yr_m == y].sum() for y in range(y0, y1 + 1)]))
    summary["step_2012"] = {
        "ghep_tho_moi_ve_tinh_2012_14_tren_2009_11": round(float(naive.loc[2012:2014].mean() / naive.loc[2009:2011].mean()), 3),
        "snpp_2013_15_tren_aqua_2009_11_ban_ngay": round(ymean(V, 2013, 2015) / ymean(A, 2009, 2011), 3),
        "sau_hai_hoa_2013_15_tren_2009_11": round(ymean(Hm_final, 2013, 2015) / ymean(Hm_final, 2009, 2011), 3),
        "aqua_tho_2013_15_tren_2009_11": round(ymean(A, 2013, 2015) / ymean(A, 2009, 2011), 3)}
    hy = pd.DataFrame({"year": np.unique(yr_m)})
    hy["hai_hoa_snpp_eq"] = [round(float(Hm_final[yr_m == y].sum()), 1) for y in hy["year"]]
    aq_era = [(y >= 2003) and (y <= 2011) for y in hy["year"]]
    hy["kich_ban_cua_so_som_2012_16"] = [round(float(H_aq_early[yr_m == y].sum()), 1) if f else np.nan for y, f in zip(hy["year"], aq_era)]
    hy["du_phong_ti_so_theo_o"] = [round(float(H_aq_fb[yr_m == y].sum()), 1) if f else np.nan for y, f in zip(hy["year"], aq_era)]
    hy["aqua_tho_ngay"] = [int(A[yr_m == y].sum()) for y in hy["year"]]
    hy["terra_tho_ngay"] = [int(Tm[yr_m == y].sum()) for y in hy["year"]]
    hy["snpp_tho_ngay"] = [int(V[yr_m == y].sum()) for y in hy["year"]]
    hy["ghep_tho_moi_ve_tinh"] = [int(naive.get(y, 0)) for y in hy["year"]]
    hy.to_csv(os.path.join(T, "harmonized_national_year.csv"), index=False)
    # độ nhạy theo chế độ cháy: hiệu chuẩn trên toàn bộ 2012-2021 so với chỉ 2012-2016, giai đoạn 2003-2011
    sel = (yr_m >= 2003) & (yr_m <= 2011)
    sens = {name: round(100 * float(H_aq[sel][:, reg_i == k].sum() / H_aq_early[sel][:, reg_i == k].sum() - 1), 1) for k, name in enumerate(REGION_NAMES)}
    sens["ToanQuoc"] = round(100 * float(H_aq[sel].sum() / H_aq_early[sel].sum() - 1), 1)
    summary["regime_sensitivity_2003_2011_pct"] = {"mo_ta": "chenh lech giua mo hinh chinh va kich ban chi hoc tren 2012-2016", "by_region": sens}

    cal_example = {}
    yi0, yi1 = int(2003 - years[0]), int(2025 - years[0])
    for k, name in ((4, "DBSCL"), (3, "TayNguyen"), (-1, "ToanQuoc")):
        m = np.ones(n_cells, bool) if k < 0 else (reg_i == k)
        Y = np.nansum(cube[yi0:yi1 + 1][:, :, m], axis=2)
        cs_ = calendar_stats(Y)
        cal_example[name] = {"years": "2003-2025", "w50_pentad": [int(cs_["w50"][0]) + 1, int(cs_["w50"][1]) + 1],
                             "w80_pentad": [int(cs_["w80"][0]) + 1, int(cs_["w80"][1]) + 1],
                             "peak_pentad": int(np.argmax(cs_["clim_mean"])) + 1,
                             "clim_mean": [round(float(x), 1) for x in cs_["clim_mean"]]}
    summary["calendar_example"] = cal_example

    vm = summary["validation_month"][chosen]

    def ok(c):
        return "PASS" if c else "FAIL"
    summary["gate2"] = {
        "lech_toan_quoc_trong_5pct": ok(all(abs(vm[d]["lech_toan_quoc_pct"]) <= 5 for d in vm)),
        "lech_DBSCL_trong_10pct": ok(all(abs(vm[d]["lech_DBSCL_pct"]) <= 10 for d in vm)),
        "kge_thang_tu_0.90": ok(all(vm[d]["kge"] >= 0.90 for d in vm)),
        "buoc_nhay_2012_trong_0.9_1.1": ok(0.9 <= summary["step_2012"]["sau_hai_hoa_2013_15_tren_2009_11"] <= 1.1)}
    with open(os.path.join(out_dir, "summary.json"), "w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o))

    web = {"meta": {"unit": summary["unit"], "grid_deg": GRID, "model": chosen, "years": [int(y) for y in years],
                    "pentad": "1..73 theo ngay-trong-nam, moi pentad 5 ngay (pentad 73 gom ca ngay 366)",
                    "src_codes": {str(k): v for k, v in src_name.items()},
                    "uncertainty_pentad_vung": [{"pred_lo": float(r.pred_lo), "pred_hi": (None if np.isinf(r.pred_hi) else float(r.pred_hi)),
                                                 "q05": round(float(r.q05), 4), "q95": round(float(r.q95), 4)} for r in tabp.itertuples()]},
           "cells": [{"id": c, "lat": float(a_), "lon": float(b_)} for c, a_, b_ in zip(cells["cell"], cells["lat"], cells["lon"])],
           "src": cube_src.tolist(),
           "pentad": {c: [[None if np.isnan(v) else round(float(v), 1) for v in cube[yi, :, ci]] for yi in range(len(years))]
                      for ci, c in enumerate(cells["cell"])}}
    with open(os.path.join(out_dir, "web_cells_pentad.json"), "w", encoding="utf-8") as fh:
        json.dump(web, fh, ensure_ascii=False, separators=(",", ":"))

    log("\n== TÓM TẮT ==")
    log("Tổng điểm: %d | %s" % (summary["counts"]["total"], summary["counts"]["by_sat"]))
    log("Tỉ số S-NPP/Aqua trên các ô-tháng hiệu chuẩn: %s" % summary["ratio_snpp_aqua_cal_units"])
    log("Bước nhảy 2012: %s" % summary["step_2012"])
    log("Độ nhạy chế độ cháy 2003-2011 (chính so với cửa sổ sớm), %%: %s" % sens)
    log("Terra -> Aqua: %s" % {d: (ta_val[d]["lech_toan_quoc_pct"], ta_val[d]["lech_vung_xau_nhat_pct"]) for d in ta_val})
    log("Mô hình chính: %s" % chosen)
    for d in vm:
        log("  %-10s lệch toàn quốc %+.1f%%  ĐBSCL %+.1f%%  Tây Nguyên %+.1f%%  KGE %.3f  vùng xấu nhất %.1f%%" %
            (d, vm[d]["lech_toan_quoc_pct"], vm[d]["lech_DBSCL_pct"], vm[d]["lech_TayNguyen_pct"], vm[d]["kge"], vm[d]["lech_vung_xau_nhat_pct"]))
    log("Cổng 2: %s" % summary["gate2"])
    return summary


def main():
    ap = argparse.ArgumentParser(description="Hỏa Lịch: dữ liệu sạch và hiệu chuẩn MODIS -> tương đương S-NPP")
    ap.add_argument("--raw", required=True, help="thư mục chứa 4 tệp zip (hoặc JSON) tải từ FIRMS")
    ap.add_argument("--out", required=True, help="thư mục kết quả")
    ap.add_argument("--save-points", action="store_true", help="ghi thêm points_clean.csv.gz (toàn bộ điểm đã chuẩn hóa)")
    ap.add_argument("--drop-lowconf", action="store_true", help="bỏ phát hiện độ tin cậy thấp khi dựng ma trận hiệu chuẩn")
    ap.add_argument("--model", default="blend", choices=["blend", "hurdle", "cell"],
                    help="mô hình chính: blend = trung bình hurdle và tỉ số theo ô; hurdle; cell = tỉ số theo ô")
    ap.add_argument("--floor", default="clim", choices=["clim", "nb"], help="kiểu mức sàn của hurdle")
    ap.add_argument("--seasons", type=int, default=2, choices=[1, 2, 4], help="số mùa của tỉ số theo ô")
    ap.add_argument("--radius", type=int, default=2, help="bán kính lân cận (ô) cho sàn 'nb'")
    ap.add_argument("--tau", type=float, default=None, help="hằng số suy giảm trọng số theo năm (năm); bỏ trống = trọng số đều")
    ap.add_argument("--kappa", type=float, default=3.0, help="trọng số khí hậu khi phân bổ xuống ngày")
    args = ap.parse_args()
    ctx = prepare(args.raw, args.out, drop_lowconf=args.drop_lowconf, save_points=args.save_points)
    calibrate(ctx, args, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
