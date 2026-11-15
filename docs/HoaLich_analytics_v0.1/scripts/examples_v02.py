import math
import numpy as np
import pandas as pd

B = 'D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/'
D0 = pd.Timestamp('2000-11-01'); ND, NC = 9509, 587
val = np.fromfile(B + 'derived/daily-values.f32', dtype='<f4').reshape(ND, NC).astype('float64')
src = np.fromfile(B + 'derived/daily-source.u8', dtype='u1').reshape(ND, NC)
cells = pd.read_csv(B + 'tables/cells_025.csv')
dates = pd.date_range(D0, periods=ND, freq='D')
reg = cells.region.to_numpy()
AREAS = {r: np.where(reg == r)[0] for r in ['TayNguyen', 'TayBac', 'DBSCL', 'DBSH', 'Khac']}
AREAS['ToanQuoc'] = np.arange(NC)
ad = pd.DataFrame({a: val[:, i].sum(1) for a, i in AREAS.items()}, index=dates)
am = ad.resample('MS').sum(); am = am[am.index < '2026-11-01']
ALPHA = 0.1


def rank_class(x, base):
    n = len(base); j = math.floor(ALPHA * (n + 1))
    if j < 1: return 'INSUFFICIENT_BASELINE', n, None, None
    b = sorted(base); return ('HIGH' if x > b[-j] else 'LOW' if x < b[j - 1] else 'TYPICAL'), n, b[j - 1], b[-j]


# JSON1: TayBac 2024-03-05
d = pd.Timestamp('2024-03-05'); i = (d - D0).days; idx = AREAS['TayBac']
print('J1 TayBac 2024-03-05 snpp_eq', round(val[i, idx].sum(), 1), 'source codes', dict(zip(*np.unique(src[i, idx], return_counts=True))))
pts = pd.read_pickle('points.pkl'); pts['dt'] = pd.to_datetime(pts['dt'])
tb = set(cells.cell[cells.region == 'TayBac'])
p = pts[(pts.cell.isin(tb)) & (pts.dt.dt.date == d.date())]
print('  raw detections by sat/dn:', p.groupby(['sat', 'dn']).size().to_dict(), 'static', int(p.static.sum()))
modis = p.sat.isin(['Terra', 'Aqua'])
passed = (p.type == 0) & ((modis & (p.conf_modis >= 30)) | (~modis & p.conf.isin(['n', 'h']))) & (p.frp >= 5)
print('  passed event filter', int(passed.sum()), 'non-static day core', int(((~p.static) & (p.dn == 'D')).sum()))
mx = p.loc[p.frp.idxmax()]
print('  max FRP', mx['frp'], mx['sat'], mx['dt'], mx['conf'], mx['dn'])
print('  FRP p50 by sat (day):', p[p.dn == 'D'].groupby('sat').frp.median().round(1).to_dict())
ev = pd.read_pickle('events.pkl'); ep = pd.read_pickle('events_points.pkl')
e_day = ep[(ep.cell.isin(tb)) & (ep.dt.dt.date == d.date())]
evs = ev.loc[e_day.event.unique()]
print('  events observed that day', len(evs), 'new that day', int((evs['first'].dt.date == d.date()).sum()), 'clusters', e_day.cluster.nunique())
print('  cells with detection', p.cell.nunique(), 'of', len(tb))

# MoM example: national Feb->Mar 2026 vs historical ratio
s = am['ToanQuoc']
r26 = s['2026-03-01'] / s['2026-02-01']
hist = [s[f'{y}-03-01'] / s[f'{y}-02-01'] for y in range(2003, 2026)]
print('MoM national Mar/Feb 2026', round(r26, 3), 'values', round(s['2026-02-01'], 1), round(s['2026-03-01'], 1),
      'historical ratio median', round(np.median(hist), 3), 'rank class', rank_class(r26, hist)[0], 'p10/p90-like cuts', rank_class(r26, hist)[2:])

# 2026 HIGH area-months (operational, prior 2003-2025)
for a in AREAS:
    for m in range(1, 11):
        sm = am[a][am.index.month == m]
        x = sm[sm.index.year == 2026].iloc[0]; base = sm[(sm.index.year >= 2003) & (sm.index.year <= 2025)].tolist()
        c, n, lo, hi = rank_class(x, base)
        if c == 'HIGH':
            b = sorted(base); med = float(np.median(base))
            rec = sm[(sm.index.year >= 2017) & (sm.index.year <= 2025)].tolist(); c2 = rank_class(x, rec)
            print(f'HIGH 2026: {a} {m:02d} x={x:.1f} median={med:.1f} hi={hi:.1f} rank={1 + sum(v > x for v in base)}/{n + 1} deltaPct={(x / med - 1) * 100:.1f} | recent: {c2[0]} hi={c2[3]} median={np.median(rec):.1f} src={dict(zip(*np.unique(src[(dates.year == 2026) & (dates.month == m)][:, AREAS[a]], return_counts=True)))}')

# Theil-Sen slopes annual 2003-2025 and 2012-2025
ann = ad[(ad.index.year >= 2003) & (ad.index.year <= 2025)].resample('YS').sum()
def theil_sen(y):
    x = np.arange(len(y)); sl = [(y[j] - y[i]) / (j - i) for i in range(len(y)) for j in range(i + 1, len(y))]
    return float(np.median(sl))
for a in AREAS:
    y = ann[a].to_numpy(); y12 = ann[a][ann.index.year >= 2012].to_numpy()
    print(f'TheilSen {a}: 2003-2025 {theil_sen(y):.0f}/yr ({100 * theil_sen(y) / np.median(y):.1f}% of median), 2012-2025 {theil_sen(y12):.0f}/yr ({100 * theil_sen(y12) / np.median(y12):.1f}%), 2017-2025 {theil_sen(ann[a][ann.index.year >= 2017].to_numpy()):.0f}/yr')

# Season comparison: TayNguyen season totals & timing ranks
se = pd.read_csv('season_metrics.csv')
tn = se[se.area == 'TayNguyen'].reset_index(drop=True)
last = tn.iloc[-1]; prev = tn.iloc[:-1]
print('Season TN last', last.season, 'total', last.total, 'onset', last.onset, 'center', last.center, 'end', last.end, 'dur', last.duration, 'max30', last.max30_share)
for col in ('total', 'onset_doy', 'center_doy', 'end_doy', 'duration', 'max30_share'):
    c, n, lo, hi = rank_class(last[col], prev[col].tolist())
    print(f'   {col}: value {last[col]} median_prev {prev[col].median()} n={n} cuts {lo}/{hi} -> {c}')
print(tn[['season', 'total', 'onset', 'center', 'end', 'duration']].tail(4).to_string())

# AN-03 FRP example: SNPP day detections in TayNguyen March, prior years 2012-2023, rank threshold for 2024 detections
cn = pts.merge(cells[['cell', 'region']], on='cell')
g = cn[(cn.sat == 'SNPP') & (cn.dn == 'D') & (~cn.static) & (cn.region == 'TayNguyen') & (cn.month == 3)]
base = g[g.year <= 2023].frp.to_numpy(); tgt = g[g.year == 2024].frp.to_numpy()
p999 = np.quantile(base, 0.999); p99 = np.quantile(base, 0.99)
print(f'AN-03 SNPP-D TayNguyen March base n={len(base)} p99={p99:.1f} p99.9={p999:.1f}; 2024 n={len(tgt)} share>p99={100 * (tgt > p99).mean():.2f}% >p99.9={100 * (tgt > p999).mean():.2f}% max={tgt.max():.1f}')
