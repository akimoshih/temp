"""Stage 6: colour grade, sea/lake handling with Blue Marble ocean, gap fill, export scandinavia_mosaic.jpg (+json)."""
import json, os, time
import numpy as np
from scipy import ndimage
from PIL import Image
from grid import *

Image.MAX_IMAGE_PIXELS = None
t0 = time.time()
GEO = '/home/user/temp/norway-tv/assets/geo'
P = json.load(open(f'{ROOT}/grade_params.json')) if os.path.exists(f'{ROOT}/grade_params.json') else {}
BP = np.array(P.get('black', [7.0, 11.0, 6.0]), np.float32)      # TCI black point (dehaze)
WHITE = P.get('white', 170.0)                                     # TCI value mapped to ~1.0 before shoulder
GAMMA = P.get('gamma', 0.78)
SAT = P.get('sat', 1.12)
WB = np.array(P.get('wb', [1.0, 1.0, 1.0]), np.float32)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


CURVE_X = np.array(P.get('curve_x', [0, 6, 14, 22, 30, 45, 70, 110, 170, 255]), np.float32)
CURVE_Y = np.array(P.get('curve_y', [0, 4, 22, 42, 58, 84, 117, 151, 192, 238]), np.float32)


def grade(rgb):
    """rgb: (3,h,w) float32 TCI units 0..255 -> graded 0..255.
    Black-point dehaze, luminance tone curve applied as a ratio (hue-preserving), mild saturation, soft knee."""
    x = np.maximum(rgb - BP[:, None, None], 0) * WB[:, None, None]
    L = 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2]
    L2 = np.interp(L, CURVE_X, CURVE_Y).astype(np.float32)
    k = L2 / np.maximum(L, 0.5)
    x = x * k[None]
    l = L2[None]
    x = l + (x - l) * SAT
    x = np.maximum(x, 0)
    kn = 225.0
    x = np.where(x > kn, kn + (255 - kn) * (1 - np.exp(-(x - kn) / (255 - kn))), x)
    return np.clip(x, 0, 255)


z = np.load(f'{OUT}/s2_mosaic_raw.npz')
aux = np.load(f'{OUT}/aux.npz')
den = z['den'].astype(np.float32)
wf = z['water'].astype(np.float32)
ne = aux['ne'].astype(bool)
print('loaded', time.time() - t0, flush=True)

# ---------------- water classification ----------------
s2cov = den > 0.03
dist_out = ndimage.distance_transform_edt(~ne)                  # px outside NE land
wb = (s2cov & (wf > 0.5)) | (~s2cov & ~ne) | (dist_out > 30 * 0.004 / PX)
seeds = ~ne & (dist_out > 8 * 0.004 / PX)
er = ndimage.binary_erosion(wb, iterations=1)
lab, nlab = ndimage.label(er, structure=np.ones((3, 3)))
keep = np.unique(lab[seeds & er]); keep = keep[keep > 0]
sea_core = np.isin(lab, keep)
del lab
sea = wb & ndimage.binary_dilation(sea_core, iterations=2)
lake = wb & ~sea
print('water: sea %.3f lake %.4f' % (sea.mean(), lake.mean()), time.time() - t0, flush=True)

# antialiased water alpha: interior = 1, shoreline follows S2 water fraction
wb_in = ndimage.binary_erosion(wb, iterations=1)
wa = np.where(s2cov, smoothstep(0.2, 0.8, wf), (~ne).astype(np.float32))
alpha_w = np.where(wb_in, 1.0, np.where(ndimage.binary_dilation(wb, iterations=1), wa, 0.0)).astype(np.float32)
alpha_w = ndimage.gaussian_filter(alpha_w, 0.6)
seaness = ndimage.gaussian_filter(sea.astype(np.float32), 4.0)  # soft sea->lake transition inside fjords
seaness = np.clip(seaness * 1.6, 0, 1)
del er, wb_in, sea_core, dist_out
cov = smoothstep(0.02, 0.35, den)

# ---------------- graded S2 + composite (chunked) ----------------
rgb16 = z['rgb']
ocean = aux['ocean']
bm = aux['bm']
out = np.zeros((HEIGHT, WIDTH, 3), np.uint8)
# BM land -> S2 look transfer (per-channel linear fit on low-pass, land with full S2 coverage)
sub = (slice(None, None, 7), slice(None, None, 7))
g_sub = grade(rgb16[(slice(None),) + sub].astype(np.float32))
g_lp = np.stack([ndimage.gaussian_filter(g_sub[c], 1.6) for c in range(3)])
m = ne[sub] & (cov[sub] > 0.95) & (wf[sub] < 0.1)
fit = []
for c in range(3):
    xb = bm[c][sub][m].astype(np.float32); yb = g_lp[c][m]
    A = np.vstack([xb, np.ones_like(xb)]).T
    a, b = np.linalg.lstsq(A, yb, rcond=None)[0]
    fit.append((float(a), float(b)))
print('BM->S2 land fit', fit, time.time() - t0, flush=True)
lake_tint = np.array(P.get('lake_tint', [10, 24, 48]), np.float32)
CH = 500
for r0 in range(0, HEIGHT, CH):
    r1 = min(HEIGHT, r0 + CH)
    g = grade(rgb16[:, r0:r1].astype(np.float32))                  # (3,h,w)
    bml = np.stack([bm[c, r0:r1].astype(np.float32) * fit[c][0] + fit[c][1] for c in range(3)])
    oc = ocean[:, r0:r1].astype(np.float32)
    cv = cov[r0:r1][None]
    landcol = g * cv + bml * (1 - cv)
    # lakes: keep S2 texture, pull toward deep navy, never pitch black
    lk = g * 0.55 + lake_tint[:, None, None] * 0.75
    lk = lk * cv + oc * 0.6 * (1 - cv)
    s = seaness[r0:r1][None]
    watercol = oc * s + lk * (1 - s)
    a = alpha_w[r0:r1][None]
    res = landcol * (1 - a) + watercol * a
    # fine dither against banding in smooth ocean gradients
    res += np.random.default_rng(r0).normal(0, 0.6, res.shape).astype(np.float32)
    out[r0:r1] = np.transpose(np.clip(res + 0.5, 0, 255), (1, 2, 0)).astype(np.uint8)
    print('chunk', r0, time.time() - t0, flush=True)

np.save(f'{OUT}/final_rgb.npy', out)
Image.fromarray(out).save(f'{GEO}/scandinavia_mosaic.jpg' if GRID == 'main' else f'{OUT}/fringe.jpg', quality=92, subsampling=0, optimize=True)
print('saved jpg', time.time() - t0, flush=True)
