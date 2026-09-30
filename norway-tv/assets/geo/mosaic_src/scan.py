"""Stage 1: list Sentinel-2 L2A scenes (Jun-Aug 2023-2025) per MGRS tile and fetch cloud cover.
Writes tmp/mosaic/scenes/<tile>.json (cached)."""
import json, os, re, sys, time, threading, concurrent.futures as cf
import requests

ROOT = '/home/user/temp/norway-tv/tmp/mosaic'
BUCKET = 'https://sentinel-cogs.s3.us-west-2.amazonaws.com'
PFX = 'sentinel-s2-l2a-cogs'
MONTHS = [(2025, 7), (2024, 7), (2023, 7), (2025, 8), (2024, 8), (2023, 8), (2025, 6), (2024, 6), (2023, 6)]
os.makedirs(f'{ROOT}/scenes', exist_ok=True)
tls = threading.local()
lock = threading.Lock()
stats = {'req': 0, 'bytes': 0}


def sess():
    if not hasattr(tls, 's'):
        tls.s = requests.Session()
    return tls.s


def get(url, headers=None, tries=5):
    for k in range(tries):
        try:
            r = sess().get(url, headers=headers, timeout=30)
            if r.status_code in (200, 206):
                with lock:
                    stats['req'] += 1; stats['bytes'] += len(r.content)
                return r
            if r.status_code == 404:
                return None
        except Exception as e:
            err = e
        time.sleep(1 + 2 * k)
    raise RuntimeError(f'failed {url}')


def list_scenes(tile, y, m):
    z, b, sq = int(tile[:2]), tile[2], tile[3:]
    url = f'{BUCKET}/?list-type=2&prefix={PFX}/{z}/{b}/{sq}/{y}/{m}/&delimiter=/'
    r = get(url)
    return re.findall(r'<Prefix>(' + PFX + r'/[^<]+/)</Prefix>', r.text)


def meta(prefix):
    name = prefix.rstrip('/').split('/')[-1]
    r = get(f'{BUCKET}/{prefix}{name}.json', headers={'Range': 'bytes=0-1999'})
    t = r.text
    if '"eo:cloud_cover"' not in t or ('"s2:nodata_pixel_percentage"' not in t and '"sentinel:data_coverage"' not in t):
        t = get(f'{BUCKET}/{prefix}{name}.json').text
    cc = float(re.search(r'"eo:cloud_cover":\s*([0-9.eE+-]+)', t).group(1))
    m = re.search(r'"s2:nodata_pixel_percentage":\s*([0-9.eE+-]+)', t)
    if m:
        nd = float(m.group(1))
    else:
        nd = 100.0 - float(re.search(r'"sentinel:data_coverage":\s*([0-9.eE+-]+)', t).group(1))
    sn = re.search(r'"s2:snow_ice_percentage":\s*([0-9.eE+-]+)', t)
    fmt = 'new' if m else 'old'
    return {'name': name, 'prefix': prefix, 'cc': cc, 'nd': nd, 'snow': float(sn.group(1)) if sn else None, 'fmt': fmt}


def score(scs, ccmax=20):
    return sum((1 - s['nd'] / 100) * (1 - s['cc'] / 100) for s in scs if s['cc'] <= ccmax and s['nd'] < 97)


def scan_tile(tile):
    out = f'{ROOT}/scenes/{tile}.json'
    if os.path.exists(out):
        return json.load(open(out))
    listed = {}
    for y, m in MONTHS:
        listed[f'{y}-{m}'] = list_scenes(tile, y, m)
    total = sum(len(v) for v in listed.values())
    metas = []
    if total:
        for y, m in MONTHS:
            for p in listed[f'{y}-{m}']:
                name = p.rstrip('/').split('/')[-1]
                if not name.endswith('_L2A'):
                    continue
                try:
                    metas.append(meta(p))
                except Exception as e:
                    print('meta fail', p, e, flush=True)
            if score(metas, 15) >= float(os.environ.get('STOP_SCORE', 5.0)) and len([s for s in metas if s['cc'] <= 15]) >= int(os.environ.get('STOP_N', 6)):
                break
    res = {'tile': tile, 'n_listed': total, 'scenes': metas, 'score15': score(metas, 15)}
    json.dump(res, open(out, 'w'))
    return res


if __name__ == '__main__':
    tiles = sorted(json.load(open(f'{ROOT}/tiles_needed.json')).keys())
    if len(sys.argv) > 1:
        tiles = json.load(open(sys.argv[1]))
    t0 = time.time()
    done = 0
    with cf.ThreadPoolExecutor(12) as ex:
        futs = {ex.submit(scan_tile, t): t for t in tiles}
        for f in cf.as_completed(futs):
            done += 1
            try:
                r = f.result()
                if done % 10 == 0 or r['n_listed'] == 0:
                    print(f'[{done}/{len(tiles)}] {r["tile"]} listed={r["n_listed"]} meta={len(r["scenes"])} score={r["score15"]:.2f} '
                          f'req={stats["req"]} MB={stats["bytes"]/1e6:.1f} t={time.time()-t0:.0f}s', flush=True)
            except Exception as e:
                print('tile fail', futs[f], e, flush=True)
    print('done', time.time() - t0, stats)
