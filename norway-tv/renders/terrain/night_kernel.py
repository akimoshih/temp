"""
night_kernel.py - moonlit Lofoten + aurora.

Aurora model (analytic, no volume marching): each curtain is a thin vertical sheet hanging
above a horizontal curve n = c_k(e) (e/n = km east/north of the camera in the view frame).
For a view direction, the ray's ground track is intersected with every curve (coarse bracketing +
secant refinement); at each crossing the emission is evaluated from the altitude of the ray there
(sharp green lower border, violet/magenta upper part, pink lower fringe), modulated by vertical
rays R(e, t) and weighted by the path length through the sheet (bright folds seen edge-on).
The result is baked per frame into a direction map (azimuth x elevation) that the pixel kernel
samples for the sky and for the mirrored sky in the sea.

PR (float64):
  0-2 moon dir   3 moon gain   4-6 moon tint   7 relief   8 time   9 pixel angle
  10 wave amp    11 night haze beta   12 haze scale height   13-15 haze colour
  16-18 water body   19-21 aurora ambient (rgb, on snow)   22 exposure
  23 map az0 (rad) 24 map az step 25 map el0 26 map el step 27 map naz 28 map nel
  29-31 sky horizon colour 32-34 sky zenith colour
"""
import math

import numpy as np
from numba import njit, prange

from terrain_core import (trace, tex_sample, grid_bilerp, grid_bilerp3, smoothstep, vnoise3,
                          HCELL)

HC = HCELL
R_EARTH = 6371.0


# ------------------------------------------------------------------ aurora
@njit(cache=True, fastmath=True)
def n1(x, s):
    return vnoise3(x, s, 0.37)


@njit(cache=True, fastmath=True)
def curve(k, e, t, CP):
    """curtain k centre line: north distance (km) as a function of east coordinate e (km)"""
    D = CP[k, 0]
    A1 = CP[k, 1]
    L1 = CP[k, 2]
    A2 = CP[k, 3]
    L2 = CP[k, 4]
    w1 = CP[k, 5]
    ph = CP[k, 6]
    c = D + A1 * math.sin(e / L1 + ph + w1 * t) + A2 * math.sin(e / L2 - 0.7 * ph + 1.9 * w1 * t)
    c += CP[k, 7] * n1(e / 55.0 + 0.05 * t, 3.1 + k)
    # gentle overall tilt of the arc
    c += CP[k, 8] * e
    return c


@njit(cache=True, fastmath=True)
def rays(k, e, t, CP):
    """vertical ray structure along the curtain (0..1)"""
    dr = CP[k, 9]
    a = 0.5 + 0.5 * n1(e / 2.2 + dr * t, 11.0 + k)
    b = 0.5 + 0.5 * n1(e / 0.8 - 1.7 * dr * t, 21.0 + k)
    c = 0.5 + 0.5 * n1(e / 9.0 + 0.3 * dr * t, 31.0 + k)
    r = 0.12 + 0.88 * (a ** 2.6) * (0.5 + 0.5 * b) * (0.35 + 1.0 * c)
    # patchy brightness along the arc
    p = 0.5 + 0.5 * n1(e / 35.0 + 0.1 * dr * t, 41.0 + k)
    return r * (0.06 + 1.5 * p * p * p)


@njit(cache=True, fastmath=True)
def emission(k, e, z, t, CP, out):
    """emission colour (linear rgb) for curtain k at east coordinate e and altitude z (km)"""
    zb = CP[k, 10] + 7.0 * n1(e / 40.0 + 0.02 * t, 51.0 + k) + 4.0 * n1(e / 11.0 - 0.05 * t, 61.0 + k)
    h = z - zb
    if h < -12.0:
        return
    I = CP[k, 11]
    r0 = rays(k, e, t, CP)
    # continuous bright lower band, streaky rays higher up
    p = 0.5 + 0.5 * n1(e / 35.0 + 0.1 * CP[k, 9] * t, 41.0 + k)
    patch = 0.06 + 1.5 * p * p * p
    hr = smoothstep(2.0, 30.0, h)
    r = (0.55 * patch + 0.45 * r0) * (1 - hr) + r0 * hr
    # green (557.7 nm): sharp lower border, bright base band, fading rays above
    g = smoothstep(-2.5, 1.0, h) * (math.exp(-max(h, 0.0) / CP[k, 12]) + 1.1 * math.exp(-max(h, 0.0) / 6.0))
    # violet / magenta upper part (630 nm red + blue N2+ at the top)
    v = smoothstep(35.0, 95.0, h) * math.exp(-max(h - 95.0, 0.0) / 45.0)
    # pink / magenta lower fringe (active curtains)
    pk = math.exp(-((h + 1.0) / 2.5) ** 2) * CP[k, 13] * 0.35
    # colours
    vv = v * 0.34 * CP[k, 14]
    out[0] += I * r * (g * 0.040 + vv * 0.55 + pk * 0.9)
    out[1] += I * r * (g * 0.95 + vv * 0.05 + pk * 0.10)
    out[2] += I * r * (g * 0.44 + vv * 1.00 + pk * 0.45)


@njit(parallel=True, cache=True, fastmath=True)
def aurora_map(CP, t, fwd_az, az0, daz, naz, el0, delv, nel, gain):
    """direction map (nel, naz, 3): az measured cw from north (rad), el (rad)"""
    out = np.zeros((nel, naz, 3), np.float32)
    ncurt = CP.shape[0]
    for i in prange(nel):
        tmp = np.zeros(3)
        el = el0 + i * delv
        if el < -0.001:
            continue
        ce = math.cos(el)
        se = math.sin(el)
        for j in range(naz):
            az = az0 + j * daz
            rel = az - fwd_az
            sa = math.sin(rel)
            ca = math.cos(rel)
            tmp[0] = 0.0
            tmp[1] = 0.0
            tmp[2] = 0.0
            if ca <= 0.05:
                continue
            for k in range(ncurt):
                # ground-track parameter s_h (horizontal km); f(s) = n(s) - c(e(s))
                Dk = CP[k, 0]
                span = CP[k, 1] + CP[k, 3] + CP[k, 7] + 5.0
                smin = max((Dk - span - 60.0) / ca, 5.0)
                smax = (Dk + span + 60.0) / ca
                nst = 40
                ds = (smax - smin) / nst
                sp = smin
                fp = sp * ca - curve(k, sp * sa, t, CP)
                wk = CP[k, 15]
                for q in range(1, nst + 1):
                    sc = smin + q * ds
                    fc = sc * ca - curve(k, sc * sa, t, CP)
                    # sheet with a gaussian cross-section of half-width wk (km): integrate its
                    # profile along the segment with f linearised -> smooth folds, no hard edges
                    if not ((fp > 3 * wk and fc > 3 * wk) or (fp < -3 * wk and fc < -3 * wk)):
                        m = (fc - fp) / ds
                        if abs(m) > 1e-4:
                            Wt = 0.8862269 * wk * abs(math.erf(fc / wk) - math.erf(fp / wk)) / abs(m)
                            sr = sp - fp / m
                            if sr < sp:
                                sr = sp
                            if sr > sc:
                                sr = sc
                        else:
                            Wt = ds * math.exp(-(fp / wk) ** 2)
                            sr = 0.5 * (sp + sc)
                        if Wt > 1e-5:
                            slant = sr / max(ce, 1e-4)
                            z = math.sqrt(R_EARTH * R_EARTH + slant * slant + 2 * R_EARTH * slant * se) - R_EARTH
                            if z > 70.0 and z < 420.0:
                                e = sr * sa
                                b0 = tmp[0]
                                b1 = tmp[1]
                                b2 = tmp[2]
                                emission(k, e, z, t, CP, tmp)
                                air = math.exp(-0.06 / max(se + 0.02, 0.02))
                                wgt = min(Wt, 60.0) * air / (2.0 * wk)
                                tmp[0] = b0 + (tmp[0] - b0) * wgt
                                tmp[1] = b1 + (tmp[1] - b1) * wgt
                                tmp[2] = b2 + (tmp[2] - b2) * wgt
                    sp = sc
                    fp = fc
            # diffuse glow under / around the arcs
            gl = 0.004 * math.exp(-((el - 0.30) / 0.22) ** 2) * (0.6 + 0.4 * n1(az * 6.0 + 0.02 * t, 77.0))
            out[i, j, 0] = gain * (tmp[0] + gl * 0.08)
            out[i, j, 1] = gain * (tmp[1] + gl * 0.9)
            out[i, j, 2] = gain * (tmp[2] + gl * 0.5)
    return out


# ------------------------------------------------------------------ sky / map lookup
@njit(cache=True, fastmath=True)
def map_lookup(AM, PR, dx, dy, dz, out):
    """bilinear lookup of the aurora map for world direction d (X east, Y south, Z up)"""
    az = math.atan2(dx, -dy)
    el = math.asin(max(-1.0, min(1.0, dz)))
    a0 = PR[23]
    # wrap az near a0
    while az < a0 - math.pi:
        az += 2 * math.pi
    while az > a0 + math.pi:
        az -= 2 * math.pi
    fx = (az - a0) / PR[24]
    fy = (el - PR[25]) / PR[26]
    naz = int(PR[27])
    nel = int(PR[28])
    if fx < 0 or fy < 0 or fx > naz - 1.001 or fy > nel - 1.001:
        out[0] = 0.0
        out[1] = 0.0
        out[2] = 0.0
        return
    x0 = int(fx)
    y0 = int(fy)
    ax = fx - x0
    ay = fy - y0
    for c in range(3):
        out[c] = (AM[y0, x0, c] * (1 - ax) * (1 - ay) + AM[y0, x0 + 1, c] * ax * (1 - ay)
                  + AM[y0 + 1, x0, c] * (1 - ax) * ay + AM[y0 + 1, x0 + 1, c] * ax * ay)


@njit(cache=True, fastmath=True)
def sky_night(AM, PR, dx, dy, dz, out, tmp):
    e = max(dz, 0.0)
    a = 1.0 - math.exp(-e * 2.5)
    for c in range(3):
        out[c] = PR[29 + c] * (1 - a) + PR[32 + c] * a
    # faint horizon glow (airglow / scattered aurora light)
    hb = math.exp(-e * 14.0)
    out[0] += hb * 0.004
    out[1] += hb * 0.010
    out[2] += hb * 0.010
    map_lookup(AM, PR, dx, dy, abs(dz), tmp)
    for c in range(3):
        out[c] += tmp[c]


# ------------------------------------------------------------------ terrain
@njit(cache=True, fastmath=True)
def terrain_night(D_nrm, D_nb, D_cav, D_shd, tex, tx_off, tx_w, tx_h, pad, PR, X, Y, Z,
                  dx, dy, dz, foot, out, S):
    tmp = S[0:3]
    tmp2 = S[3:6]
    gx = X / HC - 0.5 + pad
    gy = Y / HC - 0.5 + pad
    grid_bilerp3(D_nrm, gx, gy, tmp2)
    nx, ny, nz = tmp2[0], tmp2[1], tmp2[2]
    nl = math.sqrt(nx * nx + ny * ny + nz * nz) + 1e-9
    nx /= nl
    ny /= nl
    nz /= nl
    cosi = abs(dx * nx + dy * ny + dz * nz)
    fp = foot / math.sqrt(max(cosi, 0.1)) * (1.0 + 0.6 * (1.0 - nz))
    tex_sample(tex, tx_off, tx_w, tx_h, X, Y, fp, out, tmp)
    lx, ly, lz = PR[0], PR[1], PR[2]
    ndl = max(nx * lx + ny * ly + nz * lz, 0.0)
    grid_bilerp3(D_nb, gx, gy, tmp2)
    ndlb = max(tmp2[0] * lx + tmp2[1] * ly + tmp2[2] * lz, 0.0)
    rel = (0.35 + ndl) / (0.35 + ndlb)
    if rel < 0.45:
        rel = 0.45
    if rel > 1.6:
        rel = 1.6
    g = 1.0 + PR[7] * (rel - 1.0)
    cav = grid_bilerp(D_cav, gx, gy)
    ao = 1.0 + cav * 0.004
    if ao < 0.7:
        ao = 0.7
    if ao > 1.1:
        ao = 1.1
    lum = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2]
    # moonlight: desaturated (scotopic-ish), cool tint; plus aurora bounce light from above
    sky_up = 0.55 + 0.45 * nz
    lc = lum ** 1.25 / (0.55 ** 0.25)
    shd = grid_bilerp(D_shd, gx, gy)
    g *= 0.45 + 0.55 * shd
    for c in range(3):
        base = lc * 0.6 + out[c] * 0.4 * (lc / (lum + 1e-4))
        v = base * PR[3] * PR[4 + c] * g * ao + lc * PR[19 + c] * sky_up * ao
        out[c] = v


@njit(cache=True, fastmath=True)
def haze_night(PR, oz, dz, dist, col):
    b0 = PR[11]
    Hs = PR[12]
    z1 = oz + dz * dist
    if abs(dz) > 1e-4:
        tau = b0 * Hs * (math.exp(-oz / Hs) - math.exp(-z1 / Hs)) / dz
    else:
        tau = b0 * dist * math.exp(-oz / Hs)
    T = math.exp(-max(tau, 0.0))
    for c in range(3):
        col[c] = col[c] * T + PR[13 + c] * (1 - T)


@njit(cache=True, fastmath=True)
def water_normal_n(PR, X, Y, foot, n):
    t = PR[8]
    A = PR[10]
    sx = 0.0
    sy = 0.0
    for k in range(8):
        lam = 3.0 * (1.6 ** k)
        ang = 0.4 + k * 2.39996
        kx = math.cos(ang)
        ky = math.sin(ang)
        w = 2 * math.pi / lam
        om = math.sqrt(9.81 * w)
        ph = w * (kx * X + ky * Y) - om * t + k * 1.3
        s = A * 0.03
        fade = 1.0 - smoothstep(0.25 * lam, 0.9 * lam, foot)
        c = math.cos(ph) * s * fade
        sx += c * kx
        sy += c * ky
    nl = math.sqrt(sx * sx + sy * sy + 1.0)
    n[0] = -sx / nl
    n[1] = -sy / nl
    n[2] = 1.0 / nl


@njit(cache=True, fastmath=True)
def shade_night(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_shd, mm, mm_off, mm_w, mm_h, hmax, pad,
                tex, tx_off, tx_w, tx_h, PR, AM, ox, oy, oz, dx, dy, dz, out, S, flags):
    """flags[0] = sky fraction (direct), flags[1] = reflected-sky weight (for star reflections)"""
    wc = S[16:19]
    n = S[19:22]
    rc = S[22:25]
    tmp = S[25:28]
    flags[0] = 0.0
    flags[1] = 0.0
    t = trace(D_h, mm, mm_off, mm_w, mm_h, hmax, pad, ox, oy, oz, dx, dy, dz, 150000.0)
    outside = False
    if t < 0:
        if dz < -1e-5:
            t = -oz / dz
            outside = True
        else:
            sky_night(AM, PR, dx, dy, dz, out, tmp)
            flags[0] = 1.0
            return
    X = ox + dx * t
    Y = oy + dy * t
    Z = oz + dz * t
    foot = t * PR[9]
    gx = X / HC - 0.5 + pad
    gy = Y / HC - 0.5 + pad
    if outside:
        wsea = 1.0
    else:
        wsea = max(grid_bilerp(D_sea, gx, gy), grid_bilerp(D_lake, gx, gy) * 0.0)
    wm = smoothstep(0.35, 0.65, wsea)
    if wm < 1.0:
        terrain_night(D_nrm, D_nb, D_cav, D_shd, tex, tx_off, tx_w, tx_h, pad, PR, X, Y, Z,
                      dx, dy, dz, foot, out, S)
    else:
        out[0] = 0.0
        out[1] = 0.0
        out[2] = 0.0
    if wm > 0.0:
        water_normal_n(PR, X, Y, foot / max(abs(dz), 0.03) ** 0.5, n)
        for c in range(3):
            wc[c] = PR[16 + c]
        cosv = -(dx * n[0] + dy * n[1] + dz * n[2])
        if cosv < 0.0:
            cosv = 0.0
        F = 0.02 + 0.98 * (1.0 - cosv) ** 5
        rx = dx + 2 * cosv * n[0]
        ry = dy + 2 * cosv * n[1]
        rz = dz + 2 * cosv * n[2]
        if rz < 0.003:
            rz = 0.003
        rl = math.sqrt(rx * rx + ry * ry + rz * rz)
        rx /= rl
        ry /= rl
        rz /= rl
        t2 = trace(D_h, mm, mm_off, mm_w, mm_h, hmax, pad, X, Y, Z + 0.3, rx, ry, rz, 150000.0)
        if t2 > 0:
            X2 = X + rx * t2
            Y2 = Y + ry * t2
            Z2 = Z + 0.3 + rz * t2
            terrain_night(D_nrm, D_nb, D_cav, D_shd, tex, tx_off, tx_w, tx_h, pad, PR, X2, Y2, Z2,
                          rx, ry, rz, (t + t2) * PR[9] * 2.0, rc, S)
            haze_night(PR, Z, rz, t2, rc)
        else:
            sky_night(AM, PR, rx, ry, rz, rc, tmp)
            flags[1] = F * wm
        for c in range(3):
            wc[c] = wc[c] * (1 - F) + rc[c] * F
        for c in range(3):
            out[c] = out[c] * (1 - wm) + wc[c] * wm
    haze_night(PR, oz, dz, t, out)


@njit(parallel=True, cache=True, fastmath=True)
def render_night(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_shd, mm, mm_off, mm_w, mm_h, hmax, pad,
                 tex, tx_off, tx_w, tx_h, PR, AM, cams, offs, W, H):
    img = np.zeros((H, W, 3), np.float32)
    aux = np.zeros((H, W, 2), np.float32)
    ns = cams.shape[0]
    asp = H / W
    for py in prange(H):
        col = np.empty(3)
        S = np.empty(32)
        fl = np.empty(2)
        for px in range(W):
            r = 0.0
            g = 0.0
            b = 0.0
            f0 = 0.0
            f1 = 0.0
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
                shade_night(D_h, D_sea, D_lake, D_nrm, D_nb, D_cav, D_shd, mm, mm_off, mm_w, mm_h, hmax,
                            pad, tex, tx_off, tx_w, tx_h, PR, AM, cams[s, 0], cams[s, 1], cams[s, 2],
                            dx, dy, dz, col, S, fl)
                r += col[0]
                g += col[1]
                b += col[2]
                f0 += fl[0]
                f1 += fl[1]
            img[py, px, 0] = r / ns
            img[py, px, 1] = g / ns
            img[py, px, 2] = b / ns
            aux[py, px, 0] = f0 / ns
            aux[py, px, 1] = f1 / ns
    return img, aux
