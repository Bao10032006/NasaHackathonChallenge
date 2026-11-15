import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pandas as pd, events as E
df=pd.read_pickle('points.pkl'); df['dt']=pd.to_datetime(df['dt'])
base=df[E.passed_filter(df)]
sub=base[(base.sat=='N20')&(base.dn=='D')].copy()
pts,cl,_=E.run(sub,1.0,24.0)
n20=pts.groupby('event').dt.min().dt.year.value_counts().sort_index().rename('N20_day_events')
s=pd.read_csv('events_single_sat_by_year.csv').set_index('dt')
r=s.join(n20,how='outer')
r['N20_per_SNPP']=(r.N20_day_events/r.SNPP_day_events).round(3)
print(r.loc[2018:2026,['SNPP_day_events','N20_day_events','N20_per_SNPP']].to_string())
r.to_csv('events_single_sat_by_year.csv')
# last archive date per sat for events
print(base.groupby('sat').dt.max())
