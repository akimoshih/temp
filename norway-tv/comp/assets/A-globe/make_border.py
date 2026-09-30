# Generalised Norway border for the S2 draw-on stroke (derived from assets/geo/norway_outline_simplified.geojson).
# Morphological closing (buffer +R then -R, in a local sinusoidal km grid) fills the fjord slots so the
# animated stroke reads as one clean country outline at 1080p; islands >= ISL km2 (default 500) kept as separate rings.
# usage: python3 make_border.py [closing_R_km=6] [island_min_km2=500]
import json, math, sys
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import unary_union
R = float(sys.argv[1]) if len(sys.argv) > 1 else 6.0
ISL = float(sys.argv[2]) if len(sys.argv) > 2 else 500.0
SRC = '/home/user/temp/norway-tv/assets/geo/norway_outline_simplified.geojson'
OUT = '/home/user/temp/norway-tv/comp/assets/A-globe/norway_border_generalized.json'
gj = json.load(open(SRC))
feats = [f for f in gj['features'] if f['properties']['part'] == 'mainland']
fine = feats[0]['geometry']['coordinates']
L0 = 15.0
fw = lambda lon, lat: ((lon - L0) * math.cos(math.radians(lat)) * 111.32, lat * 110.95)
def inv(x, y):
    lat = y / 110.95
    return (x / (math.cos(math.radians(lat)) * 111.32) + L0, lat)
polys = [Polygon([fw(*p) for p in poly[0]]).buffer(0) for poly in fine]
main = max(polys, key=lambda p: p.area)
closed = main.buffer(R, resolution=6).buffer(-R, resolution=6)
if closed.geom_type == 'MultiPolygon':
    closed = max(closed.geoms, key=lambda p: p.area)
closed = closed.simplify(0.6)
ring = list(closed.exterior.coords)[:-1]
# start at Lindesnes, keep the source direction (up the west coast first)
lx, ly = fw(7.00747, 57.99305)
i0 = min(range(len(ring)), key=lambda i: (ring[i][0] - lx) ** 2 + (ring[i][1] - ly) ** 2)
ring = ring[i0:] + ring[:i0]
# direction test: the point ~200 km along should be further north-west (west coast)
if ring[40][0] > ring[-40][0]:
    ring = [ring[0]] + ring[1:][::-1]
out_ring = [[round(v, 5) for v in inv(*p)] for p in ring] + [[round(v, 5) for v in inv(*ring[0])]]
isl = []
for p in polys:
    if p is main or p.area < ISL: continue
    q = p.buffer(R * 0.5, resolution=4).buffer(-R * 0.5, resolution=4).simplify(0.6)
    if q.is_empty: continue
    geoms = q.geoms if q.geom_type == 'MultiPolygon' else [q]
    for gq in geoms:
        if gq.area < ISL: continue
        # skip islands swallowed by the closed mainland
        if closed.contains(gq.representative_point()): continue
        isl.append([[round(v, 5) for v in inv(*c)] for c in gq.exterior.coords])
json.dump({'source': 'assets/geo/norway_outline_simplified.geojson (part=mainland, 1.5 km), closing R=%g km, simplify 0.6 km, islands >= %g km2' % (R, ISL),
           'start': 'Lindesnes', 'ring': out_ring, 'islands': isl}, open(OUT, 'w'))
print('ring', len(out_ring), 'islands', len(isl), 'area km2', round(closed.area), 'first', out_ring[:3])
