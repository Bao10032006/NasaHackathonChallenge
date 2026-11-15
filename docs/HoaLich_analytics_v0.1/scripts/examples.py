import math, numpy as np, pandas as pd
T='D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/tables/'
h=pd.read_csv(T+'harmonized_025_month.csv').merge(pd.read_csv(T+'cells_025.csv')[['cell','region']],on='cell')
reg=h.groupby(['region','year','month'],as_index=False).snpp_eq.sum()
nat=h.groupby(['year','month'],as_index=False).snpp_eq.sum().assign(region='ToanQuoc')
am=pd.concat([reg,nat])
def ex(area,month,year,y0,y1):
    g=am[(am.region==area)&(am.month==month)]; s=dict(zip(g.year,g.snpp_eq)); x=s[year]
    base=sorted(s[b] for b in range(y0,y1+1) if b!=year); n=len(base); j=math.floor(0.1*(n+1))
    med=float(np.median(base)); mad=float(np.median(np.abs(np.array(base)-med)))
    pct=100*(sum(b<x for b in base)+0.5*sum(b==x for b in base))/n
    rank=1+sum(b>x for b in base)
    cls='INSUFFICIENT_BASELINE' if j<1 else 'HIGH' if x>base[-j] else 'LOW' if x<base[j-1] else 'TYPICAL'
    print(f'{area} {month:02d}/{year} base {y0}-{y1} n={n} j={j} x={x:.1f} median={med:.1f} lowCut={base[j-1] if j else None} highCut={base[-j] if j else None} '
          f'delta={x-med:.1f} deltaPct={(x/med-1)*100:.1f} pct={pct:.1f} rank={rank}/{n+1} robustZ={(x-med)/(1.4826*mad):.2f} -> {cls}')
for a in ('TayNguyen','ToanQuoc'):
    ex(a,3,2024,2003,2025); ex(a,3,2024,2017,2025); ex(a,3,2026,2003,2025); ex(a,3,2026,2017,2025)
# comparison example: TayNguyen March 2024 vs March 2025, and per-cell density TayNguyen vs DBSCL March 2024
g=am[am.month==3].set_index(['region','year']).snpp_eq
print('TN 03/2024 vs 03/2025', g['TayNguyen',2024], g['TayNguyen',2025], round((g['TayNguyen',2025]/g['TayNguyen',2024]-1)*100,1))
print('DBSCL 03/2024', g['DBSCL',2024], 'per cell', round(g['DBSCL',2024]/71,1), 'TN per cell', round(g['TayNguyen',2024]/122,1))
# era-crossing example: TayNguyen March 2010 vs March 2024 with interval for 2010
hc=h[(h.region=='TayNguyen')&(h.month==3)&(h.year==2010)]
print('TN 03/2010', round(hc.snpp_eq.sum(),1), 'src', hc.src.unique())
unc=pd.read_csv(T+'uncertainty_table.csv'); q=unc[(unc.don_vi=='thang')&(unc.cap=='vung')]
x=hc.snpp_eq.sum(); r=q[(q.pred_lo<=x)&(x<q.pred_hi)].iloc[0]
print('  90% interval via region table', round(x*r.q05,1), round(x*r.q95,1), 'factors', r.q05, r.q95)
