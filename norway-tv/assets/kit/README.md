# Collage kit: NORWAY in 30s

This kit gives you editorial cut-out collage parts for the frame-by-frame HTML compositor: torn paper, halftone prints, tape, stamps, stickers, hand-drawn marker strokes and film texture. Everything in it is **deterministic**. There is no `Math.random`, no `Date`, and no CSS animations or transitions (`kit.css` even disables them with `!important`). Every visual is a pure function of `(frame, seed, options)`.

```
assets/kit/
  fonts/        10 local woff2 faces + fonts.css + charset.txt + LICENSES.txt
  textures/     procedural PNG/JPEG (papers, tape, grain, dust, leaks, halftone, crumple, stamp grunge)
  svg/          flags (exact geometry), die-cut stickers, pin, airplane, person, NOK token, silhouettes
  prerendered/  PNG exports of stamps, boarding pass, torn plates, stickers (if you'd rather not use canvas)
  collage.js    the library (classic script -> window.Collage)
  collage.mjs   ES-module entry (import Collage from '.../collage.mjs')
  kit.css       classes + palette + typography scale
  preview.html  look-dev boards: ?board=title|fact|reveal|kit|marker|type|export
  tools/        build_fonts.py, make_textures.py, make_svg.py, render_preview.js, export_png.js
```

## Quick start (compositor page)

```html
<link rel="stylesheet" href="../assets/kit/fonts/fonts.css">
<link rel="stylesheet" href="../assets/kit/kit.css">
<script src="../assets/kit/collage.js"></script>
<script>
(async () => {
  const C = Collage;
  // fonts + the kit's own textures; extra images: page-relative, or 'kit:' prefix for kit files
  await C.ready({ oslo: '../assets/geo/crops/oslo.jpg', roc: 'kit:svg/sticker_flag_roc.svg' });
  const stage = document.querySelector('.stage');

  // build DOM ONCE
  const plate = Object.assign(document.createElement('div'), { className: 'paper paper--red crumple center f-sans c-white t-xl', textContent: '挪威' });
  Object.assign(plate.style, { position: 'absolute', left: '520px', top: '250px', width: '900px', height: '380px' });
  stage.appendChild(plate);
  const title = C.tornPaper(plate, { seed: 'title', edges: 'tb' });      // returns the wrapper to animate
  const overlay = C.canvas(1920, 1080); overlay.style.cssText = 'position:absolute;left:0;top:0'; stage.appendChild(overlay);
  const g = overlay.getContext('2d');
  const stamp = C.makeStamp('norge', { color: '#FFFFFF' });
  const film = await C.createFilmLayer(stage, { grain: 0.2, dust: 0.7 });  // pre-decoded, on top

  window.renderFrame = async (f) => {
    const T = 224;                                                  // DROP
    C.place(title, { rotate: -1 }, C.slamAt(f, T, { dur: 5 }), C.jitter('title', f, 2));
    stage.style.transform = C.shake('drop', f, T + 3, { amp: 20 }).css;
    g.clearRect(0, 0, 1920, 1080);
    C.marker.underline(g, { x1: 640, x2: 1300, y: 845, color: C.colors.yellow, width: 16, progress: C.prog(f, T + 12, 7), seed: 'ul' });
    C.drawStamp(g, stamp, 1560, 690, C.progRaw(f, T + 14, 6), { rot: -12, scale: 0.6, composite: 'source-over' });
    film.render(f);
  };
  window.compReady = true;
})();
</script>
```

The rules that keep renders deterministic and fast:
- Build elements once and only change transforms, opacity, `textContent` and canvas drawing inside `renderFrame`.
- `C.place(el, base, ...mods)` combines transform objects: it adds `x/y/rotate`, multiplies `scale/opacity`, and hides the element if any modifier says `visible:false`.
- Cut-outs move **on twos** through `C.jitter(seed, f, amp)`. Camera moves and globe motion stay smooth at 30 fps (`C.shake`, `C.wander`).
- Don't swap `img.src` per frame, because decode is async and can land after the screenshot. Pre-decode images and toggle their visibility, as `createFilmLayer` does.
- Expensive canvases (`halftone`, `tornPaper(canvas)`, `makeStamp`, `sticker`, `boardingPass`) are cached. Create them at setup. Animated push-ins on a halftone print should scale the cached canvas with a CSS transform, so the dots scale like a real print.
- The recorder already passes `--allow-file-access-from-files`. `halftone()` and `duotone()` need it, because they read pixels from `file://` images.

## API (`window.Collage`, abbreviated `C`)

### Timing and PRNG
| call | returns |
|---|---|
| `C.FPS=30, C.BEAT=14, C.BAR=56`, `C.beat(n)`, `C.bar(k)` | frame numbers from the SPEC tempo |
| `C.prog(f, start, dur)` | 0..1, clamped. `C.progRaw` is unclamped (<0 before start, which presets treat as hidden) |
| `C.onTwos(f)` / `C.onN(f, n)` | frame quantised to 2 or n (hold frames) |
| `C.hash(...)`, `C.rand(...)` [0,1), `C.srand(...)` [-1,1) | stateless hashes. Arguments can be numbers or strings: `C.rand('pin', f)` |
| `C.rng(seed)` | stream `{next, range, int, pick, sign, normal}` (mulberry32) |
| `C.noise1(seed, x)`, `C.fbm1(seed, x, oct)` | smooth 1-D value noise [-1,1] |
| `C.jitter(seed, f, amp=2, rotAmp=amp*0.3)` | `{x,y,r,css}`, constant over each 2-frame hold (stop-motion) |
| `C.wander(seed, f, amp, speed)` | smooth drift (gate weave, floating) |
| `C.shake(seed, f, hitFrame, {amp=16, decay=7})` | decaying camera shake `{x,y,r,css}` |
| `C.film(f)` | `{grainIndex, grainOffset, dust, dustOffset, weave:{css}, flicker}`. Put `weave.css` on the whole comp for subtle gate weave |

### Easing, springs, presets
- `C.ease.{linear,inQuad,outQuad,inOutQuad,inCubic,outCubic,inOutCubic,outQuart,outQuint,inExpo,outExpo,inOutExpo,outCirc,inBack,outBack(t,s),inOutBack,overshoot,outElastic(t,amp,period),outBounce,smooth,steps(t,n)}`
- `C.spring(tSeconds, {from=0,to=1,stiffness=170,damping=14,mass=1,velocity=0})` is an analytic damped spring (under-, critically and over-damped cases). `C.springF(frames, opts)` takes frames instead of seconds.
- `C.settle(p)` is a damped curve with f(0)=1, f(1)=0 and one undershoot.
- Presets return `{scale, rotate, x, y, opacity, visible, css}`:
  - `C.snapIn(p, {from=1.3, rot0, rot=0, drop})` goes 1.30 → 0.95 → 1.00. `C.snapInAt(f, start, {dur=4})` takes frames (use 3–5).
  - `C.popOut(p)` / `C.popOutAt(f, start, {dur=3})` is a quick exit.
  - `C.slam(p)` / `C.slamAt(f, start, {dur=5, from=2.4})` is the heavy title slam (scale 2.4 → 1 with a squash). `.impact` is true after the hit.
  - `C.stampFx(p)` (alias `C.stamp(p)`) / `C.stampAt(f, start, {dur=6})` is the rubber-stamp thunk: scale 1.9 → 0.93 on impact at p=.35 → 1, plus `inkSpread` (1 at impact, settling to 0.15), `blur`, `opacity` and a twist.

### Text
- `C.formatNumber(8694)` gives `'8,694'`. Options: `{decimals, sep, dot}`.
- `C.countUp(to, p, {from, decimals, ease=outExpo, prefix, suffix})` returns a formatted string. `C.countUpAt(to, f, start, end)` takes frames.
- `C.toWan(5630000)` gives `{value:563, unit:'萬', text:'563 萬'}`.
- `C.typeSchedule(text, start, end)` returns the frame at which each grapheme appears, with longer holds after `，。？！…`. Give this schedule to the typewriter-click SFX.
- `C.typewriterAt(text, f, start, end)` returns `{text, count, total, done, justTyped, cursorOn}`. `C.typewriter(text, p)` is the progress-based version. Both are grapheme-safe for CJK and emoji.
- `C.graphemes(s)`, `C.spacedText(ctx, text, cx, y, tracking)` and `C.spacedTextLeft(...)` are canvas letter-spacing helpers.

### Torn paper
- `C.tornPaper(element, opts)` wraps a DOM element in `<div class="torn-wrap">`. The wrapper inherits the element's `left/top/transform`. The element is clipped to the inner torn polygon, and a rim-and-shadow canvas sits behind it. **Animate the returned wrapper.**
- `C.tornPaper(imageOrCanvas | null, opts)` returns a new canvas cut-out (content + white fibre rim + soft shadow). It has `.pad` (default 40), `.plateW`, `.plateH` and `.path` properties. Use `null` with `{width, height, fill, texture:'paper'|'newsprint'|'kraft'}` for a blank plate.
- Options: `{seed, roughness=1, rim=7 (px width of white core), edges:'all'|'tb'|'lr'|'t'|'lrb'…, bite=1, shadow:{x,y,blur,color}|false, rimColor, fibres=true, fit:'cover'|'stretch', focus, crop, zoom, cacheKey}`. Edges not listed in `edges` stay as clean cuts. Mixing torn and cut edges looks more real than tearing all four.
- Lower-level: `C.tornPath(w,h,opts)` returns `{outer, inner}`. `C.clipPathCss(pts)` gives a CSS `polygon()`. `C.tornRim(w,h,opts)` returns the backing canvas.
- Markup shortcut: add `class="torn" data-seed="x" data-edges="tb" data-rim="8"` to elements and call `C.tornAll(root)`.

### Halftone and print
- `C.halftone(img, opts)` returns a canvas: an AM halftone (classic round-to-checker dot, antialiased, ragged dot gain) printed on paper. It is cached. A 1920×1080 print takes about 250 ms the first time and 0.1 ms from cache.
  Options: `{width, height, crop:{x,y,w,h}, focus:{x,y}, zoom, dot=9, angle=45, ink='#141414', paper='#F1E9D8'|null (transparent), paperTexture:true|'newsprint'|img, contrast=1.2, brightness, gamma, rough=0.06, mode:'mono'|'duotone', ink2, angle2=15, dot2, misreg=[2,-1], tone2:'mid'|'shadow'|'light'|'same', tint}`.
- `C.duotone(img, {dark, light, contrast, grain})` is a continuous-tone duotone, for example a navy/cream satellite backdrop.
- `C.printCutout(img, {...halftoneOpts, torn:{...tornOpts}})` does halftone plus torn edge in one step.
- CSS alternatives: `.halftone-dots` and `.halftone-fade` are masks, so they take any `color`.

### Marker strokes (canvas, progressive reveal)
Every function draws into a 2D context. Common options are `{color, width, progress 0..1, seed, alpha, composite, frame, boil}`. Set `boil` (px) together with `frame` to re-seed the fine wobble on twos (line boil).
- `C.marker.circle(ctx, {cx, cy, rx, ry, rotation, turns=1.16, start, irregular=.07, spiral=.09})` is a loose ellipse that overshoots its start.
- `C.marker.arrow(ctx, {x1, y1, x2, y2, bend=.18, head, headAngle=28})` draws the shaft first, then two head strokes.
- `C.marker.underline(ctx, {x1, x2, y, double, gap, slope, sag})`.
- `C.marker.starburst(ctx, {cx, cy, r1, r2, rays, from, to})` draws emphasis rays, revealed one by one. `C.marker.burst(ctx, {cx, cy, r1, r2, points})` is a spiky outline.
- `C.marker.highlight(ctx, {x, y, w, h, passes})` is a chisel highlighter with multiply blending and ink pooling at the ends. `C.marker.scribble(ctx, {x, y, w, h, loops, slant})` is a loopy scribble fill.
- `C.marker.cross`, `C.marker.check` and the generic `C.markerPath(ctx, points, opts)` are also available.
- The highlighter and scribble default to `multiply`, which is right on paper. Over dark satellite imagery, pass `composite:'source-over'`.

### Stamps
- `C.makeStamp(presetOrSpec, overrides)` returns a cached canvas with rough edges (SVG displacement), grunge voids, uneven pressure and a misregistered ghost strike.
- Presets: `heritage` (世界遺產 WORLD HERITAGE, red), `norge` (KONGERIKET · 挪威 · NORGE, navy), `ssr` (稀有度 RARITY SSR ★★★★★), `oslo` (postmark with cancellation waves), `taiwan` (TAIWAN · 台灣 · FORMOSA, ROC blue), `approved`.
- Overrides: `{color, ink=.9, wear=1, ghost=.28, misreg=[x,y], seed}`. A custom spec looks like `{shape:'rect'|'circle'|'postmark', w, h, lines:[{text, font:'serif'|'sans'|'anton'|'mono'|'hand', size, y, track}], top, bottom, center, radius}`.
- `C.drawStamp(ctx, stampCanvas, x, y, p, {rot, scale, composite='multiply'})` draws the stamp with the thunk and ink spread. Use `composite:'source-over'` plus a light colour on dark backgrounds.

### Stickers, glyphs, boarding pass
- `C.sticker(imgOrCanvas, {border=14, color:'#fff', shadow, gloss})` returns a die-cut sticker canvas from any alpha shape. For CSS, use `.sticker` (white outline plus shadow via stacked drop-shadows) on text or SVG.
- `C.drawPlane(ctx, x, y, headingDeg (0 = north), size, color, {outline})`, `C.drawPerson(ctx, x, y, h, color)`, and `C.drawCrowd(ctx, {x, y, cols, rows, size, gap, mode:'people'|'dots', progress, highlight:i=>color|null})` for the 1-in-N visual. `C.PATHS` holds the SVG path data.
- `C.boardingPass({from:'TPE', to:'OSL', fromCity, toCity, passenger:'YOU', flight:'30SEC', date, seat, gate, boarding, cls})` returns a 1680×680 canvas: generic, no airline branding, with barcode and 2-D code. `.stubX` marks the perforation, if you want to tear the stub off.
- `C.drawBarcode(ctx, x, y, w, h, seed)` and `C.drawCode2D(...)` draw decorative codes.

### Film overlay
`await C.createFilmLayer(parent, {grain=.2, dust=.75, leak=0, vignette=true, zIndex})` returns `{el, render(f, {grain, dust, leak, leakIndex})}`. It pre-decodes 8 grain frames, 4 dust frames and 2 leaks, then toggles visibility each frame. Grain changes every frame and never repeats back-to-back. Dust changes on twos.

## CSS (`kit.css`)
- **Palette variables:** `--cream --newsprint --kraft --ink --no-red --no-navy --aurora --hl-yellow --roc-red --roc-blue`. Colour classes are `.c-*` for text and `.bg-*` for backgrounds.
- **Type:**
  - Families: `.f-sans` (Noto Sans TC 900), `.f-sans-b` (700), `.f-sans-m` (500), `.f-serif` (Noto Serif TC 900), `.f-anton`, `.f-mono` (Space Mono 700), `.f-hand` (LXGW WenKai TC 700), `.f-marker` (Permanent Marker).
  - Scale for 1080p: `.t-mega 300`, `.t-xxl 220`, `.t-xl 160`, `.t-l 112`, `.t-m 80`, `.t-s 56`, `.t-xs 40`, `.t-body 32`, `.t-cap 24`, `.t-foot 19` (px).
  - Canvas equivalent: `C.font('sans'|'serif'|'anton'|'mono'|'hand'|'marker', px, weight)`.
- **Paper:** `.paper` plus one of `--cream --newsprint --kraft --cardboard --white --red --navy --yellow --aurora --ink`. Add `.crumple` (or `--heavy`/`--light`) or `.fold` for shading. The element must be positioned. `.shadow-paper`, `.shadow-lift` and `.shadow-flat` are filter shadows.
- **Tape:** `.tape` plus `--white` or `--kraft`, sizes `--sm`/`--lg`, and corner placements `--tl --tr --bl --br --top` (tweak with `--tr`). `.tape-label` is a text-bearing tape strip for kickers like 「30 秒認識一個國家」.
- **Labels:** `.sticker`, `.sticker--thin`, `.sticker-pill`, `.stamp`, `.clipping` (with `__kicker`, `__headline`, `__deck`, `__body`, `__meta`), `.marker-label` (with `--red`, `--white`, `--cjk`, `--hl`), `.dymo`, `.kicker`, `.cut-letter` (see `C.cutLetters(el, {seed})` for ransom-note letters), and `.footnote` (source line inside title-safe, bottom-left).
- **Overlays:** `.overlay .grain-overlay` (overlay .2), `.dust-overlay`, `.leak-overlay` (screen), `.crumple-overlay`, `.vignette`.
- **Layout:** `.safe` is the 96/54 px title-safe box. `.stage`, `.layer`, `.abs`, `.rel` and `.center` are also available.

## Assets

### Fonts
There are ten woff2 faces, about 7.5 MB in total. Each CJK face is subset to 6,520 code points: ASCII, Latin-1, Latin Ext-A, typographic punctuation, CJK punctuation, full-width forms, Bopomofo, Big5 symbols, the **5,401 Big5 level-1 常用字**, plus every character found in SPEC.md, facts/*.json, comp/** and the kit. If new text needs a missing glyph, run `python3 assets/kit/tools/build_fonts.py` again. It rescans those files. The full TTFs are cached in `tmp/kit/ttf` and are re-downloaded if missing. Verification: the `type` board and a cmap check both show every spec character present in all CJK faces.

### Textures
| file | use |
|---|---|
| `paper_cream.jpg`, `newsprint.jpg` (faint mirrored show-through print), `kraft.jpg`, `cardboard.jpg` | 1536² seamless tiles |
| `cardboard_edge.png` | torn corrugated edge strip |
| `tape_beige.png`, `tape_white.png`, `tape_kraft.png` | RGBA, crepe texture, torn ends |
| `grain_0..7.png` | 1920×1080 grey noise, mean 128. Overlay or soft-light blend |
| `dust_0..3.png` | RGBA specks, hairs and scratches |
| `leak_0..1.jpg` | screen blend |
| `halftone_tile.png`, `halftone_tile_fine.png` | 256² seamless 45° tiles |
| `halftone_fade.png` | halftone gradient |
| `crumple.jpg` | multi-octave facet shading, grey 128. Soft-light blend |
| `fold.jpg` | map folds |
| `stamp_grunge.png` | seamless void mask |

### SVG
- **Flags.** `flag_no.svg` is 22×16 with the cross at 6:1:2:1:12 × 6:1:2:1:6, #BA0C2F / #00205B. `flag_roc.svg` is 3:2: the canton is ½ × ½ of the flag, and the sun is centred in the canton. The ray tips sit on r=30 (half the canton width), with the blue ring at r=17 and the white disc at r=15 (ring = 1/15 of the disc diameter). The 12 rays are the exact {12/5} star (rhombus half-base 30·tan15°), with one ray pointing up, #FE0000 / #000095. `sticker_flag_no.svg` and `sticker_flag_roc.svg` add a white die-cut border, shadow and gloss.
- **Icons.** `pin.svg`, `pin_navy.svg`, `airplane.svg` and `airplane_white.svg` (top view, nose up), `person.svg`, `coin_nok.svg` (a generic brass token with 'kr' and 'NOK', not a reproduction of any coin), and the round stickers `sticker_aurora.svg` and `sticker_midnight_sun.svg`.
- **Silhouettes.** `norway_silhouette.svg` and `taiwan_silhouette.svg` are Lambert equal-area projections, each centred on its own country, at **1 SVG unit = 1 km**. They share a scale, so a stack of Taiwans next to Norway compares true areas. Sizes are in `silhouettes.json`. All SVG text is converted to outlines, so the files are safe to use in `<img>`.

### Prerendered
`prerendered/*.png` holds the stamps (red, navy and white/yellow variants), `boarding_pass.png`, four torn plates, the Taiwan sticker and the plane sticker. Regenerate them with `node tools/export_png.js`.

## Look-dev and regeneration
```
python3 assets/kit/tools/make_textures.py [paper cardboard tape grain dust leak halftone crumple stamp]
python3 assets/kit/tools/make_svg.py
NODE_PATH=/opt/node22/lib/node_modules node assets/kit/tools/render_preview.js            # -> tmp/kit/preview/*.png
NODE_PATH=/opt/node22/lib/node_modules node assets/kit/tools/render_preview.js title:0,5,40 marker:20
NODE_PATH=/opt/node22/lib/node_modules node assets/kit/tools/export_png.js
```

## Performance notes (measured on this machine)
- A preview board's `render(f)` JavaScript takes about 20 ms.
- **PNG screenshot encoding of a grainy 1080p frame takes about 1.0–1.3 s.** A JPEG screenshot (`type:'jpeg', quality:95`) of the same frame takes about 0.15–0.25 s. If the recorder's throughput matters, use JPEG q95–100 intermediates, or add grain in ffmpeg and keep page grain at 0.
- Blend modes (`overlay`, `soft-light`, `multiply`) and CSS `drop-shadow` filters cost CPU raster time, and there is no GPU. Use them on the cut-outs that matter, and keep the film layer to one full-frame blended image per frame (which `createFilmLayer` already does).

## Licences and attribution
Fonts are SIL OFL 1.1, except Permanent Marker, which is Apache 2.0 (see `fonts/LICENSES.txt`). All textures and vectors were generated here from code; no third-party imagery was used. The preview boards use the project's Sentinel-2 crops, so the end card needs to credit "Contains modified Copernicus Sentinel data [year]" (SPEC §7).
