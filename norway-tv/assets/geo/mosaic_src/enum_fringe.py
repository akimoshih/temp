"""Tiles for the low-res 'fringe' used only in the globe texture: east (43.5..58E) and west (-9..-3.5E) of the main mosaic."""
import numpy as np, json, mgrs
from shapely.geometry import box
from shapely import contains_xy
from topo import Topo
t = Topo()
m = mgrs.MGRS()
main = set(json.load(open('/home/user/temp/norway-tv/tmp/mosaic/tiles_needed.json')))
tiles = {}
for (W, E, S, N) in [(43.5, 58.0, 54.0, 72.5), (-9.0, -3.5, 54.0, 61.0)]:
    land = t.land().intersection(box(W - 1, S - 1, E + 1, N + 1)).buffer(0.04)
    step = 0.05
    LO, LA = np.meshgrid(np.arange(W + step / 2, E, step), np.arange(S + step / 2, N, step))
    ins = contains_xy(land, LO.ravel(), LA.ravel())
    for lo, la in zip(LO.ravel()[ins], LA.ravel()[ins]):
        s = m.toMGRS(float(la), float(lo), MGRSPrecision=0)
        if s not in main:
            tiles[s] = tiles.get(s, 0) + 1
print(len(tiles))
json.dump(sorted(tiles), open('/home/user/temp/norway-tv/tmp/mosaic/fringe_tiles.json', 'w'))
