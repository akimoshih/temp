#!/usr/bin/env python3
"""Vector assets for the collage kit -> assets/kit/svg/.   python3 assets/kit/tools/make_svg.py
All text is converted to outlines (fontTools) so every SVG is self-contained (safe as <img src>)."""
import os, json, math
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'kit', 'svg')
FONTS = os.path.join(ROOT, 'assets', 'kit', 'fonts')
GEO = os.path.join(ROOT, 'assets', 'geo')
os.makedirs(OUT, exist_ok=True)

C = dict(cream='#F1E9D8', news='#E4E0D6', kraft='#C8A27A', ink='#141414', no_red='#BA0C2F', no_navy='#00205B',
         white='#FFFFFF', aurora='#3CF2B0', yellow='#FFE14D', roc_red='#FE0000', roc_blue='#000095')

_font_cache = {}


def text_path(text, font_file, size, x, y, anchor='middle', tracking=0.0):
    """Return (svg path d, width) for text set on baseline y. anchor: start|middle|end."""
    if font_file not in _font_cache:
        _font_cache[font_file] = TTFont(os.path.join(FONTS, font_file))
    f = _font_cache[font_file]
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
    s = size / upm
    glyphs = [cmap.get(ord(ch), '.notdef') for ch in text]
    adv = [gs[g].width * s + tracking * size for g in glyphs]
    total = sum(adv) - (tracking * size if glyphs else 0)
    x0 = x - (total / 2 if anchor == 'middle' else total if anchor == 'end' else 0)
    pen = SVGPathPen(gs)
    cx = x0
    for g, a in zip(glyphs, adv):
        tp = TransformPen(pen, (s, 0, 0, -s, cx, y))
        gs[g].draw(tp)
        cx += a
    return pen.getCommands(), total


def write(name, body, w, h, vb=None):
    vb = vb or f'0 0 {w} {h}'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">\n{body}\n</svg>\n')
    open(os.path.join(OUT, name), 'w').write(svg)
    print('wrote', name)


# ----------------------------------------------------------------------------- flags
def flag_no_body(x=0, y=0, u=1.0):
    """Norway: 22x16 units; cross 6:1:2:1:12 (horizontal) and 6:1:2:1:6 (vertical)."""
    R = lambda X, Y, W, H, c: f'<rect x="{x + X * u:g}" y="{y + Y * u:g}" width="{W * u:g}" height="{H * u:g}" fill="{c}"/>'
    return ''.join([R(0, 0, 22, 16, C['no_red']),
                    R(6, 0, 4, 16, C['white']), R(0, 6, 22, 4, C['white']),
                    R(7, 0, 2, 16, C['no_navy']), R(0, 7, 22, 2, C['no_navy'])])


def roc_sun(cx, cy, s):
    """ROC white sun in canton units: ray-tip circle r=30, blue ring r=17, white disc r=15 (canton 120x80).
    Twelve rays = the {12/5} star polygon on the r=30 circle (each tip joined to the tips 150° away), built as three
    30°-rotated copies of two crossed rhombi with half-base b = 30·tan(15°) ≈ 8.0385; one ray points straight up."""
    b = 30 * math.tan(math.radians(15))
    rh = f'M {b:.4f},0 L 0,-30 L -{b:.4f},0 L 0,30 Z M 0,{b:.4f} L 30,0 L 0,-{b:.4f} L -30,0 Z'
    rays = ''.join(f'<path d="{rh}" fill="#fff" transform="rotate({a})"/>' for a in (0, 30, 60))
    return (f'<g transform="translate({cx:g},{cy:g}) scale({s:g})">{rays}'
            f'<circle r="17" fill="{C["roc_blue"]}"/><circle r="15" fill="#fff"/></g>')


def flag_roc_body(x=0, y=0, u=1.0):
    """ROC: 3:2 field 240x160 units; canton = 1/4 of the flag (120x80); sun centred in canton."""
    return (f'<rect x="{x:g}" y="{y:g}" width="{240 * u:g}" height="{160 * u:g}" fill="{C["roc_red"]}"/>'
            f'<rect x="{x:g}" y="{y:g}" width="{120 * u:g}" height="{80 * u:g}" fill="{C["roc_blue"]}"/>'
            + roc_sun(x + 60 * u, y + 40 * u, u))


def sticker_rect(name, inner, iw, ih, border, radius, shadow=True, gloss=True, pad=None):
    pad = pad if pad is not None else border + 28
    W, H = iw + 2 * pad, ih + 2 * pad
    ox, oy = pad, pad
    defs = ('<defs>'
            '<filter id="sh" x="-20%" y="-20%" width="140%" height="150%">'
            '<feGaussianBlur in="SourceAlpha" stdDeviation="7"/><feOffset dy="8" result="b"/>'
            '<feFlood flood-color="#000" flood-opacity="0.38"/><feComposite in2="b" operator="in" result="s"/>'
            '<feGaussianBlur in="SourceAlpha" stdDeviation="1.4"/><feOffset dy="1.5" result="b2"/>'
            '<feFlood flood-color="#000" flood-opacity="0.35"/><feComposite in2="b2" operator="in" result="s2"/>'
            '<feMerge><feMergeNode in="s"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
            f'<clipPath id="ic"><rect x="{ox}" y="{oy}" width="{iw}" height="{ih}" rx="{max(2, radius - border)}"/></clipPath>'
            '<linearGradient id="gl" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="#fff" stop-opacity="0.34"/><stop offset="0.42" stop-color="#fff" stop-opacity="0.06"/>'
            '<stop offset="0.43" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.10"/>'
            '</linearGradient></defs>')
    g = (f'<g filter="url(#sh)"><rect x="{ox - border}" y="{oy - border}" width="{iw + 2 * border}" height="{ih + 2 * border}" '
         f'rx="{radius}" fill="#FFFFFF"/>'
         f'<g clip-path="url(#ic)"><g transform="translate({ox},{oy})">{inner}</g></g></g>')
    if gloss:
        g += (f'<rect x="{ox - border}" y="{oy - border}" width="{iw + 2 * border}" height="{ih + 2 * border}" rx="{radius}" '
              f'fill="url(#gl)"/>'
              f'<rect x="{ox - border + 1}" y="{oy - border + 1}" width="{iw + 2 * border - 2}" height="{ih + 2 * border - 2}" '
              f'rx="{radius - 1}" fill="none" stroke="#000" stroke-opacity="0.08" stroke-width="2"/>')
    write(name, defs + g, W, H)


def flags():
    u = 30  # 22x16 -> 660x480
    write('flag_no.svg', flag_no_body(0, 0, 1), 660, 480, vb='0 0 22 16')
    write('flag_roc.svg', flag_roc_body(0, 0, 1), 900, 600, vb='0 0 240 160')
    sticker_rect('sticker_flag_no.svg', f'<g transform="scale({u})">{flag_no_body()}</g>', 22 * u, 16 * u, 34, 46)
    sticker_rect('sticker_flag_roc.svg', f'<g transform="scale(2.75)">{flag_roc_body()}</g>', 660, 440, 34, 46)


# ----------------------------------------------------------------------------- icons
def pin():
    d = 'M50,98 C44,80 18,64 18,38 A32,32 0 1 1 82,38 C82,64 56,80 50,98 Z'
    body = ('<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="0.25">'
            f'<stop offset="0" stop-color="#E0314F"/><stop offset="0.55" stop-color="{C["no_red"]}"/>'
            '<stop offset="1" stop-color="#7E0620"/></linearGradient>'
            '<radialGradient id="ps" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000" stop-opacity="0.45"/>'
            '<stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>'
            '<ellipse cx="50" cy="99" rx="17" ry="4.5" fill="url(#ps)"/>'
            f'<path d="{d}" fill="url(#pg)" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>'
            '<circle cx="50" cy="38" r="12.5" fill="#fff"/>'
            f'<circle cx="50" cy="38" r="5.5" fill="{C["no_navy"]}"/>'
            '<path d="M30,26 A24,24 0 0 1 48,13" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="4" stroke-linecap="round"/>')
    write('pin.svg', body, 200, 208, vb='0 -2 100 104')
    # navy variant (secondary locations)
    write('pin_navy.svg', body.replace('#E0314F', '#1B3F8F').replace(C['no_red'], C['no_navy']).replace('#7E0620', '#00123A')
          .replace(f'fill="{C["no_navy"]}"', f'fill="{C["no_red"]}"'), 200, 208, vb='0 -2 100 104')


PLANE_D = ('M50,2 C53.6,2 55.2,7 55.2,13 L55.2,36 L96,58.5 L96,64.5 L55.2,53.5 L55.2,74 C55.2,78 54.8,82 54.3,85 '
           'L69,93 L69,97 L52.2,93.6 C51.6,96 51,97.6 50,98 C49,97.6 48.4,96 47.8,93.6 L31,97 L31,93 L45.7,85 '
           'C45.2,82 44.8,78 44.8,74 L44.8,53.5 L4,64.5 L4,58.5 L44.8,36 L44.8,13 C44.8,7 46.4,2 50,2 Z '
           'M28,40.5 C28,38.8 29.3,37.6 31,37.6 C32.7,37.6 34,38.8 34,40.5 L34,50.5 C34,52.2 32.7,53.2 31,53.2 '
           'C29.3,53.2 28,52.2 28,50.5 Z '
           'M66,40.5 C66,38.8 67.3,37.6 69,37.6 C70.7,37.6 72,38.8 72,40.5 L72,50.5 C72,52.2 70.7,53.2 69,53.2 '
           'C67.3,53.2 66,52.2 66,50.5 Z')


def airplane():
    """Top-view airliner, nose up (heading 0° = north); rotate to arc tangent."""
    write('airplane.svg', f'<path d="{PLANE_D}" fill="{C["ink"]}"/>', 400, 400, vb='0 0 100 100')
    write('airplane_white.svg', f'<path d="{PLANE_D}" fill="#fff" stroke="{C["ink"]}" stroke-width="3.2" stroke-linejoin="round" paint-order="stroke"/>',
          400, 400, vb='-2 -2 104 104')


PERSON_D = ('M20,0 C25.2,0 29,4.1 29,9.6 C29,15.1 25.2,19.8 20,19.8 C14.8,19.8 11,15.1 11,9.6 C11,4.1 14.8,0 20,0 Z '
            'M3,52 L3,38 C3,28.5 9.5,22.6 20,22.6 C30.5,22.6 37,28.5 37,38 L37,52 Z')


def people():
    write('person.svg', f'<path d="{PERSON_D}" fill="{C["ink"]}"/>', 80, 104, vb='0 0 40 52')


def coin():
    """Generic NOK token (NOT a reproduction of any real coin): brass disc, bead ring, 'kr' + 'NOK'."""
    R = 200
    kr, _ = text_path('kr', 'Anton-400.woff2', 150, 200, 252)
    nok, _ = text_path('NOK', 'SpaceMono-700.woff2', 36, 202, 318, tracking=0.14)
    star = lambda x, y, r: f'M{x},{y-r} L{x+r*0.28},{y-r*0.28} L{x+r},{y} L{x+r*0.28},{y+r*0.28} L{x},{y+r} L{x-r*0.28},{y+r*0.28} L{x-r},{y} L{x-r*0.28},{y-r*0.28} Z'
    top = star(200, 88, 13) + star(92, 200, 9) + star(308, 200, 9)
    beads = ''.join(f'<circle cx="{200 + 168 * math.cos(a):.2f}" cy="{200 + 168 * math.sin(a):.2f}" r="3.2"/>'
                    for a in np.linspace(0, 2 * np.pi, 72, endpoint=False))
    body = ('<defs>'
            '<radialGradient id="cg" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#FFF1BF"/>'
            '<stop offset="0.35" stop-color="#E7C66E"/><stop offset="0.75" stop-color="#B58632"/><stop offset="1" stop-color="#7A551B"/></radialGradient>'
            '<linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF4CC"/>'
            '<stop offset="0.5" stop-color="#B98B38"/><stop offset="1" stop-color="#6B4712"/></linearGradient>'
            '<linearGradient id="tg" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#F6DC8E"/><stop offset="1" stop-color="#BF9038"/></linearGradient>'
            '<filter id="emb"><feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b"/>'
            '<feOffset in="b" dx="-2" dy="-2" result="hi"/><feOffset in="b" dx="2.5" dy="2.5" result="lo"/>'
            '<feFlood flood-color="#FFF7D6" flood-opacity="0.9"/><feComposite in2="hi" operator="in" result="h"/>'
            '<feFlood flood-color="#5A3B0C" flood-opacity="0.85"/><feComposite in2="lo" operator="in" result="l"/>'
            '<feMerge><feMergeNode in="l"/><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
            '<filter id="csh" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="8"/>'
            '<feOffset dy="10"/><feComponentTransfer><feFuncA type="linear" slope="0.45"/></feComponentTransfer>'
            '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
            f'<g filter="url(#csh)"><circle cx="200" cy="200" r="{R - 8}" fill="url(#rg)"/>'
            f'<circle cx="200" cy="200" r="{R - 26}" fill="url(#cg)" stroke="#8E6824" stroke-width="2"/></g>'
            f'<g fill="#C79B45" filter="url(#emb)">{beads}</g>'
            '<circle cx="200" cy="200" r="150" fill="none" stroke="#9C7429" stroke-width="2.5" stroke-opacity="0.8"/>'
            f'<g fill="url(#tg)" filter="url(#emb)"><path d="{kr}"/><path d="{nok}"/><path d="{top}"/></g>'
            '<path d="M120,90 A120,120 0 0 1 250,70" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="10" stroke-linecap="round"/>')
    write('coin_nok.svg', body, 400, 420, vb='0 0 400 420')


def die_cut_circle(name, inner, r=180, border=20):
    S = 2 * (r + border) + 60
    c = S / 2
    defs = ('<filter id="sh" x="-20%" y="-20%" width="140%" height="150%">'
            '<feGaussianBlur in="SourceAlpha" stdDeviation="7"/><feOffset dy="9" result="b"/>'
            '<feFlood flood-color="#000" flood-opacity="0.38"/><feComposite in2="b" operator="in" result="s"/>'
            '<feGaussianBlur in="SourceAlpha" stdDeviation="1.3"/><feOffset dy="1.5" result="b2"/>'
            '<feFlood flood-color="#000" flood-opacity="0.3"/><feComposite in2="b2" operator="in" result="s2"/>'
            '<feMerge><feMergeNode in="s"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
            f'<clipPath id="cc"><circle cx="{c}" cy="{c}" r="{r}"/></clipPath>'
            '<linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.30"/>'
            '<stop offset="0.45" stop-color="#fff" stop-opacity="0.04"/><stop offset="0.46" stop-color="#fff" stop-opacity="0"/>'
            '<stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient>')
    body = (f'<defs>{defs}{inner[0]}</defs><g filter="url(#sh)"><circle cx="{c}" cy="{c}" r="{r + border}" fill="#fff"/>'
            f'<g clip-path="url(#cc)"><g transform="translate({c - 200},{c - 200})">{inner[1]}</g></g></g>'
            f'<circle cx="{c}" cy="{c}" r="{r + border}" fill="url(#gl)"/>')
    write(name, body, int(S), int(S))


def aurora_icon():
    rng = np.random.default_rng(7)
    defs = ('<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#020A1F"/>'
            f'<stop offset="0.6" stop-color="{C["no_navy"]}"/><stop offset="1" stop-color="#0B3A66"/></linearGradient>'
            '<linearGradient id="ray" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3CF2B0" stop-opacity="0.95"/>'
            '<stop offset="0.45" stop-color="#3CF2B0" stop-opacity="0.45"/><stop offset="0.8" stop-color="#9B6CFF" stop-opacity="0.22"/>'
            '<stop offset="1" stop-color="#9B6CFF" stop-opacity="0"/></linearGradient>'
            '<filter id="glow"><feGaussianBlur stdDeviation="3"/></filter>')
    g = ['<rect x="0" y="0" width="400" height="400" fill="url(#sky)"/>']
    stars = ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" fill="#fff" fill-opacity="{o:.2f}"/>'
                    for x, y, r, o in zip(rng.uniform(20, 380, 70), rng.uniform(10, 240, 70), rng.uniform(0.5, 1.8, 70),
                                          rng.uniform(0.4, 1, 70)))
    g.append(stars)
    for k, (base, amp, ph, L) in enumerate(((245, 34, 0.3, 150), (205, 24, 2.1, 115))):
        lines = []
        for x in np.arange(-10, 412, 2.2):
            y = base + amp * math.sin(x / 70 + ph) + 10 * math.sin(x / 23 + ph * 3)
            ln = L * (0.55 + 0.45 * (0.5 + 0.5 * math.sin(x / 31 + k))) * rng.uniform(0.8, 1.1)
            lines.append(f'<rect x="{x:.1f}" y="{y - ln:.1f}" width="2.4" height="{ln:.1f}" fill="url(#ray)" '
                         f'fill-opacity="{rng.uniform(0.35, 0.8):.2f}"/>')
        g.append(f'<g filter="url(#glow)">{"".join(lines)}</g><g opacity="0.55">{"".join(lines[::2])}</g>')
    # mountains (Lofoten-ish peaks) + snow
    mtn = 'M-10,410 L-10,300 L40,262 L78,300 L120,238 L150,270 L182,248 L236,312 L276,272 L318,300 L352,258 L410,305 L410,410 Z'
    g.append(f'<path d="{mtn}" fill="#030B1C"/>')
    g.append('<path d="M120,238 L106,256 L118,252 L126,262 L134,250 Z M40,262 L30,272 L42,270 L50,276 Z M352,258 L341,270 L352,267 L362,272 Z" fill="#DDE8F5" fill-opacity="0.8"/>')
    g.append('<rect x="0" y="352" width="400" height="60" fill="#061530"/>')
    g.append('<path d="M0,352 L400,352" stroke="#3CF2B0" stroke-opacity="0.35" stroke-width="2"/>')
    die_cut_circle('sticker_aurora.svg', (defs, ''.join(g)))


def midnight_sun_icon():
    defs = ('<linearGradient id="sky2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B3A8C"/>'
            '<stop offset="0.45" stop-color="#E35D6A"/><stop offset="0.72" stop-color="#FFB45C"/><stop offset="1" stop-color="#FFE9A8"/></linearGradient>'
            '<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2E6B"/><stop offset="1" stop-color="#00205B"/></linearGradient>'
            '<radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFF8D6"/><stop offset="0.7" stop-color="#FFE14D"/>'
            '<stop offset="1" stop-color="#FFB23F"/></radialGradient>'
            '<radialGradient id="halo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#FFE9A0" stop-opacity="0.9"/>'
            '<stop offset="1" stop-color="#FFE9A0" stop-opacity="0"/></radialGradient>')
    g = ['<rect width="400" height="400" fill="url(#sky2)"/>',
         '<circle cx="200" cy="262" r="150" fill="url(#halo)"/>']
    rays = ''.join(f'<path d="M200,262 L{200 + 260 * math.cos(a - 0.05):.1f},{262 + 260 * math.sin(a - 0.05):.1f} '
                   f'L{200 + 260 * math.cos(a + 0.05):.1f},{262 + 260 * math.sin(a + 0.05):.1f} Z" fill="#FFF3C4" fill-opacity="0.22"/>'
                   for a in np.linspace(math.pi, 2 * math.pi, 13))
    g.append(rays)
    g.append('<circle cx="200" cy="262" r="62" fill="url(#sun)"/>')
    g.append('<path d="M-10,275 L60,226 L96,250 L150,206 L196,262 L-10,262 Z" fill="#1A1440" fill-opacity="0.85"/>')
    g.append('<rect x="0" y="262" width="400" height="150" fill="url(#sea)"/>')
    for i, (w, y) in enumerate(((110, 272), (86, 286), (130, 300), (64, 315), (92, 332), (48, 350), (70, 368))):
        g.append(f'<rect x="{200 - w / 2}" y="{y}" width="{w}" height="{5 - i * 0.4:.1f}" rx="2" fill="#FFD66B" fill-opacity="{0.9 - i * 0.1:.2f}"/>')
    h24, _ = text_path('24H', 'SpaceMono-700.woff2', 44, 200, 96, tracking=0.08)
    g.append(f'<path d="{h24}" fill="#fff" fill-opacity="0.92"/>')
    g.append('<path d="M142,110 A72,72 0 0 1 258,110" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="4" '
             'stroke-linecap="round" stroke-dasharray="1 12"/>')
    die_cut_circle('sticker_midnight_sun.svg', (defs, ''.join(g)))


# ----------------------------------------------------------------------------- silhouettes (equal-area, km)
def laea(lon, lat, lon0, lat0):
    R = 6371.0088
    lam, phi = np.radians(lon), np.radians(lat)
    l0, p0 = math.radians(lon0), math.radians(lat0)
    k = np.sqrt(2 / (1 + math.sin(p0) * np.sin(phi) + math.cos(p0) * np.cos(phi) * np.cos(lam - l0)))
    x = R * k * np.cos(phi) * np.sin(lam - l0)
    y = R * k * (math.cos(p0) * np.sin(phi) - math.sin(p0) * np.cos(phi) * np.cos(lam - l0))
    return x, -y


def silhouettes():
    meta = {}
    for key, fn, part, lon0, lat0 in (('norway', 'norway_outline_simplified.geojson', 'mainland', 15.0, 65.0),
                                      ('taiwan', 'taiwan_outline_simplified.geojson', 'main_island', 120.97, 23.7)):
        path = os.path.join(GEO, fn)
        if not os.path.exists(path):
            print('skip', key); continue
        d = json.load(open(path))
        feats = [f for f in d['features'] if f['properties'].get('part') == part]
        # take the most detailed MultiPolygon/Polygon for the part (first match)
        geom = feats[0]['geometry']
        polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
        rings, area = [], 0.0
        xs_all, ys_all = [], []
        for poly in polys:
            for ri, ring in enumerate(poly):
                a = np.array(ring)
                x, y = laea(a[:, 0], a[:, 1], lon0, lat0)
                rings.append((x, y)); xs_all.append(x); ys_all.append(y)
                sa = 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)
                area += -sa if ri == 0 else sa  # y flipped
        xs = np.concatenate(xs_all); ys = np.concatenate(ys_all)
        minx, miny = xs.min(), ys.min()
        W, H = xs.max() - minx, ys.max() - miny
        dstr = ' '.join('M' + ' L'.join(f'{px - minx:.2f},{py - miny:.2f}' for px, py in zip(x, y)) + ' Z' for x, y in rings)
        write(f'{key}_silhouette.svg', f'<path d="{dstr}" fill="{C["ink"]}" fill-rule="evenodd"/>',
              round(W), round(H), vb=f'0 0 {W:.2f} {H:.2f}')
        meta[key] = dict(width_km=round(W, 2), height_km=round(H, 2), area_km2_polygon=round(abs(area)),
                         projection=f'Lambert azimuthal equal-area centred {lon0},{lat0}; 1 SVG unit = 1 km',
                         source=f'assets/geo/{fn} part={part}')
    json.dump(meta, open(os.path.join(OUT, 'silhouettes.json'), 'w'), indent=1)
    print(meta)


if __name__ == '__main__':
    flags(); pin(); airplane(); people(); coin(); aurora_icon(); midnight_sun_icon(); silhouettes()
