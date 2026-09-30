"""Find Sentinel-2 tiles that cover land points whose MGRS 'home' tile does not exist in the S2 grid."""
import json, glob, numpy as np, requests, mgrs
from shapely.geometry import box
from shapely import contains_xy
from rasterio.warp import transform
from topo import Topo
ROOT = '/home/user/temp/norway-tv/tmp/mosaic'
W, E, S, N = -4.0, 44.0, 54.0, 72.0
BANDS = 'CDEFGHJKLMNPQRSTUVWX'
COLS = {1: 'ABCDEFGH', 2: 'JKLMNPQR', 0: 'STUVWXYZ'}
ROWS = 'ABCDEFGHJKLMNPQRSTUV'


def band_of(lat):
    return BANDS[int((lat + 80) // 8)]


def squares_in_zone(lons, lats, zone):
    xs, ys = transform('EPSG:4326', f'EPSG:326{zone:02d}', list(lons), list(lats))
    out = []
    for x, y, la in zip(xs, ys, lats):
        # S2 tiles are 109.8 km squares anchored at the 100 km grid: a point may be inside square (c,r) or (c-1,r) / (c,r+1)
        res = set()
        for dc in (0, -1):
            for dr in (0, 1):
                c = int(x // 100000) + dc
                r = int(y // 100000) + dr
                ex0 = c * 100000; ny1 = r * 100000  # square (c, r) origin; S2 tile covers x in [ex0, ex0+109800], y in [ny1-9800+... ]
                if not (ex0 <= x <= ex0 + 109800 and r * 100000 - 9800 <= y <= r * 100000 + 100000):
                    continue
                if not 1 <= c <= 8:
                    continue
                col = COLS[zone % 3][c - 1]
                row = ROWS[(r + (5 if zone % 2 == 0 else 0)) % 20]
                for b in {band_of(la), band_of(la - 1), band_of(la + 1)}:
                    res.add(f'{zone:02d}{b}{col}{row}')
        out.append(res)
    return out


s = requests.Session()


def exists(tile):
    z, b, sq = int(tile[:2]), tile[2], tile[3:]
    for ym in ('2024/7', '2025/7', '2023/8'):
        r = s.get(f'https://sentinel-cogs.s3.us-west-2.amazonaws.com/?list-type=2&prefix=sentinel-s2-l2a-cogs/{z}/{b}/{sq}/{ym}/&delimiter=/&max-keys=2', timeout=30)
        if '_L2A/' in r.text:
            return True
    return False


if __name__ == '__main__':
    have = {}
    for f in glob.glob(f'{ROOT}/scenes/*.json'):
        d = json.load(open(f)); have[d['tile']] = len(d['scenes']) > 0
    empty = {t for t, v in have.items() if not v}
    t = Topo()
    land = t.land().intersection(box(W - 1, S - 1, E + 1, N + 1)).buffer(0.04)
    step = 0.04
    LO, LA = np.meshgrid(np.arange(W + step / 2, E, step), np.arange(S + step / 2, N, step))
    ins = contains_xy(land, LO.ravel(), LA.ravel())
    lo, la = LO.ravel()[ins], LA.ravel()[ins]
    m = mgrs.MGRS()
    home = np.array([m.toMGRS(float(b), float(a), MGRSPrecision=0) for a, b in zip(lo, la)])
    sel = np.isin(home, list(empty))
    print('points in empty tiles', sel.sum())
    lo, la = lo[sel][::3], la[sel][::3]
    cand_count = {}
    per_pt = []
    for zone in range(29, 40):
        zl = squares_in_zone(lo, la, zone)
        for i, st in enumerate(zl):
            if len(per_pt) <= i:
                per_pt.append(set())
            per_pt[i] |= st
    allc = sorted(set().union(*per_pt) - set(have))
    print('candidates', len(allc))
    ex = {}
    import concurrent.futures as cf
    with cf.ThreadPoolExecutor(12) as pool:
        for tname, e in zip(allc, pool.map(exists, allc)):
            ex[tname] = e
    good = [t for t, e in ex.items() if e]
    # which points are covered by existing (have & non-empty) or good candidates
    okset = {t for t, v in have.items() if v} | set(good)
    unc = sum(1 for st in per_pt if not (st & okset))
    print('existing alternates', len(good), good, 'uncovered pts (of sampled)', unc, len(per_pt))
    json.dump(good, open(f'{ROOT}/alt_tiles.json', 'w'))
