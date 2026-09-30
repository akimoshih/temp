#!/usr/bin/env python3
"""
Lofoten winter-night aurora plate: 48 frames @30 fps, 1920x1080.

usage: python3 render_aurora.py [--frames 0-47] [--scale 1.0] [--spp 6] [--out DIR]
"""
import argparse
import math
import os
import sys
import time

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain_core as tc  # noqa: E402
from night_kernel import render_night, aurora_map  # noqa: E402
from render_geiranger import cam_basis, sample_pattern, TORDER  # noqa: E402
from post import soft_shoulder, lin_to_srgb, vignette  # noqa: E402

OUT = '/home/user/temp/norway-tv/renders/terrain/aurora'
NF = 48
FPS = 30.0
EXAG = 1.2
PAD = 600
HFOV = 78.0

# moon behind the camera, close to the texture's baked sun azimuth (176 deg) so shadows agree
MOON_AZ, MOON_EL = 168.0, 22.0

# ---------------- camera: on the water south-east of Reine, looking NNW over the peaks --------
C0 = np.array([972.0, 888.0, 48.0])     # DEM px col,row + altitude m
C1 = np.array([980.0, 884.0, 54.0])


def smooth(u):
    return u * u * (3 - 2 * u)


def camera(fr):
    u = fr / (NF - 1)
    e = u                                   # linear drift (calm, long-exposure feel)
    b = C0 * (1 - e) + C1 * e
    pos = np.array([(b[0] + 0.5) * 20.0, (b[1] + 0.5) * 20.0, b[2]])
    yaw = 341.5 - 3.0 * u
    pitch = 7.5 + 0.6 * u
    roll = 0.0
    return pos, yaw, pitch, roll


# ---------------- aurora curtains ----------------
# columns: D, A1, L1, A2, L2, w1, ph, noiseAmp, tilt, rayDrift, zb, I, Hg, pink, violet, thick
CP = np.array([
    [330.0, 55.0, 40.0, 7.0, 14.0, 0.30, 0.4, 16.0, 0.10, 1.1, 100.0, 1.00, 38.0, 0.60, 1.00, 5.0],
    [470.0, 60.0, 55.0, 9.0, 18.0, -0.22, 2.2, 22.0, -0.12, -0.8, 104.0, 0.60, 42.0, 0.30, 1.20, 6.0],
    [690.0, 45.0, 70.0, 8.0, 24.0, 0.14, 4.1, 24.0, 0.04, 0.6, 100.0, 0.45, 45.0, 0.10, 1.30, 8.0],
    [215.0, 30.0, 30.0, 5.0, 11.0, 0.35, 5.3, 12.0, 0.20, 1.4, 108.0, 0.30, 35.0, 0.25, 1.00, 4.0],
])


def moon_dir():
    az, el = math.radians(MOON_AZ), math.radians(MOON_EL)
    return np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])


def load():
    D = tc.prepare('lofoten', EXAG, PAD, tex_file='lofoten_tex_winter.jpg', detail_amp=4.0)
    D['shd'] = tc.shadow_map(D, moon_dir())
    return D


def make_stars(n=9000, seed=7):
    rng = np.random.default_rng(seed)
    z = rng.uniform(-0.05, 1.0, n)
    ph = rng.uniform(0, 2 * np.pi, n)
    r = np.sqrt(1 - z * z)
    dirs = np.stack([r * np.cos(ph), r * np.sin(ph), z], 1)
    # magnitude distribution ~ 10^(0.35 m), m in [0.5, 7.5]
    u = rng.uniform(0, 1, n)
    k = 0.35 * math.log(10)
    m = np.log(np.exp(k * 0.5) + u * (np.exp(k * 7.5) - np.exp(k * 0.5))) / k
    flux = 10 ** (-0.4 * (m - 1.0))
    # colour temperature tint
    tt = rng.uniform(0, 1, n)
    col = np.stack([0.85 + 0.3 * tt, 0.92 + 0.08 * np.sin(tt * 3), 1.15 - 0.35 * tt], 1)
    return dirs, flux, col


STARS = make_stars()


def project(dirs, cam, W, H):
    pos, fwd, right, up, th = cam[0:3], cam[3:6], cam[6:9], cam[9:12], cam[12]
    zf = dirs @ fwd
    xs = (dirs @ right) / np.maximum(zf, 1e-6) / th
    ys = (dirs @ up) / np.maximum(zf, 1e-6) / (th * H / W)
    px = (xs + 1) * 0.5 * W
    py = (1 - ys) * 0.5 * H
    ok = (zf > 0.05) & (px > -4) & (px < W + 4) & (py > -4) & (py < H + 4)
    return px, py, ok


def splat(img, px, py, amp, col, sigma):
    H, W = img.shape[:2]
    rad = int(math.ceil(sigma * 3))
    for x, y, a, c in zip(px, py, amp, col):
        x0, y0 = int(math.floor(x)), int(math.floor(y))
        xs = np.arange(x0 - rad, x0 + rad + 2)
        ys = np.arange(y0 - rad, y0 + rad + 2)
        xs = xs[(xs >= 0) & (xs < W)]
        ys = ys[(ys >= 0) & (ys < H)]
        if len(xs) == 0 or len(ys) == 0:
            continue
        gx = np.exp(-((xs + 0.5 - x) ** 2) / (2 * sigma * sigma))
        gy = np.exp(-((ys + 0.5 - y) ** 2) / (2 * sigma * sigma))
        k = np.outer(gy, gx)
        k *= a / (2 * math.pi * sigma * sigma)
        img[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1, :] += k[..., None] * c[None, None, :]


def star_layer(cam, W, H, aux, scale):
    dirs, flux, col = STARS
    img = np.zeros((H, W, 3), np.float32)
    # direct
    px, py, ok = project(dirs, cam, W, H)
    el = dirs[:, 2]
    ext = np.exp(-0.12 / np.maximum(el + 0.03, 0.03))       # dimmer near the horizon
    a = flux * ext * 4.0 * scale ** 2
    sel = ok & (a > 1e-5)
    splat(img, px[sel], py[sel], a[sel], col[sel], 0.62 * scale + 0.25)
    vis = aux[..., 0:1]
    out = img * vis
    # reflections: mirrored direction, weighted by the reflected-sky Fresnel weight
    img2 = np.zeros((H, W, 3), np.float32)
    md = dirs * np.array([1, 1, -1])
    px, py, ok = project(md, cam, W, H)
    sel = ok & (a > 4e-5) & (el > 0.01)
    splat(img2, px[sel], py[sel], a[sel], col[sel], 1.0 * scale + 0.4)
    img2 = ndimage.gaussian_filter(img2, (1.6 * scale, 0.6 * scale, 0))
    out += img2 * aux[..., 1:2]
    return out


def params(t, pix, AMP):
    PR = np.zeros(40)
    PR[0:3] = moon_dir()
    PR[3] = 0.044                             # moon gain on the (daylight) texture
    PR[4:7] = [0.72, 0.87, 1.20]             # moonlight tint (long-exposure white balance)
    PR[7] = 0.9                               # relief
    PR[8] = t
    PR[9] = pix
    PR[10] = 0.07                             # wave amplitude (long exposure = calm)
    PR[11] = 3.0e-5                           # night haze
    PR[12] = 1500.0
    PR[13:16] = [0.0035, 0.0060, 0.0110]     # haze colour
    PR[16:19] = [0.0015, 0.0028, 0.0045]     # water body
    PR[19:22] = AMP['amb']                    # aurora bounce on snow
    PR[22] = 1.0
    PR[23:29] = AMP['geo']
    PR[29:32] = [0.0022, 0.0042, 0.0080]     # sky horizon
    PR[32:35] = [0.0004, 0.0008, 0.0022]     # sky zenith
    return PR


def build_map(t, yaw_deg, res_deg=0.06, gain=0.30):
    fwd_az = math.radians(yaw_deg)
    half = math.radians(HFOV / 2 + 14)
    az0 = fwd_az - half
    naz = int(2 * half / math.radians(res_deg)) + 2
    el0 = 0.0
    el1 = math.radians(60.0)
    nel = int((el1 - el0) / math.radians(res_deg)) + 2
    AM = aurora_map(CP, t, fwd_az, az0, math.radians(res_deg), naz, el0, math.radians(res_deg), nel, gain)
    # slight softening = long exposure (rays shimmer during the exposure)
    AM = ndimage.gaussian_filter(AM, (0.6, 1.0, 0)).astype(np.float32)
    # aurora light on snow: average emission over the map (cos-weighted), per channel
    w = np.cos(np.linspace(el0, el1, nel))[:, None, None] * np.sin(np.linspace(el0, el1, nel))[:, None, None]
    amb = (AM * w).sum((0, 1)) / (w.sum() * AM.shape[1]) * 2.2
    geo = [az0, math.radians(res_deg), el0, math.radians(res_deg), naz, nel]
    return AM, dict(amb=amb, geo=geo)


def finish_night(img):
    x = img.astype(np.float32)
    h, w = x.shape[:2]
    # glow: aurora and stars bloom softly (long-exposure lens glow)
    hi = np.maximum(x - 0.05, 0)
    b = np.stack([ndimage.gaussian_filter(hi[..., c], 12 * w / 1920) for c in range(3)], -1)
    x = x + b * 0.12
    x = x * 2.2                                  # exposure
    # filmic shoulder with gentle desaturation of the very bright aurora core
    lum = (0.2126 * x[..., 0] + 0.7152 * x[..., 1] + 0.0722 * x[..., 2])[..., None]
    x = x + np.maximum(lum - 0.7, 0) * 0.35
    x = soft_shoulder(x, 0.70)
    s = lin_to_srgb(x)
    # lift blacks a touch (long-exposure look), slight teal in shadows
    s = s * 0.985 + np.array([0.004, 0.007, 0.012], np.float32)
    s = s * vignette(h, w, 0.25)[..., None]
    return (np.clip(s, 0, 1) * 255 + 0.5).astype(np.uint8)


def render_frame(D, fr, W, H, spp, shutter=0.5):
    offs = sample_pattern(spp)
    ns = len(offs)
    cams = np.zeros((ns, 13))
    for k in range(ns):
        ti = TORDER.get(ns, list(range(ns)))[k]
        ts = fr + ((ti + 0.5) / ns - 0.5) * shutter
        pos, yaw, pitch, roll = camera(ts)
        cams[k] = cam_basis(pos, yaw, pitch, roll, HFOV)
    pos, yaw, pitch, roll = camera(fr)
    cam_c = cam_basis(pos, yaw, pitch, roll, HFOV)
    AM, AMP = build_map(fr / FPS, yaw)
    pix = 2 * math.tan(math.radians(HFOV) / 2) / W / math.sqrt(ns)
    PR = params(fr / FPS, pix, AMP)
    img, aux = render_night(D['h'], D['sea'], D['lake'], D['nrm'], D['nb'], D['cav'], D['shd'], D['mm'],
                            D['mm_off'], D['mm_w'], D['mm_h'], float(D['hmax']), int(D['pad']), D['tex'],
                            D['tx_off'], D['tx_w'], D['tx_h'], PR, AM, cams, offs, W, H)
    img = img + star_layer(cam_c, W, H, aux, W / 1920)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', default='0-47')
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--spp', type=int, default=6)
    ap.add_argument('--out', default=OUT)
    a = ap.parse_args()
    if '-' in a.frames:
        f0, f1 = map(int, a.frames.split('-'))
        frames = list(range(f0, f1 + 1))
    else:
        frames = [int(x) for x in a.frames.split(',')]
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()
    D = load()
    print('prep %.1fs' % (time.time() - t0), flush=True)
    W, H = int(1920 * a.scale), int(1080 * a.scale)
    for fr in frames:
        t1 = time.time()
        img = render_frame(D, fr, W, H, a.spp)
        Image.fromarray(finish_night(img)).save(os.path.join(a.out, 'f%04d.jpg' % fr), quality=95,
                                                subsampling=0)
        print('frame %d  %.1fs' % (fr, time.time() - t1), flush=True)


if __name__ == '__main__':
    main()
