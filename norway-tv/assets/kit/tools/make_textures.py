#!/usr/bin/env python3
"""Procedural texture generator for the collage kit.  Deterministic (fixed seeds).

    python3 assets/kit/tools/make_textures.py            # all
    python3 assets/kit/tools/make_textures.py paper tape # selected groups

Outputs -> assets/kit/textures/
  paper_cream.jpg  newsprint.jpg  kraft.jpg  cardboard.jpg      (1536² seamless tiles)
  cardboard_edge.png                                            (2048×140 RGBA corrugated torn edge strip)
  tape_beige.png tape_white.png tape_kraft.png                  (RGBA, torn ends, semi-transparent)
  grain_0..7.png                                                (1920×1080 L, mean 128 → overlay/soft-light)
  dust_0..3.png                                                 (1920×1080 RGBA dust, hairs, scratches)
  leak_0..1.jpg                                                 (1920×1080 RGB on black → screen/add)
  halftone_tile.png halftone_tile_fine.png                      (256² seamless 45° dot tile, black on alpha)
  halftone_fade.png                                             (1920×540 RGBA dot gradient)
  crumple.jpg  fold.jpg                                         (grey 128 shading → overlay/soft-light)
  stamp_grunge.png                                              (1024² seamless RGBA void mask for stamps)
"""
import os, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'kit', 'textures')
TTF = os.path.join(ROOT, 'tmp', 'kit', 'ttf')
os.makedirs(OUT, exist_ok=True)


# ----------------------------------------------------------------------------- helpers
def fft_noise(h, w, seed, beta=2.0, fmin=None, fmax=None, aniso=(1.0, 1.0)):
    """Seamless (periodic) coloured noise, zero mean / unit std.
    beta: spectral slope (power ~ 1/f^beta). fmin/fmax in cycles/pixel band-limit (soft).
    aniso scales the frequency axes (x, y) -> stretched structures."""
    rng = np.random.default_rng(seed)
    F = np.fft.rfft2(rng.standard_normal((h, w)))
    fy = np.fft.fftfreq(h)[:, None] * aniso[1]
    fx = np.fft.rfftfreq(w)[None, :] * aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = f ** (-beta / 2.0)
    if fmin is not None:
        amp *= 1.0 - np.exp(-(f / fmin) ** 4)
    if fmax is not None:
        amp *= np.exp(-(f / fmax) ** 2)
    amp[0, 0] = 0.0
    n = np.fft.irfft2(F * amp, s=(h, w))
    n -= n.mean()
    return n / (n.std() + 1e-9)


def splat_curves(h, w, rng, n, len_rng, curl=0.08, step=0.5, weight_rng=(0.5, 1.0), wrap=True, angle=None):
    """Rasterise n random curved fibres into a float map (bilinear splats, periodic)."""
    acc = np.zeros((h, w), np.float64)
    ys_all, xs_all, ws_all = [], [], []
    for _ in range(n):
        L = rng.uniform(*len_rng)
        m = max(2, int(L / step))
        a0 = rng.uniform(0, 2 * np.pi) if angle is None else angle + rng.normal(0, 0.25)
        da = np.cumsum(rng.normal(0, curl, m))
        ang = a0 + da
        x = rng.uniform(0, w) + np.cumsum(np.cos(ang) * step)
        y = rng.uniform(0, h) + np.cumsum(np.sin(ang) * step)
        wt = rng.uniform(*weight_rng) * np.sin(np.linspace(0.15, np.pi - 0.15, m)) ** 0.5
        xs_all.append(x); ys_all.append(y); ws_all.append(wt)
    x = np.concatenate(xs_all); y = np.concatenate(ys_all); wt = np.concatenate(ws_all)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx = x - x0; fy = y - y0
    for dx, dy, ww in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi = x0 + dx; yi = y0 + dy
        if wrap:
            xi %= w; yi %= h
            np.add.at(acc, (yi, xi), ww * wt)
        else:
            ok = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
            np.add.at(acc, (yi[ok], xi[ok]), (ww * wt)[ok])
    return acc


def to_u8(a):
    return np.clip(np.round(a), 0, 255).astype(np.uint8)


def save_rgb(arr, name, q=92):
    Image.fromarray(to_u8(arr), 'RGB').save(os.path.join(OUT, name), quality=q, subsampling=0, optimize=True)
    print('wrote', name)


def save_png(arr, name, mode):
    Image.fromarray(to_u8(arr), mode).save(os.path.join(OUT, name), optimize=True)
    print('wrote', name)


def hex_rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float64)


def gblur(a, s, wrap=True):
    return ndi.gaussian_filter(a, s, mode='wrap' if wrap else 'reflect')


# ----------------------------------------------------------------------------- papers
def paper(name, base_hex, seed, size=1536, mottle=0.014, cloud=0.009, fibres=2600, fibre_amp=0.045,
          dark_fibres=0, dark_amp=0.18, specks=40, grain=0.010, warm=0.008, showthrough=None, fibre_len=(18, 110),
          dark_len=(10, 60), dark_curl=0.12):
    h = w = size
    rng = np.random.default_rng(seed)
    base = hex_rgb(base_hex)
    lum = np.ones((h, w))
    lum += mottle * fft_noise(h, w, seed + 1, beta=3.0, fmax=0.012)
    lum += cloud * fft_noise(h, w, seed + 2, beta=1.2, fmin=0.01, fmax=0.06)
    # fibres: light & dark families
    fl = splat_curves(h, w, rng, fibres, fibre_len, curl=0.06)
    fd = splat_curves(h, w, rng, fibres // 2, (fibre_len[0] * 0.6, fibre_len[1] * 0.8), curl=0.09)
    fl = gblur(fl, 0.55); fd = gblur(fd, 0.6)
    lum += fibre_amp * (fl / (np.percentile(fl, 99.7) + 1e-9)).clip(0, 1.4)
    lum -= fibre_amp * 0.8 * (fd / (np.percentile(fd, 99.7) + 1e-9)).clip(0, 1.4)
    if dark_fibres:
        dk = gblur(splat_curves(h, w, rng, dark_fibres, dark_len, curl=dark_curl, weight_rng=(0.3, 1.0)), 0.5)
        lum -= dark_amp * (dk / (np.percentile(dk, 99.95) + 1e-9)).clip(0, 1.2)
    # fine grain (felted surface)
    lum += grain * gblur(rng.standard_normal((h, w)), 0.7) / 0.35
    img = base[None, None, :] * lum[..., None]
    # hue drift (warmer/cooler areas)
    hue = fft_noise(h, w, seed + 3, beta=3.2, fmax=0.008)
    img += np.stack([hue, hue * 0.35, -hue * 0.6], -1) * warm * 255
    # show-through print from the reverse side (newsprint)
    if showthrough is not None:
        st = showthrough(h, w, rng)
        img *= (1 - st)[..., None]
    # specks / inclusions
    sp = np.zeros((h, w))
    for _ in range(specks):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(0.5, 1.8)
        ys, xs = np.ogrid[-4:5, -4:5]
        blob = np.exp(-((xs + rng.normal(0, .3)) ** 2 + (ys * rng.uniform(.6, 1.4)) ** 2) / (2 * r * r))
        yi = (np.arange(-4, 5) + int(cy)) % h; xi = (np.arange(-4, 5) + int(cx)) % w
        sp[np.ix_(yi, xi)] = np.maximum(sp[np.ix_(yi, xi)], blob * rng.uniform(0.25, 0.7))
    img *= (1 - sp)[..., None]
    save_rgb(img, name)


def newsprint_showthrough(h, w, rng):
    """Faint mirrored newspaper print bleeding through from the back (seamless: layout fits tile)."""
    im = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(im)
    try:
        body = ImageFont.truetype(os.path.join(TTF, 'NotoSerifTC-900.ttf'), 21)
        head = ImageFont.truetype(os.path.join(TTF, 'NotoSansTC-900.ttf'), 56)
    except Exception:
        body = head = ImageFont.load_default()
    chars = open(os.path.join(ROOT, 'assets', 'kit', 'fonts', 'charset.txt'), encoding='utf-8').read()
    han = [c for c in chars if 0x4E00 <= ord(c) <= 0x9FFF]
    cols, gutter, lh = 4, 28, 32
    colw = w // cols
    y_head = rng.integers(3, 20) * lh
    for c in range(cols):
        x0 = c * colw + gutter // 2
        for li in range(h // lh):
            y = li * lh + 5
            if c < 2 and y_head <= y < y_head + 3 * lh:
                if c == 0 and y == y_head + 5:
                    d.text((x0, y), ''.join(rng.choice(han, 11)), font=head, fill=255)
                continue
            n = colw // 22 - 1
            if rng.random() < 0.12: n = int(n * rng.uniform(0.2, 0.8))   # paragraph ends
            s = ''.join(rng.choice(han, n))
            if rng.random() < 0.3:
                k = rng.integers(1, max(2, n - 1)); s = s[:k] + '，' + s[k + 1:]
            d.text((x0, y), s, font=body, fill=255)
    a = np.asarray(im.transpose(Image.FLIP_LEFT_RIGHT), np.float64) / 255.0
    a = gblur(a, 2.0)
    return a * 0.06


def cardboard(seed=41, size=1536):
    """Corrugated cardboard surface: kraft liner + faint flute ridges (vertical)."""
    h = w = size
    rng = np.random.default_rng(seed)
    base = hex_rgb('#B98E5F')
    lum = np.ones((h, w))
    lum += 0.05 * fft_noise(h, w, seed + 1, beta=3.0, fmax=0.01)
    lum += 0.03 * fft_noise(h, w, seed + 2, beta=1.0, fmin=0.02, fmax=0.12)
    x = np.arange(w)[None, :] + 3 * fft_noise(h, w, seed + 5, beta=4, fmax=0.004)
    period = w / 192  # 8 px flutes, seamless
    ridge = np.cos(2 * np.pi * x / period)
    lum += 0.022 * ridge
    fl = gblur(splat_curves(h, w, rng, 2400, (15, 80), curl=0.05, angle=np.pi / 2), 0.6)
    fd = gblur(splat_curves(h, w, rng, 3200, (10, 60), curl=0.08), 0.6)
    lum += 0.05 * (fl / np.percentile(fl, 99.7)).clip(0, 1.3) - 0.07 * (fd / np.percentile(fd, 99.7)).clip(0, 1.3)
    lum += 0.02 * gblur(rng.standard_normal((h, w)), 0.8) / 0.3
    img = base[None, None, :] * lum[..., None]
    save_rgb(img, 'cardboard.jpg')


def cardboard_edge(seed=43, w=2048, h=140):
    """Torn corrugated cross-section strip (RGBA): torn top liner, exposed fluting, bottom liner."""
    ss = 2
    W, H = w * ss, h * ss
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    def tear(seed_, amp, base_y):
        n = fft_noise(1, W, seed_, beta=1.6)[0] * amp + fft_noise(1, W, seed_ + 9, beta=0.6)[0] * amp * 0.25
        return base_y + n
    top_torn = tear(seed, 7 * ss, 26 * ss)       # top liner torn edge
    flute_top = tear(seed + 1, 3 * ss, 44 * ss)
    bottom = tear(seed + 2, 1.2 * ss, 118 * ss)
    alpha = (yy >= top_torn[None, :] - 10 * ss).astype(np.float64) * (yy <= bottom[None, :]).astype(np.float64)
    col = np.zeros((H, W, 3))
    kraft = hex_rgb('#C39A6B'); dark = hex_rgb('#5E432A'); core = hex_rgb('#D8BC94')
    col[:] = kraft
    # fluting zone between flute_top and bottom-12
    fz = (yy > flute_top[None, :]) & (yy < bottom[None, :] - 12 * ss)
    period = 26 * ss
    mid = (flute_top + bottom - 12 * ss) / 2
    ampw = (bottom - 12 * ss - flute_top) / 2 - 2 * ss
    wave = mid[None, :] + ampw[None, :] * np.sin(2 * np.pi * xx / period)
    dist = np.abs(yy - wave)
    paper_line = np.clip(1 - (dist - 2.2 * ss) / (1.2 * ss), 0, 1)
    gap_shade = np.clip(1 - dist / (ampw[None, :] * 1.1 + 1), 0, 1)
    shade = dark * (0.55 + 0.45 * (1 - gap_shade[..., None]))
    col = np.where(fz[..., None], shade * (1 - paper_line[..., None]) + kraft * 0.92 * paper_line[..., None], col)
    # torn top liner: frayed lighter fibre rim
    rim = np.clip(1 - np.abs(yy - top_torn[None, :]) / (5 * ss), 0, 1) * (yy < flute_top[None, :])
    col = col * (1 - 0.55 * rim[..., None]) + core * 0.55 * rim[..., None]
    # fringe of fibres above the torn edge
    fib = splat_curves(H, W, rng, 700, (2 * ss, 6 * ss), curl=0.2, wrap=False)
    fib = gblur(fib, 0.8, False)
    fib_a = np.clip(fib / (np.percentile(fib[fib > 0], 85) + 1e-9), 0, 1) * (np.abs(yy - top_torn[None, :] + 2 * ss) < 3 * ss)
    alpha = np.maximum(alpha * (yy >= top_torn[None, :]), fib_a * 0.9)
    liner_edge = np.clip(1 - np.abs(yy - bottom[None, :] + 12 * ss) / (1.5 * ss), 0, 1)
    col = col * (1 - 0.35 * liner_edge[..., None])
    col *= (1 + 0.05 * fft_noise(H, W, seed + 7, beta=1.4))[..., None]
    rgba = np.concatenate([col, alpha[..., None] * 255], -1)
    im = Image.fromarray(to_u8(rgba), 'RGBA').resize((w, h), Image.LANCZOS)
    im.save(os.path.join(OUT, 'cardboard_edge.png'), optimize=True); print('wrote cardboard_edge.png')


# ----------------------------------------------------------------------------- tape
def tape(name, color_hex, alpha0, seed, w=640, h=150, crepe=0.05, opacity_var=0.08):
    ss = 2
    W, H = w * ss, h * ss
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    # long edges: nearly straight, very slight waviness
    e_top = 4 * ss + 0.6 * ss * fft_noise(1, W, seed + 1, beta=2)[0]
    e_bot = H - 4 * ss + 0.6 * ss * fft_noise(1, W, seed + 2, beta=2)[0]
    # torn ends: jagged tear (random walk + fine teeth), slanted
    def tear_x(seed_, x_base, slant):
        t = np.arange(H, dtype=np.float64)
        coarse = np.cumsum(np.random.default_rng(seed_).normal(0, 1.4, H))
        coarse -= np.linspace(coarse[0], coarse[-1], H)
        teeth = 2.5 * ss * np.abs(np.sin(t / (rng.uniform(5, 9) * ss) + rng.uniform(0, 6))) ** 1.5
        return x_base + slant * (t - H / 2) + coarse * 0.8 * ss + teeth
    xl = tear_x(seed + 3, 22 * ss, rng.uniform(-0.12, 0.12))
    xr = W - 22 * ss - (tear_x(seed + 4, 0, rng.uniform(-0.12, 0.12)))
    inside = (yy >= e_top[None, :]) & (yy <= e_bot[None, :]) & (xx >= xl[:, None]) & (xx <= xr[:, None])
    a = inside.astype(np.float64)
    a = ndi.gaussian_filter(a, 0.7 * ss)
    # fibres poking out of torn ends
    fib = splat_curves(H, W, rng, 260, (3 * ss, 12 * ss), curl=0.25, wrap=False)
    near_end = (np.abs(xx - xl[:, None]) < 6 * ss) | (np.abs(xx - xr[:, None]) < 6 * ss)
    fib = gblur(fib, 0.6 * ss, False) * near_end
    a = np.maximum(a, np.clip(fib / (np.percentile(fib[fib > 0], 90) + 1e-9), 0, 1) * 0.8)
    # crepe crinkle: fine lines across the width (vertical for a horizontal tape)
    cr = fft_noise(H, W, seed + 5, beta=1.0, fmin=0.02, fmax=0.25, aniso=(1.0, 0.08))
    wr = fft_noise(H, W, seed + 6, beta=2.6, fmax=0.02)            # broader wrinkles
    lum = 1 + crepe * cr + 0.03 * wr
    # denser adhesive edge + lighter torn ends (compressed fibres)
    edge_d = np.minimum(np.abs(yy - e_top[None, :]), np.abs(yy - e_bot[None, :]))
    lum -= 0.05 * np.exp(-edge_d / (1.2 * ss))
    end_d = np.minimum(np.abs(xx - xl[:, None]), np.abs(xx - xr[:, None]))
    lum += 0.06 * np.exp(-end_d / (3 * ss))
    col = hex_rgb(color_hex)[None, None, :] * lum[..., None]
    alpha_map = alpha0 * (1 + opacity_var * fft_noise(H, W, seed + 7, beta=1.8)) * (1 + 0.6 * crepe * cr)
    alpha_map += 0.12 * np.exp(-end_d / (3 * ss))
    A = np.clip(a * alpha_map, 0, 1) * 255
    im = Image.fromarray(to_u8(np.concatenate([col, A[..., None]], -1)), 'RGBA').resize((w, h), Image.LANCZOS)
    im.save(os.path.join(OUT, name), optimize=True); print('wrote', name)


# ----------------------------------------------------------------------------- film overlays
def grain_frames(n=8, w=1920, h=1080):
    for i in range(n):
        rng = np.random.default_rng(1000 + i)
        fine = ndi.gaussian_filter(rng.standard_normal((h, w)), 0.55)
        clump = ndi.gaussian_filter(rng.standard_normal((h, w)), 1.3)
        g = fine / fine.std() * 0.75 + clump / clump.std() * 0.5
        g /= g.std()
        save_png(128 + 22 * g, f'grain_{i}.png', 'L')


def dust_frames(n=4, w=1920, h=1080):
    for i in range(n):
        rng = np.random.default_rng(2000 + i)
        ss = 1
        A = np.zeros((h, w)); C = np.zeros((h, w))  # C: 1 = white, 0 = black
        im_a = Image.new('L', (w, h), 0); im_c = Image.new('L', (w, h), 0)
        da, dc = ImageDraw.Draw(im_a), ImageDraw.Draw(im_c)
        # specks (irregular blobs)
        for _ in range(rng.integers(18, 34)):
            cx, cy = rng.uniform(0, w), rng.uniform(0, h)
            r = rng.gamma(1.6, 1.3) + 0.6
            k = rng.integers(5, 9)
            ang = np.sort(rng.uniform(0, 2 * np.pi, k))
            rr = r * rng.uniform(0.5, 1.3, k)
            pts = [(cx + rr[j] * np.cos(ang[j]), cy + rr[j] * np.sin(ang[j])) for j in range(k)]
            white = rng.random() < 0.35
            op = int(rng.uniform(110, 230))
            da.polygon(pts, fill=op); dc.polygon(pts, fill=255 if white else 0)
        # hairs
        for _ in range(rng.integers(1, 3)):
            L = rng.uniform(60, 240); m = int(L / 1.5)
            ang = rng.uniform(0, 2 * np.pi) + np.cumsum(rng.normal(0, 0.09, m))
            x = rng.uniform(0, w) + np.cumsum(np.cos(ang) * 1.5); y = rng.uniform(0, h) + np.cumsum(np.sin(ang) * 1.5)
            pts = list(zip(x, y))
            op = int(rng.uniform(90, 170))
            da.line(pts, fill=op, width=int(rng.choice([1, 2]))); dc.line(pts, fill=0, width=2)
        # vertical scratches
        for _ in range(rng.integers(0, 3)):
            x0 = rng.uniform(0, w); y0 = rng.uniform(-100, h * 0.6); y1 = y0 + rng.uniform(h * 0.2, h * 1.2)
            ys = np.linspace(y0, y1, 60)
            xs = x0 + np.cumsum(rng.normal(0, 0.25, 60))
            op = int(rng.uniform(40, 90))
            da.line(list(zip(xs, ys)), fill=op, width=1); dc.line(list(zip(xs, ys)), fill=255, width=1)
        a = np.asarray(im_a.filter(ImageFilter.GaussianBlur(0.6)), np.float64)
        c = np.asarray(im_c.filter(ImageFilter.GaussianBlur(0.6)), np.float64)
        rgba = np.stack([c, c, c * 0.97, a], -1)
        save_png(rgba, f'dust_{i}.png', 'RGBA')


def light_leaks(w=1920, h=1080):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    specs = [
        # (seed, blobs[(cx,cy,rx,ry,color,intensity)])
        (3000, [(-0.05, 0.25, 0.45, 0.75, '#FF6A1A', 1.0), (0.02, 0.85, 0.35, 0.4, '#FF2D55', 0.8),
                (0.12, 0.05, 0.25, 0.3, '#FFD27A', 0.9), (1.05, 0.9, 0.2, 0.35, '#FF8A3D', 0.35)]),
        (3001, [(1.02, 0.35, 0.18, 0.9, '#FF4A1C', 1.0), (0.93, 0.6, 0.08, 0.7, '#FFE0A0', 0.9),
                (0.85, 0.0, 0.3, 0.25, '#FF2F6B', 0.6), (-0.02, 1.0, 0.25, 0.3, '#FFB347', 0.4)]),
    ]
    for i, (seed, blobs) in enumerate(specs):
        img = np.zeros((h, w, 3))
        n = 0.5 + 0.5 * np.tanh(fft_noise(h, w, seed, beta=3.2, fmax=0.004))
        for cx, cy, rx, ry, colr, inten in blobs:
            d2 = ((xx / w - cx) / rx) ** 2 + ((yy / h - cy) / ry) ** 2
            g = np.exp(-d2 * 1.6) * inten
            img += hex_rgb(colr)[None, None, :] * g[..., None]
        img *= (0.55 + 0.9 * n)[..., None]
        img = 255 * (1 - np.exp(-img / 255 * 1.4))   # soft film-like roll-off
        img += np.random.default_rng(seed + 5).normal(0, 1.2, img.shape)
        save_rgb(img, f'leak_{i}.jpg', q=90)


# ----------------------------------------------------------------------------- halftone
def halftone_tile(name, d=8, size=256, radius=0.36, ss=4):
    """45° grid, lattice vectors (d,d),(d,-d) -> seamless for size % (2d) == 0.
    radius as fraction of dot pitch (d*sqrt2)."""
    S = size * ss
    yy, xx = (np.mgrid[0:S, 0:S].astype(np.float64) + 0.5) / ss
    u = (xx + yy) / (2 * d); v = (xx - yy) / (2 * d)
    du = u - np.round(u); dv = v - np.round(v)
    dist = np.sqrt(((du + dv) * d) ** 2 + ((du - dv) * d) ** 2)
    r = radius * d * math.sqrt(2)
    a = np.clip(r - dist + 0.5, 0, 1) * 255
    a = np.asarray(Image.fromarray(to_u8(a), 'L').resize((size, size), Image.LANCZOS), np.float64)
    rgba = np.stack([np.full_like(a, 20), np.full_like(a, 20), np.full_like(a, 20), a], -1)
    save_png(rgba, name, 'RGBA')


def halftone_fade(w=1920, h=540, d=9, ss=3):
    W, H = w * ss, h * ss
    yy, xx = (np.mgrid[0:H, 0:W].astype(np.float64) + 0.5) / ss
    u = (xx + yy) / (2 * d); v = (xx - yy) / (2 * d)
    cu, cv = np.round(u), np.round(v)
    cx = (cu + cv) * d; cy = (cu - cv) * d          # dot centres
    tone = np.clip(1 - cy / h, 0, 1) ** 1.3          # dark at top -> none at bottom
    r = np.sqrt(tone) * d * math.sqrt(2) * 0.56
    dist = np.hypot(xx - cx, yy - cy)
    a = np.clip(r - dist + 0.5, 0, 1) * 255
    a = np.asarray(Image.fromarray(to_u8(a), 'L').resize((w, h), Image.LANCZOS), np.float64)
    save_png(np.stack([np.full_like(a, 20)] * 3 + [a], -1), 'halftone_fade.png', 'RGBA')


# ----------------------------------------------------------------------------- crumple / fold
def crumple(size=2048, seed=5000):
    """Crumpled-paper shading: sum of piecewise-linear random triangulated surfaces (sharp facets & creases),
    lit from the top-left.  Grey 128 = flat -> use with overlay / soft-light."""
    from scipy.spatial import Delaunay
    from scipy.interpolate import LinearNDInterpolator
    rng = np.random.default_rng(seed)
    g = 1024
    gy_, gx_ = np.mgrid[0:g, 0:g].astype(np.float64)
    hgt = np.zeros((g, g))
    for npts, amp in ((40, 90.0), (220, 34.0), (1100, 12.0), (4000, 4.0)):
        pts = rng.uniform(-0.08 * g, 1.08 * g, (npts, 2))
        border = np.array([[-0.2 * g, -0.2 * g], [1.2 * g, -0.2 * g], [-0.2 * g, 1.2 * g], [1.2 * g, 1.2 * g]])
        pts = np.vstack([pts, border])
        z = rng.normal(0, amp, len(pts))
        interp = LinearNDInterpolator(Delaunay(pts), z)
        hgt += interp(gx_, gy_)
    hgt = ndi.gaussian_filter(hgt, 0.6)
    gy, gx = np.gradient(hgt)
    L = np.array([-0.5, -0.65, 0.57]); L /= np.linalg.norm(L)
    nrm = np.sqrt(gx ** 2 + gy ** 2 + 1)
    shade = (-gx * L[0] - gy * L[1] + L[2]) / nrm
    shade -= np.median(shade)
    shade /= np.percentile(np.abs(shade), 99.0)
    im = Image.fromarray(to_u8(128 + 62 * np.clip(shade, -1.4, 1.4)), 'L').resize((size, size), Image.BICUBIC)
    a = np.asarray(im, np.float64) + 2.0 * np.random.default_rng(seed + 1).standard_normal((size, size))
    Image.fromarray(to_u8(a), 'L').convert('RGB').save(os.path.join(OUT, 'crumple.jpg'), quality=92)
    print('wrote crumple.jpg')


def fold(w=1920, h=1080, seed=5100):
    """Map-style fold: one vertical + one horizontal crease with valley/ridge shading (grey 128 base)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    out = np.zeros((h, w))
    for pos, axis, sign in ((w * 0.5 + rng.normal(0, 6), 'x', 1), (h * 0.5 + rng.normal(0, 4), 'y', -1),
                            (w * 0.25 + rng.normal(0, 6), 'x', -1), (w * 0.75 + rng.normal(0, 6), 'x', -1)):
        coord = xx if axis == 'x' else yy
        other = yy if axis == 'x' else xx
        wob = 1.5 * fft_noise(1, int(other.max()) + 1, int(pos), beta=2.5)[0]
        d = coord - pos - wob[other.astype(int)]
        s = 0.9 if pos in (w * 0.5, h * 0.5) else 0.6
        out += sign * s * (np.tanh(d / 3.0) * np.exp(-np.abs(d) / 70.0))     # light one side / dark other
        out -= 0.8 * np.exp(-(d / 1.2) ** 2)                                  # sharp crease line
    out += 0.05 * fft_noise(h, w, seed, beta=2.5, fmax=0.01)
    Image.fromarray(to_u8(128 + 40 * out), 'L').convert('RGB').save(os.path.join(OUT, 'fold.jpg'), quality=92)
    print('wrote fold.jpg')


def stamp_grunge(size=1024, seed=6000):
    """Seamless ink-void mask: alpha=255 where ink should be REMOVED (use destination-out / mask)."""
    fine = fft_noise(size, size, seed, beta=0.6, fmin=0.05, fmax=0.45)
    mid = fft_noise(size, size, seed + 1, beta=1.4, fmin=0.01, fmax=0.12)
    big = fft_noise(size, size, seed + 2, beta=3.0, fmax=0.01)
    v = fine * 0.55 + mid * 0.8 + big * 0.9
    a = np.clip((v - 1.75) * 1.8, 0, 1)                         # voids / pitting
    speck = (fine > 2.9).astype(np.float64) * 0.9
    streak = np.clip(fft_noise(size, size, seed + 3, beta=1.2, fmin=0.01, fmax=0.2, aniso=(0.12, 1.0)) - 2.2, 0, 1)
    a = np.clip(np.maximum.reduce([a, speck, streak * 0.9]), 0, 1)
    a = gblur(a, 0.5)
    rgba = np.stack([np.full_like(a, 255)] * 3 + [a * 255], -1)
    save_png(rgba, 'stamp_grunge.png', 'RGBA')


# ----------------------------------------------------------------------------- main
GROUPS = {
    'paper': lambda: (
        paper('paper_cream.jpg', '#F1E9D8', 11),
        paper('newsprint.jpg', '#E4E0D6', 21, mottle=0.012, cloud=0.012, fibres=1800, fibre_amp=0.03,
              dark_fibres=700, dark_amp=0.10, specks=90, grain=0.016, warm=0.004, showthrough=newsprint_showthrough,
              dark_len=(6, 26), dark_curl=0.05),
        paper('kraft.jpg', '#C8A27A', 31, mottle=0.03, cloud=0.02, fibres=5200, fibre_amp=0.07,
              dark_fibres=6000, dark_amp=0.13, specks=90, grain=0.02, warm=0.012, fibre_len=(10, 70),
              dark_len=(5, 28), dark_curl=0.03)),
    'cardboard': lambda: (cardboard(), cardboard_edge()),
    'tape': lambda: (tape('tape_beige.png', '#E9DDBD', 0.84, 71),
                     tape('tape_white.png', '#FAF8F1', 0.66, 72, w=560, h=128, crepe=0.035),
                     tape('tape_kraft.png', '#C79E6E', 0.93, 73, w=700, h=160, crepe=0.03, opacity_var=0.04)),
    'grain': grain_frames,
    'dust': dust_frames,
    'leak': light_leaks,
    'halftone': lambda: (halftone_tile('halftone_tile.png', d=8), halftone_tile('halftone_tile_fine.png', d=4, radius=0.33),
                         halftone_fade()),
    'crumple': lambda: (crumple(), fold()),
    'stamp': stamp_grunge,
}

if __name__ == '__main__':
    sel = sys.argv[1:] or list(GROUPS)
    for g in sel:
        GROUPS[g]()
