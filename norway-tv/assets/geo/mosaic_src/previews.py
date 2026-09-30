"""Preview PNGs: downscaled full mosaic; 1920x1080 Norway frame (aspect-corrected, outline drawn); globe texture thumb."""
import json, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from grid import *

Image.MAX_IMAGE_PIXELS = None
GEO = '/home/user/temp/norway-tv/assets/geo'
M = np.load(f'{ROOT}/final_rgb.npy', mmap_mode='r')
G = np.load(f'{ROOT}/globe8k.npy', mmap_mode='r')

# 1) downscaled full mosaic (area-average, plate carree as stored)
im = Image.fromarray(np.ascontiguousarray(M))
im.resize((3000, 1125), Image.LANCZOS).save(f'{GEO}/preview_scandinavia_mosaic.png', optimize=True)

# 2) 1920x1080 Norway frame, equirectangular with standard parallel 64.5N (so shapes look right), outline drawn
W, H = 1920, 1080
lat0, lat1 = 57.3, 71.9
lat_c = 64.5
k = math.cos(math.radians(lat_c))
dlat = (lat1 - lat0) / H
dlon = dlat / k
lon_c = 17.6
lons = lon_c + (np.arange(W) + 0.5 - W / 2) * dlon
lats = lat1 - (np.arange(H) + 0.5) * dlat
LON, LAT = np.meshgrid(lons, lats)
# sample mosaic (bilinear) and globe texture, feather the mosaic over 1.6 deg inside its border
col = (LON - WEST) / PX - 0.5; row = (NORTH - LAT) / PX - 0.5
ins = (LON > WEST) & (LON < EAST) & (LAT > SOUTH) & (LAT < NORTH)
edge = np.minimum.reduce([LON - WEST, EAST - LON, LAT - SOUTH, NORTH - LAT]) / 1.6
a = np.clip(edge, 0, 1); a = a * a * (3 - 2 * a) * ins
gpx = 360 / 8192
gc = (LON + 180) / gpx - 0.5; gr = (90 - LAT) / gpx - 0.5
out = np.zeros((H, W, 3), np.float32)
r0, r1 = int(max(0, row.min() - 2)), int(min(HEIGHT, row.max() + 3))
c0, c1 = int(max(0, col.min() - 2)), int(min(WIDTH, col.max() + 3))
sub = np.asarray(M[r0:r1, c0:c1]).astype(np.float32)
gr0, gr1 = int(gr.min()) - 2, int(gr.max()) + 3; gc0, gc1 = int(gc.min()) - 2, int(gc.max()) + 3
gsub = np.asarray(G[gr0:gr1, gc0:gc1]).astype(np.float32)
for c in range(3):
    ms = ndimage.map_coordinates(sub[..., c], [row - r0, col - c0], order=1, mode='nearest')
    gs = ndimage.map_coordinates(gsub[..., c], [gr - gr0, gc - gc0], order=3, mode='nearest')
    out[..., c] = a * ms + (1 - a) * gs
frame = Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))
# outline (supersampled)
S = 3
ov = Image.new('RGBA', (W * S, H * S), (0, 0, 0, 0))
d = ImageDraw.Draw(ov)
gj = json.load(open(f'{GEO}/norway_outline.geojson'))
feat = [f for f in gj['features'] if f['properties']['part'] == 'mainland'][0]
def xy(p):
    return ((p[0] - lon_c) / dlon * S + W * S / 2, (lat1 - p[1]) / dlat * S)
for poly in feat['geometry']['coordinates']:
    ring = [xy(p) for p in poly[0]]
    d.line(ring + [ring[0]], fill=(255, 255, 255, 235), width=int(4.5 * S), joint='curve')
for poly in feat['geometry']['coordinates']:
    ring = [xy(p) for p in poly[0]]
    d.line(ring + [ring[0]], fill=(186, 12, 47, 255), width=int(2.2 * S), joint='curve')
ov = ov.resize((W, H), Image.LANCZOS)
frame = frame.convert('RGBA'); frame.alpha_composite(ov)
frame.convert('RGB').save(f'{GEO}/preview_norway_1080p.png', optimize=True)

# 3) globe texture thumbnail + Europe crop
Image.fromarray(np.ascontiguousarray(G)).resize((2048, 1024), Image.LANCZOS).save(f'{GEO}/preview_globe_texture.png', optimize=True)
print('ok', dict(lon_c=lon_c, lat0=lat0, lat1=lat1, dlat=dlat, dlon=dlon))
