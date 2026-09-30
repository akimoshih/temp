"""Stage 2: choose low-cloud scenes per tile and download TCI (1/16 overview, ~160 m) + SCL (resampled to same grid).
Cache: tmp/mosaic/cache/<scene>.npz"""
import json, os, re, sys, time, threading, glob, concurrent.futures as cf
import numpy as np
import rasterio
from rasterio.enums import Resampling

ROOT = '/home/user/temp/norway-tv/tmp/mosaic'
BUCKET = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com'
CACHE = f'{ROOT}/cache'
os.makedirs(CACHE, exist_ok=True)
OV = 687  # 10980/16 rounded up
GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',
                GDAL_HTTP_MULTIRANGE='YES', GDAL_HTTP_MERGE_CONSECUTIVE_RANGES='YES', GDAL_CACHEMAX=64,
                GDAL_HTTP_MAX_RETRY=4, GDAL_HTTP_RETRY_DELAY=2, VSI_CACHE='FALSE')


def select(tile_json, target=5.0, nmax=10, late=False):
    d = json.load(open(tile_json))
    best = {}
    for s in d['scenes']:
        m = re.match(r'(S2[ABC])_(\w+)_(\d{8})_(\d+)_L2A', s['name'])
        key = (m.group(1), m.group(3))
        if key not in best or int(m.group(4)) > int(re.match(r'.*_(\d+)_L2A', best[key]['name']).group(1)):
            best[key] = s
    cands = sorted(best.values(), key=lambda s: (s['cc'] + 0.05 * s['nd']))
    chosen, score = [], 0.0
    for ccmax in (15, 30, 60):
        for s in cands:
            if s in chosen or s['cc'] > ccmax or s['nd'] >= 97:
                continue
            if score >= target and len(chosen) >= 4:
                break
            if len(chosen) >= nmax:
                break
            chosen.append(s)
            score += (1 - s['nd'] / 100) * (1 - s['cc'] / 100)
        if score >= target * 0.7 and len(chosen) >= 3:
            break
    if late:
        # snowy Scandes tiles: add late-summer (>= Jul 20) low-cloud looks so the snow-aware median can pick snow-free ground
        late_c = [s for s in cands if s not in chosen and s['cc'] <= 20 and s['nd'] < 90 and
                  (s['name'].split('_')[2][4:6] == '08' or (s['name'].split('_')[2][4:6] == '07' and int(s['name'].split('_')[2][6:8]) >= 20))]
        for s in late_c[:6]:
            chosen.append(s)
            score += (1 - s['nd'] / 100) * (1 - s['cc'] / 100)
    return chosen, score


def fetch_scene(s):
    out = f'{CACHE}/{s["name"]}.npz'
    if os.path.exists(out):
        return out, 0
    base = f'/vsicurl/{BUCKET}/{s["prefix"]}'
    t0 = time.time()
    for k in range(4):
        try:
            with rasterio.Env(**GDAL_ENV):
                with rasterio.open(base + 'TCI.tif') as ds:
                    tci = ds.read(out_shape=(3, OV, OV), resampling=Resampling.nearest)
                    tr = ds.transform
                    crs = ds.crs.to_epsg()
                with rasterio.open(base + 'SCL.tif') as ds:
                    scl = ds.read(1, out_shape=(OV, OV), resampling=Resampling.nearest)
            break
        except Exception as e:
            print('retry', s['name'], k, e, flush=True)
            time.sleep(3 + 5 * k)
    else:
        return None, 0
    np.savez_compressed(out + '.tmp.npz', tci=tci, scl=scl, x0=tr.c, y0=tr.f, epsg=crs)
    os.replace(out + '.tmp.npz', out)
    return out, time.time() - t0


if __name__ == '__main__':
    files = sorted(glob.glob(f'{ROOT}/scenes/*.json'))
    if len(sys.argv) > 1:
        files = [f'{ROOT}/scenes/{t}.json' for t in sys.argv[1:]]
    plan = {}
    jobs = []
    snowy = set(json.load(open(f'{ROOT}/snowy_tiles.json'))) if os.path.exists(f'{ROOT}/snowy_tiles.json') else set()
    for f in files:
        tile = os.path.basename(f)[:-5]
        ch, sc = select(f, target=float(os.environ.get('TARGET', 5.0)), nmax=int(os.environ.get('NMAX', 10)), late=tile in snowy)
        plan[tile] = {'score': sc, 'scenes': [{k: s[k] for k in ('name', 'prefix', 'cc', 'nd')} for s in ch]}
        jobs.extend(ch)
    if len(sys.argv) == 1:
        json.dump(plan, open(f'{ROOT}/plan.json', 'w'), indent=1)
    elif os.environ.get('PLAN_OUT'):
        json.dump(plan, open(os.environ['PLAN_OUT'], 'w'), indent=1)
    print('tiles', len(plan), 'scenes', len(jobs), 'empty tiles', [t for t, p in plan.items() if not p['scenes']], flush=True)
    t0 = time.time(); n = 0
    with cf.ThreadPoolExecutor(10) as ex:
        for out, dt in ex.map(fetch_scene, jobs):
            n += 1
            if n % 25 == 0:
                sz = sum(os.path.getsize(p) for p in glob.glob(f'{CACHE}/*_L2A.npz') if os.path.exists(p))
                print(f'[{n}/{len(jobs)}] t={time.time()-t0:.0f}s cache={sz/1e6:.0f}MB last={dt:.1f}s', flush=True)
    print('done', time.time() - t0)
