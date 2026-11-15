import pandas as pd, numpy as np, json
df = pd.read_pickle('points.pkl')
df['dt'] = pd.to_datetime(df['dt'])
out = {}
print('dt range', df.dt.min(), df.dt.max())
print('sat x src\n', pd.crosstab(df.sat, df.src))
print('type counts\n', df.type.value_counts().sort_index())
print('type by src\n', pd.crosstab(df.type, df.src))
print('conf by sat\n', pd.crosstab(df.sat, df.conf, dropna=False))
print('nulls\n', df.isna().sum().to_string())
print('dn x static\n', pd.crosstab(df.dn, df.static))
print('seconds nonzero share', (df.dt.dt.second!=0).mean())
modis = df.sat.isin(['Terra','Aqua'])
print('modis conf_modis null', df.loc[modis,'conf_modis'].isna().sum(), 'viirs conf null', df.loc[~modis,'conf'].isna().sum())
print('frp<=0', (df.frp<=0).sum(), 'frp null', df.frp.isna().sum())
print('frp quantiles by sat\n', df.groupby('sat').frp.quantile([.25,.5,.75,.9]).unstack())
print('share frp>=5 by sat\n', df.assign(f=df.frp>=5).groupby('sat').f.mean())
# event filter (rule 1)
viirs = ~modis
qual = (modis & (df.conf_modis>=30)) | (viirs & df.conf.isin(['n','h']))
t0 = df.type==0
f5 = df.frp>=5
passed = t0 & qual & f5
print('PASS rule1 total', passed.sum())
print('pass by sat\n', passed.groupby(df.sat).sum())
print('pass by src\n', passed.groupby(df.src).sum())
# reasons (not exclusive)
reasons = pd.DataFrame({
 'type_missing_nrt': df.type==-1,
 'type_1': df.type==1,'type_2': df.type==2,'type_3': df.type==3,
 'low_conf': ~qual,
 'frp_lt5': df.frp<5,
})
print('reason counts\n', reasons.sum())
# NRT that would pass if type treated by static mask
nrt = df.src=='nrt'
alt = nrt & ~df.static & qual & f5
print('NRT would pass if type proxy=static mask:', alt.sum(), 'of NRT', nrt.sum())
print('NRT date range', df.loc[nrt,'dt'].min(), df.loc[nrt,'dt'].max())
print('pass & static==True', (passed & df.static).sum())
print('pass & dn', pd.crosstab(passed, df.dn))
# brightness flags
b = df.bright
day = df.dn=='D'
flag = pd.Series('not_evaluated', index=df.index)
inval = b.isna() | (b<250)
m = modis & day & ~inval; flag[m] = np.where(b[m]>360,'above','not_above')
m = modis & ~day & ~inval; flag[m] = np.where(b[m]>320,'above','not_above')
m = viirs & ~day & ~inval; flag[m] = np.where(b[m]>320,'above_temp_only','not_above')
m = viirs & day & ~inval; flag[m] = 'no_fixed_threshold'
print('bright flag among passed\n', flag[passed].value_counts())
print('viirs bright==367 share among passed viirs', ((b==367)&passed&viirs).sum()/ (passed&viirs).sum())
print('bright<250 among passed', (inval & passed).sum())
# by year passed counts (day only and all)
yr = df[passed].groupby(['year']).size()
print(yr.to_string())
