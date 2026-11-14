#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Kiểm tự động bộ dữ liệu Hỏa Lịch (Cổng 1).  Chạy:  python verify_outputs.py <thư mục kết quả>
In PASS/FAIL cho từng phép kiểm; mã thoát khác 0 nếu có FAIL."""
import json
import os
import sys

import numpy as np
import pandas as pd

out = sys.argv[1] if len(sys.argv) > 1 else "."
T = os.path.join(out, "tables")
S = json.load(open(os.path.join(out, "summary.json"), encoding="utf-8"))
fails = 0


def check(name, cond, detail=""):
    global fails
    print("%-4s %s %s" % ("PASS" if cond else "FAIL", name, detail))
    fails += 0 if cond else 1


gm = pd.read_csv(os.path.join(T, "grid_025_month.csv"))
gp = pd.read_csv(os.path.join(T, "grid_025_pentad.csv"))
tot = S["counts"]["total"]
check("Bảng tháng cộng lại đủ số điểm gốc", int(gm["n"].sum() + gm["n_static"].sum()) == tot, "(%d)" % tot)
check("Bảng pentad cộng lại đủ số điểm gốc", int(gp["n"].sum() + gp["n_static"].sum()) == tot)
a = gm.groupby(["cell", "year", "sat", "dn"])["n"].sum()
b = gp.groupby(["cell", "year", "sat", "dn"])["n"].sum()
check("Tháng và pentad khớp nhau theo ô-năm-vệ tinh", a.equals(b.reindex(a.index)))
by_sat = (gm.groupby("sat")["n"].sum() + gm.groupby("sat")["n_static"].sum()).to_dict()
check("Số điểm theo vệ tinh khớp summary", all(int(by_sat[s]) == S["counts"]["by_sat"][s] for s in by_sat), str(by_sat))

mm = pd.read_csv(os.path.join(T, "model_025_month.csv"))
d = gm[gm["dn"] == "D"].groupby(["cell", "year", "month", "sat"])["n"].sum().unstack(fill_value=0)
chk = mm.set_index(["cell", "year", "month"])
ok = True
for s, c in (("Aqua", "aqua_d"), ("Terra", "terra_d"), ("SNPP", "snpp_d"), ("N20", "n20_d"), ("N21", "n21_d")):
    ok &= int(chk[c].sum()) == int(d[s].sum())
check("Bảng mô hình (dày) khớp bảng lưới ban ngày", ok)

z = np.load(os.path.join(T, "cube_daily_day_veg.npz"))
check("Khối ngày khớp bảng mô hình", all(int(z[s].sum(dtype=np.int64)) == int(mm[s.lower() + "_d"].sum()) for s in ("Terra", "Aqua", "SNPP", "N20", "N21")))
H = z["harmonized"].astype(np.float64)
src = z["src_code"]
snpp = z["SNPP"].astype(np.float64)
check("Ngày nguồn S-NPP: chuỗi hài hòa đúng bằng số đếm S-NPP", np.allclose(H[src == 3], snpp[src == 3]))
check("Chuỗi hài hòa không âm, không NaN", bool(np.isfinite(H).all() and (H >= 0).all()))

hm = pd.read_csv(os.path.join(T, "harmonized_025_month.csv"))
cube = np.load(os.path.join(T, "harmonized_cells_pentad.npz"))
ysum_m = hm.groupby("year")["snpp_eq"].sum()
ysum_p = pd.Series(np.nansum(cube["snpp_eq"], axis=(1, 2)), index=cube["years"])
rel = (ysum_m - ysum_p).abs() / ysum_m.clip(lower=1)
check("Tổng năm theo tháng và theo pentad khớp nhau (sai khác < 0,1%)", bool((rel < 1e-3).all()), "(lệch lớn nhất %.5f)" % rel.max())
check("Tổng ngày khớp tổng tháng", abs(H.sum() - hm["snpp_eq"].sum()) / H.sum() < 1e-4)
check("Khoảng 90% bao giá trị ước lượng", bool(((hm["lo90"] <= hm["snpp_eq"] + 0.01) & (hm["hi90"] >= hm["snpp_eq"] - 0.01)).all()))

st = S["step_2012"]
check("Bước nhảy 2012 sau hài hòa nằm trong 0,9-1,1", 0.9 <= st["sau_hai_hoa_2013_15_tren_2009_11"] <= 1.1, "(%.3f; thô %.2f)" % (st["sau_hai_hoa_2013_15_tren_2009_11"], st["snpp_2013_15_tren_aqua_2009_11_ban_ngay"]))
ref = {"total": 2150162, "Terra": 140824, "Aqua": 302513, "SNPP": 1018991, "N20": 491632, "N21": 196202}
if tot == ref["total"]:
    check("Đúng bộ tải FIRMS ngày 13/11/2026 (số điểm theo vệ tinh)", all(S["counts"]["by_sat"][k] == v for k, v in ref.items() if k != "total"))
else:
    print("INFO Bộ dữ liệu khác bản tải 13/11/2026 (tổng %d), bỏ qua phép so với số tham chiếu" % tot)
print("Cổng 2 (theo summary.json):", S["gate2"])
print("KẾT QUẢ:", "TẤT CẢ PASS" if fails == 0 else "%d FAIL" % fails)
sys.exit(1 if fails else 0)
