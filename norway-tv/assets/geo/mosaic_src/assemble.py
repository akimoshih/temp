"""Stage 5: gain-equalise overlapping tiles and blend all warped tiles into the lat/lon mosaic (linear TCI, ungraded).
Output: tmp/mosaic/s2_mosaic_raw.npz (rgb float16, weight, water, snow, nclear)."""
import json, os, glob, time
import numpy as np
from scipy.sparse import lil_matrix
from scipy.sparse.linalg import lsqr
from grid import *

t0 = time.time()
files = sorted(glob.glob(f'{OUT}/warped/*.npz'))
T = []
for f in files:
    z = np.load(f)
    if 'empty' in z.files:
        continue
    T.append((os.path.basename(f)[:-4], z['win'], z['data']))
print('tiles', len(T), time.time() - t0, flush=True)

# ---- pairwise overlap statistics
eqs = []
for i in range(len(T)):
    ni, wi, di = T[i]
    for j in range(i + 1, len(T)):
        nj, wj, dj = T[j]
        r0, r1 = max(wi[0], wj[0]), min(wi[1], wj[1])
        c0, c1 = max(wi[2], wj[2]), min(wi[3], wj[3])
        if r1 - r0 < 8 or c1 - c0 < 8:
            continue
        a = di[:, r0 - wi[0]:r1 - wi[0], c0 - wi[2]:c1 - wi[2]].astype(np.float32)
        b = dj[:, r0 - wj[0]:r1 - wj[0], c0 - wj[2]:c1 - wj[2]].astype(np.float32)
        m = (a[3] > 0.2) & (b[3] > 0.2)
        if m.sum() < 400:
            continue
        with np.errstate(all='ignore'):
            ra = a[:3] / a[3]; rb = b[:3] / b[3]
            land = m & (a[4] / a[3] < 0.15) & (b[4] / b[3] < 0.15) & (a[5] / a[3] < 0.2) & (b[5] / b[3] < 0.2)
            land &= (ra.mean(0) > 8) & (rb.mean(0) > 8) & (ra.mean(0) < 140) & (rb.mean(0) < 140)
        n = int(land.sum())
        if n < 400:
            continue
        ma = np.median(ra[:, land], axis=1); mb = np.median(rb[:, land], axis=1)
        eqs.append((i, j, np.log(ma) - np.log(mb), n))
print('overlap pairs', len(eqs), time.time() - t0, flush=True)

# ---- least squares per-tile log gains (g_i - g_j = -(log a - log b)), weak prior g=0
nT = len(T)
fixed = json.load(open(f'{ROOT}/tile_gains.json')) if GRID != 'main' else {}
gains = np.zeros((nT, 3))
for ch in range(3):
    A = lil_matrix((len(eqs) + nT, nT)); rhs = np.zeros(len(eqs) + nT)
    for k, (i, j, L, n) in enumerate(eqs):
        wgt = min(np.sqrt(n) / 30, 3.0)
        A[k, i] = wgt; A[k, j] = -wgt; rhs[k] = -L[ch] * wgt
    for i in range(nT):
        if T[i][0] in fixed:   # fringe grid: keep the gains already used by the main mosaic
            A[len(eqs) + i, i] = 20.0; rhs[len(eqs) + i] = 20.0 * fixed[T[i][0]][ch]
        else:
            A[len(eqs) + i, i] = float(os.environ.get("PRIOR", "1.5"))
    g = lsqr(A.tocsr(), rhs, atol=1e-8, btol=1e-8)[0]
    gains[:, ch] = np.clip(g, -0.2, 0.2)
res = [np.abs(L + gains[i] - gains[j]).mean() for i, j, L, n in eqs]
res0 = [np.abs(L).mean() for i, j, L, n in eqs]
print('gain residual before %.4f after %.4f' % (np.mean(res0), np.mean(res)), 'gain range', gains.min(0), gains.max(0), flush=True)
json.dump({T[i][0]: gains[i].round(4).tolist() for i in range(nT)}, open(f'{OUT}/tile_gains.json', 'w'), indent=0)

# ---- accumulate
num = np.zeros((3, HEIGHT, WIDTH), np.float32)
den = np.zeros((HEIGHT, WIDTH), np.float32)
wat = np.zeros((HEIGHT, WIDTH), np.float32)
sno = np.zeros((HEIGHT, WIDTH), np.float32)
ncl = np.zeros((HEIGHT, WIDTH), np.float32)
for i, (n, w, d) in enumerate(T):
    d = d.astype(np.float32)
    k = np.exp(gains[i]).astype(np.float32)[:, None, None]
    sl = (slice(w[0], w[1]), slice(w[2], w[3]))
    num[(slice(None),) + sl] += d[:3] * k
    den[sl] += d[3]; wat[sl] += d[4]; sno[sl] += d[5]; ncl[sl] += d[6]
print('accumulated', time.time() - t0, flush=True)
with np.errstate(all='ignore'):
    inv = np.where(den > 1e-4, 1.0 / den, 0).astype(np.float32)
rgb = num * inv[None]
del num
np.savez(f'{OUT}/s2_mosaic_raw.npz', rgb=rgb.astype(np.float16), den=den.astype(np.float16),
         water=(wat * inv).astype(np.float16), snow=(sno * inv).astype(np.float16), ncl=(ncl * inv).astype(np.float16))
print('saved', time.time() - t0)
