#!/usr/bin/env python3
"""End-card / recap backdrop for S8 (owner D-quickfire-outro).

Orthographic satellite view of Scandinavia built from the project's own open-data products:
  assets/geo/scandinavia_mosaic.jpg      (Sentinel-2 L2A, 0.004 deg, -4..44E / 54..72N)
  assets/geo/scandinavia_wide_lowres.jpg (same pipeline, 0.012 deg, -9..58E / 54..72.5N)
  assets/geo/globe_texture_8k.jpg        (Blue Marble base with the mosaics blended in)
Layers are feathered over ~1.4 deg exactly like the globe texture does, so no seam shows.

The image covers the 1920x1080 frame plus a bleed of BX/BY px on every side (for camera shake and push-ins).
Screen mapping (also written to endcard_backdrop.json, used by the comp to draw outline / pin / plane):
  x = CX + R * cos(lat) * sin(lon - lon0)
  y = CY - R * (cos(lat0) * sin(lat) - sin(lat0) * cos(lat) * cos(lon - lon0))
  image pixel = (x + BX, y + BY)
Run:  python3 comp/assets/D-quickfire-outro/make_endcard_backdrop.py
"""
import json, os
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
GEO = os.path.join(HERE, '..', '..', '..', 'assets', 'geo')

W, H, BX, BY = 1920, 1080, 120, 90
LAT0, LON0 = 64.5, 17.0
R = 3290.0                      # px per radian: Norway (57.98..71.17N) spans ~y 95..840
CX, CY = 1236.0, 470.0
SS = 2                          # supersampling


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def sample(img, rows, cols):
    out = np.empty(rows.shape + (3,), np.float32)
    for c in range(3):
        out[..., c] = map_coordinates(img[..., c], [rows, cols], order=1, mode='nearest')
    return out


def main():
    ow, oh = (W + 2 * BX) * SS, (H + 2 * BY) * SS
    xs = (np.arange(ow, dtype=np.float64) + 0.5) / SS - BX
    ys = (np.arange(oh, dtype=np.float64) + 0.5) / SS - BY
    X, Y = np.meshgrid(xs - CX, CY - ys)
    x, y = X / R, Y / R
    rho = np.hypot(x, y)
    c = np.arcsin(np.clip(rho, 0, 1))
    p0 = np.radians(LAT0)
    with np.errstate(invalid='ignore', divide='ignore'):
        lat = np.degrees(np.arcsin(np.cos(c) * np.sin(p0) + np.where(rho > 0, y * np.sin(c) * np.cos(p0) / rho, 0)))
        lon = LON0 + np.degrees(np.arctan2(x * np.sin(c), rho * np.cos(c) * np.cos(p0) - y * np.sin(c) * np.sin(p0)))
    print('lat range', lat.min(), lat.max(), 'lon range', lon.min(), lon.max())

    # base: globe texture 8k (whole world)
    g = np.asarray(Image.open(os.path.join(GEO, 'globe_texture_8k.jpg')).convert('RGB'), np.float32)
    gw, gh = g.shape[1], g.shape[0]
    out = sample(g, (90 - lat) / 180 * gh - 0.5, (lon + 180) / 360 * gw - 0.5)
    del g

    def layer(fname, west, east, south, north, px, reduce=1, feather=1.4):
        nonlocal out
        im = Image.open(os.path.join(GEO, fname)).convert('RGB')
        if reduce > 1:
            im = im.reduce(reduce)
        a = np.asarray(im, np.float32)
        step = px * reduce
        rows = (north - lat) / step - 0.5
        cols = (lon - west) / step - 0.5
        d = np.minimum.reduce([lon - west, east - lon, lat - south, north - lat])
        al = smooth(d / feather)[..., None].astype(np.float32)
        inside = d > 0
        if not inside.any():
            return
        s = sample(a, rows, cols)
        out = out * (1 - al) + s * al

    layer('scandinavia_wide_lowres.jpg', -9, 58, 54, 72.5, 0.012)
    layer('scandinavia_mosaic.jpg', -4, 44, 54, 72, 0.004, reduce=2)

    img = Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))
    img = img.resize((W + 2 * BX, H + 2 * BY), Image.LANCZOS)
    img.save(os.path.join(HERE, 'endcard_backdrop.jpg'), quality=93, subsampling=0)
    meta = dict(W=W, H=H, BX=BX, BY=BY, lat0=LAT0, lon0=LON0, R=R, CX=CX, CY=CY,
                projection='orthographic', note='x = CX + R cos(lat) sin(lon-lon0); y = CY - R (cos(lat0) sin(lat) - sin(lat0) cos(lat) cos(lon-lon0)); image px = (x+BX, y+BY)',
                sources=['assets/geo/scandinavia_mosaic.jpg', 'assets/geo/scandinavia_wide_lowres.jpg', 'assets/geo/globe_texture_8k.jpg'],
                attribution='Contains modified Copernicus Sentinel data 2023-2025. Earth imagery: NASA Blue Marble (via three-globe).')
    json.dump(meta, open(os.path.join(HERE, 'endcard_backdrop.json'), 'w'), indent=1)

    def proj(la, lo):
        la, lo, p = np.radians(la), np.radians(lo - LON0), np.radians(LAT0)
        return CX + R * np.cos(la) * np.sin(lo), CY - R * (np.cos(p) * np.sin(la) - np.sin(p) * np.cos(la) * np.cos(lo))
    for n, (la, lo) in {'Lindesnes': (57.98, 7.05), 'Nordkapp': (71.17, 25.78), 'Vardo': (70.37, 31.1), 'Stad': (62.2, 5.1), 'Oslo': (59.91, 10.75)}.items():
        print(n, [round(v) for v in proj(la, lo)])


if __name__ == '__main__':
    main()
