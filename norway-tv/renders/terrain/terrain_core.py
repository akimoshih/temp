"""
terrain_core.py - shared data prep + numba kernels for the Norway terrain plates.

World frame (metres): X = east, Y = south, Z = up, origin at the NW corner of the
DEM extent. Height samples live on a 10 m grid (bicubic upsample of the 20 m
Copernicus DEM), texture on a 5 m grid (Lanczos upsample of the 10 m Sentinel-2
texture). Grid sample (i, j) of the padded height array sits at
X = (j - PAD + 0.5) * 10, Y = (i - PAD + 0.5) * 10.

Ray casting = hierarchical max-mip ("maximum mipmap") traversal of the height
field with an exact ray / bilinear-patch intersection at level 0 (no voxel or
stair-step artefacts, no holes). Texture = trilinear mip-mapped lookups with the
LOD taken from the ray footprint.
"""
import json
import math
import os

import numpy as np
from numba import njit
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None

GEO = '/home/user/temp/norway-tv/assets/geo/dem'
CACHE = '/home/user/temp/norway-tv/tmp/terrain/cache'
HCELL = 10.0     # height grid spacing (m)
TCELL = 5.0      # texture level-0 texel (m)


# --------------------------------------------------------------------------
# data preparation (numpy / scipy, cached)
# --------------------------------------------------------------------------
def srgb_to_lin(x):
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def value_noise2(shape, cell, seed):
    """smooth 2D value noise (cubic-interpolated random lattice), ~unit variance"""
    rng = np.random.default_rng(seed)
    gh = int(math.ceil(shape[0] / cell)) + 4
    gw = int(math.ceil(shape[1] / cell)) + 4
    g = rng.standard_normal((gh, gw)).astype(np.float32)
    yy = np.arange(shape[0], dtype=np.float32) / cell + 1.0
    xx = np.arange(shape[1], dtype=np.float32) / cell + 1.0
    Y, X = np.meshgrid(yy, xx, indexing='ij')
    return ndimage.map_coordinates(g, [Y, X], order=3, mode='nearest').astype(np.float32)


def prepare(name, exag, pad, tex_file=None, detail_amp=0.0, seed=1):
    """returns dict of arrays for the kernels (cached to .npz)"""
    os.makedirs(CACHE, exist_ok=True)
    tex_file = tex_file or f'{name}_tex.jpg'
    key = f'{name}_{tex_file.split(".")[0]}_e{exag:.2f}_p{pad}_d{detail_amp:.1f}'
    path = os.path.join(CACHE, key + '.npz')
    if os.path.exists(path):
        z = np.load(path)
        d = {k: z[k] for k in z.files}
        return d
    meta = json.load(open(os.path.join(GEO, f'{name}_dem.json')))
    dem = np.load(os.path.join(GEO, f'{name}_dem.npy')).astype(np.float32)
    wm = np.array(Image.open(os.path.join(GEO, f'{name}_water.png')))
    H20, W20 = dem.shape
    H10, W10 = H20 * 2, W20 * 2
    # 10 m sample (i, j) -> DEM fractional coords (i/2 - 0.25, j/2 - 0.25)
    ii = np.arange(H10, dtype=np.float32) / 2 - 0.25
    jj = np.arange(W10, dtype=np.float32) / 2 - 0.25
    I, J = np.meshgrid(ii, jj, indexing='ij')
    h = ndimage.map_coordinates(dem, [I, J], order=3, mode='nearest').astype(np.float32)
    # smooth (sub-pixel) shorelines: blurred 20 m mask, cubic upsample
    sm = ndimage.gaussian_filter((wm == 255).astype(np.float32), 0.8)
    lm = ndimage.gaussian_filter((wm == 128).astype(np.float32), 0.8)
    sea = np.clip(ndimage.map_coordinates(sm, [I, J], order=3, mode='nearest'), 0, 1)
    lake = np.clip(ndimage.map_coordinates(lm, [I, J], order=3, mode='nearest'), 0, 1)
    lakelev = ndimage.map_coordinates(dem, [I, J], order=0, mode='nearest')
    h = np.maximum(h, 0.0)
    h[sea > 0.5] = 0.0
    lk = lake > 0.5
    h[lk] = lakelev[lk]
    # fine relief on land only: fall-line ribs / gullies (anisotropic, ridged), slope-weighted.
    # GLO-30 is ~30 m, so bicubic alone gives "melted" walls; this adds believable rock structure.
    if detail_amp > 0:
        hs0 = ndimage.gaussian_filter(h, 3.0)
        gy, gx = np.gradient(hs0, HCELL)
        slope = np.sqrt(gx * gx + gy * gy)
        cx = ndimage.gaussian_filter(gx / (slope + 1e-3) * np.minimum(slope, 1), 8.0)
        cy = ndimage.gaussian_filter(gy / (slope + 1e-3) * np.minimum(slope, 1), 8.0)
        cl = np.sqrt(cx * cx + cy * cy) + 1e-6
        cx, cy = cx / cl, cy / cl
        Yw, Xw = np.mgrid[0:H10, 0:W10].astype(np.float32) * HCELL
        along = Xw * cx + Yw * cy
        across = -Xw * cy + Yw * cx
        rng = np.random.default_rng(seed)
        lat = rng.standard_normal((1024, 1024)).astype(np.float32)
        acc = np.zeros_like(h)
        for (wa, wb, amp) in ((70.0, 260.0, 0.55), (32.0, 120.0, 0.30), (15.0, 55.0, 0.15)):
            n = ndimage.map_coordinates(lat, [across / wa, along / wb], order=3, mode='wrap')
            r = 1.0 - np.abs(n) * 1.2          # ridged -> sharp crests / soft gullies
            acc += amp * (r - 0.35)
        land = np.clip(1.0 - sea - lake, 0, 1)
        land = ndimage.gaussian_filter(ndimage.minimum_filter(land, 5), 2.0)
        sw = np.clip((slope - 0.25) / 0.9, 0, 1) ** 1.2
        amp = detail_amp * (0.15 + sw) * land
        h = h + (acc * amp).astype(np.float32)
        h = np.maximum(h, 0.0)
        h[sea > 0.5] = 0.0
        del Yw, Xw, along, across
    h = h * exag
    # symmetric padding (mirrors the terrain beyond the extent; hidden by haze)
    hp = np.pad(h, pad, mode='symmetric').astype(np.float32)
    seap = np.pad(sea, pad, mode='symmetric').astype(np.float32)
    lakep = np.pad(lake, pad, mode='symmetric').astype(np.float32)
    # normals from the padded height field (central differences)
    hs = ndimage.gaussian_filter(hp, 0.7)
    gy, gx = np.gradient(hs, HCELL)
    nrm = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    nrm /= np.linalg.norm(nrm, axis=-1, keepdims=True)
    # coarse normals (for relief-shading reference = what the 10 m satellite pixel "saw")
    hb = ndimage.gaussian_filter(hp, 3.0)
    gy, gx = np.gradient(hb, HCELL)
    nb = np.stack([-gx, -gy, np.ones_like(gx)], -1)
    nb /= np.linalg.norm(nb, axis=-1, keepdims=True)
    # cavity / ambient-occlusion proxy: height relative to local mean
    cav = (hp - ndimage.gaussian_filter(hp, 6.0)).astype(np.float32)
    # valley-floor reference height for the steep-face (triplanar) texture projection
    zref = ndimage.gaussian_filter(ndimage.minimum_filter(hp, 61), 30.0).astype(np.float32)
    # max-mip pyramid on cells
    m0 = np.maximum(np.maximum(hp[:-1, :-1], hp[:-1, 1:]), np.maximum(hp[1:, :-1], hp[1:, 1:]))
    levels = [m0]
    while max(levels[-1].shape) > 1:
        a = levels[-1]
        hh, ww = a.shape
        ph, pw = (hh + 1) // 2 * 2, (ww + 1) // 2 * 2
        b = np.full((ph, pw), -1e30, np.float32)
        b[:hh, :ww] = a
        b = np.maximum(np.maximum(b[0::2, 0::2], b[0::2, 1::2]), np.maximum(b[1::2, 0::2], b[1::2, 1::2]))
        levels.append(b)
    mm_off = np.zeros(len(levels), np.int64)
    mm_w = np.zeros(len(levels), np.int64)
    mm_h = np.zeros(len(levels), np.int64)
    o = 0
    for k, a in enumerate(levels):
        mm_off[k] = o
        mm_h[k], mm_w[k] = a.shape
        o += a.size
    mm = np.concatenate([a.ravel() for a in levels]).astype(np.float32)
    # texture: 10 m -> 5 m Lanczos, linearise, mip pyramid
    tim = Image.open(os.path.join(GEO, tex_file)).convert('RGB')
    tw, th = tim.size
    tim = tim.resize((tw * 2, th * 2), Image.LANCZOS)
    t0 = srgb_to_lin(np.asarray(tim).astype(np.float32) / 255.0).astype(np.float32)
    # compensate the softness of the 2x upsample (mild unsharp mask on level 0 only)
    bl = np.stack([ndimage.gaussian_filter(t0[..., c], 1.6) for c in range(3)], -1)
    t0 = np.maximum(t0 + 0.45 * (t0 - bl), 0.0).astype(np.float32)
    del bl
    tl = [t0]
    while min(tl[-1].shape[:2]) > 8:
        a = tl[-1]
        hh, ww = a.shape[0] // 2 * 2, a.shape[1] // 2 * 2
        a = a[:hh, :ww]
        tl.append(((a[0::2, 0::2] + a[0::2, 1::2] + a[1::2, 0::2] + a[1::2, 1::2]) * 0.25).astype(np.float32))
    tx_off = np.zeros(len(tl), np.int64)
    tx_w = np.zeros(len(tl), np.int64)
    tx_h = np.zeros(len(tl), np.int64)
    o = 0
    for k, a in enumerate(tl):
        tx_off[k] = o
        tx_h[k], tx_w[k] = a.shape[:2]
        o += a.shape[0] * a.shape[1] * 3
    tex = np.concatenate([a.reshape(-1) for a in tl]).astype(np.float32)
    wsel = (ndimage.minimum_filter((sea > 0.5).astype(np.uint8), 9) > 0)
    t10 = srgb_to_lin(np.asarray(Image.open(os.path.join(GEO, tex_file)).convert('RGB')).astype(np.float32) / 255.0)
    water_rgb = np.median(t10[wsel], axis=0).astype(np.float32) if wsel.any() else np.array([0.01, 0.02, 0.04], np.float32)
    d = dict(h=hp, sea=seap, water_rgb=water_rgb, lake=lakep, nrm=nrm.astype(np.float32), nb=nb.astype(np.float32),
             cav=cav, zref=zref, mm=mm, mm_off=mm_off, mm_w=mm_w, mm_h=mm_h,
             tex=tex, tx_off=tx_off, tx_w=tx_w, tx_h=tx_h,
             pad=np.int64(pad), hmax=np.float32(hp.max()), exag=np.float32(exag))
    np.savez(path, **d)
    return d


def shadow_map(D, sun, step=2):
    """cast-shadow mask on the height grid for a fixed sun (1 = lit), cached"""
    key = os.path.join(CACHE, 'shadow_%d_%.4f_%.4f_%.4f_%d.npy' % (D['h'].shape[0], sun[0], sun[1], sun[2], D['h'].size))
    if os.path.exists(key):
        return np.load(key)
    sm = _shadow_kernel(D['h'], D['mm'], D['mm_off'], D['mm_w'], D['mm_h'], float(D['hmax']), int(D['pad']),
                        float(sun[0]), float(sun[1]), float(sun[2]), step)
    full = ndimage.zoom(sm, step, order=1)[:D['h'].shape[0], :D['h'].shape[1]]
    full = ndimage.gaussian_filter(full, 1.2).astype(np.float32)
    np.save(key, full)
    return full


# --------------------------------------------------------------------------
# numba kernels
# --------------------------------------------------------------------------
@njit(cache=True, fastmath=True)
def mirror_i(i, n):
    m = i % (2 * n)
    if m < 0:
        m += 2 * n
    if m >= n:
        m = 2 * n - 1 - m
    return m


@njit(cache=True, fastmath=True)
def tex_bilerp(tex, off, w, h, fx, fy, out):
    """bilinear on one mip level; fx, fy in texel units (centre = +0.5); mirrored"""
    x = fx - 0.5
    y = fy - 0.5
    x0 = math.floor(x)
    y0 = math.floor(y)
    ax = x - x0
    ay = y - y0
    ix0 = mirror_i(int(x0), w)
    ix1 = mirror_i(int(x0) + 1, w)
    iy0 = mirror_i(int(y0), h)
    iy1 = mirror_i(int(y0) + 1, h)
    b00 = off + (iy0 * w + ix0) * 3
    b01 = off + (iy0 * w + ix1) * 3
    b10 = off + (iy1 * w + ix0) * 3
    b11 = off + (iy1 * w + ix1) * 3
    w00 = (1 - ax) * (1 - ay)
    w01 = ax * (1 - ay)
    w10 = (1 - ax) * ay
    w11 = ax * ay
    for c in range(3):
        out[c] = tex[b00 + c] * w00 + tex[b01 + c] * w01 + tex[b10 + c] * w10 + tex[b11 + c] * w11


@njit(cache=True, fastmath=True)
def tex_sample(tex, tx_off, tx_w, tx_h, X, Y, foot, out, tmp):
    """trilinear mip lookup at world (X, Y) with footprint `foot` metres"""
    lod = math.log2(max(foot, 1e-3) / TCELL_C)
    nl = tx_off.shape[0]
    if lod <= 0.0:
        tex_bilerp(tex, tx_off[0], tx_w[0], tx_h[0], X / TCELL_C, Y / TCELL_C, out)
        return
    if lod >= nl - 1:
        lod = nl - 1.0001
    l0 = int(math.floor(lod))
    f = lod - l0
    s0 = TCELL_C * (2.0 ** l0)
    tex_bilerp(tex, tx_off[l0], tx_w[l0], tx_h[l0], X / s0, Y / s0, out)
    s1 = s0 * 2.0
    tex_bilerp(tex, tx_off[l0 + 1], tx_w[l0 + 1], tx_h[l0 + 1], X / s1, Y / s1, tmp)
    for c in range(3):
        out[c] = out[c] * (1 - f) + tmp[c] * f


TCELL_C = TCELL


@njit(cache=True, fastmath=True)
def grid_bilerp(a, gx, gy):
    hh, ww = a.shape
    x0 = int(math.floor(gx))
    y0 = int(math.floor(gy))
    ax = gx - x0
    ay = gy - y0
    if x0 < 0:
        x0 = 0
        ax = 0.0
    if y0 < 0:
        y0 = 0
        ay = 0.0
    if x0 >= ww - 1:
        x0 = ww - 2
        ax = 1.0
    if y0 >= hh - 1:
        y0 = hh - 2
        ay = 1.0
    return (a[y0, x0] * (1 - ax) * (1 - ay) + a[y0, x0 + 1] * ax * (1 - ay)
            + a[y0 + 1, x0] * (1 - ax) * ay + a[y0 + 1, x0 + 1] * ax * ay)


@njit(cache=True, fastmath=True)
def grid_bilerp3(a, gx, gy, out):
    hh, ww = a.shape[0], a.shape[1]
    x0 = int(math.floor(gx))
    y0 = int(math.floor(gy))
    ax = gx - x0
    ay = gy - y0
    if x0 < 0:
        x0 = 0
        ax = 0.0
    if y0 < 0:
        y0 = 0
        ay = 0.0
    if x0 >= ww - 1:
        x0 = ww - 2
        ax = 1.0
    if y0 >= hh - 1:
        y0 = hh - 2
        ay = 1.0
    for c in range(3):
        out[c] = (a[y0, x0, c] * (1 - ax) * (1 - ay) + a[y0, x0 + 1, c] * ax * (1 - ay)
                  + a[y0 + 1, x0, c] * (1 - ax) * ay + a[y0 + 1, x0 + 1, c] * ax * ay)


@njit(cache=True, fastmath=True)
def trace(h, mm, mm_off, mm_w, mm_h, hmax, pad, ox, oy, oz, dx, dy, dz, tmax):
    """
    Ray (world metres) vs height field. Returns t of first hit or -1.
    Max-mip hierarchical traversal + analytic ray / bilinear patch intersection.
    """
    HH, WW = h.shape
    # grid coordinates
    gx0 = ox / HCELL_C - 0.5 + pad
    gy0 = oy / HCELL_C - 0.5 + pad
    kx = dx / HCELL_C
    ky = dy / HCELL_C
    # clip to domain box [0, WW-1] x [0, HH-1] x [-inf, hmax]
    t0 = 0.0
    t1 = tmax
    if abs(kx) > 1e-12:
        ta = (0.0 - gx0) / kx
        tb = (WW - 1.0 - gx0) / kx
        if ta > tb:
            ta, tb = tb, ta
        t0 = max(t0, ta)
        t1 = min(t1, tb)
    elif gx0 < 0 or gx0 > WW - 1:
        return -1.0
    if abs(ky) > 1e-12:
        ta = (0.0 - gy0) / ky
        tb = (HH - 1.0 - gy0) / ky
        if ta > tb:
            ta, tb = tb, ta
        t0 = max(t0, ta)
        t1 = min(t1, tb)
    elif gy0 < 0 or gy0 > HH - 1:
        return -1.0
    if dz > 0:
        if oz > hmax:
            return -1.0
        t1 = min(t1, (hmax - oz) / dz)
    elif dz < 0 and oz > hmax:
        t0 = max(t0, (hmax - oz) / dz)
    if t0 >= t1:
        return -1.0
    nlev = mm_off.shape[0]
    top = nlev - 1
    lev = top
    if lev > 6:
        lev = 6
    t = t0 + 1e-6
    eps = 1e-5
    it = 0
    while t < t1 and it < 20000:
        it += 1
        gx = gx0 + kx * t
        gy = gy0 + ky * t
        cs = float(1 << lev)
        cx = int(math.floor(gx / cs))
        cy = int(math.floor(gy / cs))
        # exit of this cell
        if kx > 0:
            tx = ((cx + 1) * cs - gx0) / kx
        elif kx < 0:
            tx = (cx * cs - gx0) / kx
        else:
            tx = 1e30
        if ky > 0:
            ty = ((cy + 1) * cs - gy0) / ky
        elif ky < 0:
            ty = (cy * cs - gy0) / ky
        else:
            ty = 1e30
        te = min(tx, ty, t1)
        if te <= t:
            te = t + eps
        lw = mm_w[lev]
        lh = mm_h[lev]
        if cx < 0 or cy < 0 or cx >= lw or cy >= lh:
            t = te + eps
            continue
        hm = mm[mm_off[lev] + cy * lw + cx]
        zlo = oz + dz * (te if dz < 0 else t)
        if zlo > hm:
            t = te + eps
            if lev < top:
                lev += 1
            continue
        if lev > 0:
            lev -= 1
            continue
        # level 0 cell: exact bilinear patch intersection over [t, te]
        if cx >= WW - 1 or cy >= HH - 1:
            t = te + eps
            continue
        h00 = h[cy, cx]
        h01 = h[cy, cx + 1]
        h10 = h[cy + 1, cx]
        h11 = h[cy + 1, cx + 1]
        a0 = gx - cx
        b0 = gy - cy
        e1 = h01 - h00
        e2 = h10 - h00
        e3 = h00 - h01 - h10 + h11
        B0 = h00 + e1 * a0 + e2 * b0 + e3 * a0 * b0
        B1 = e1 * kx + e2 * ky + e3 * (a0 * ky + b0 * kx)
        B2 = e3 * kx * ky
        z0 = oz + dz * t
        A0 = z0 - B0
        A1 = dz - B1
        A2 = -B2
        smax = te - t
        if A0 <= 0.0:
            return t
        sh = -1.0
        if abs(A2) < 1e-14:
            if A1 < 0:
                s = -A0 / A1
                if s <= smax:
                    sh = s
        else:
            disc = A1 * A1 - 4 * A2 * A0
            if disc >= 0:
                sq = math.sqrt(disc)
                if A1 >= 0:
                    q = -0.5 * (A1 + sq)
                else:
                    q = -0.5 * (A1 - sq)
                r1 = q / A2
                r2 = A0 / q if q != 0 else 1e30
                if r1 > r2:
                    r1, r2 = r2, r1
                if r1 >= 0 and r1 <= smax:
                    sh = r1
                elif r2 >= 0 and r2 <= smax:
                    sh = r2
        if sh >= 0:
            return t + sh
        t = te + eps
        # after leaving a level-0 cell, climb one level
        lev = 1 if top >= 1 else 0
    return -1.0


HCELL_C = HCELL


@njit(cache=True, fastmath=True)
def smoothstep(a, b, x):
    t = (x - a) / (b - a)
    if t < 0:
        t = 0.0
    if t > 1:
        t = 1.0
    return t * t * (3 - 2 * t)


@njit(cache=True, fastmath=True)
def hash3(ix, iy, iz):
    n = (ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)
    n = (n << 13) ^ n
    n = (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff
    return n / 1073741824.0 - 1.0


@njit(cache=True, fastmath=True)
def vnoise3(x, y, z):
    """value noise in [-1, 1], quintic interpolation"""
    ix = math.floor(x)
    iy = math.floor(y)
    iz = math.floor(z)
    fx = x - ix
    fy = y - iy
    fz = z - iz
    ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
    uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
    uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10)
    ix = int(ix)
    iy = int(iy)
    iz = int(iz)
    a = hash3(ix, iy, iz)
    b = hash3(ix + 1, iy, iz)
    c = hash3(ix, iy + 1, iz)
    d = hash3(ix + 1, iy + 1, iz)
    e = hash3(ix, iy, iz + 1)
    f = hash3(ix + 1, iy, iz + 1)
    g = hash3(ix, iy + 1, iz + 1)
    k = hash3(ix + 1, iy + 1, iz + 1)
    l1 = a + (b - a) * ux
    l2 = c + (d - c) * ux
    l3 = e + (f - e) * ux
    l4 = g + (k - g) * ux
    m1 = l1 + (l2 - l1) * uy
    m2 = l3 + (l4 - l3) * uy
    return m1 + (m2 - m1) * uz


@njit(cache=True, fastmath=True)
def vnoise2(x, y):
    return vnoise3(x, y, 0.5)


from numba import prange  # noqa: E402


@njit(parallel=True, cache=True, fastmath=True)
def _shadow_kernel(h, mm, mm_off, mm_w, mm_h, hmax, pad, lx, ly, lz, step):
    HH, WW = h.shape
    oh = (HH + step - 1) // step
    ow = (WW + step - 1) // step
    out = np.ones((oh, ow), np.float32)
    for i in prange(oh):
        for j in range(ow):
            gi = i * step
            gj = j * step
            if gi >= HH or gj >= WW:
                continue
            X = (gj - pad + 0.5) * HCELL_C
            Y = (gi - pad + 0.5) * HCELL_C
            Z = h[gi, gj] + 3.0
            t = trace(h, mm, mm_off, mm_w, mm_h, hmax, pad, X + lx * 2.0, Y + ly * 2.0, Z + lz * 2.0,
                      lx, ly, lz, 60000.0)
            if t > 0:
                out[i, j] = 0.0
    return out
