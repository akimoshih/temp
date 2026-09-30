"""Svalbard + Jan Mayen silhouettes for S4 F3, at the SAME scale as assets/kit/svg/*_silhouette.svg (1 unit = 1 km).
Each is projected with a Lambert azimuthal equal-area projection centred on itself (true area + true shape),
from assets/geo/norway_outline.geojson (Natural Earth 1:10m). Output: islands.json {name: {w, h, d, area_km2}}.
Run: python3 comp/assets/B-title-facts/make_islands.py"""
import json, math, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
R = 6371.0088
def laea(lon, lat, lon0, lat0):
    l, p, l0, p0 = map(math.radians, (lon, lat, lon0, lat0))
    k = math.sqrt(2 / (1 + math.sin(p0) * math.sin(p) + math.cos(p0) * math.cos(p) * math.cos(l - l0)))
    x = R * k * math.cos(p) * math.sin(l - l0)
    y = R * k * (math.cos(p0) * math.sin(p) - math.sin(p0) * math.cos(p) * math.cos(l - l0))
    return x, y
def area(ring):
    return abs(sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1] for i in range(len(ring)))) / 2
gj = json.load(open(os.path.join(ROOT, 'assets/geo/norway_outline.geojson')))
out = {}
for part, c0, min_km2 in (('svalbard', (19.0, 78.4), 12.0), ('jan_mayen', (-8.5, 71.0), 0.0)):
    ft = next(f for f in gj['features'] if f['properties']['part'] == part)
    rings = []
    for poly in ft['geometry']['coordinates']:
        outer = [laea(lon, lat, *c0) for lon, lat in poly[0]]
        if area(outer) < min_km2: continue
        rings.append(outer)
    xs = [x for r in rings for x, _ in r]; ys = [y for r in rings for _, y in r]
    x0, y1 = min(xs), max(ys)
    w, h = max(xs) - x0, y1 - min(ys)
    d = ' '.join('M' + ' L'.join(f'{x - x0:.2f},{y1 - y:.2f}' for x, y in r) + ' Z' for r in rings)
    tot = sum(area(r) for r in rings)
    out[part] = {'w': round(w, 2), 'h': round(h, 2), 'area_km2_polygon': round(tot), 'd': d,
                 'name_zh': ft['properties']['name_zh'], 'projection': f'LAEA centred {c0[0]},{c0[1]}; 1 unit = 1 km'}
    print(part, round(w), 'x', round(h), 'km, polygons', len(rings), 'area', round(tot))
json.dump(out, open(os.path.join(os.path.dirname(__file__), 'islands.json'), 'w'), ensure_ascii=False)
