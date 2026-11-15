import numpy as np, pandas as pd
T='D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/tables/'
h=pd.read_csv(T+'harmonized_025_month.csv').merge(pd.read_csv(T+'cells_025.csv')[['cell','region']],on='cell')
reg=h.groupby(['region','year','month'],as_index=False).snpp_eq.sum()
nat=h.groupby(['year','month'],as_index=False).snpp_eq.sum().assign(region='ToanQuoc')
am=pd.concat([reg,nat]); am=am[(am.year>=2003)&(am.year<=2025)]
rows=[]
for (a,m),g in am.groupby(['region','month']):
    s=dict(zip(g.year,g.snpp_eq))
    for y in range(2017,2026):
        base=[s[b] for b in range(2017,2026) if b!=y]
        p10,p90=np.percentile(base,[10,90]); x=s[y]
        rows.append('HIGH' if x>max(p90,1) else 'LOW' if x<p10 else 'TYPICAL')
print('post-break 2017-2025 LOO (n=8), era C shares %:', (pd.Series(rows).value_counts(normalize=True)*100).round(1).to_dict())
# percentile method sensitivity with n=22: share of HIGH under linear vs nearest-rank
rows2={'linear':[], 'nearest':[]}
for (a,m),g in am.groupby(['region','month']):
    s=dict(zip(g.year,g.snpp_eq))
    for y in range(2003,2026):
        base=np.array([s[b] for b in range(2003,2026) if b!=y]); x=s[y]
        for meth in rows2:
            p90=np.percentile(base,90,method='linear' if meth=='linear' else 'inverted_cdf')
            rows2[meth].append(x>max(p90,1))
print('HIGH share linear vs inverted_cdf %:', {k: round(100*np.mean(v),1) for k,v in rows2.items()})
# monthly activity distribution by area for minimum-activity discussion (2017-2025)
act=am[am.year>=2017].groupby(['region','month']).snpp_eq.median().unstack().round(0)
print(act.to_string())
