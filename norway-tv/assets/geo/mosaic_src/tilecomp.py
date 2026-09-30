"""Stage 3: per-tile cloud-masked median composite (UTM grid of the tile, ~160 m)."""
import json, os, sys, glob, time
import numpy as np
import concurrent.futures as cf

ROOT = '/home/user/temp/norway-tv/tmp/mosaic'
CACHE = f'{ROOT}/cache'
TOUT = f'{ROOT}/tiles'
os.makedirs(TOUT, exist_ok=True)
BAD = np.array([0, 1, 3, 8, 9, 10], np.uint8)   # nodata, saturated, cloud shadow, cloud med/high, cirrus
OV = 687


def composite(tile, scenes, force=False):
    out = f'{TOUT}/{tile}.npz'
    if os.path.exists(out) and not force:
        return out
    stack, clear, valid, water, snow = [], [], [], [], []
    meta = None
    for s in scenes:
        p = f'{CACHE}/{s["name"]}.npz'
        if not os.path.exists(p):
            continue
        z = np.load(p)
        tci, scl = z['tci'], z['scl']
        if meta is None:
            meta = (float(z['x0']), float(z['y0']), int(z['epsg']))
        v = (tci.min(0) > 0) & (scl > 0)   # TCI nodata = 0
        c = v & ~np.isin(scl, BAD)
        stack.append(tci); valid.append(v); clear.append(c)
        water.append(scl == 6); snow.append(scl == 11)
    if not stack:
        return None
    S = np.stack(stack).astype(np.float32)            # n,3,H,W
    C = np.stack(clear); V = np.stack(valid)
    W = np.stack(water); SN = np.stack(snow)
    n_clear = C.sum(0)
    n_valid = V.sum(0)
    # fast masked order statistics: masked obs -> NaN, sort along scene axis (NaNs go last)
    def masked_sorted(mask):
        X = np.where(mask[:, None], S, np.nan)
        X.sort(axis=0)
        return X

    def take(Xs, idx):
        idx = np.clip(idx, 0, Xs.shape[0] - 1)
        return np.take_along_axis(Xs, np.broadcast_to(idx[None, None], (1,) + Xs.shape[1:]), 0)[0]

    def median_of(Xs, k):
        lo = take(Xs, (k - 1) // 2); hi = take(Xs, k // 2)
        return 0.5 * (lo + hi)

    Xs = masked_sorted(C)
    med = median_of(Xs, n_clear)
    lum = S.mean(1)
    medl = med.mean(0)
    C2 = C & ~((lum > medl[None] * 1.35 + 12) & (n_clear[None] >= 3))   # thin cloud / haze outliers
    C2 &= ~((lum < medl[None] * 0.55 - 4) & (n_clear[None] >= 3))       # undetected shadows
    # summer look with minimal seasonal snow: where snow-free clear looks exist, use only those
    SNOWY = np.stack(snow)
    C3 = C2 & ~SNOWY
    n3 = C3.sum(0)
    C2 = np.where((n3 >= 1)[None], C3, C2)
    n2 = C2.sum(0)
    Xs = masked_sorted(C2)
    med = median_of(Xs, n2)
    # fallback for pixels with no clear obs: darker quartile of all valid obs
    Xv = masked_sorted(V)
    fb = take(Xv, np.floor(0.25 * np.maximum(n_valid - 1, 0)).astype(np.int64))
    rgb = np.where(n2[None] > 0, med, fb)
    ok = n_valid > 0
    rgb = np.where(ok[None], rgb, 0)
    with np.errstate(all='ignore'):
        wf = np.where(n2 > 0, (W & C2).sum(0) / np.maximum(n2, 1), (W & V).sum(0) / np.maximum(n_valid, 1))
        sf = np.where(n2 > 0, (SN & C2).sum(0) / np.maximum(n2, 1), 0)
    np.savez_compressed(out, rgb=np.clip(np.nan_to_num(rgb), 0, 255).astype(np.uint8),
                        n_clear=n2.astype(np.uint8), n_valid=n_valid.astype(np.uint8), ok=ok,
                        water=(np.nan_to_num(wf) * 255).astype(np.uint8), snow=(np.nan_to_num(sf) * 255).astype(np.uint8),
                        x0=meta[0], y0=meta[1], epsg=meta[2], px=109800.0 / OV)
    return out


if __name__ == '__main__':
    plan = json.load(open(os.environ.get('PLAN', f'{ROOT}/plan.json')))
    tiles = sys.argv[1:] or sorted(plan)
    force = bool(os.environ.get('FORCE'))
    t0 = time.time()
    with cf.ProcessPoolExecutor(3) as ex:
        futs = {ex.submit(composite, t, plan[t]['scenes'], force): t for t in tiles if plan[t]['scenes']}
        for i, f in enumerate(cf.as_completed(futs)):
            f.result()
            if i % 20 == 0:
                print(f'[{i}/{len(futs)}] {futs[f]} t={time.time()-t0:.0f}s', flush=True)
    print('done', time.time() - t0)
