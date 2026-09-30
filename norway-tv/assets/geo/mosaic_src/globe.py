"""globe_texture_8k.jpg: 8192x4096 equirectangular world = Blue Marble (Lanczos-upsampled) with the Scandinavia
mosaic blended in. Seam hiding: (1) de-snow BM land east of the mosaic (BM has spring snow over NW Russia, the mosaic is
summer), fading out toward the Urals; (2) low-frequency (mosaic - BM) colour difference measured inside the mosaic and
bled outward with a fade; (3) smoothstep alpha ramp inside the mosaic edge. Heavy work is done in a Europe window."""
import numpy as np, time
from PIL import Image
from scipy import ndimage
from rasterio.warp import reproject, Resampling
from affine import Affine
from grid import *

Image.MAX_IMAGE_PIXELS = None
t0 = time.time()
GEO = '/home/user/temp/norway-tv/assets/geo'
IMG = '/home/user/temp/norway-tv/assets/raw/package/example/img'
GW, GH = 8192, 4096
gpx = 360.0 / GW
# processing window (lon -30..90, lat 30..85)
X0, X1 = int((-30 + 180) / gpx), int((90 + 180) / gpx)
Y0, Y1 = int((90 - 85) / gpx), int((90 - 30) / gpx)
wtr = Affine(gpx, 0, -180 + X0 * gpx, 0, -gpx, 90 - Y0 * gpx)
h, w = Y1 - Y0, X1 - X0

B8full = np.asarray(Image.open(f'{IMG}/earth-blue-marble.jpg').convert('RGB').resize((GW, GH), Image.LANCZOS)).copy()
B = np.transpose(B8full[Y0:Y1, X0:X1].astype(np.float32), (2, 0, 1))
water = np.load(f'{ROOT}/bm_water_world.npy')
water8 = np.asarray(Image.fromarray((water * 255).astype(np.uint8)).resize((GW, GH), Image.BILINEAR))[Y0:Y1, X0:X1].astype(np.float32) / 255
print('bm up', time.time() - t0, flush=True)

# mosaic layers -> window grid: main high-res mosaic, plus the coarser 'fringe' mosaic (same pipeline + grade,
# extends real summer Sentinel-2 imagery to -9..58E / 54..72.5N) so the BM seam sits far outside the Norway framing.
def to_win(path_rgb, path_aux, tr):
    Mx = np.load(path_rgb, mmap_mode='r'); ax = np.load(path_aux)
    hh, ww = Mx.shape[:2]
    d = np.zeros((5, h, w), np.float32)
    for c in range(3):
        reproject(np.ascontiguousarray(Mx[..., c]).astype(np.float32), d[c], src_transform=tr, src_crs='EPSG:4326',
                  dst_transform=wtr, dst_crs='EPSG:4326', resampling=Resampling.average, src_nodata=None, dst_nodata=0)
    reproject(np.ones((hh, ww), np.float32), d[3], src_transform=tr, src_crs='EPSG:4326', dst_transform=wtr,
              dst_crs='EPSG:4326', resampling=Resampling.average, src_nodata=None, dst_nodata=0)
    reproject(ax['ne'].astype(np.float32), d[4], src_transform=tr, src_crs='EPSG:4326', dst_transform=wtr,
              dst_crs='EPSG:4326', resampling=Resampling.average, src_nodata=None, dst_nodata=0)
    cv = d[3]
    return d[:3] / np.maximum(cv, 1e-6)[None], cv, d[4] / np.maximum(cv, 1e-6)

FW, FE, FS, FN, FPX = -9.0, 58.0, 54.0, 72.5, 0.012
Mm, covm, Lm = to_win(f'{ROOT}/final_rgb.npy', f'{ROOT}/aux.npz', TRANSFORM)
Mf, covf, Lf = to_win(f'{ROOT}/fringe/final_rgb.npy', f'{ROOT}/fringe/aux.npz', Affine(FPX, 0, FW, 0, -FPX, FN))
dm = ndimage.distance_transform_edt(covm > 0.999).astype(np.float32)
wmn = np.clip(dm / 8.0, 0, 1); wmn = wmn * wmn * (3 - 2 * wmn)
Mw = wmn[None] * Mm + (1 - wmn[None]) * Mf
L8 = wmn * Lm + (1 - wmn) * Lf
cov = np.maximum(covf, covm)
del Mm, Mf
EAST = FE
print('mosaic down', time.time() - t0, flush=True)

inside = cov > 0.999
din = ndimage.distance_transform_edt(inside).astype(np.float32)
dout = ndimage.distance_transform_edt(~inside).astype(np.float32)

# (1)+(2) low-frequency colour difference (mosaic - BM) measured inside the mosaic, bled outward.
#  - general: normalised convolution, faded over ~3 deg from the edge
#  - east of 44E (BM shows a grey spring-snow veil over NW Russia, the mosaic is summer taiga): the edge difference is
#    carried eastward row by row and faded linearly over 20 deg, and BM's snow speckle detail is attenuated there.
wm = (inside & (L8 > 0.7) & (din > 3)).astype(np.float32)
Blp = np.stack([ndimage.gaussian_filter(B[c], 4.0) for c in range(3)])
den1 = ndimage.gaussian_filter(wm, 30.0); den2 = ndimage.gaussian_filter(wm, 60.0)
fade = np.exp(-dout / 70.0) * (dout < 400)
lon = (-180 + (np.arange(X0, X1) + 0.5) * gpx).astype(np.float32)[None, :]
lat = (90 - (np.arange(Y0, Y1) + 0.5) * gpx).astype(np.float32)[:, None]
lonw = np.where(lon > EAST, np.clip(1 - (lon - EAST) / 20.0, 0, 1), np.clip((lon - (EAST - 10)) / 10.0, 0, 1))
latw = np.clip((73.0 - lat) / 1.5, 0, 1) * np.clip((lat - 49) / 5, 0, 1)
zone = lonw * latw
zone = zone * zone * (3 - 2 * zone)
bnd = np.clip(dout / 20.0, 0, 1); bnd = bnd * bnd * (3 - 2 * bnd)
zone = (zone * bnd).astype(np.float32)          # 0 inside the mosaic, ramps up just outside its edge
ce = int(round((EAST + 180) / gpx)) - X0
rows = np.arange(h)
Dg = np.zeros_like(B); T = np.zeros_like(B)
for c in range(3):
    diff = (Mw[c] - Blp[c]) * wm
    d1 = ndimage.gaussian_filter(diff, 30.0) / np.maximum(den1, 1e-4)
    d2 = ndimage.gaussian_filter(diff, 60.0) / np.maximum(den2, 1e-5)
    Dg[c] = np.where(den1 > 0.05, d1, np.where(den2 > 1e-5, d2, 0)) * fade
    # east edge profile (absolute mosaic colour over its last ~1.5 deg of land), per row, smoothed along latitude
    sl = slice(ce - 36, ce - 4)
    num = (Mw[c][:, sl] * wm[:, sl]).sum(1); wsum = wm[:, sl].sum(1)
    num = ndimage.gaussian_filter1d(num, 25); wsum = ndimage.gaussian_filter1d(wsum, 25)
    prof = np.where(wsum > 0.5, num / np.maximum(wsum, 1e-6), np.nan)
    good = ~np.isnan(prof)
    T[c] = np.interp(rows, rows[good], prof[good])[:, None]
# attenuate BM snow speckle in the east zone
mn = B.min(0); mx = B.max(0)
grey = np.clip(1 - ((mx - mn) / np.maximum(mx, 1)) / 0.3, 0, 1) * np.clip((mn - 40) / 60, 0, 1)
att = 1 - 0.65 * zone * grey
Bnew = (Blp + Dg) * (1 - zone[None]) + T * zone[None] + (B - Blp) * att[None]
landw = ndimage.gaussian_filter(1 - water8, 1.0)
B = B + (Bnew - B) * landw[None]
del Blp, Bnew, T, Dg

# (3) alpha ramp inside the mosaic edge
RAMP = 36.0
alpha = np.clip(din / RAMP, 0, 1)
alpha = np.minimum(alpha, np.clip((FE - lon) / 5.0, 0, 1))      # long 5-deg taper on the far-east (Urals) edge
alpha = alpha * alpha * (3 - 2 * alpha) * cov
# sharpness ramp: the mosaic is much crisper than 2x-upsampled BM, so soften it progressively toward its edge
sh = np.clip(din / (2.2 * RAMP), 0, 1); sh = sh * sh * (3 - 2 * sh)
Mw = np.stack([ndimage.gaussian_filter(Mw[c], 1.3) * (1 - sh) + Mw[c] * sh for c in range(3)])
out = alpha[None] * Mw + (1 - alpha[None]) * B
B8full[Y0:Y1, X0:X1] = np.transpose(np.clip(out + 0.5, 0, 255), (1, 2, 0)).astype(np.uint8)
Image.fromarray(B8full).save(f'{GEO}/globe_texture_8k.jpg', quality=92, subsampling=0, optimize=True)
np.save(f'{ROOT}/globe8k.npy', B8full)
print('saved', time.time() - t0)
