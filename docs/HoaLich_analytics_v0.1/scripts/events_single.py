import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pandas as pd, events as E
df=pd.read_pickle('points.pkl'); df['dt']=pd.to_datetime(df['dt'])
base=df[E.passed_filter(df)]
T='D:/Semester 5/BE-NASAWEBAPP/backend/hoalich_data_v1/hoalich_data_v1/tables/'
nat=pd.read_csv(T+'harmonized_national_year.csv')[['year','hai_hoa_snpp_eq']].set_index('year')
out={}
for sat in ('SNPP','Aqua'):
    sub=base[(base.sat==sat)&(base.dn=='D')].copy()
    pts,cl,_=E.run(sub,1.0,24.0)
    ev=pts.groupby('event').dt.min().dt.year.value_counts().sort_index()
    out[sat+'_day_events']=ev
res=pd.DataFrame(out).join(nat)
res['snpp_events_per_1000_snpp_eq']=(res.SNPP_day_events/res.hai_hoa_snpp_eq*1000).round(1)
print(res.to_string())
res.to_csv('events_single_sat_by_year.csv')
