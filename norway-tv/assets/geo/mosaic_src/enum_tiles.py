import numpy as np, json, mgrs
from shapely.geometry import box
from shapely import contains_xy
from topo import Topo
W, E, S, N = -4.0, 44.0, 54.0, 72.0
t = Topo()
land = t.land().intersection(box(W - 1, S - 1, E + 1, N + 1))
landb = land.buffer(0.04)  # include coastal skerries + shoreline
step = 0.04
lons = np.arange(W + step / 2, E, step)
lats = np.arange(S + step / 2, N, step)
LO, LA = np.meshgrid(lons, lats)
inside = contains_xy(landb, LO.ravel(), LA.ravel())
print('land sample pts', inside.sum(), 'of', inside.size)
m = mgrs.MGRS()
tiles = {}
for lo, la in zip(LO.ravel()[inside], LA.ravel()[inside]):
    s = m.toMGRS(float(la), float(lo), MGRSPrecision=0)
    tiles[s] = tiles.get(s, 0) + 1
print('tiles', len(tiles))
json.dump(tiles, open('/home/user/temp/norway-tv/tmp/mosaic/tiles_needed.json', 'w'), indent=0, sort_keys=True)
from collections import Counter
print(Counter(k[:3] for k in tiles))
