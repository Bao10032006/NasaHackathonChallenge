import math, numpy as np, pandas as pd
B='D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/'
D0=pd.Timestamp('2000-11-01'); ND,NC=9509,587
val=np.fromfile(B+'derived/daily-values.f32','<f4').reshape(ND,NC).astype(float)
cells=pd.read_csv(B+'tables/cells_025.csv'); dates=pd.date_range(D0,periods=ND)
tn=np.where(cells.region=='TayNguyen')[0]
s=pd.Series(val[:,tn].sum(1),index=dates).resample('MS').sum()
mar={d.year:v for d,v in s[s.index.month==3].items()}
base=sorted(mar[y] for y in range(2003,2025)); n=len(base); j=math.floor(0.1*(n+1))
x=mar[2025]; print('TN 03/2025 operational FULL 2003-2024 n',n,'j',j,'x',x,'lo',base[j-1],'hi',base[-j],'median',np.median(base), 'cls', 'HIGH' if x>base[-j] else 'LOW' if x<base[j-1] else 'TYPICAL')
# SPC-03 total variation distance between years (national cell shares)
cy=pd.DataFrame(val,index=dates).resample('YS').sum()
def tv(a,b):
    A=cy.loc[str(a)].to_numpy()[0]; Bv=cy.loc[str(b)].to_numpy()[0]; return 0.5*np.abs(A/A.sum()-Bv/Bv.sum()).sum()
for a,b in ((2015,2016),(2016,2017),(2023,2024),(2024,2025),(2005,2024)): print('TV',a,b,round(tv(a,b),3))
tvs=[tv(y,y+1) for y in range(2012,2025)]; print('TV consecutive 2012-2025 p50/max', round(np.median(tvs),3), round(max(tvs),3))
p=pd.read_pickle('points.pkl'); p['dt']=pd.to_datetime(p['dt'])
core=p[(~p.static)&(p.dn=='D')]
# SPC-01 cells with S-NPP day detection per year
sc=core[core.sat=='SNPP'].groupby('year').cell.nunique(); print('SPC-01 cells with SNPP det', sc.loc[[2015,2016,2017,2024,2025]].to_dict())
# DQ-04 daily N20/SNPP national ratio
d=core[core.sat.isin(['SNPP','N20'])&(core.year.between(2019,2025))].groupby([core.dt.dt.date,'sat']).size().unstack().dropna()
d=d[(d.SNPP>=100)&(d.N20>=100)]; r=d.N20/d.SNPP
print('DQ-04 daily N20/SNPP (both>=100) n',len(r),'p05/p50/p95',round(r.quantile(.05),2),round(r.median(),2),round(r.quantile(.95),2),'min/max',round(r.min(),2),round(r.max(),2))
# AC-03 / FRP-03: S-NPP observation groups 2024-03-05 national
s5=p[(p.sat=='SNPP')&(p.dt.dt.date==pd.Timestamp('2024-03-05').date())].sort_values('dt')
g=(s5.dt.diff().dt.total_seconds().fillna(0)>600).cumsum()
print('SNPP 2024-03-05 groups', s5.groupby(g).agg(start=('dt','min'),n=('frp','size'),frp_sum=('frp','sum'),frp_max=('frp','max'),dn=('dn','first')).round(1).to_string())
