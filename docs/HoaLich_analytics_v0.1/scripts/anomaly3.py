import math, numpy as np, pandas as pd
T='D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/tables/'
h=pd.read_csv(T+'harmonized_025_month.csv').merge(pd.read_csv(T+'cells_025.csv')[['cell','region']],on='cell')
reg=h.groupby(['region','year','month'],as_index=False).snpp_eq.sum()
nat=h.groupby(['year','month'],as_index=False).snpp_eq.sum().assign(region='ToanQuoc')
am=pd.concat([reg,nat])
ALPHA=0.10
def rank_class(x, base):
    n=len(base); j=math.floor(ALPHA*(n+1))
    if j<1: return 'INSUFFICIENT_BASELINE'
    b=sorted(base)
    if x>b[-j]: return 'HIGH'
    if x<b[j-1]: return 'LOW'
    return 'TYPICAL'
# null check by simulation
rng=np.random.default_rng(2)
for n in (9,10,22):
    hi=np.mean([rank_class(rng.random(), list(rng.random(n)))=='HIGH' for _ in range(40000)])
    print('sim n=%d nominal j/(n+1)=%.3f observed HIGH=%.3f'%(n, math.floor(ALPHA*(n+1))/(n+1), hi))
ERA=lambda y:'A_2003_2011' if y<=2011 else 'B_2012_2016' if y<=2016 else 'C_2017_2025'
res=[]
for (a,m),g in am.groupby(['region','month']):
    s=dict(zip(g.year,g.snpp_eq))
    for y in range(2003,2026):
        res.append(dict(window='full_2003_2025', era=ERA(y), cls=rank_class(s[y],[s[b] for b in range(2003,2026) if b!=y])))
        if y>=2017:
            res.append(dict(window='post_2017_2025', era=ERA(y), cls=rank_class(s[y],[s[b] for b in range(2017,2026) if b!=y])))
    # 2026 complete months (1..10) against two windows
    if m<=10:
        x=s[2026]
        res.append(dict(window='full_2003_2025', era='D_2026', cls=rank_class(x,[s[b] for b in range(2003,2026)])))
        res.append(dict(window='post_2017_2025', era='D_2026', cls=rank_class(x,[s[b] for b in range(2017,2026)])))
r=pd.DataFrame(res)
print((r.groupby(['window','era']).cls.value_counts(normalize=True).unstack().fillna(0)*100).round(1).to_string())
print(r.groupby(['window','era']).size().to_string())
