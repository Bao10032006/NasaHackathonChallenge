import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pandas as pd, events as E
df=pd.read_pickle('points.pkl'); df['dt']=pd.to_datetime(df['dt'])
b=df[E.passed_filter(df)&(df.year==2024)&(df.month==3)&(df.lat.between(11.5,15))&(df.lon.between(107,109))].copy()
pts,cl,_=E.run(b,1.0,24.0)
ev=pts.groupby('event').agg(n=('lat','size'),sats=('sat','nunique'),first=('dt','min'),last=('dt','max'))
cand=ev[(ev.sats>=2)&(ev.n.between(3,8))].sort_values('first')
e=cand.index[0]; print(cand.head(3))
cols=['lat','lon','dt','sat','dn','frp','conf','conf_modis','type','bright','cell','cluster']
print(pts[pts.event==e][cols].sort_values('dt').to_string())
print(cl[cl.event==e])
