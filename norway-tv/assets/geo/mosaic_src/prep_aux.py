"""Aux layers on the mosaic grid: Natural Earth land raster, Blue Marble (upsampled) and a Blue-Marble ocean-only field."""
import numpy as np, time
from PIL import Image
from scipy import ndimage
from shapely.geometry import box, mapping
from rasterio.features import rasterize
from rasterio.warp import reproject, Resampling
from affine import Affine
from grid import *
from topo import Topo

t0 = time.time()
IMG = '/home/user/temp/norway-tv/assets/raw/package/example/img'
t = Topo()
land = t.land().intersection(box(WEST - 1, SOUTH - 1, EAST + 1, NORTH + 1))
geoms = [mapping(g) for g in getattr(land, 'geoms', [land]) if g.geom_type in ('Polygon', 'MultiPolygon')]
ne = rasterize(geoms, out_shape=(HEIGHT, WIDTH), transform=TRANSFORM, fill=0, default_value=1, dtype='uint8', all_touched=False)
print('ne land frac', ne.mean(), time.time() - t0, flush=True)

bm = np.asarray(Image.open(f'{IMG}/earth-blue-marble.jpg').convert('RGB')).astype(np.float32)
BH, BW = bm.shape[:2]
bpx = 360.0 / BW
btr = Affine(bpx, 0, -180, 0, -bpx, 90)
wpng = np.asarray(Image.open(f'{IMG}/earth-water.png').convert('L').resize((BW, BH), Image.BILINEAR)).astype(np.float32)
R, G, B = bm[..., 0], bm[..., 1], bm[..., 2]
blue = (B > R + 10) & (B >= G)
water_bm = blue & (wpng > 200)
# Natural Earth land at BM resolution (all_touched) -> excludes small islands' mixed pixels too
wl = t.land()
wgeoms = [mapping(g) for g in getattr(wl, 'geoms', [wl]) if g.geom_type in ('Polygon', 'MultiPolygon')]
ne_bm = rasterize(wgeoms, out_shape=(BH, BW), transform=btr, fill=0, default_value=1, dtype='uint8', all_touched=True).astype(bool)
land_bm = ndimage.binary_dilation(ne_bm | ~water_bm, iterations=1)
# reject dark outliers (lakes / island shadows mis-tagged as ocean): compare with local mean water luminance
lum = 0.3 * R + 0.59 * G + 0.11 * B
wm = water_bm.astype(np.float32)
lmean = ndimage.gaussian_filter(lum * wm, 4) / np.maximum(ndimage.gaussian_filter(wm, 4), 1e-3)
core = water_bm & ~land_bm & ~(lum < 0.75 * lmean)
print('ocean core frac', core.mean(), flush=True)
# de-block the JPEG a bit (only inside ocean)
f = np.zeros_like(bm); wsum = np.zeros((BH, BW), np.float32)
m = core.astype(np.float32)
num = ndimage.gaussian_filter(bm * m[..., None], (2.0, 2.0, 0)); den = ndimage.gaussian_filter(m, 2.0)
ocean = np.where(core[..., None], num / np.maximum(den, 1e-6)[..., None], 0)
filled = ocean.copy(); known = core.copy()
for sig in (2, 4, 8, 16, 32, 64):
    num = ndimage.gaussian_filter(np.where(known[..., None], filled, 0), (sig, sig, 0))
    den = ndimage.gaussian_filter(known.astype(np.float32), sig)
    est = num / np.maximum(den, 1e-6)[..., None]
    newk = (den > 0.02) & ~known
    filled[newk] = est[newk]
    known |= newk
print('bm ocean field filled', known.mean(), time.time() - t0, flush=True)


def to_grid(a, resampling=Resampling.cubic):
    out = np.zeros((a.shape[2], HEIGHT, WIDTH), np.float32)
    reproject(np.ascontiguousarray(np.transpose(a, (2, 0, 1))), out, src_transform=btr, src_crs='EPSG:4326',
              dst_transform=TRANSFORM, dst_crs='EPSG:4326', resampling=resampling, num_threads=2)
    return out


bm_g = to_grid(bm, Resampling.lanczos)
oc_g = to_grid(filled, Resampling.cubic)
wbm_g = to_grid(water_bm.astype(np.float32)[..., None], Resampling.bilinear)[0]
np.savez(f'{OUT}/aux.npz', ne=ne, bm=np.clip(bm_g, 0, 255).astype(np.uint8), ocean=np.clip(oc_g, 0, 255).astype(np.uint8),
         wbm=(wbm_g * 255).astype(np.uint8))
Image.fromarray(np.transpose(np.clip(oc_g, 0, 255).astype(np.uint8), (1, 2, 0))[::6, ::6]).save(f'{OUT}/dbg_ocean_field.png')
np.save(f'{ROOT}/bm_ocean_field_world.npy', filled.astype(np.float16))
np.save(f'{ROOT}/bm_water_world.npy', water_bm)
np.save(f'{ROOT}/bm_ocean_core_world.npy', core)
print('done', time.time() - t0)
