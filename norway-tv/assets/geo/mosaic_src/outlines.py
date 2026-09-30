"""Export Natural Earth 1:10m (world-atlas@2 countries-10m.json) outlines as GeoJSON."""
import json
from shapely.geometry import mapping, shape, MultiPolygon, Polygon, LineString
from shapely.ops import unary_union
from rasterio.warp import transform_geom
from topo import Topo

OUT = '/home/user/temp/norway-tv/assets/geo'
t = Topo()
C = t.countries()


def polys(g):
    if g.geom_type == 'Polygon':
        return [g]
    return [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon']


def laea(lat0, lon0):
    return f'+proj=laea +lat_0={lat0} +lon_0={lon0} +datum=WGS84 +units=m'


def area_km2(g, crs):
    return shape(transform_geom('EPSG:4326', crs, mapping(g))).area / 1e6


def rnd(geom, nd=5):
    def r(c):
        if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
            return [round(c[0], nd), round(c[1], nd)]
        return [r(x) for x in c]
    m = mapping(geom)
    return {'type': m['type'], 'coordinates': r(m['coordinates'])}


def fc(features):
    return {'type': 'FeatureCollection',
            'properties': {'source': 'Natural Earth 1:10m Admin-0 countries v4.1.0 via world-atlas@2 (countries-10m.json), public domain',
                           'crs': 'EPSG:4326 (lon, lat degrees)'},
            'features': features}


def feat(geom, **props):
    return {'type': 'Feature', 'properties': props, 'geometry': rnd(geom)}


def simplify_m(geom, crs, tol_m, min_area_km2=0.0):
    """Simplify in metres (local LAEA), drop tiny polygons, return lon/lat geometry."""
    gm = shape(transform_geom('EPSG:4326', crs, mapping(geom)))
    out = []
    for p in polys(gm):
        if p.area / 1e6 < min_area_km2:
            continue
        s = p.simplify(tol_m, preserve_topology=True)
        if not s.is_empty:
            out.extend(polys(s))
    mp = MultiPolygon(out) if len(out) > 1 else out[0]
    return shape(transform_geom(crs, 'EPSG:4326', mapping(mp)))


def ring_line(poly, start_near=None):
    """Exterior ring of a polygon as an open LineString (for stroke draw-on), rotated to start near a point."""
    cs = list(poly.exterior.coords)[:-1]
    if start_near is not None:
        import math
        k = min(range(len(cs)), key=lambda i: (cs[i][0] - start_near[0]) ** 2 + (cs[i][1] - start_near[1]) ** 2)
        cs = cs[k:] + cs[:k]
    cs.append(cs[0])
    return LineString(cs)


def length_km(line, crs):
    return shape(transform_geom('EPSG:4326', crs, mapping(line))).length / 1000


# ---------------- Norway ----------------
NOR = C['Norway'][1]
crs_no = laea(65, 15)
parts = {'mainland': [], 'svalbard': [], 'jan_mayen': [], 'bouvet': []}
for p in polys(NOR):
    x0, y0, x1, y1 = p.bounds
    if y0 < 0:
        parts['bouvet'].append(p)
    elif x1 < -5:
        parts['jan_mayen'].append(p)
    elif y0 > 73:
        parts['svalbard'].append(p)
    else:
        parts['mainland'].append(p)
mainland = MultiPolygon(parts['mainland'])
main_poly = max(parts['mainland'], key=lambda p: p.area)
features = []
names = {'mainland': ('挪威本土（含沿岸島嶼）', 'Norway mainland incl. coastal islands'),
         'svalbard': ('斯瓦巴群島', 'Svalbard (incl. Bjørnøya)'),
         'jan_mayen': ('揚馬延島', 'Jan Mayen'),
         'bouvet': ('布威島', 'Bouvetøya')}
for k, ps in parts.items():
    g = MultiPolygon(ps)
    features.append(feat(g, part=k, name_zh=names[k][0], name_en=names[k][1], iso_n3='578',
                         n_polygons=len(ps), area_km2=round(area_km2(g, laea(70 if k != 'bouvet' else -54, 15 if k != 'bouvet' else 3)), 0),
                         bbox=[round(v, 4) for v in g.bounds]))
json.dump(fc(features), open(f'{OUT}/norway_outline.geojson', 'w'), ensure_ascii=False)
print('norway parts', {k: len(v) for k, v in parts.items()}, 'mainland bbox', mainland.bounds,
      'area', area_km2(mainland, crs_no))

# simplified Norway for animated strokes
simp = simplify_m(mainland, crs_no, 1500, min_area_km2=15)
simp_main = max(polys(simp), key=lambda p: p.area)
# start the draw-on at the southern tip (Lindesnes ~ 7.05E 57.98N)
line_main = ring_line(simp_main, start_near=(7.05, 57.98))
feat_s = [feat(simp, part='mainland', level='simplified 1.5 km, islands >= 15 km2', n_polygons=len(polys(simp)),
               n_vertices=sum(len(p.exterior.coords) for p in polys(simp))),
          feat(line_main, part='mainland_main_ring', purpose='single closed path for stroke draw-on; starts at Lindesnes, runs counter-/clockwise as in source ring',
               n_vertices=len(line_main.coords), length_km=round(length_km(line_main, crs_no), 1))]
simp2 = simplify_m(mainland, crs_no, 5000, min_area_km2=150)
line2 = ring_line(max(polys(simp2), key=lambda p: p.area), start_near=(7.05, 57.98))
feat_s.append(feat(simp2, part='mainland', level='coarse 5 km, islands >= 150 km2', n_polygons=len(polys(simp2)),
                   n_vertices=sum(len(p.exterior.coords) for p in polys(simp2))))
feat_s.append(feat(line2, part='mainland_main_ring_coarse', n_vertices=len(line2.coords), length_km=round(length_km(line2, crs_no), 1)))
json.dump(fc(feat_s), open(f'{OUT}/norway_outline_simplified.geojson', 'w'), ensure_ascii=False)
print('norway simplified', [f['properties'].get('n_vertices') for f in feat_s])

# ---------------- Taiwan ----------------
TW = C['Taiwan'][1]
crs_tw = laea(23.7, 121)
tw_polys = polys(TW)
tw_main = max(tw_polys, key=lambda p: p.area)
ftw = [feat(tw_main, part='main_island', name_zh='臺灣本島', name_en='Taiwan (main island)', iso_n3='158',
            area_km2=round(area_km2(tw_main, crs_tw))),
       feat(TW, part='all', name_zh='臺灣（含澎湖、金門、綠島、蘭嶼）', name_en='Taiwan incl. Penghu, Kinmen, Green I., Orchid I. (NE 1:10m)',
            iso_n3='158', n_polygons=len(tw_polys), area_km2=round(area_km2(TW, crs_tw)))]
json.dump(fc(ftw), open(f'{OUT}/taiwan_outline.geojson', 'w'), ensure_ascii=False)
tws = simplify_m(tw_main, crs_tw, 800)
lt = ring_line(tws, start_near=(121.56, 25.3))
json.dump(fc([feat(tws, part='main_island', level='simplified 0.8 km', n_vertices=len(tws.exterior.coords)),
              feat(lt, part='main_island_ring', purpose='closed path for stroke draw-on, starts near the northern tip',
                   n_vertices=len(lt.coords), length_km=round(length_km(lt, crs_tw), 1))]),
          open(f'{OUT}/taiwan_outline_simplified.geojson', 'w'), ensure_ascii=False)
print('taiwan main area', area_km2(tw_main, crs_tw), 'all', area_km2(TW, crs_tw))

# ---------------- neighbours ----------------
nb = []
for n, zh in [('Sweden', '瑞典'), ('Finland', '芬蘭'), ('Denmark', '丹麥'), ('Russia', '俄羅斯（區域內）'), ('Estonia', '愛沙尼亞')]:
    g = unary_union(polys(C[n][1]))
    if n == 'Russia':
        from shapely.geometry import box
        g = g.intersection(box(-10, 50, 60, 82))
    nb.append(feat(g, name_en=n, name_zh=zh, iso_n3=C[n][0]))
    if n in ('Sweden', 'Finland'):
        json.dump(fc([nb[-1]]), open(f'{OUT}/{n.lower()}_outline.geojson', 'w'), ensure_ascii=False)
json.dump(fc(nb), open(f'{OUT}/nordic_neighbours.geojson', 'w'), ensure_ascii=False)
print('done')
