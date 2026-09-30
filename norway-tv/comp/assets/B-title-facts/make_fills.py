"""Real-imagery fills for the S4 F3 equal-area silhouettes (same frames as the kit SVGs, 1 unit = 1 km).

Each output JPEG is registered pixel-for-pixel to its silhouette's SVG/islands.json frame at the px-per-km (ppk) listed in fills.json,
so the comp can draw it at (0, 0, w_km*s, h_km*s) and mask it with the silhouette alpha (destination-in).
  norway_fill.jpg    mainland, LAEA 15E 65N  <- assets/geo/scandinavia_mosaic.jpg (Sentinel-2 L2A, 0.004 deg)
  svalbard_fill.jpg  LAEA 19E 78.4N          <- assets/geo/globe_texture_8k.jpg (Blue Marble; outside the mosaic)
  janmayen_fill.jpg  LAEA 8.5W 71N           <- globe_texture_8k.jpg
  taiwan_relief.png  LAEA 120.97E 23.7N      <- three-globe earth-topology.png (relief, stretched)
Frames: kit silhouettes use (x - minx, (-y) - min(-y)) of assets/geo/*_simplified.geojson (assets/kit/tools/make_svg.py);
islands use (x - minx, maxy - y) of norway_outline.geojson (make_islands.py). Both are reproduced exactly here.
Run: python3 comp/assets/B-title-facts/make_fills.py
"""
import json, math, os
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
GEO = os.path.join(ROOT, 'assets', 'geo')
R = 6371.0088


def laea(lon, lat, lon0, lat0):
    lam, phi = np.radians(lon), np.radians(lat)
    l0, p0 = math.radians(lon0), math.radians(lat0)
    k = np.sqrt(2 / (1 + math.sin(p0) * np.sin(phi) + math.cos(p0) * np.cos(phi) * np.cos(lam - l0)))
    return R * k * np.cos(phi) * np.sin(lam - l0), R * k * (math.cos(p0) * np.sin(phi) - math.sin(p0) * np.cos(phi) * np.cos(lam - l0))


def laea_inv(x, y, lon0, lat0):
    l0, p0 = math.radians(lon0), math.radians(lat0)
    rho = np.hypot(x, y)
    c = 2 * np.arcsin(np.clip(rho / (2 * R), -1, 1))
    with np.errstate(invalid='ignore', divide='ignore'):
        phi = np.arcsin(np.cos(c) * math.sin(p0) + np.where(rho > 0, y * np.sin(c) * math.cos(p0) / rho, 0))
        lam = l0 + np.arctan2(x * np.sin(c), rho * math.cos(p0) * np.cos(c) - y * math.sin(p0) * np.sin(c))
    return np.degrees(lam), np.degrees(phi)


def ring_area(x, y):
    return abs(0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def kit_frame(fn, part, lon0, lat0):
    """make_svg.py: y flipped (-y), origin at (minx, min(-y))."""
    d = json.load(open(os.path.join(GEO, fn)))
    geom = [f for f in d['features'] if f['properties'].get('part') == part][0]['geometry']
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    xs, ys = [], []
    for poly in polys:
        for ring in poly:
            a = np.array(ring); x, y = laea(a[:, 0], a[:, 1], lon0, lat0); xs.append(x); ys.append(-y)
    xs, ys = np.concatenate(xs), np.concatenate(ys)
    minx, miny = xs.min(), ys.min()
    return dict(lon0=lon0, lat0=lat0, x0=minx, flipY=-miny, w=xs.max() - minx, h=ys.max() - miny)   # y_laea = flipY - v


def island_frame(part, lon0, lat0, min_km2):
    """make_islands.py: origin at (minx, maxy), v = maxy - y."""
    gj = json.load(open(os.path.join(GEO, 'norway_outline.geojson')))
    ft = next(f for f in gj['features'] if f['properties']['part'] == part)
    xs, ys = [], []
    for poly in ft['geometry']['coordinates']:
        a = np.array(poly[0]); x, y = laea(a[:, 0], a[:, 1], lon0, lat0)
        if ring_area(x, y) < min_km2: continue
        xs.append(x); ys.append(y)
    xs, ys = np.concatenate(xs), np.concatenate(ys)
    return dict(lon0=lon0, lat0=lat0, x0=xs.min(), flipY=ys.max(), w=xs.max() - xs.min(), h=ys.max() - ys.min())


def lonlat_grid(fr, ppk):
    W, H = int(math.ceil(fr['w'] * ppk)), int(math.ceil(fr['h'] * ppk))
    u = (np.arange(W) + 0.5) / ppk; v = (np.arange(H) + 0.5) / ppk
    U, V = np.meshgrid(u, v)
    return laea_inv(fr['x0'] + U, fr['flipY'] - V, fr['lon0'], fr['lat0'])


def sample(img, cols, rows):
    out = np.stack([map_coordinates(img[..., c].astype(np.float32), [rows, cols], order=1, mode='nearest') for c in range(img.shape[2])], -1)
    return np.clip(out, 0, 255).astype(np.uint8)


def main():
    meta = {}
    # ---- Norway mainland from the Sentinel-2 mosaic (EPSG:4326, W -4 N 72, 0.004 deg), pre-reduced 4x (lon) / 2x (lat)
    fr = kit_frame('norway_outline_simplified.geojson', 'mainland', 15.0, 65.0)
    ppk = 1.0
    lon, lat = lonlat_grid(fr, ppk)
    mos = Image.open(os.path.join(GEO, 'scandinavia_mosaic.jpg'))
    c0, c1 = int((2.0 + 4) / 0.004), int((33.0 + 4) / 0.004)
    r1 = int((72 - 56.5) / 0.004)
    mos = mos.crop((c0, 0, c1, r1))
    red = mos.reduce((4, 2)); mos.close()
    arr = np.asarray(red)
    dlon, dlat = 0.016, 0.008
    cols = (lon - 2.0) / dlon - 0.5; rows = (72 - lat) / dlat - 0.5
    Image.fromarray(sample(arr, cols, rows)).save(os.path.join(HERE, 'norway_fill.jpg'), quality=90)
    meta['norway'] = dict(fr, ppk=ppk, src='scandinavia_mosaic.jpg')
    del arr
    # ---- islands + Taiwan from the 8k globe texture (lon -180..180, lat 90..-90)
    gt = np.asarray(Image.open(os.path.join(GEO, 'globe_texture_8k.jpg')).convert('RGB'))
    GW, GH = gt.shape[1], gt.shape[0]
    jobs = [('svalbard', island_frame('svalbard', 19.0, 78.4, 12.0), 1.0),
            ('janmayen', island_frame('jan_mayen', -8.5, 71.0, 0.0), 2.0),
            ('taiwan', kit_frame('taiwan_outline_simplified.geojson', 'main_island', 120.97, 23.7), 2.0)]
    for key, fr, ppk in jobs:
        meta[key] = dict(fr, ppk=ppk, src='globe_texture_8k.jpg')
        if key == 'taiwan':          # only the frame is needed (the comp prints Taiwan in red + relief halftone)
            continue
        lon, lat = lonlat_grid(fr, ppk)
        cols = (lon + 180) / 360 * GW - 0.5; rows = (90 - lat) / 180 * GH - 0.5
        Image.fromarray(sample(gt, cols, rows)).save(os.path.join(HERE, f'{key}_fill.jpg'), quality=90)
    # Taiwan relief (three-globe earth-topology.png, equirectangular bump map) for the printed red duotone
    topo_p = os.path.join(ROOT, 'assets/raw/package/example/img/earth-topology.png')
    if os.path.exists(topo_p):
        tp = np.asarray(Image.open(topo_p).convert('L'))[..., None]
        fr = meta['taiwan']; lon, lat = lonlat_grid(fr, fr['ppk'])
        cols = (lon + 180) / 360 * tp.shape[1] - 0.5; rows = (90 - lat) / 180 * tp.shape[0] - 0.5
        rel = sample(tp, cols, rows)[..., 0].astype(np.float32)
        rel = np.clip(rel / max(1.0, np.percentile(rel, 99.5)), 0, 1) ** 0.8 * 255      # stretch: the bump map is dim
        Image.fromarray(rel.astype(np.uint8)).save(os.path.join(HERE, 'taiwan_relief.png'))
        meta['taiwan']['relief'] = 'earth-topology.png'; meta['taiwan']['src'] = 'earth-topology.png'
    for k, v in meta.items():
        for kk in ('x0', 'flipY', 'w', 'h'):
            v[kk] = round(float(v[kk]), 3)
        print(k, v)
    json.dump(meta, open(os.path.join(HERE, 'fills.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
