import math, numpy as np, pandas as pd
p=pd.read_pickle('points.pkl'); p['dt']=pd.to_datetime(p['dt'])
r=p.groupby(['sat','src']).dt.agg(['min','max','size'])
print('[raw ranges]\n', r.to_string())
B='D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/'
h=pd.read_csv(B+'tables/harmonized_025_month.csv')
pv=h[(h.year>=2003)&(h.year<=2025)].pivot_table(index=['cell','month'],columns='year',values='snpp_eq')
V=pv.to_numpy(); years=list(pv.columns)
ALPHA=0.1
rows=[]
for yi,y in enumerate(years):
    if y<2012: continue
    base=V[:, :yi]  # prior years only (operational)
    n=base.shape[1]; j=math.floor(ALPHA*(n+1))
    if j<1: continue
    sb=np.sort(base,axis=1)
    hi=sb[:,-j]; lo=sb[:,j-1]; med=np.median(base,axis=1); x=V[:,yi]
    rows.append(pd.DataFrame({'year':y,'n':n,'nominal':j/(n+1),'med':med,'high':x>hi,'low':x<lo}))
d=pd.concat(rows)
bins=[-0.01,0,1,5,20,100,np.inf]; labels=['0','(0,1]','(1,5]','(5,20]','(20,100]','>100']
d['bin']=pd.cut(d.med,bins=bins,labels=labels)
for name,sel in (('calib 2012-2016',d.year<=2016),('eval 2017-2025',d.year>=2017)):
    g=d[sel].groupby('bin',observed=True).agg(cases=('high','size'),high=('high','mean'),low=('low','mean'),nominal=('nominal','mean'))
    print(f'\n[{name}] operational cell-month rank labels by prior-year median bin\n', (g.assign(high=lambda t:(t.high*100).round(1),low=lambda t:(t.low*100).round(1),nominal=lambda t:(t.nominal*100).round(1))).to_string())
