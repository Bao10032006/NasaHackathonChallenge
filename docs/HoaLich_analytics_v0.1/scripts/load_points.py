import pandas as pd, sys, time
t=time.time()
src = sys.argv[1]
df = pd.read_csv(src, compression='gzip', low_memory=False)
print(df.shape, round(time.time()-t,1),'s')
print(df.dtypes.to_string())
print(df.head(3).to_string())
df.to_parquet('points.parquet') if False else None
df.to_pickle('points.pkl')
