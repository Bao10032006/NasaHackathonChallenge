"""Baseline / anomaly diagnostics on the MVP snapshot (pipeline 1.0 tables)."""
import numpy as np
import pandas as pd

T = 'D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/tables/'
h = pd.read_csv(T + 'harmonized_025_month.csv')
cells = pd.read_csv(T + 'cells_025.csv')[['cell', 'region']]
h = h.merge(cells, on='cell')
unc = pd.read_csv(T + 'uncertainty_table.csv')
rp = pd.read_csv(T + 'harmonized_regions_pentad.csv')

ERA = lambda y: 'A_2003_2011_aqua' if y <= 2011 else ('B_2012_2016_snpp' if y <= 2016 else 'C_2017_2025_snpp')

# ---------- 0. interval semantics check on region pentads ----------
aq = rp[(rp.src == 'aqua_hieu_chuan') & (rp.vung != 'ToanQuoc')].copy()
aq['r_lo'] = aq.lo90 / aq.snpp_eq
aq['r_hi'] = aq.hi90 / aq.snpp_eq
print('pentad region lo/hi ratio (aqua era) quantiles', aq[['r_lo', 'r_hi']].quantile([.1, .5, .9]).round(3).to_dict())

# ---------- 1. area x month totals ----------
reg = h.groupby(['region', 'year', 'month'], as_index=False).snpp_eq.sum()
nat = h.groupby(['year', 'month'], as_index=False).snpp_eq.sum().assign(region='ToanQuoc')
am = pd.concat([reg, nat])
am = am[(am.year >= 2003) & (am.year <= 2025)]


def classify(series_by_year, years, base_years_fn):
    out = {}
    for y in years:
        base = [series_by_year[b] for b in base_years_fn(y) if b != y and b in series_by_year]
        n = len(base)
        x = series_by_year[y]
        if n < 5:
            out[y] = ('INSUFFICIENT_BASELINE', n, None, None, None)
            continue
        p10, p50, p90 = np.percentile(base, [10, 50, 90])
        cls = 'HIGH' if x > max(p90, 1) else ('LOW' if x < p10 else 'TYPICAL')
        out[y] = (cls, n, p10, p50, p90)
    return out


windows = {
    'full_2003_2025_loo': lambda y: range(2003, 2026),
    'trailing_10y': lambda y: range(y - 10, y),
    'fixed_2016_2025_loo': lambda y: range(2016, 2026),
}
rows = []
for (area, month), g in am.groupby(['region', 'month']):
    s = dict(zip(g.year, g.snpp_eq))
    for wname, fn in windows.items():
        res = classify(s, sorted(s), fn)
        for y, (cls, n, p10, p50, p90) in res.items():
            rows.append(dict(area=area, month=month, year=y, window=wname, cls=cls, n=n, x=s[y], median=p50, p90=p90))
cl = pd.DataFrame(rows)
cl['era'] = cl.year.map(ERA)
tab = cl[cl.cls != 'INSUFFICIENT_BASELINE'].groupby(['window', 'era']).cls.value_counts(normalize=True).unstack().mul(100).round(1)
print('\n[1] class share % by baseline window and era (6 areas x 12 months)\n', tab.to_string())
print('\ninsufficient share by window', cl.groupby('window').cls.apply(lambda s: round(100 * (s == 'INSUFFICIENT_BASELINE').mean(), 1)).to_dict())
cl.to_csv('anomaly_area_month_classes.csv', index=False)

# ---------- 2. era shift (annual totals) ----------
ann = pd.concat([h.groupby(['region', 'year']).snpp_eq.sum().reset_index(),
                 h.groupby('year').snpp_eq.sum().reset_index().assign(region='ToanQuoc')])
ann = ann[(ann.year >= 2003) & (ann.year <= 2025)]
ann['era'] = ann.year.map(ERA)
era = ann.groupby(['region', 'era']).snpp_eq.median().unstack().round(0)
era['C_vs_A_pct'] = ((era['C_2017_2025_snpp'] / era['A_2003_2011_aqua'] - 1) * 100).round(1)
era['C_vs_B_pct'] = ((era['C_2017_2025_snpp'] / era['B_2012_2016_snpp'] - 1) * 100).round(1)
print('\n[2] median annual snpp_eq by era\n', era.to_string())

# ---------- 3. cell-level baseline degeneracy ----------
hc = h[(h.year >= 2003) & (h.year <= 2025)]
piv = hc.pivot_table(index=['cell', 'month'], columns='year', values='snpp_eq')
vals = piv.to_numpy()
stats = []
for i in range(vals.shape[0]):
    row = vals[i]
    for j in range(vals.shape[1]):
        base = np.delete(row, j)
        base = base[~np.isnan(base)]
        x = row[j]
        p10, p50, p90 = np.percentile(base, [10, 50, 90])
        mad = np.median(np.abs(base - p50))
        stats.append((x, p50, p90, mad))
st = np.array(stats)
x, p50, p90, mad = st.T
print('\n[3] cell x month x year targets (LOO 2003-2025):', len(st))
print('  median==0 %', round(100 * (p50 == 0).mean(), 1), '| p90==0 %', round(100 * (p90 == 0).mean(), 1),
      '| MAD==0 %', round(100 * (mad == 0).mean(), 1), '| p90<1 %', round(100 * (p90 < 1).mean(), 1))
high = x > np.maximum(p90, 1)
print('  HIGH rate %', round(100 * high.mean(), 2), '| HIGH where p90<1 (share of HIGH) %', round(100 * (high & (p90 < 1)).sum() / high.sum(), 1))
print('  deltaPct undefined (median==0) among x>0 %', round(100 * ((p50 == 0) & (x > 0)).sum() / (x > 0).sum(), 1))

# annual activity per cell (2012-2025 snpp era) for minimum-activity gate
cell_year = h[(h.year >= 2012) & (h.year <= 2025)].groupby(['cell', 'year']).snpp_eq.sum().groupby('cell').median()
print('  cell median annual snpp_eq 2012-2025 quantiles', cell_year.quantile([.1, .25, .5, .75, .9]).round(1).to_dict())
for thr in (50, 100, 200):
    print(f'  cells with median annual < {thr}:', int((cell_year < thr).sum()), 'of', len(cell_year))

# ---------- 4. how often a HIGH survives the 90% interval (aqua era, region month) ----------
q = unc[(unc.don_vi == 'thang') & (unc.cap == 'vung')]


def factor(v, col):
    r = q[(q.pred_lo <= v) & (v < q.pred_hi)]
    return float(r[col].iloc[0]) if len(r) else np.nan


full = cl[(cl.window == 'full_2003_2025_loo') & (cl.area != 'ToanQuoc')].copy()
aqua = full[full.era == 'A_2003_2011_aqua'].copy()
aqua['lo'] = [x * factor(x, 'q05') for x in aqua.x]
aqua['hi'] = [x * factor(x, 'q95') for x in aqua.x]
hi_rows = aqua[aqua.cls == 'HIGH']
print('\n[4] Aqua-era region-month HIGH:', len(hi_rows), '| lower-90 bound still > p90:', int((hi_rows.lo > hi_rows.p90).sum()))
lo_rows = aqua[aqua.cls == 'LOW']
print('    Aqua-era region-month LOW:', len(lo_rows))

# ---------- 5. year-to-year variability (S-NPP era, region-month, active months) ----------
sn = am[(am.year >= 2013)].sort_values(['region', 'month', 'year']).copy()
sn['prev'] = sn.groupby(['region', 'month']).snpp_eq.shift(1)
sn = sn.dropna()
act = sn[(sn.prev >= 100) & (sn.snpp_eq >= 100)].copy()
act['abs_log2'] = np.abs(np.log2(act.snpp_eq / act.prev))
print('\n[5] |log2 ratio| consecutive years, region-month both >=100 (n=%d): p50 %.2f p75 %.2f p90 %.2f' %
      (len(act), act.abs_log2.quantile(.5), act.abs_log2.quantile(.75), act.abs_log2.quantile(.9)))
print('    => typical change x', round(2 ** act.abs_log2.quantile(.5), 2), '; p90 change x', round(2 ** act.abs_log2.quantile(.9), 2))

# ---------- 6. per-cell density for area comparison ----------
dens = ann[ann.era == 'C_2017_2025_snpp'].groupby('region').snpp_eq.median()
ncell = cells.region.value_counts()
ncell['ToanQuoc'] = len(cells)
dd = pd.DataFrame({'median_annual': dens.round(0), 'cells': ncell, 'per_cell': (dens / ncell).round(1)})
print('\n[6] 2017-2025 median annual, cells, per-cell\n', dd.to_string())

# ---------- 7. examples for the doc: TayNguyen March 2024, national March 2024 ----------
for area in ('TayNguyen', 'ToanQuoc', 'TayBac'):
    for w in windows:
        r = cl[(cl.area == area) & (cl.month == 3) & (cl.year == 2024) & (cl.window == w)].iloc[0]
        print(f'[7] {area} 03/2024 {w}: x={r.x:.1f} median={r["median"]:.1f} p90={r.p90:.1f} n={r.n} -> {r.cls}')
