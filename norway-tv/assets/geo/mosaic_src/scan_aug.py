"""Stage 1b: for snowy (Scandes) tiles, also scan all August scenes so late-summer, snow-minimal looks are available."""
import json, os, glob, sys, time, re
import numpy as np, concurrent.futures as cf
import scan
ROOT = scan.ROOT
tiles = []
for f in sorted(glob.glob(f'{ROOT}/tiles/*.npz')):
    t = os.path.basename(f)[:-4]; z = np.load(f)
    ok = z['ok'] & (z['water'] < 128)
    if ok.sum() < 1000:
        continue
    sn = (z['snow'][ok] > 128).mean(); br = (z['rgb'][:, ok].mean(0) > 120).mean()
    if sn > 0.004 or br > 0.03:
        tiles.append(t)
print('snowy tiles', len(tiles), tiles, flush=True)


def aug(tile):
    p = f'{ROOT}/scenes/{tile}.json'
    d = json.load(open(p))
    if d.get('aug_scanned'):
        return tile, 0
    have = {s['name'] for s in d['scenes']}
    added = 0
    for y in (2025, 2024, 2023):
        for m in (8, 7):
            for pr in scan.list_scenes(tile, y, m):
                name = pr.rstrip('/').split('/')[-1]
                if not name.endswith('_L2A') or name in have:
                    continue
                if m == 7 and int(name.split('_')[2][6:8]) < 20:   # only late July in addition to August
                    continue
                try:
                    d['scenes'].append(scan.meta(pr)); added += 1
                except Exception as e:
                    print('meta fail', pr, e, flush=True)
    d['aug_scanned'] = True
    json.dump(d, open(p, 'w'))
    return tile, added


t0 = time.time()
with cf.ThreadPoolExecutor(12) as ex:
    for t, n in ex.map(aug, tiles):
        print(t, 'added', n, f'{time.time()-t0:.0f}s', flush=True)
json.dump(tiles, open(f'{ROOT}/snowy_tiles.json', 'w'))
