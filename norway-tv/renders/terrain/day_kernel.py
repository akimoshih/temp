"""
day_kernel.py - midday shading kernel for the Geirangerfjord flyover.

Parameter vector PR (float64):
  0-2  sun dir (unit, world)        3  sun intensity (spec)
  4    haze beta0 (1/m at z=0)      5  haze scale height (m)
  6-8  zenith colour (lin)          9-11 horizon colour (lin)
  12   relief strength              13 ambient for relief ratio
  14   time (s)                     15 pixel angle (rad per sub-pixel)
  16   wave amplitude scale         17 water body gain
  18   cloud coverage               19 cloud altitude (m)
  20   sun glow strength            21 haze sun-tint strength
  22   texture-detail strength      23 steep-face projection strength
  24   exposure (terrain)           25 texture saturation
"""
import math

import numpy as np
from numba import njit, prange

from terrain_core import (trace, tex_sample, grid_bilerp, grid_bilerp3, smoothstep,
                          vnoise3, HCELL, TCELL)

HC = HCELL


# ------------------------------------------------------------------ sky
@njit(cache=True, fastmath=True)
def sky_col(PR, dx, dy, dz, out):
    lx, ly, lz = PR[0], PR[1], PR[2]
    e = dz
    if e < -0.02:
        e = -0.02
    a = 1.0 - math.exp(-max(e, 0.0) * 3.2)
    a = a ** 0.8
    for c in range(3):
        out[c] = PR[9 + c] * (1 - a) + PR[6 + c] * a
    hb = math.exp(-max(e, 0.0) * 25.0) * 0.08
    hl = math.sqrt(lx * lx + ly * ly) + 1e-9
    hd = math.sqrt(dx * dx + dy * dy) + 1e-9
    caz = (dx * lx + dy * ly) / (hl * hd)
    cang = dx * lx + dy * ly + dz * lz
    g = PR[20]
    glow_h = g * (max(caz, 0.0) ** 3) * math.exp(-max(e, 0.0) * 6.0)
    mie = g * 0.6 * (max(cang, 0.0) ** 12) + 3.0 * math.exp((cang - 1.0) * 900.0)
    out[0] += hb + (glow_h + mie) * 1.00
    out[1] += hb + (glow_h + mie) * 0.93
    out[2] += hb * 0.9 + (glow_h + mie) * 0.80


@njit(cache=True, fastmath=True)
def clouds(PR, ox, oy, oz, dx, dy, dz, col):
    """soft fair-weather cloud layer on a plane (sky rays only)"""
    cov = PR[18]
    if cov <= 0 or dz < 0.01:
        return
    zc = PR[19]
    t = (zc - oz) / dz
    X = (ox + dx * t) / 3000.0
    Y = (oy + dy * t) / 3000.0
    tm = PR[14] * 0.004
    n = 0.0
    amp = 0.5
    f = 1.0
    fr = t * PR[15] / 3000.0
    for o in range(6):
        wl = 1.0 / f
        fade = 1.0 - smoothstep(0.3 * wl, 1.0 * wl, fr)
        if fade <= 0:
            break
        n += amp * fade * vnoise3(X * f + tm, Y * f * 1.6, 1.3 + o * 7.1)
        f *= 2.03
        amp *= 0.5
    d = smoothstep(0.58 - cov, 0.98 - cov, n * 0.5 + 0.5)
    fade = smoothstep(0.01, 0.10, dz)
    d *= fade * 0.9
    lit = 1.0 + 0.3 * n
    for c in range(3):
        cc = lit * (0.97 if c == 0 else (0.98 if c == 1 else 1.0))
        col[c] = col[c] * (1 - d) + cc * 0.95 * d


@njit(cache=True, fastmath=True)
def haze_apply(PR, oz, dx, dy, dz, dist, col):
    b0 = PR[4]
    Hs = PR[5]
    z1 = oz + dz * dist
    if abs(dz) > 1e-4:
        tau = b0 * Hs * (math.exp(-oz / Hs) - math.exp(-z1 / Hs)) / dz
    else:
        tau = b0 * dist * math.exp(-oz / Hs)
    if tau < 0:
        tau = 0.0
    T = math.exp(-tau)
    lx, ly = PR[0], PR[1]
    hl = math.sqrt(lx * lx + ly * ly) + 1e-9
    hd = math.sqrt(dx * dx + dy * dy) + 1e-9
    caz = (dx * lx + dy * ly) / (hl * hd)
    s = PR[21] * (max(caz, 0.0) ** 2)
    for c in range(3):
        hz = PR[9 + c] * 0.95 + s * (1.0 if c == 0 else (0.92 if c == 1 else 0.78))
        col[c] = col[c] * T + hz * (1 - T)


# ------------------------------------------------------------------ terrain
@njit(cache=True, fastmath=True)
def xy_footprint(dx, dy, dz, nx, ny, nz, foot):
    """ray-differential pixel footprint projected onto the texture (XY) plane"""
    rx, ry, rz = -dy, dx, 0.0
    rl = math.sqrt(rx * rx + ry * ry)
    if rl < 1e-6:
        rx, ry, rz = 1.0, 0.0, 0.0
    else:
        rx /= rl
        ry /= rl
    ux = ry * dz - rz * dy
    uy = rz * dx - rx * dz
    uz = rx * dy - ry * dx
    dn = dx * nx + dy * ny + dz * nz
    if dn > -0.06:
        dn = -0.06
    en = rx * nx + ry * ny + rz * nz
    ax = foot * (rx - dx * en / dn)
    ay = foot * (ry - dy * en / dn)
    en = ux * nx + uy * ny + uz * nz
    bx = foot * (ux - dx * en / dn)
    by = foot * (uy - dy * en / dn)
    L1 = math.sqrt(ax * ax + ay * ay)
    L2 = math.sqrt(bx * bx + by * by)
    if L1 < L2:
        L1, L2 = L2, L1
    return (L1 ** 0.7) * (max(L2, 1e-3) ** 0.3)


@njit(cache=True, fastmath=True)
def detail_lum(tex, tx_off, tx_w, tx_h, X, Y, fp, scale, ox, oy, tmp, tmp2):
    """self-similar detail: high-pass of the texture's own luminance, sampled at 1/scale size"""
    u = X * scale + ox
    v = Y * scale + oy
    f = fp * scale
    tex_sample(tex, tx_off, tx_w, tx_h, u, v, f, tmp, tmp2)
    l0 = 0.2126 * tmp[0] + 0.7152 * tmp[1] + 0.0722 * tmp[2]
    tex_sample(tex, tx_off, tx_w, tx_h, u, v, max(f, TCELL) * 4.0, tmp, tmp2)
    l1 = 0.2126 * tmp[0] + 0.7152 * tmp[1] + 0.0722 * tmp[2]
    return (l0 - l1) / (l1 + 0.03)


@njit(cache=True, fastmath=True)
def tri_fbm(X, Y, Z, nx, ny, sa, sz, oct, fpr, seed):
    """fixed-axis triplanar fbm on vertical faces: (X,Z) plane weighted by |ny|, (Y,Z) by |nx|.
    sa / sz = horizontal / vertical frequency (1/m); fpr = footprint (m)"""
    wx = abs(nx)
    wy = abs(ny)
    ws = wx + wy + 1e-6
    wx /= ws
    wy /= ws
    v = 0.0
    if wy > 0.02:
        v += wy * fbm_aniso(X * sa, Z * sz, seed, oct, fpr * max(sa, sz))
    if wx > 0.02:
        v += wx * fbm_aniso(Y * sa, Z * sz, seed + 11.0, oct, fpr * max(sa, sz))
    return v


@njit(cache=True, fastmath=True)
def fbm_aniso(u, v, seed, oct, fr):
    s = 0.0
    a = 1.0
    f = 1.0
    for o in range(oct):
        wl = 1.0 / f
        fade = 1.0 - smoothstep(0.3 * wl, 1.0 * wl, fr)
        if fade <= 0.0:
            break
        s += a * fade * vnoise3(u * f, v * f, seed + o * 5.3)
        f *= 2.07
        a *= 0.52
    return s


@njit(cache=True, fastmath=True)
def terrain_col(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, tex, tx_off, tx_w, tx_h, pad,
                PR, X, Y, Z, dx, dy, dz, foot, out, S):
    tmp = S[0:3]
    tmp2 = S[3:6]
    reg = S[6:9]
    gx = X / HC - 0.5 + pad
    gy = Y / HC - 0.5 + pad
    grid_bilerp3(D_nrm, gx, gy, tmp2)
    nx, ny, nz = tmp2[0], tmp2[1], tmp2[2]
    nl = math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-9
    nx /= nl
    ny /= nl
    nz /= nl
    cosi = abs(dx * nx + dy * ny + dz * nz)
    footw = foot / max(cosi, 0.12)          # footprint on the surface itself
    fp = xy_footprint(dx, dy, dz, nx, ny, nz, foot)
    tex_sample(tex, tx_off, tx_w, tx_h, X, Y, fp, out, tmp)
    lx, ly, lz = PR[0], PR[1], PR[2]
    ndl = max(nx * lx + ny * ly + nz * lz, 0.0)
    grid_bilerp3(D_nb, gx, gy, tmp2)
    bnz = tmp2[2]
    ndlb = max(tmp2[0] * lx + tmp2[1] * ly + tmp2[2] * lz, 0.0)
    shd = grid_bilerp(D_shd, gx, gy)
    cav = grid_bilerp(D_cav, gx, gy)
    ao = 1.0 + cav * 0.004
    if ao < 0.7:
        ao = 0.7
    if ao > 1.08:
        ao = 1.08
    # ---- (1) satellite texture with sub-texel relief (sun already baked in)
    amb = PR[13]
    rel = (amb + ndl) / (amb + ndlb)
    if rel < 0.45:
        rel = 0.45
    if rel > 1.5:
        rel = 1.5
    g = (1.0 + PR[12] * (rel - 1.0)) * ao
    # ---- (2) steep faces: the nadir texture has no information there (smeared along the fall
    # line), so switch to a lit rock material: regional tint from a coarse mip + triplanar
    # fall-line streaks / ledges, lit with the same sun + the precomputed cast shadows.
    st = smoothstep(0.64, 0.36, min(nz, bnz + 0.05)) * PR[23]
    if st > 0.0:
        tex_sample(tex, tx_off, tx_w, tx_h, X, Y, max(fp, 45.0), reg, tmp)
        rl = 0.2126 * reg[0] + 0.7152 * reg[1] + 0.0722 * reg[2]
        # vertical stains / gullies + fine grain (triplanar, footprint-filtered)
        streak = tri_fbm(X, Y, Z, nx, ny, 0.03, 0.004, 5, footw, 3.0)
        grain = tri_fbm(X, Y, Z, nx, ny, 0.2, 0.12, 3, footw, 29.0)
        lt = 0.165 * (1.0 + 0.30 * streak + 0.10 * grain)
        if lt < 0.04:
            lt = 0.04
        sun = 1.05 * ndl * (0.12 + 0.88 * shd)
        sky = 0.32 * (0.55 + 0.45 * nz) * ao
        for c in range(3):
            tint = reg[c] / (rl + 1e-3)
            if tint > 1.5:
                tint = 1.5
            alb = lt * (0.55 + 0.45 * tint)
            skyc = PR[9 + c] / (PR[10] + 1e-3)
            v = alb * (sun + sky * skyc)
            out[c] = out[c] * g * (1 - st) + v * st
        g = 1.0
    # ---- (3) self-similar detail synthesis on the texture part (fades near texel size)
    ds = PR[22]
    if ds > 0 and footw < 6.0 and st < 0.98:
        w1 = (1.0 - smoothstep(2.0, 6.0, footw)) * (1.0 - st)
        d1 = detail_lum(tex, tx_off, tx_w, tx_h, X, Y, footw, 4.0, 1731.0, 977.0, tmp, tmp2)
        d = d1 * w1
        if footw < 1.5:
            w2 = (1.0 - smoothstep(0.5, 1.5, footw)) * (1.0 - st)
            d2 = detail_lum(tex, tx_off, tx_w, tx_h, X, Y, footw, 16.0, 5311.0, 2711.0, tmp, tmp2)
            d += d2 * w2 * 0.7
        m = 1.0 + ds * d
        if m < 0.4:
            m = 0.4
        if m > 1.8:
            m = 1.8
        g *= m
    sat = PR[25]
    lum = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]
    ex = PR[24]
    for c in range(3):
        v = lum + (out[c] - lum) * sat
        if v < 0:
            v = 0.0
        out[c] = v * g * ex


# ------------------------------------------------------------------ water
@njit(cache=True, fastmath=True)
def water_normal(PR, X, Y, foot, n):
    """sum of directional waves with analytic slope; components below the footprint fade out"""
    t = PR[14]
    A = PR[16]
    sx = 0.0
    sy = 0.0
    for k in range(10):
        lam = 1.2 * (1.55 ** k)          # 1.2 .. ~62 m
        ang = 0.9 + k * 2.39996
        kx = math.cos(ang)
        ky = math.sin(ang)
        w = 2 * math.pi / lam
        om = math.sqrt(9.81 * w)
        ph = w * (kx * X + ky * Y) - om * t + k * 1.7
        s = A * 0.05 * (lam / 20.0) ** 0.1
        fade = 1.0 - smoothstep(0.25 * lam, 0.9 * lam, foot)
        c = math.cos(ph) * s * fade
        sx += c * kx
        sy += c * ky
    m = 0.35 + 0.65 * smoothstep(-0.4, 0.6, vnoise3(X * 0.0035, Y * 0.0035, t * 0.05))
    sx *= m
    sy *= m
    nl = math.sqrt(sx * sx + sy * sy + 1.0)
    n[0] = -sx / nl
    n[1] = -sy / nl
    n[2] = 1.0 / nl


# ------------------------------------------------------------------ integrator
@njit(cache=True, fastmath=True)
def shade_refl(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, mm, mm_off, mm_w, mm_h, hmax, pad,
               tex, tx_off, tx_w, tx_h, PR, ox, oy, oz, dx, dy, dz, out, dist0, S):
    """reflected ray: terrain / sky only"""
    t = trace(D_h, mm, mm_off, mm_w, mm_h, hmax, pad, ox, oy, oz, dx, dy, dz, 120000.0)
    if t < 0:
        sky_col(PR, dx, dy, dz, out)
        clouds(PR, ox, oy, oz, dx, dy, dz, out)
        return
    X = ox + dx * t
    Y = oy + dy * t
    Z = oz + dz * t
    foot = (dist0 + t) * PR[15] * 2.0
    terrain_col(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, tex, tx_off, tx_w, tx_h, pad,
                PR, X, Y, Z, dx, dy, dz, foot, out, S)
    haze_apply(PR, oz, dx, dy, dz, t, out)


@njit(cache=True, fastmath=True)
def shade_ray(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, mm, mm_off, mm_w, mm_h, hmax, pad,
              tex, tx_off, tx_w, tx_h, PR, ox, oy, oz, dx, dy, dz, out, S):
    wc = S[16:19]
    n = S[19:22]
    rc = S[22:25]
    tmp = S[25:28]
    t = trace(D_h, mm, mm_off, mm_w, mm_h, hmax, pad, ox, oy, oz, dx, dy, dz, 120000.0)
    pa = PR[15]
    outside = False
    if t < 0:
        if dz < -1e-5:
            t = -oz / dz
            outside = True
        else:
            sky_col(PR, dx, dy, dz, out)
            clouds(PR, ox, oy, oz, dx, dy, dz, out)
            return -1.0
    X = ox + dx * t
    Y = oy + dy * t
    Z = oz + dz * t
    foot = t * pa
    gx = X / HC - 0.5 + pad
    gy = Y / HC - 0.5 + pad
    if outside:
        wsea = 1.0
    else:
        wsea = max(grid_bilerp(D_sea, gx, gy), grid_bilerp(D_lake, gx, gy))
    wm = smoothstep(0.35, 0.65, wsea)
    if wm < 1.0:
        terrain_col(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, tex, tx_off, tx_w, tx_h, pad,
                    PR, X, Y, Z, dx, dy, dz, foot, out, S)
    else:
        out[0] = 0.0
        out[1] = 0.0
        out[2] = 0.0
    if wm > 0.0:
        water_normal(PR, X, Y, foot / max(abs(dz), 0.05) ** 0.5, n)
        fpw = foot / math.sqrt(max(abs(dz), 0.03))
        bg = PR[17]
        vv = 1.0 + 0.12 * vnoise3(X * 0.002, Y * 0.002, 0.7)
        for c in range(3):
            wc[c] = PR[26 + c] * bg * vv
        cosv = -(dx * n[0] + dy * n[1] + dz * n[2])
        if cosv < 0.0:
            cosv = 0.0
        F = 0.02 + 0.98 * (1.0 - cosv) ** 5
        rx = dx + 2 * cosv * n[0]
        ry = dy + 2 * cosv * n[1]
        rz = dz + 2 * cosv * n[2]
        if rz < 0.005:
            rz = 0.005
        rl = math.sqrt(rx * rx + ry * ry + rz * rz)
        rx /= rl
        ry /= rl
        rz /= rl
        shade_refl(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, mm, mm_off, mm_w, mm_h, hmax, pad,
                   tex, tx_off, tx_w, tx_h, PR, X, Y, Z + 0.5, rx, ry, rz, rc, t, S)
        lx, ly, lz = PR[0], PR[1], PR[2]
        hx = lx - dx
        hy = ly - dy
        hz = lz - dz
        hl = math.sqrt(hx * hx + hy * hy + hz * hz)
        ndh = max((n[0] * hx + n[1] * hy + n[2] * hz) / hl, 0.0)
        sp = PR[3] * (ndh ** 1500) * 60.0 * F
        if not outside:
            sp *= grid_bilerp(D_shd, gx, gy)
        for c in range(3):
            wc[c] = wc[c] * (1 - F) + rc[c] * F + sp
        for c in range(3):
            out[c] = out[c] * (1 - wm) + wc[c] * wm
    haze_apply(PR, oz, dx, dy, dz, t, out)
    return t


@njit(parallel=True, cache=True, fastmath=True)
def render_day(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, mm, mm_off, mm_w, mm_h, hmax, pad,
               tex, tx_off, tx_w, tx_h, PR, cams, offs, W, H):
    """cams: (nspp, 13) = pos(3) fwd(3) right(3) up(3) tan_half_h ; offs: (nspp, 2) sub-pixel"""
    img = np.zeros((H, W, 3), np.float32)
    ns = cams.shape[0]
    asp = H / W
    for py in prange(H):
        col = np.empty(3)
        S = np.empty(32)
        for px in range(W):
            r = 0.0
            g = 0.0
            b = 0.0
            for s in range(ns):
                sx = ((px + offs[s, 0]) / W) * 2.0 - 1.0
                sy = 1.0 - ((py + offs[s, 1]) / H) * 2.0
                th = cams[s, 12]
                dx = cams[s, 3] + sx * th * cams[s, 6] + sy * th * asp * cams[s, 9]
                dy = cams[s, 4] + sx * th * cams[s, 7] + sy * th * asp * cams[s, 10]
                dz = cams[s, 5] + sx * th * cams[s, 8] + sy * th * asp * cams[s, 11]
                dl = math.sqrt(dx * dx + dy * dy + dz * dz)
                dx /= dl
                dy /= dl
                dz /= dl
                shade_ray(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_zref, D_shd, mm, mm_off, mm_w, mm_h, hmax,
                          pad, tex, tx_off, tx_w, tx_h, PR, cams[s, 0], cams[s, 1], cams[s, 2],
                          dx, dy, dz, col, S)
                r += col[0]
                g += col[1]
                b += col[2]
            img[py, px, 0] = r / ns
            img[py, px, 1] = g / ns
            img[py, px, 2] = b / ns
    return img
