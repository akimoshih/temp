#!/usr/bin/env python3
"""
Geirangerfjord flyover plate: 70 frames @30 fps, 1920x1080.

usage: python3 render_geiranger.py [--frames 0-69] [--scale 1.0] [--spp 4] [--out DIR]
"""
import argparse
import json
import math
import os
import sys
import time

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import terrain_core as tc  # noqa: E402
from day_kernel import render_day  # noqa: E402
from post import finish_day  # noqa: E402

OUT = '/home/user/temp/norway-tv/renders/terrain/geiranger'
NF = 70
FPS = 30.0
EXAG = 1.10
PAD = 500
DETAIL = 7.0
WATER_RGB = np.array([0.012, 0.022, 0.040])

# fjord centreline (DEM 20 m px: col, row), from the water mask
CL = np.array([(780, 790), (820, 805), (860, 821), (900, 823), (940, 819), (980, 807), (1000, 798),
               (1020, 782), (1040, 763), (1060, 740), (1080, 708), (1100, 678), (1120, 662),
               (1160, 661), (1200, 672), (1240, 692)], float)


def catmull(P, n=40):
    pts = []
    P = np.vstack([P[0] * 2 - P[1], P, P[-1] * 2 - P[-2]])
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            pts.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    pts.append(P[-2])
    return np.array(pts)


_path = catmull(CL)
_path_w = np.stack([(_path[:, 0] + 0.5) * 20.0, (_path[:, 1] + 0.5) * 20.0], 1)   # world X, Y (m)
_seg = np.linalg.norm(np.diff(_path_w, axis=0), axis=1)
_arc = np.concatenate([[0], np.cumsum(_seg)])
# light smoothing of the path so the heading changes gently
from scipy.ndimage import gaussian_filter1d  # noqa: E402
_path_w = np.stack([gaussian_filter1d(_path_w[:, 0], 6, mode='nearest'),
                    gaussian_filter1d(_path_w[:, 1], 6, mode='nearest')], 1)


def path_at(s):
    x = np.interp(s, _arc, _path_w[:, 0])
    y = np.interp(s, _arc, _path_w[:, 1])
    return x, y


def arc_of_col(col):
    i = np.argmin(np.abs(_path[:, 0] - col))
    return _arc[i]


# ---------------- camera ----------------
S0 = arc_of_col(875)          # start (m along centreline)
DIST = 1350.0                 # metres travelled over 70 frames


def ease(u):
    # decelerating push: v(0)=1.45, v(1)=0.55 (relative); monotonic, smooth
    return 1.45 * u - 0.45 * u * u


def camera(fr):
    """fr: float frame. returns pos(3), yaw(deg, cw from N), pitch(deg), roll(deg)"""
    u = fr / (NF - 1)
    s = S0 + DIST * ease(u)
    x, y = path_at(s)
    # lateral offset: slightly toward the north wall, drifting to the centre
    xa, ya = path_at(s + 30)
    tx, ty = xa - x, ya - y
    tl = math.hypot(tx, ty)
    nxl, nyl = ty / tl, -tx / tl        # left normal (for X east / Y south)
    off = -60.0 + 40.0 * u
    x += nxl * off * -1
    y += nyl * off * -1
    z = 250.0 + 70.0 * u
    # look toward a point further along the fjord
    lx, ly = path_at(s + 2600.0)
    yaw = math.degrees(math.atan2(lx - x, -(ly - y)))
    # pitch: look slightly down
    pitch = -6.5 + 1.0 * u
    # bank into the left-hand bend (slow roll)
    roll = -1.0 - 4.0 * (0.5 - 0.5 * math.cos(math.pi * min(1.0, u * 1.1)))
    return np.array([x, y, z]), yaw, pitch, roll


def cam_basis(pos, yaw, pitch, roll, hfov):
    a, p, r = math.radians(yaw), math.radians(pitch), math.radians(roll)
    fwd = np.array([math.sin(a) * math.cos(p), -math.cos(a) * math.cos(p), math.sin(p)])
    right = np.array([math.cos(a), math.sin(a), 0.0])
    up = np.cross(right, fwd)
    if up[2] < 0:
        up = -up
    up /= np.linalg.norm(up)
    # roll about the forward axis (positive = clockwise image rotation)
    cr, sr = math.cos(r), math.sin(r)
    right2 = right * cr + up * sr
    up2 = up * cr - right * sr
    return np.concatenate([pos, fwd, right2, up2, [math.tan(math.radians(hfov) / 2)]])


HFOV = 62.0
# 4-sample rotated grid (fixed pattern -> temporally stable)
RGSS4 = np.array([[0.125, 0.625], [0.375, 0.125], [0.625, 0.875], [0.875, 0.375]])


def sample_pattern(spp):
    if spp == 1:
        return np.array([[0.5, 0.5]])
    if spp == 4:
        return RGSS4.copy()
    n = int(round(math.sqrt(spp)))
    g = (np.arange(n) + 0.5) / n
    X, Y = np.meshgrid(g, g)
    o = np.stack([X.ravel(), Y.ravel()], 1)
    # slight rotation of the grid
    return (o + np.array([[0.07, -0.05]]) * (np.arange(len(o))[:, None] % 2)) % 1.0


def params(sun, t, pix_angle):
    PR = np.zeros(32)
    PR[0:3] = sun
    PR[3] = 1.0
    PR[4] = 3.0e-5          # haze extinction at sea level (1/m)
    PR[5] = 1400.0          # haze scale height (m)
    PR[6:9] = tc.srgb_to_lin(np.array([62, 118, 196]) / 255.0)    # zenith
    PR[9:12] = tc.srgb_to_lin(np.array([184, 206, 228]) / 255.0)   # horizon
    PR[12] = 0.45           # relief strength
    PR[13] = 0.45           # ambient in relief ratio
    PR[14] = t
    PR[15] = pix_angle
    PR[16] = 0.45           # wave amplitude
    PR[17] = 0.95           # water body gain
    PR[18] = 0.10           # cloud coverage
    PR[19] = 2600.0         # cloud altitude
    PR[20] = 0.22           # sun glow
    PR[21] = 0.10           # haze sun tint
    PR[22] = 0.6            # sub-texel detail
    PR[23] = 0.6            # steep-face projection
    PR[24] = 1.0            # terrain exposure
    PR[25] = 1.0            # texture saturation
    PR[26:29] = WATER_RGB   # water body colour (lin)
    return PR


def render(D, PR, cams, offs, W, H):
    return render_day(D['h'], D['sea'], D['lake'], D['nrm'], D['nb'], D['cav'], D['zref'], D['shd'], D['mm'],
                      D['mm_off'], D['mm_w'], D['mm_h'], float(D['hmax']), int(D['pad']), D['tex'],
                      D['tx_off'], D['tx_w'], D['tx_h'], PR, cams, offs, W, H)


def sun_dir():
    meta = json.load(open(os.path.join(tc.GEO, 'geiranger_dem.json')))
    bs = meta['texture']['baked_sun']
    az, el = math.radians(bs['azimuth_deg']), math.radians(bs['elevation_deg'])
    return np.array([math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)])


def load():
    D = tc.prepare('geiranger', EXAG, PAD, detail_amp=DETAIL)
    D['shd'] = tc.shadow_map(D, sun_dir())
    return D


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--frames', default='0-69')
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--spp', type=int, default=4)
    ap.add_argument('--shutter', type=float, default=0.5)
    ap.add_argument('--out', default=OUT)
    ap.add_argument('--raw', action='store_true')
    a = ap.parse_args()
    if '-' in a.frames:
        f0, f1 = map(int, a.frames.split('-'))
        frames = list(range(f0, f1 + 1))
    else:
        frames = [int(x) for x in a.frames.split(',')]
    os.makedirs(a.out, exist_ok=True)
    t0 = time.time()
    D = load()
    sun = sun_dir()
    WATER_RGB[:] = D['water_rgb']
    print('prep %.1fs' % (time.time() - t0), flush=True)
    W, H = int(1920 * a.scale), int(1080 * a.scale)
    offs = sample_pattern(a.spp)
    ns = len(offs)
    sub = math.sqrt(ns)
    for fr in frames:
        t1 = time.time()
        cams = np.zeros((ns, 13))
        for k in range(ns):
            # shutter time for this sample (stratified, centred on the frame)
            ts = fr + ((k + 0.5) / ns - 0.5) * a.shutter
            pos, yaw, pitch, roll = camera(ts)
            cams[k] = cam_basis(pos, yaw, pitch, roll, HFOV)
        pix = 2 * math.tan(math.radians(HFOV) / 2) / W / sub
        PR = params(sun, fr / FPS, pix)
        img = render(D, PR, cams, offs, W, H)
        if a.raw:
            np.save(os.path.join(a.out, 'raw%04d.npy' % fr), img)
        out = finish_day(img, fr)
        Image.fromarray(out).save(os.path.join(a.out, 'f%04d.jpg' % fr), quality=95, subsampling=0)
        print('frame %d  %.1fs' % (fr, time.time() - t1), flush=True)


if __name__ == '__main__':
    main()
