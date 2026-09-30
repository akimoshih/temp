# Cloud wisps for the S2 push-in "flying through clouds" effect: crops of three-globe clouds.png (alpha),
# soft elliptical mask, slight blur, saved as white RGBA PNGs. Deterministic.
import numpy as np
from PIL import Image, ImageFilter
SRC = '/home/user/temp/norway-tv/assets/raw/package/example/clouds/clouds.png'
OUT = '/home/user/temp/norway-tv/comp/assets/A-globe/'
a = np.asarray(Image.open(SRC).convert('RGBA'))[..., 3].astype(np.float32) / 255
H, W = a.shape
cw, ch = 1100, 620
cands = []
for y in range(160, H - ch - 160, 60):
    for x in range(0, W - cw, 80):
        win = a[y:y + ch, x:x + cw]
        # centre-weighted density
        c = win[ch // 4: 3 * ch // 4, cw // 4: 3 * cw // 4]
        score = c.mean() * 1.0 + win.std() * 0.5
        cands.append((score, x, y))
cands.sort(reverse=True)
picked = []
for s, x, y in cands:
    if all(abs(x - px) > cw * 0.9 or abs(y - py) > ch * 0.9 for _, px, py in picked):
        picked.append((s, x, y))
    if len(picked) == 5:
        break
yy, xx = np.mgrid[0:ch, 0:cw]
d = np.sqrt(((xx - cw / 2) / (cw / 2)) ** 2 + ((yy - ch / 2) / (ch / 2)) ** 2)
mask = np.clip((1 - d) / 0.55, 0, 1) ** 1.6
for i, (s, x, y) in enumerate(picked):
    win = a[y:y + ch, x:x + cw]
    al = np.clip((win - 0.08) / 0.8, 0, 1) ** 0.85 * mask
    im = Image.fromarray((al * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4.5))
    al = np.asarray(im).astype(np.float32) / 255
    # slight blue-grey shading in the thin parts, white in the dense core
    rgb = np.stack([225 + 30 * al, 232 + 23 * al, 242 + 13 * al], -1).clip(0, 255)
    out = np.dstack([rgb, al * 255]).astype(np.uint8)
    Image.fromarray(out, 'RGBA').resize((880, 496), Image.LANCZOS).save(OUT + f'cloud_{i}.png', optimize=True)
    print(i, round(s, 3), x, y, round(float(al.mean()), 3))
