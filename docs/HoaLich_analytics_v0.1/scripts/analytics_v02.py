"""Extra analyses for v0.2: daily artifact, operational baselines, seasons, change points, 12 scenarios."""
import math
import numpy as np
import pandas as pd

B = 'D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/'
D0 = pd.Timestamp('2000-11-01')
ND, NC = 9509, 587
val = np.fromfile(B + 'derived/daily-values.f32', dtype='<f4').reshape(ND, NC).astype('float64')
src = np.fromfile(B + 'derived/daily-source.u8', dtype='u1').reshape(ND, NC)
cnt = np.fromfile(B + 'derived/daily-input-count.i16', dtype='<i2').reshape(ND, NC)
cells = pd.read_csv(B + 'tables/cells_025.csv')
dates = pd.date_range(D0, periods=ND, freq='D')
regions = cells.region.to_numpy()
AREAS = {r: np.where(regions == r)[0] for r in ['TayNguyen', 'TayBac', 'DBSCL', 'DBSH', 'Khac']}
AREAS['ToanQuoc'] = np.arange(NC)
area_day = pd.DataFrame({a: val[:, idx].sum(1) for a, idx in AREAS.items()}, index=dates)
print('check: national 2024 total', round(area_day.loc['2024', 'ToanQuoc'].sum(), 1))

ALPHA = 0.10


def rank_class(x, base):
    base = [b for b in base if b is not None and not np.isnan(b)]
    n = len(base)
    j = math.floor(ALPHA * (n + 1))
    if j < 1:
        return 'INSUFFICIENT_BASELINE', n, None, None
    b = sorted(base)
    lo, hi = b[j - 1], b[-j]
    return ('HIGH' if x > hi else 'LOW' if x < lo else 'TYPICAL'), n, lo, hi


# ---------- 1. operational (prior-years-only) monthly baselines ----------
am = area_day.resample('MS').sum()
am = am[am.index < '2026-11-01']
ERA = lambda y: 'A_2003_2011' if y <= 2011 else 'B_2012_2016' if y <= 2016 else 'C_2017_2025' if y <= 2025 else 'D_2026'
rows = []
for a in AREAS:
    s = am[a]
    for m in range(1, 13):
        sm = {d.year: v for d, v in s[s.index.month == m].items()}
        for y in sorted(sm):
            if y < 2003:
                continue
            base = [sm[b] for b in range(2003, y) if b in sm]
            cls, n, lo, hi = rank_class(sm[y], base)
            rows.append(dict(area=a, month=m, year=y, era=ERA(y), cls=cls, n=n))
op = pd.DataFrame(rows)
t = op[op.cls != 'INSUFFICIENT_BASELINE'].groupby('era').cls.value_counts(normalize=True).unstack().mul(100).round(1)
print('\n[1] OPERATIONAL expanding prior-years baseline (2003..y-1), n>=9 -> first labelled year 2012\n', t.to_string())
print('    first year with label:', op[op.cls != 'INSUFFICIENT_BASELINE'].year.min())

# ---------- 2. local date vs UTC date ----------
pts = pd.read_pickle('points.pkl')
pts['dt'] = pd.to_datetime(pts['dt'])
local = pts.dt + pd.Timedelta(hours=7)
diff = (local.dt.date != pts.dt.dt.date)
print('\n[2] local(UTC+7) date != UTC date share by day/night:', diff.groupby(pts.dn).mean().round(4).to_dict())
print('    UTC hour range by dn:', pts.groupby('dn').dt.agg(lambda s: (s.dt.hour.min(), s.dt.hour.max())).to_dict())

# ---------- 3. overdispersion of daily detection counts (S-NPP day non-static, region-day, March 2013-2025) ----------
core = pts[(~pts.static) & (pts.dn == 'D')].copy()
core['date'] = core.dt.dt.date
core = core.merge(cells[['cell', 'region']], on='cell', how='left')
sn = core[core.sat == 'SNPP']
rd = sn.groupby(['region', 'date']).size()
for r in ['TayNguyen', 'TayBac', 'DBSCL']:
    idx = pd.date_range('2013-01-01', '2025-12-31')
    idx = idx[idx.month == 3]
    v = rd.get(r, pd.Series(dtype=float)).reindex(idx.date, fill_value=0)
    print(f'[3] {r} March daily S-NPP detections: mean {v.mean():.1f} var {v.var():.1f} var/mean {v.var() / v.mean():.1f} zero-days {100 * (v == 0).mean():.1f}%')

# ---------- 4. multiple comparisons ----------
print('\n[4] Expected chance flags per day at alpha=0.10 one side over 587 cells:', round(0.10 * 587, 1),
      '; with j/(n+1)=2/23:', round(2 / 23 * 587, 1))

# ---------- 5. season metrics (season year starts month after climatological minimum) ----------
clim = am[(am.index.year >= 2003) & (am.index.year <= 2025)].groupby(am.index[(am.index.year >= 2003) & (am.index.year <= 2025)].month).median()
season_start = {}
for a in AREAS:
    mmin = int(clim[a].idxmin())
    season_start[a] = mmin % 12 + 1
print('\n[5] climatological minimum month -> season-year start month:', {a: (int(clim[a].idxmin()), season_start[a]) for a in AREAS})
srows = []
for a in AREAS:
    s0 = season_start[a]
    s = area_day[a]
    for y in range(2003, 2026):
        start = pd.Timestamp(year=y, month=s0, day=1)
        end = start + pd.DateOffset(years=1) - pd.Timedelta(days=1)
        if end > pd.Timestamp('2026-11-13'):
            continue
        seg = s[start:end]
        c = seg.cumsum() / seg.sum()
        on = (c >= 0.10).idxmax(); pk = (c >= 0.50).idxmax(); off = (c >= 0.90).idxmax()
        dur = (off - on).days + 1
        top = seg.rolling(30).sum().max() / seg.sum()
        srows.append(dict(area=a, season=f'{y}-{y + 1}', start=start.date(), onset=on.date(), center=pk.date(), end=off.date(),
                          onset_doy=(on - start).days, center_doy=(pk - start).days, end_doy=(off - start).days, duration=dur,
                          max30_share=round(top, 3), total=round(seg.sum(), 1)))
se = pd.DataFrame(srows)
se.to_csv('season_metrics.csv', index=False)
summ = se.groupby('area')[['onset_doy', 'center_doy', 'end_doy', 'duration', 'max30_share']].agg(['median', 'std']).round(1)
print(summ.to_string())
print(se[se.area == 'TayNguyen'][['season', 'onset', 'center', 'end', 'duration', 'max30_share', 'total']].tail(5).to_string())

# ---------- 6. Pettitt change point on annual totals 2003-2025 ----------
def pettitt(x):
    x = np.asarray(x); n = len(x)
    U = np.array([sum(np.sign(x[i] - x[j]) for i in range(t + 1) for j in range(t + 1, n)) for t in range(n - 1)])
    k = int(np.argmax(np.abs(U))); K = abs(U[k])
    p = 2 * math.exp(-6 * K ** 2 / (n ** 3 + n ** 2))
    return k, K, min(1.0, p)


ann = area_day[(area_day.index.year >= 2003) & (area_day.index.year <= 2025)].resample('YS').sum()
print('\n[6] Pettitt on annual totals 2003-2025 (last year of first segment, p approx):')
for a in AREAS:
    k, K, p = pettitt(ann[a].to_numpy())
    print(f'   {a}: change after {2003 + k} (first year of new regime {2004 + k}), K={K}, p~{p:.4f}')

# ---------- 7. scenarios ----------
print('\n[7] SCENARIOS')
# S1/S2 day7 operational baseline in S-NPP era (2012..y-1 prior same window)
def day7(a, d, y0=2012):
    s = area_day[a]
    x = s[d - pd.Timedelta(days=3): d + pd.Timedelta(days=3)].sum()
    base = []
    for y in range(y0, d.year):
        try:
            dd = d.replace(year=y)
        except ValueError:
            dd = d.replace(year=y, day=28)
        base.append(s[dd - pd.Timedelta(days=3): dd + pd.Timedelta(days=3)].sum())
    return x, base


cands = []
for a in ['TayNguyen', 'TayBac', 'DBSCL', 'Khac', 'DBSH']:
    for d in pd.date_range('2024-01-04', '2024-12-28'):
        x, base = day7(a, d)
        cls, n, lo, hi = rank_class(x, base)
        cands.append(dict(area=a, date=d.date(), day=area_day.loc[d, a], x7=x, n=n, lo=lo, hi=hi, med=float(np.median(base)), cls=cls))
cd = pd.DataFrame(cands)
s1 = cd[cd.cls == 'TYPICAL'].sort_values('day', ascending=False).head(1)
s2 = cd[(cd.cls == 'HIGH')].sort_values('x7').head(3)
print('S1 big day but TYPICAL:\n', s1.round(1).to_string())
print('S2 small but HIGH:\n', s2.round(1).to_string())

# S3 outage day
gaps = pd.read_csv(B + 'tables/data_gaps.csv')
g = gaps[(gaps.sat == 'SNPP') & (gaps.pham_vi == 'toan_quoc')]
print('S3 S-NPP national gaps:\n', g.to_string())
d3 = pd.Timestamp(g.iloc[-1].start)
i3 = (d3 - D0).days
print('   ', d3.date(), 'national value', round(val[i3].sum(), 1), 'source codes', np.unique(src[i3], return_counts=True),
      'raw SNPP day detections that date', int(((pts.sat == 'SNPP') & (pts.dt.dt.date == d3.date())).sum()))

# S4 partial month Nov 1-13 2026
s = area_day['ToanQuoc']
x4 = s['2026-11-01':'2026-11-13'].sum()
b4 = {y: s[f'{y}-11-01':f'{y}-11-13'].sum() for y in range(2003, 2026)}
cls, n, lo, hi = rank_class(x4, list(b4.values()))
print(f'S4 national 1-13/11/2026 = {x4:.1f}; same span 2003-2025 median {np.median(list(b4.values())):.1f} n={n} cuts {lo:.1f}/{hi:.1f} -> {cls}; full Nov median {np.median([s[f"{y}-11-01":f"{y}-11-30"].sum() for y in range(2003, 2026)]):.1f}; 2025 same span {b4[2025]:.1f}')
b4r = [b4[y] for y in range(2017, 2026)]
print('    recent 2017-2025 same span:', rank_class(x4, b4r)[0], 'median', round(np.median(b4r), 1))

# S5 baseline zero (region pentad/cell month)
hm = pd.read_csv(B + 'tables/harmonized_025_month.csv')
pv = hm[(hm.year >= 2003) & (hm.year <= 2025)].pivot_table(index=['cell', 'month'], columns='year', values='snpp_eq')
z = pv[(pv.drop(columns=2024).median(axis=1) == 0) & (pv[2024] > 3)]
ex = z.iloc[0]
print('S5 cell-month with zero median and X>3 in 2024:', len(z), 'cases; example', z.index[0], '2024 =', ex[2024], 'baseline years >0:', int((ex.drop(2024) > 0).sum()), 'of 22')

# S6 raw count jump vs snpp_eq
raw_day = core.groupby(core.dt.dt.year).size()
nat_y = area_day['ToanQuoc'].resample('YS').sum()
for y in (2011, 2012, 2017, 2018, 2022, 2023):
    print(f'S6 {y}: raw day non-static detections all sats {raw_day[y]:,}; snpp_eq {nat_y[str(y)].iloc[0]:,.0f}')

# S7 high FRP low confidence
lowc = pts[(pts.conf == 'l') & (~pts.static)]
print('S7 low-confidence points with FRP>=100 MW:', int((lowc.frp >= 100).sum()), 'of', len(lowc), '; VIIRS bright<250K count', int(((pts.bright < 250) & ~pts.sat.isin(['Terra', 'Aqua']) & (~pts.static) & (pts.dn == 'D')).sum()),
      'median FRP', round(pts[(pts.bright < 250) & ~pts.sat.isin(['Terra', 'Aqua']) & (~pts.static) & (pts.dn == 'D')].frp.median(), 1))
exr = lowc[lowc.frp >= 100].sort_values('frp', ascending=False).iloc[0]
print('   example', exr[['lat', 'lon', 'dt', 'sat', 'dn', 'frp', 'conf', 'bright', 'cell']].to_dict())

# S9 estimated value but no input detection
est = (src == 2) & (val > 0)
noinp = est & (cnt == 0)
print('S9 cell-days source=AQUA with value>0:', int(est.sum()), '; of which input count 0:', int(noinp.sum()), f'({100 * noinp.sum() / est.sum():.1f}%)',
      '; snpp_eq carried by those:', round(val[noinp].sum(), 1), 'of', round(val[est].sum(), 1))
i9 = (pd.Timestamp('2010-03-15') - D0).days
c9 = np.where(noinp[i9])[0]
c9 = c9[np.argmax(val[i9, c9])]
print('   example 2010-03-15 cell', cells.cell[c9], 'value', round(val[i9, c9], 3), 'input count', cnt[i9, c9], 'source', src[i9, c9])

# S11 more detections but not more days (S-NPP day non-static, region, year over year)
sn = core[core.sat == 'SNPP']
ry = sn.groupby(['region', sn.dt.dt.year]).agg(det=('lat', 'size'), days=('date', 'nunique'))
ry['det_chg'] = ry.groupby(level=0).det.pct_change() * 100
ry['days_chg'] = ry.groupby(level=0).days.pct_change() * 100
c11 = ry[(ry.det_chg > 20) & (ry.days_chg <= 0)]
print('S11 region-years with detections +>20% but detection-days not up:\n', c11.round(1).to_string())

# S12 FRP>=5 filter vs unfiltered trend (S-NPP day non-static)
yy = sn.groupby(sn.dt.dt.year).agg(all=('lat', 'size'), f5=('frp', lambda s: int((s >= 5).sum())))
yy['share_f5'] = (yy.f5 / yy['all']).round(3)
print('S12 S-NPP day non-static: all vs FRP>=5 by year\n', yy.to_string())

# FRP stats by sensor and day/night (non-static)
q = pts[~pts.static].groupby(['sat', 'dn']).frp.quantile([.5, .9, .99]).unstack().round(1)
print('\nFRP quantiles by sat x dn (non-static)\n', q.to_string())
bq = pts[~pts.static].groupby(['sat', 'dn']).bright.quantile([.05, .5, .95]).unstack().round(1)
print('brightness quantiles\n', bq.to_string())

# new-location rule: S-NPP day 2024 detections in 0.01 / 0.05 deg grids never seen 2012-2023
for res in (0.01, 0.05):
    k = (np.floor(sn.lat / res).astype(int).astype(str) + '_' + np.floor(sn.lon / res).astype(int).astype(str))
    hist = set(k[sn.dt.dt.year <= 2023])
    k24 = k[sn.dt.dt.year == 2024]
    print(f'new-location share 2024 at {res} deg: {100 * (~k24.isin(hist)).mean():.1f}% of detections; grid cells {k24[~k24.isin(hist)].nunique()} new of {k24.nunique()}')

# spatial concentration: share of national annual snpp_eq in top 10% cells (59 cells)
cy = pd.DataFrame(val, index=dates).resample('YS').sum()
for y in (2005, 2010, 2015, 2020, 2024, 2025):
    v = np.sort(cy.loc[str(y)].to_numpy()[0])[::-1]
    print(f'concentration {y}: top 59 cells share {100 * v[:59].sum() / v.sum():.1f}%, cells with snpp_eq>=1: {(v >= 1).sum()}')
