"""Real-imagery globe -> Norway zoom plates (EDL S1-S3, frames 0-279).

Ray-casts a textured sphere (NASA Blue Marble + Sentinel-2 Scandinavia mosaic when present),
with clouds, city lights on the dark limb, ocean specular and an atmosphere rim.
Writes renders/globe/f%04d.jpg and renders/globe/camera.json (per-frame camera, so the
compositor can project lat/lon points: flight arc, pins, borders).

usage: python3 render_globe.py [first last] [--ss 1.5] [--preview]
"""
import json, math, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
IMG = os.path.join(ROOT, 'assets/raw/package/example')
GEO = os.path.join(ROOT, 'assets/geo')
OUT = os.path.join(ROOT, 'renders/globe')
W, H = 1920, 1080
FOVY = math.radians(30.0)
Image.MAX_IMAGE_PIXELS = None

# ---------------------------------------------------------------- camera path
def unit(lat, lon):
    la, lo = math.radians(lat), math.radians(lon)
    return np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])

def slerp(a, b, t):
    om = math.acos(max(-1.0, min(1.0, float(a @ b))))
    if om < 1e-6:
        return a
    return (math.sin((1 - t) * om) * a + math.sin(t * om) * b) / math.sin(om)

def smooth(t):  # easeInOutCubic
    t = min(1.0, max(0.0, t))
    return 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2

def ease_io(t, p=4.0):
    t = min(1.0, max(0.0, t))
    return 0.5 * (2 * t) ** p if t < 0.5 else 1 - 0.5 * (2 - 2 * t) ** p

TW_A = unit(21.5, 125.5)   # f0: just east of Taiwan, drifting onto it
TW_B = unit(23.6, 119.5)   # f111
NO_A = unit(62.0, 12.0)    # end of rotation (f167)
NO_B = unit(64.6, 16.0)    # framed Norway (f223)
NO_C = unit(64.4, 16.6)    # drift during the title (f279)
H_S1 = (3.55, 3.25)
H_ROT_MID = 4.1
H_ZOOM_END = 0.47

def camera(f):
    """sub-camera unit vector, altitude (Earth radii), roll (rad)."""
    if f < 112:
        t = f / 111
        u = slerp(TW_A, TW_B, 1 - (1 - t) ** 2)
        h = H_S1[0] + (H_S1[1] - H_S1[0]) * t
    elif f < 168:
        t = (f - 112) / 55
        e = smooth(t)
        u = slerp(TW_B, NO_A, e)
        h = H_S1[1] + (H_S1[1] - H_S1[1]) * e + (H_ROT_MID - H_S1[1]) * math.sin(math.pi * e)
    elif f < 224:
        t = (f - 168) / 55
        e = ease_io(t, 3.2)
        u = slerp(NO_A, NO_B, smooth(t))
        h = math.exp(math.log(H_S1[1]) + (math.log(H_ZOOM_END) - math.log(H_S1[1])) * e)
    else:
        t = (f - 224) / 55
        u = slerp(NO_B, NO_C, t)
        h = H_ZOOM_END * (1 - 0.08 * t)
    return u / np.linalg.norm(u), h, 0.0

def basis(u, roll=0.0):
    fwd = -u
    z = np.array([0.0, 0.0, 1.0])
    up = z - (z @ fwd) * fwd
    up /= np.linalg.norm(up)
    right = np.cross(fwd, up)
    right /= np.linalg.norm(right)
    if roll:
        c, s = math.cos(roll), math.sin(roll)
        right, up = c * right + s * up, -s * right + c * up
    return fwd, right, up

# ---------------------------------------------------------------- textures
def load(path, mode='RGB'):
    return np.asarray(Image.open(path).convert(mode), dtype=np.float32) / 255.0

def pyramid(img, levels):
    out = [img]
    for _ in range(levels):
        a = out[-1]
        h2, w2 = a.shape[0] // 2 * 2, a.shape[1] // 2 * 2
        a = a[:h2, :w2]
        out.append(0.25 * (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]))
    return out

def bilinear(tex, u, v, wrap=True):
    """tex HxWxC, u,v in [0,1] (u = x). Returns (...,C)."""
    h, w = tex.shape[:2]
    x = u * w - 0.5
    y = v * h - 0.5
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    if wrap:
        x0m, x1m = x0 % w, (x0 + 1) % w
    else:
        x0m, x1m = np.clip(x0, 0, w - 1), np.clip(x0 + 1, 0, w - 1)
    y0c, y1c = np.clip(y0, 0, h - 1), np.clip(y0 + 1, 0, h - 1)
    t = tex if tex.ndim == 3 else tex[..., None]
    a = t[y0c, x0m]; b = t[y0c, x1m]; c = t[y1c, x0m]; d = t[y1c, x1m]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy

def sample_mip(pyr, lvl, u, v, wrap=True):
    lvl = min(max(lvl, 0.0), len(pyr) - 1.001)
    l0 = int(lvl)
    fr = lvl - l0
    a = bilinear(pyr[l0], u, v, wrap)
    if fr < 1e-3:
        return a
    return a * (1 - fr) + bilinear(pyr[l0 + 1], u, v, wrap) * fr

class Scene:
    def __init__(self):
        day8k = os.path.join(GEO, 'globe_texture_8k.jpg')
        day = load(day8k if os.path.exists(day8k) else os.path.join(IMG, 'img/earth-blue-marble.jpg'))
        self.day = pyramid(day, 5)
        self.day_texel = 180.0 / day.shape[0]           # degrees per texel
        self.night = pyramid(load(os.path.join(IMG, 'img/earth-night.jpg')), 4)
        self.water = load(os.path.join(IMG, 'img/earth-water.png'), 'L')
        self.clouds = pyramid(load(os.path.join(IMG, 'clouds/clouds.png'), 'RGBA')[..., 3:4], 4)
        self.stars = load(os.path.join(IMG, 'img/night-sky.png'))
        self.mosaic = None
        mj = os.path.join(GEO, 'scandinavia_mosaic.json')
        mi = os.path.join(GEO, 'scandinavia_mosaic.jpg')
        if os.path.exists(mj) and os.path.exists(mi):
            meta = json.load(open(mj))
            b = meta.get('bounds', meta)
            self.mb = (b['west'], b['east'], b['south'], b['north'])
            m = load(mi)
            self.mosaic = pyramid(m, 7)
            self.m_texel = (self.mb[3] - self.mb[2]) / m.shape[0]
            print('mosaic', m.shape, self.mb, flush=True)

    def render(self, f, ss=1.5):
        u, h, roll = camera(f)
        fwd, right, up = basis(u, roll)
        C = (1.0 + h) * u
        w, hh = int(W * ss), int(H * ss)
        ty = math.tan(FOVY / 2)
        tx = ty * W / H
        xs = ((np.arange(w, dtype=np.float32) + 0.5) / w * 2 - 1) * tx
        ys = (1 - (np.arange(hh, dtype=np.float32) + 0.5) / hh * 2) * ty
        X, Y = np.meshgrid(xs, ys)
        D = fwd[None, None, :] + X[..., None] * right + Y[..., None] * up
        D /= np.linalg.norm(D, axis=-1, keepdims=True)
        D = D.astype(np.float32)
        Cd = D @ C.astype(np.float32)
        cc = float(C @ C) - 1.0
        disc = Cd * Cd - cc
        hit = disc > 0
        tt = -Cd - np.sqrt(np.maximum(disc, 0))
        P = C[None, None, :] + tt[..., None] * D
        P = np.where(hit[..., None], P, 0).astype(np.float32)

        lat = np.degrees(np.arcsin(np.clip(P[..., 2], -1, 1)))
        lon = np.degrees(np.arctan2(P[..., 1], P[..., 0]))
        U = (lon + 180.0) / 360.0
        V = (90.0 - lat) / 180.0

        # ground footprint of one output pixel at screen centre, in degrees
        foot = math.degrees(h * 2 * ty / H)

        day_lvl = math.log2(max(foot / self.day_texel, 1.0))
        col = sample_mip(self.day, day_lvl, U, V)
        if self.mosaic is not None:
            wv, ev, sv, nv = self.mb
            mu = (lon - wv) / (ev - wv)
            mv = (nv - lat) / (nv - sv)
            inside = (mu > 0) & (mu < 1) & (mv > 0) & (mv < 1) & hit
            if inside.any():
                lvl = math.log2(max(foot / self.m_texel, 1.0))
                idx = np.nonzero(inside)
                mc = sample_mip(self.mosaic, lvl, mu[idx], mv[idx], wrap=False)
                # feather 1.2 deg at the mosaic border
                edge = np.minimum.reduce([(lon[idx] - wv), (ev - lon[idx]), (lat[idx] - sv), (nv - lat[idx])])
                wgt = np.clip(edge / 1.2, 0, 1)[..., None]
                col[idx] = col[idx] * (1 - wgt) + mc * wgt

        n = P  # unit normal
        # camera-relative key light: upper-left, slightly in front
        L = -0.55 * right + 0.45 * up - 0.70 * fwd
        L /= np.linalg.norm(L)
        ndl = (n @ L.astype(np.float32))
        diff = np.clip(ndl * 1.1 + 0.08, 0, 1)
        light = 0.10 + 0.95 * diff ** 0.9

        # ocean specular
        water = bilinear(self.water, U, V)[..., 0]
        Hv = (L - fwd); Hv /= np.linalg.norm(Hv)
        spec = np.clip(n @ Hv.astype(np.float32), 0, 1) ** 60 * 0.35 * water
        col = col * light[..., None] + spec[..., None] * np.array([0.85, 0.92, 1.0], np.float32)

        # clouds, fading out as we dive in
        cloud_a = float(np.clip((h - 0.75) / 1.4, 0, 1)) * 0.92
        if cloud_a > 0.01:
            cl_lvl = math.log2(max(foot / (180.0 / 2048), 1.0))
            cu = (U + 0.004 * f / 30.0) % 1.0
            cl = sample_mip(self.clouds, cl_lvl, cu, V)[..., 0]
            cl = np.clip(cl * 1.25, 0, 1) ** 0.9 * cloud_a
            ccol = np.clip(light * 1.05, 0, 1.1)[..., None] * np.array([0.97, 0.98, 1.0], np.float32)
            col = col * (1 - cl[..., None]) + ccol * cl[..., None]

        # city lights on the dark side
        dark = np.clip(-ndl * 3 + 0.25, 0, 1)
        if dark.max() > 0:
            nl = sample_mip(self.night, math.log2(max(foot / (180.0 / 2048), 1.0)), U, V)
            col = col + nl * np.array([1.0, 0.8, 0.5], np.float32) * dark[..., None] * 0.9

        # atmosphere: grazing haze on the surface + rim glow off the limb
        cos_v = np.clip(-(D * n).sum(-1), 0, 1)
        haze = ((1 - cos_v) ** 3.0 * 0.85)[..., None] * np.array([0.42, 0.66, 1.0], np.float32)
        haze *= np.clip(ndl * 0.9 + 0.45, 0.08, 1.0)[..., None]
        zoom_haze = float(np.clip((h - 0.35) / 1.5, 0.25, 1.0))
        col = col * (1 - 0.25 * (1 - cos_v[..., None]) ** 3) + haze * zoom_haze

        # sky: stars + limb glow
        az = np.degrees(np.arctan2(D[..., 1], D[..., 0]))
        el = np.degrees(np.arcsin(np.clip(D[..., 2], -1, 1)))
        sky = bilinear(self.stars, (az + 180) / 360, (90 - el) / 180) * 1.05
        b = np.sqrt(np.maximum(cc + 1.0 - Cd * Cd, 0))  # closest approach of ray to centre
        glow_w = 0.018 + 0.03 * min(h / 3.5, 1)
        rim = np.exp(-np.maximum(b - 1.0, 0) / glow_w) * (b >= 1.0)
        sun_side = np.clip(((C[None, None, :] + np.maximum(-Cd, 0)[..., None] * D) @ L.astype(np.float32)) / np.maximum(b, 1e-3) * 0.8 + 0.4, 0.15, 1.2)
        glowc = np.array([0.36, 0.62, 1.0], np.float32)
        skycol = sky * (1 - np.clip(rim, 0, 1)[..., None]) + (rim * sun_side)[..., None] * glowc * 1.1
        out = np.where(hit[..., None], col, skycol)

        # filmic tone map + slight teal/orange grade
        out = np.clip(out, 0, None)
        out = out / (1 + 0.18 * out)
        out = out * np.array([1.02, 1.0, 1.04], np.float32)
        out = np.clip(out * 1.14, 0, 1) ** (1 / 1.04)
        img = Image.fromarray((out * 255 + 0.5).astype(np.uint8))
        if ss != 1:
            img = img.resize((W, H), Image.LANCZOS)
        cam = {'f': f, 'C': C.tolist(), 'fwd': fwd.tolist(), 'right': right.tolist(), 'up': up.tolist(),
               'tanx': tx, 'tany': ty, 'h': h}
        return img, cam


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    ss = 1.5
    if '--ss' in sys.argv:
        ss = float(sys.argv[sys.argv.index('--ss') + 1])
        args = [a for a in args if a != sys.argv[sys.argv.index('--ss') + 1]]
    first, last = (int(args[0]), int(args[1])) if len(args) >= 2 else (0, 279)
    os.makedirs(OUT, exist_ok=True)
    sc = Scene()
    camp = os.path.join(OUT, 'camera.json')
    cams = json.load(open(camp)) if os.path.exists(camp) else {}
    for f in range(first, last + 1):
        img, cam = sc.render(f, ss)
        img.save(os.path.join(OUT, f'f{f:04d}.jpg'), quality=94)
        cams[str(f)] = cam
        if f % 10 == 0 or f == last:
            print('frame', f, 'h=%.3f' % cam['h'], flush=True)
            json.dump(cams, open(camp, 'w'))
    json.dump(cams, open(camp, 'w'))


if __name__ == '__main__':
    main()
