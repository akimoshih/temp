"""Stage 4: reproject each tile composite (UTM) into its window of the lat/lon grid, with feather weights."""
import json, os, sys, glob, time, math
import numpy as np
import concurrent.futures as cf
from scipy import ndimage
import rasterio
from rasterio.warp import reproject, transform_bounds, Resampling
from affine import Affine
from grid import *

WOUT = f'{OUT}/warped'
os.makedirs(WOUT, exist_ok=True)
FEATHER = 24  # source px (~3.8 km)


def warp(tile, force=False):
    out = f'{WOUT}/{tile}.npz'
    if os.path.exists(out) and not force:
        return out
    z = np.load(f'{ROOT}/tiles/{tile}.npz')
    rgb = z['rgb'].astype(np.float32)
    ok = z['ok']
    ncl = z['n_clear'].astype(np.float32)
    px = float(z['px'])
    src_tr = Affine(px, 0, float(z['x0']), 0, -px, float(z['y0']))
    crs = f'EPSG:{int(z["epsg"])}'
    H, Wd = ok.shape
    # feather: distance to invalid pixels or tile border
    okp = np.pad(ok, 1, constant_values=False)
    d = ndimage.distance_transform_edt(okp)[1:-1, 1:-1]
    f = np.clip(d / FEATHER, 0, 1)
    f = f * f * (3 - 2 * f)
    q = np.clip((ncl + 1) / 4.0, 0.25, 1.0)          # tiles with more clear looks dominate overlaps
    w = (f * q).astype(np.float32)
    w[~ok] = 0
    src = np.concatenate([rgb * w, w[None], (z['water'].astype(np.float32) / 255 * w)[None],
                          (z['snow'].astype(np.float32) / 255 * w)[None], (ncl * w)[None]], 0)
    b = transform_bounds(crs, 'EPSG:4326', src_tr.c, src_tr.f - px * H, src_tr.c + px * Wd, src_tr.f, densify_pts=41)
    c0 = max(0, int(math.floor((b[0] - WEST) / PX)) - 2); c1 = min(WIDTH, int(math.ceil((b[2] - WEST) / PX)) + 2)
    r0 = max(0, int(math.floor((NORTH - b[3]) / PX)) - 2); r1 = min(HEIGHT, int(math.ceil((NORTH - b[1]) / PX)) + 2)
    if c1 <= c0 or r1 <= r0:
        np.savez_compressed(out, empty=True)
        return out
    dst_tr = Affine(PX, 0, WEST + c0 * PX, 0, -PX, NORTH - r0 * PX)
    dst = np.zeros((src.shape[0], r1 - r0, c1 - c0), np.float32)
    reproject(src, dst, src_transform=src_tr, src_crs=crs, dst_transform=dst_tr, dst_crs='EPSG:4326',
              resampling=Resampling.average, src_nodata=None, dst_nodata=None, num_threads=1)
    np.savez_compressed(out, data=dst.astype(np.float16), win=np.array([r0, r1, c0, c1]))
    return out


if __name__ == '__main__':
    tiles = sys.argv[1:] or sorted(os.path.basename(p)[:-4] for p in glob.glob(f'{ROOT}/tiles/*.npz'))
    force = bool(os.environ.get('FORCE'))
    t0 = time.time()
    with cf.ProcessPoolExecutor(3) as ex:
        for i, _ in enumerate(ex.map(warp, tiles, [force] * len(tiles))):
            if i % 50 == 0:
                print(f'[{i}/{len(tiles)}] t={time.time()-t0:.0f}s', flush=True)
    print('done', time.time() - t0)
