"""Experimental implementation of QUY_TAC_NHAN_DIEN_SU_KIEN_CHAY experimental_v1 (steps 1, 3, 4).

DBSCAN(eps, min_samples=1, haversine) == connected components of the "distance <= eps" graph,
so it is implemented with a 0.01 degree grid hash + union-find (no scipy/sklearn locally).
"""
import math
import sys
import time
from collections import defaultdict

import numpy as np
import pandas as pd

R = 6371.0088
GRID = 0.01  # degrees; >= 1.0 km in latitude and >= 1.02 km in longitude for lat <= 23.5


def hav_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1.0, math.sqrt(a)))


def passed_filter(df):
    modis = df.sat.isin(['Terra', 'Aqua'])
    qual = (modis & (df.conf_modis >= 30)) | (~modis & df.conf.isin(['n', 'h']))
    return (df.type == 0) & qual & (df.frp >= 5)


def time_groups(times_min):
    """Greedy groups of max span `window` minutes on sorted times (minutes since epoch)."""
    out = np.empty(len(times_min), dtype=np.int64)
    g = -1
    anchor = None
    for i, t in enumerate(times_min):
        if anchor is None or t - anchor > WINDOW_MIN:
            g += 1
            anchor = t
        out[i] = g
    return out


def components(lat, lon, eps_km):
    n = len(lat)
    parent = list(range(n))

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    cell = GRID * max(1.0, math.ceil(eps_km / 1.0))
    reach = 1
    buckets = defaultdict(list)
    keys = [(int(math.floor(la / cell)), int(math.floor(lo / cell))) for la, lo in zip(lat, lon)]
    for i, k in enumerate(keys):
        buckets[k].append(i)
    for i, (ky, kx) in enumerate(keys):
        for dy in range(-reach, reach + 1):
            for dx in range(-reach, reach + 1):
                for j in buckets.get((ky + dy, kx + dx), ()):
                    if j <= i:
                        continue
                    if hav_km(lat[i], lon[i], lat[j], lon[j]) <= eps_km:
                        ri, rj = find(i), find(j)
                        if ri != rj:
                            parent[rj] = ri
    return [find(i) for i in range(n)]


def run(pts, eps_km=1.0, gap_h=24.0):
    pts = pts.sort_values(['sat', 'dt']).reset_index(drop=True)
    tmin = (pts.dt.astype('int64') // 60_000_000_000).to_numpy()
    cluster_id = np.empty(len(pts), dtype=np.int64)
    next_cluster = 0
    group_sizes = []
    for sat, idx in pts.groupby('sat').indices.items():
        idx = np.sort(idx)
        groups = time_groups(tmin[idx])
        for g in np.unique(groups):
            sub = idx[groups == g]
            group_sizes.append(len(sub))
            roots = components(pts.lat.to_numpy()[sub].tolist(), pts.lon.to_numpy()[sub].tolist(), eps_km)
            remap = {}
            for k, r in zip(sub, roots):
                if r not in remap:
                    remap[r] = next_cluster
                    next_cluster += 1
                cluster_id[k] = remap[r]
    pts['cluster'] = cluster_id

    # ---- link clusters into events (time order, cross-satellite) ----
    cl = pts.groupby('cluster').agg(t=('dt', 'min'), sat=('sat', 'first'), n=('lat', 'size'))
    cl = cl.sort_values('t')
    members = pts.groupby('cluster').indices
    lat_all = pts.lat.to_numpy()
    lon_all = pts.lon.to_numpy()
    gap = pd.Timedelta(hours=gap_h)
    cell = GRID * max(1.0, math.ceil(eps_km / 1.0))
    index = defaultdict(set)          # grid key -> event ids (keys of the event's latest cluster)
    ev_keys = {}                       # event -> keys currently indexed
    ev_last_t = {}
    ev_last_pts = {}                   # event -> list of point indices of its latest cluster(s)
    cluster_event = {}
    link_status = {}
    next_event = 0
    for cid, row in cl.iterrows():
        p = members[cid]
        t = row.t
        cand = set()
        for i in p:
            ky, kx = int(math.floor(lat_all[i] / cell)), int(math.floor(lon_all[i] / cell))
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    cand |= index.get((ky + dy, kx + dx), set())
        matches = []
        for e in cand:
            if t - ev_last_t[e] > gap:
                continue
            q = ev_last_pts[e]
            hit = False
            for i in p:
                for j in q:
                    if hav_km(lat_all[i], lon_all[i], lat_all[j], lon_all[j]) <= eps_km:
                        hit = True
                        break
                if hit:
                    break
            if hit:
                matches.append(e)
        if len(matches) == 1:
            e = matches[0]
            status = 'LINKED'
        else:
            e = next_event
            next_event += 1
            status = 'AMBIGUOUS' if len(matches) > 1 else 'NEW'
        cluster_event[cid] = e
        link_status[cid] = status
        # update "latest cluster" of event e
        if e in ev_last_t and ev_last_t[e] == t:
            ev_last_pts[e] = list(ev_last_pts[e]) + list(p)
        else:
            ev_last_pts[e] = list(p)
        ev_last_t[e] = t
        for k in ev_keys.get(e, ()):
            index[k].discard(e)
        keys = {(int(math.floor(lat_all[i] / cell)), int(math.floor(lon_all[i] / cell))) for i in ev_last_pts[e]}
        for k in keys:
            index[k].add(e)
        ev_keys[e] = keys
    pts['event'] = pts.cluster.map(cluster_event)
    cl['event'] = cl.index.map(cluster_event)
    cl['status'] = cl.index.map(link_status)
    return pts, cl, group_sizes


def summarize(pts, cl, label):
    ev = pts.groupby('event').agg(
        n=('lat', 'size'), first=('dt', 'min'), last=('dt', 'max'),
        sats=('sat', 'nunique'), cells=('cell', 'nunique'))
    ev['clusters'] = cl.groupby('event').size()
    ev['dur_h'] = (ev['last'] - ev['first']).dt.total_seconds() / 3600
    amb_events = set(cl.loc[cl.status == 'AMBIGUOUS', 'event'])
    clear = ev[~ev.index.isin(amb_events)]
    res = {
        'label': label,
        'detections': int(len(pts)),
        'clusters': int(len(cl)),
        'single_point_clusters_pct': round(100 * (pts.groupby('cluster').size() == 1).mean(), 1),
        'events_total': int(len(ev)),
        'ambiguous_clusters': int((cl.status == 'AMBIGUOUS').sum()),
        'events_clear': int(len(clear)),
        'single_detection_events_pct': round(100 * (ev.n == 1).mean(), 1),
        'single_cluster_events_pct': round(100 * (ev.clusters == 1).mean(), 1),
        'multi_sat_events_pct': round(100 * (ev.sats > 1).mean(), 1),
        'multi_cell_events_pct': round(100 * (ev.cells > 1).mean(), 1),
        'detections_per_event_p50': float(ev.n.median()),
        'detections_per_event_p90': float(ev.n.quantile(.9)),
        'detections_per_event_max': int(ev.n.max()),
        'obs_span_h_p50': round(float(ev.dur_h.median()), 1),
        'obs_span_h_p90': round(float(ev.dur_h.quantile(.9)), 1),
        'obs_span_h_max': round(float(ev.dur_h.max()), 1),
        'events_span_gt_7d': int((ev.dur_h > 168).sum()),
    }
    return res, ev


WINDOW_MIN = 10

if __name__ == '__main__':
    df = pd.read_pickle('points.pkl')
    df['dt'] = pd.to_datetime(df['dt'])
    mode = sys.argv[1]
    base = df[passed_filter(df)].copy()
    rows = []
    if mode == 'sens2024':
        sub = base[base.year == 2024]
        for eps in (0.5, 1.0, 2.0):
            for gap in (12.0, 24.0, 48.0):
                t0 = time.time()
                pts, cl, gs = run(sub.copy(), eps, gap)
                r, _ = summarize(pts, cl, f'2024 eps={eps}km gap={gap}h')
                r['secs'] = round(time.time() - t0, 1)
                rows.append(r)
                print(r, flush=True)
        for w in (5, 10, 20):
            WINDOW_MIN = w
            pts, cl, gs = run(sub.copy(), 1.0, 24.0)
            r, _ = summarize(pts, cl, f'2024 window={w}min')
            rows.append(r)
            print(r, flush=True)
        WINDOW_MIN = 10
        pd.DataFrame(rows).to_csv('events_sensitivity_2024.csv', index=False)
    elif mode == 'full':
        t0 = time.time()
        pts, cl, gs = run(base.copy(), 1.0, 24.0)
        r, ev = summarize(pts, cl, 'all years default')
        r['secs'] = round(time.time() - t0, 1)
        print(r, flush=True)
        gs = np.array(gs)
        print('time-group sizes p50/p90/max', np.median(gs), np.quantile(gs, .9), gs.max())
        ev['year'] = ev['first'].dt.year
        by_year = ev.groupby('year').agg(events=('n', 'size'), single_det_pct=('n', lambda s: round(100 * (s == 1).mean(), 1)))
        amb = cl[cl.status == 'AMBIGUOUS'].groupby(cl.t.dt.year).size()
        by_year['ambiguous_clusters'] = amb
        print(by_year.to_string())
        by_year.to_csv('events_by_year.csv')
        pts[['event', 'cluster', 'cell', 'sat', 'dt']].to_pickle('events_points.pkl')
        ev.to_pickle('events.pkl')
        cl.to_pickle('clusters.pkl')
        pd.DataFrame([r]).to_csv('events_full_summary.csv', index=False)
