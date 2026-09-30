/* S5 QUICKFIRE (f504–559) + S8 OUTRO (f784–899). Owner: D-quickfire-outro. Full frame, z 30.
 *
 *   S5  four stacking collage cards on a navy satellite-halftone desk, one per paper_slap/music_stab cue
 *       (f504, 518, 532, 546; read from audio/cues.json). Each card lands ON its cue frame (overshoot -> squash
 *       -> settle), with flash + shake; secondaries pop on the following frames; the pile shifts when the next
 *       card lands.  FACT 05 貨幣 挪威克朗 NOK (NOK token coin drop + guilloche card) · FACT 06 語言 挪威語 Norsk
 *       (speech-bubble sticker) · FACT 07 冬季 極光 (renders/terrain/aurora local 0–13 ↔ f532–545 inside a photo
 *       print; fallback: crops/lofoten.jpg night-graded + aurora sticker) · FACT 08 夏季 午夜太陽 (crops/tromso.jpg
 *       warm-graded print + text-free midnight-sun sticker + 12 even marker rays + pin on Tromsø centre).
 *   S8  f784–839 recap: 8 collage cuts on the stutter_cuts cues (784…833), each with its own frame/tilt/paper,
 *       energy building under the reverse cymbal (812→840: camera creep 1.03→1.11, slam overshoot growing to ~1.2,
 *       horizontal whip smear on the entry frames of cuts 5–8): geiranger plate (local 56–68, double speed), Oslo
 *       colour clipping + pin, aurora plate (local 20–44, 4× speed) polaroid, Lofoten postage stamp + ink postmark,
 *       Lysefjord film strip, Tromsø warm strip, globe plates f176–182 through a torn-paper window, title 挪威 NORWAY.
 *       Red label-maker FACT callbacks (04 / 01 / 07 / 08) on cuts 1, 2, 3, 6.
 *       f840 FINAL HIT (impact_final): end card over comp/assets/D-quickfire-outro/endcard_backdrop.jpg (orthographic
 *       Sentinel-2 mosaic view of Scandinavia with 120/90 px bleed, built by make_endcard_backdrop.py; projection in
 *       endcard_backdrop.json) so the whole of Norway sits above the credits: Velkommen til Norge · 歡迎來到挪威,
 *       下一站，出發！, NO + ROC flag stickers, stamp, tape, Norway outline marker
 *       (comp/assets/A-globe/norway_border_generalized.json, read-only; geojson fallback), Oslo pin + departing plane,
 *       credits (facts credits_line + imagery attributions + Natural Earth, Space Mono Regular 20 px) static from f840
 *       (global fade to black f885–899 is done by core.js).
 * Kit sticker_midnight_sun.svg has '24H' baked in (not in facts.json): a text-free copy lives in this section's assets.
 * Raster budget: papers/plates/tapes/shadows are baked into canvases (no CSS blur/blend stacks); a buried S5 card is
 * swapped for a baked half-res snapshot (torn body + shadow + static picture), the desk is 4 integer-translated strips
 * -> ~0.2–0.8 s/frame incl. JPEG screenshot. Every recap/end-card background has bleed (no edge gaps under shake).
 * Missing plates fall back automatically (X.exists): aurora -> night-graded Lofoten crop (+ aurora sticker, fallback
 * only), geiranger -> crop, globe -> nearest existing frame / f0207, end-card backdrop -> globe plate f0207.
 * All wording/numbers come from facts.json (onscreen.* / copy.* / credits_line / imagery_attributions).
 * render(f) is a pure function of f.
 */
(function () {
  'use strict';
  const W = 1920, H = 1080;
  const RED = '#BA0C2F', NAVY = '#00205B', CREAM = '#F1E9D8', INK = '#141414', YEL = '#FFE14D';
  const GEO = '../assets/geo/';
  const OWN = 'assets/D-quickfire-outro/';
  const KIT = s => window.Collage.asset(s);
  // default cue frames (overridden from audio/cues.json in init)
  const Q = { start: 504, end: 559, beats: [504, 518, 532, 546] };
  const O = { start: 784, cuts: [784, 791, 798, 805, 812, 819, 826, 833], hit: 840, end: 899 };
  const GLOBE_END = 207;                    // globe plate used as the end-card / S5-desk satellite backdrop

  const cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (f, a, d) => cl01((f - a) / d);
  const eOutCubic = t => 1 - Math.pow(1 - t, 3);
  const eInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const eInCubic = t => t * t * t;
  const px = v => v.toFixed(2) + 'px';
  const foot = t => t.replace(/([\u3000-\u9fff\uff00-\uffef]+)/g, '<span class="zh">$1</span>');

  function div(parent, cls, style = {}, html) {
    const e = document.createElement('div');
    if (cls) e.className = cls;
    Object.assign(e.style, { position: 'absolute' }, style);
    if (html !== undefined) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  function cv(parent, w, h, style = {}) {
    const c = window.Collage.canvas(w, h);
    Object.assign(c.style, { position: 'absolute', left: '0px', top: '0px' }, style);
    parent.appendChild(c);
    return c;
  }
  function put(parent, canvas, x, y, style = {}) {        // place a pre-rendered canvas
    Object.assign(canvas.style, { position: 'absolute', left: x + 'px', top: y + 'px' }, style);
    parent.appendChild(canvas);
    return canvas;
  }
  function imgEl(parent, src, style = {}) {
    const e = document.createElement('img');
    e.src = src; e.decoding = 'sync';
    Object.assign(e.style, { position: 'absolute' }, style);
    parent.appendChild(e);
    return e;
  }
  function textW(C, kind, size, text, track = 0) {
    const g = textW.g || (textW.g = C.canvas(8, 8).getContext('2d'));
    g.font = C.font(kind, size);
    return g.measureText(text).width + track * size * Math.max(0, C.graphemes(text).length - 1);
  }
  // impact that lands ON frame t (visible from t): overshoot -> squash -> settle
  function hitAt(f, t, o = {}) {
    const k = f - t;
    if (k < 0) return { visible: false, opacity: 0 };
    const S = o.seq || [1.16, 0.962, 1.016, 0.996, 1];
    const s = S[Math.min(k, S.length - 1)];
    const e = Math.max(0, 1 - k / (o.settle || 3));
    return { scale: s, rotate: (o.rot0 || 0) * e, x: (o.dx || 0) * e, y: (o.dy || 0) * e };
  }
  const flashAt = (f, t, seq = [0.55, 0.22, 0.07]) => (f >= t && f - t < seq.length ? seq[f - t] : 0);
  // baked paper (colour + tiled texture like kit.css .paper--* + crumple soft-light): one bitmap instead of CSS blends
  const PAPERS = {
    cream: ['#F1E9D8', 'paper', 'source-over'], newsprint: ['#E4E0D6', 'newsprint', 'source-over'], kraft: ['#C8A27A', 'kraft', 'source-over'],
    red: ['#BA0C2F', 'paper', 'multiply'], navy: ['#00205B', 'paper', 'multiply'], ink: ['#1b1b1b', 'kraft', 'multiply'],
    yellow: ['#FFE14D', 'paper', 'multiply'], white: ['#FBF9F4', 'paper', 'luminosity'], deep: ['#0B1F4C', 'paper', 'multiply'],
  };
  function paperCanvas(C, A, w, h, kind, o = {}) {
    const c = C.canvas(w, h), g = c.getContext('2d'), P = PAPERS[kind] || PAPERS.cream;
    g.fillStyle = P[0]; g.fillRect(0, 0, w, h);
    const tex = C.images[P[1]];
    if (tex) {
      const pat = g.createPattern(tex, 'repeat'); pat.setTransform(new DOMMatrix().scale(768 / tex.width));
      g.globalCompositeOperation = P[2]; g.globalAlpha = o.texAlpha ?? 1; g.fillStyle = pat; g.fillRect(0, 0, w, h);
    }
    if (A.crumple && (o.crumple ?? 0.6) > 0) {
      const cp = g.createPattern(A.crumple, 'repeat'); cp.setTransform(new DOMMatrix().translate(o.cx || 0, o.cy || 0).scale(1024 / A.crumple.width));
      g.globalCompositeOperation = 'soft-light'; g.globalAlpha = o.crumple ?? 0.6; g.fillStyle = cp; g.fillRect(0, 0, w, h);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    return c;
  }
  // luminance -> colour ramp (stylised print grade), keeping a little of the original colour
  function gradientMap(C, src, w, h, crop, stops, o = {}) {
    const c = C.canvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(src, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    const S = stops.map(([t, hex]) => [t, C.parseColor(hex)]), lut = new Float32Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const t = i / 255; let k = 0;
      while (k < S.length - 2 && t > S[k + 1][0]) k++;
      const [t0, c0] = S[k], [t1, c1] = S[k + 1], u = cl01((t - t0) / (t1 - t0 || 1));
      for (let j = 0; j < 3; j++) lut[i * 3 + j] = c0[j] + (c1[j] - c0[j]) * u;
    }
    const lo = o.lo ?? 16, hi = o.hi ?? 210, gam = o.gamma ?? 0.9, mix = o.mix ?? 0.22;
    for (let i = 0; i < d.length; i += 4) {
      const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      const li = Math.round(255 * Math.pow(cl01((L - lo) / (hi - lo)), gam)) * 3;
      d[i] = lut[li] * (1 - mix) + d[i] * mix; d[i + 1] = lut[li + 1] * (1 - mix) + d[i + 1] * mix; d[i + 2] = lut[li + 2] * (1 - mix) + d[i + 2] * mix;
    }
    g.putImageData(id, 0, 0);
    if (o.glow) {
      const [gx, gy, gr] = o.glow;
      g.globalCompositeOperation = 'screen';
      const rg = g.createRadialGradient(w * gx, h * gy, 0, w * gx, h * gy, w * gr);
      rg.addColorStop(0, 'rgba(255,226,150,0.9)'); rg.addColorStop(0.25, 'rgba(255,170,90,0.4)'); rg.addColorStop(1, 'rgba(255,120,80,0)');
      g.fillStyle = rg; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    }
    return c;
  }
  // torn paper plate with text, baked into ONE canvas (paper + crumple + key light + text + torn rim + shadow).
  // o: {w, h, kind, lines:[{text, font, size, color, track(em), dx, dy, shadow}], edges, seed, rim, pad, shadow}
  function bakePlate(C, A, o) {
    const pc = paperCanvas(C, A, o.w, o.h, o.kind, { crumple: o.crumple ?? 0.6, cx: C.rand(o.seed, 'cx') * 600, cy: C.rand(o.seed, 'cy') * 600 });
    const g = pc.getContext('2d');
    const lg = g.createLinearGradient(0, 0, o.w, o.h * 1.3);
    lg.addColorStop(0, 'rgba(255,255,255,0.10)'); lg.addColorStop(0.45, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.09)');
    g.fillStyle = lg; g.fillRect(0, 0, o.w, o.h);
    for (const l of o.lines || []) {
      g.font = C.font(l.font, l.size); g.fillStyle = l.color; g.textBaseline = 'middle';
      if (l.shadow) { g.shadowColor = 'rgba(0,0,0,0.22)'; g.shadowOffsetY = Math.round(l.size * 0.025); }
      C.spacedText(g, l.text, o.w / 2 + (l.dx || 0), o.h / 2 + (l.dy || 0), (l.track || 0) * l.size);
      g.shadowColor = 'transparent'; g.shadowOffsetY = 0;
    }
    return C.tornPaper(pc, { seed: o.seed, edges: o.edges || 'tb', rim: o.rim ?? 7, roughness: o.rough ?? 1, width: o.w, height: o.h, fit: 'stretch', pad: o.pad ?? 34,
      shadow: o.shadow ?? { x: 0, y: 10, blur: 16, color: 'rgba(12,8,4,0.42)' } });
  }
  // text on a strip of masking tape (like .tape-label), baked
  function bakeTape(C, A, text, o = {}) {
    const size = o.size ?? 40, padX = o.padX ?? 44, h = o.h ?? 84;
    const g0 = C.canvas(8, 8).getContext('2d'); g0.font = C.font(o.font || 'sans', size);
    const w = Math.round(g0.measureText(text).width + (o.track || 0) * size * (C.graphemes(text).length - 1) + padX * 2);
    const P = 16, c = C.canvas(w + 2 * P, h + 2 * P), g = c.getContext('2d');
    let tape = A[o.tape || 'tapeWhite'];
    if (o.wash) {                              // highlighter wash over the tape (keeps its crepe texture + torn ends)
      const t2 = C.canvas(w, h), q = t2.getContext('2d');
      q.drawImage(tape, 0, 0, w, h);
      q.globalCompositeOperation = 'source-atop'; q.globalAlpha = 0.6; q.fillStyle = o.wash; q.fillRect(0, 0, w, h);
      q.globalCompositeOperation = 'multiply'; q.globalAlpha = 0.45; q.drawImage(tape, 0, 0, w, h);
      tape = t2;
    }
    g.shadowColor = 'rgba(0,0,0,0.28)'; g.shadowBlur = 4; g.shadowOffsetY = 2;
    g.drawImage(tape, P, P, w, h);
    g.shadowColor = 'transparent';
    g.font = C.font(o.font || 'sans', size); g.fillStyle = o.color || INK; g.textBaseline = 'middle';
    C.spacedText(g, text, P + w / 2, P + h / 2 + (o.dy ?? 2), (o.track || 0) * size);
    c.pad = P; c.tw = w; c.th = h;
    return c;
  }
  // n evenly spaced, tapered marker rays around (cx,cy) from r1 to r2 (same length each), revealed one by one
  function sunRays(C, g, cx, cy, r1, r2, n, rot, f, progress, seed, width, color) {
    if (progress <= 0) return;
    for (let i = 0; i < n; i++) {
      const p = cl01(progress * n - i);
      if (p <= 0) continue;
      const a = rot + i * Math.PI * 2 / n, ca = Math.cos(a), sa = Math.sin(a);
      const pts = [];
      for (let q = 0; q <= 6; q++) { const r = lerp(r1, r2, q / 6); pts.push([cx + ca * r, cy + sa * r]); }
      C.markerPath(g, pts, { width, color, progress: p, seed: seed + i, taper: [4, (r2 - r1) * 0.8], pressure: 0.1, frame: f, boil: 0.7, composite: 'source-over' });
    }
  }
  const SUN_RAMP = [[0, '#26092B'], [0.22, '#6E1943'], [0.45, '#C9423F'], [0.66, '#F08A3A'], [0.84, '#FFCB6B'], [1, '#FFF4DA']];
  function cueFrames(X, name, a, b) {
    return ((X.cues && X.cues.sfx) || []).filter(s => s.name === name && s.frame >= a && s.frame <= b).map(s => s.frame).sort((p, q) => p - q);
  }

  // ------------------------------------------------------------------ image processing (init only)
  // satellite -> land mask grey (land dark, sea light) for a halftone desk map
  function landGrey(C, img, w, h) {
    const c = C.canvas(w, h), g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const land = cl01(((r + gg) / 2 - b + 40) / 70);          // sea: blue > r,g
      const lum = (0.3 * r + 0.59 * gg + 0.11 * b) / 255;
      const v = 255 * cl01(1 - (0.25 + 0.55 * land + 0.35 * lum * land));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    g.putImageData(id, 0, 0);
    return c;
  }
  // night grade for the aurora fallback (Lofoten crop + green sky band)
  function nightGrade(C, src, w, h) {
    const c = C.canvas(w, h), g = c.getContext('2d');
    C.drawCover(g, src, 0, 0, w, h, { focus: { x: 0.45, y: 0.55 } });
    g.globalCompositeOperation = 'multiply'; g.fillStyle = '#1b2a4a'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'screen';
    const lg = g.createLinearGradient(0, 0, 0, h * 0.6);
    lg.addColorStop(0, 'rgba(60,242,176,0.55)'); lg.addColorStop(0.5, 'rgba(60,242,176,0.18)'); lg.addColorStop(1, 'rgba(60,242,176,0)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  // banknote-style guilloche (generic line rosettes, not a reproduction of any note)
  function guilloche(C, w, h) {
    const c = C.canvas(w, h), g = c.getContext('2d');
    g.lineWidth = 1.1;
    const rosette = (cx, cy, R, a, k, n, col) => {
      g.strokeStyle = col;
      for (let j = 0; j < n; j++) {
        g.beginPath();
        for (let i = 0; i <= 720; i++) {
          const th = i / 720 * Math.PI * 2;
          const r = R + a * Math.sin(k * th + j * 0.42) + a * 0.35 * Math.sin((k + 3) * th - j * 0.3);
          const x = cx + Math.cos(th) * r, y = cy + Math.sin(th) * r;
          if (i) g.lineTo(x, y); else g.moveTo(x, y);
        }
        g.stroke();
      }
    };
    rosette(w * 0.72, h * 0.5, 380, 34, 18, 14, 'rgba(186,12,47,0.16)');
    rosette(w * 0.72, h * 0.5, 250, 22, 12, 10, 'rgba(0,32,91,0.13)');
    rosette(w * 0.72, h * 0.5, 470, 16, 30, 6, 'rgba(0,32,91,0.10)');
    g.strokeStyle = 'rgba(0,32,91,0.10)';
    for (let j = 0; j < 22; j++) {
      g.beginPath();
      for (let x = 0; x <= w; x += 6) { const y = h - 150 + j * 6 + 14 * Math.sin(x / 70 + j * 0.35); if (x) g.lineTo(x, y); else g.moveTo(x, y); }
      g.stroke();
    }
    return c;
  }
  // speech bubble silhouette (for C.sticker)
  function bubbleCanvas(C, w, h, fill, o = {}) {
    const P = 90, c = C.canvas(w + P * 2, h + P * 2), g = c.getContext('2d');
    g.translate(P, P);
    g.fillStyle = fill;
    C.roundRect(g, 0, 0, w, h, Math.min(w, h) * 0.42); g.fill();
    const tx = o.tail === 'br' ? w * 0.76 : w * 0.2, dir = o.tail === 'br' ? 1 : -1;
    g.beginPath(); g.moveTo(tx - 50, h - 20); g.quadraticCurveTo(tx + dir * 10, h + 30, tx + dir * 70, h + 80); g.quadraticCurveTo(tx + dir * 30, h + 20, tx + 60, h - 20); g.closePath(); g.fill();
    c.P = P;
    return c;
  }
  // postage stamp with perforated edges around an image (cover)
  function postageStamp(C, src, w, h, o = {}) {
    const B = o.border ?? 34, r = o.hole ?? 11, step = o.step ?? 34;
    const c = C.canvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#FBF8F0'; g.fillRect(0, 0, w, h);
    if (C.images.paper) { g.globalAlpha = 0.35; g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(C.images.paper, 'repeat'); g.fillRect(0, 0, w, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (o.rotImg) {                  // rotated framing: source point (fx,fy) at the centre, s px per source px
      const iw = w - 2 * B, ih = h - 2 * B, sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, r = o.rotImg;
      g.save(); g.beginPath(); g.rect(B, B, iw, ih); g.clip();
      g.translate(B + iw / 2, B + ih / 2); g.rotate(r.deg * Math.PI / 180); g.scale(r.s, r.s);
      g.drawImage(src, -r.fx * sw, -r.fy * sh);
      g.restore();
    } else C.drawCover(g, src, B, B, w - 2 * B, h - 2 * B, o.cover || {});
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.5; g.strokeRect(B, B, w - 2 * B, h - 2 * B);
    if (o.label) {
      g.font = C.font('anton', o.labelSize || 64); g.fillStyle = '#fff'; g.textBaseline = 'alphabetic';
      g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
      C.spacedTextLeft(g, o.label, B + 26, h - B - 24, 6);
      g.shadowColor = 'transparent';
    }
    g.globalCompositeOperation = 'destination-out';
    const holes = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.round(L / step); for (let i = 0; i <= n; i++) { g.beginPath(); g.arc(lerp(x0, x1, i / n), lerp(y0, y1, i / n), r, 0, Math.PI * 2); g.fill(); } };
    holes(0, 0, w, 0); holes(0, h, w, h); holes(0, 0, 0, h); holes(w, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    return c;
  }
  // film strip (black, sprocket holes) with frames of images
  function filmStrip(C, imgs, fw, fh, o = {}) {
    const gap = 26, mTop = 64, n = imgs.length, w = n * (fw + gap) + gap, h = fh + 2 * mTop;
    const c = C.canvas(w, h), g = c.getContext('2d');
    g.fillStyle = '#17120e'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    imgs.forEach((im, i) => { const x = gap + i * (fw + gap); C.drawCover(g, im.img, x, mTop, fw, fh, im.o || {}); g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.strokeRect(x, mTop, fw, fh); });
    g.fillStyle = '#EDE6D6';
    for (let x = 18; x < w - 20; x += 46) { C.roundRect(g, x, 18, 26, 30, 5); g.fill(); C.roundRect(g, x, h - 48, 26, 30, 5); g.fill(); }
    g.fillStyle = 'rgba(255,190,80,0.75)';                       // edge marks (no numbers: on-screen numbers come from facts only)
    for (let i = 0; i < n; i++) { const x = gap + i * (fw + gap) + 14; g.beginPath(); g.moveTo(x, h - 58); g.lineTo(x + 16, h - 50); g.lineTo(x, h - 42); g.closePath(); g.fill(); }
    c.frameW = fw + gap; c.gap = gap; c.mTop = mTop;
    return c;
  }
  // full-frame paper window: four overlapping torn strips around a hole (hx,hy,hw,hh), rims facing the hole
  function tornWindow(C, A, hx, hy, hw, hh, seed) {
    // canvas = frame + 120 px bleed on every side (place it at (-120,-120)); the strips run 120 px past the frame
    const M = 120, out = C.canvas(W + 2 * M, H + 2 * M), g = out.getContext('2d'), P = 34;
    const strip = (x, y, w, h, edges, k) => {
      const pc = paperCanvas(C, A, w, h, 'cream', { crumple: 0.6, cx: x, cy: y });
      const tp = C.tornPaper(pc, { seed: seed + k, edges, rim: 11, roughness: 1.5, bite: 1.5, width: w, height: h, fit: 'stretch', pad: P, shadow: { x: 0, y: 12, blur: 22, color: 'rgba(0,0,0,0.55)' } });
      g.drawImage(tp, x - P + M, y - P + M);
    };
    strip(-M, -M, hx + M + 30, H + 2 * M, 'r', 'l');
    strip(hx + hw - 30, -M, W - hx - hw + M + 30, H + 2 * M, 'l', 'r');
    strip(-M, -M, W + 2 * M, hy + M + 20, 'b', 't');
    strip(-M, hy + hh - 20, W + 2 * M, H - hy - hh + M + 20, 't', 'b');
    return out;
  }

  // ------------------------------------------------------------------ shared assets (loaded once)
  let SHARED = null;
  function loadShared(X) {
    if (SHARED) return SHARED;
    SHARED = (async () => {
      const C = X.C, A = {};
      const list = {
        coin: KIT('svg/coin_nok.svg'), flagNo: KIT('svg/sticker_flag_no.svg'), flagRoc: KIT('svg/sticker_flag_roc.svg'),
        aurora: KIT('svg/sticker_aurora.svg'), sun: KIT('svg/sticker_midnight_sun.svg'), pin: KIT('svg/pin.svg'),
        plane: KIT('prerendered/sticker_plane.png'), crumple: KIT('textures/crumple.jpg'), tapeWhite: KIT('textures/tape_white.png'), tapeBeige: KIT('textures/tape_beige.png'), tapeKraft: KIT('textures/tape_kraft.png'),
        oslo: GEO + 'crops/oslo.jpg', lofoten: GEO + 'crops/lofoten.jpg', lysefjord: GEO + 'crops/lysefjord.jpg',
        tromso: GEO + 'crops/tromso.jpg', geiranger: GEO + 'crops/geiranger.jpg',
        globeEnd: X.SEQ.globe(GLOBE_END),
        // text-free variant of the kit's midnight-sun sticker (the kit file has '24H' baked in, not in facts.json)
        sunNT: OWN + 'sticker_midnight_sun_notext.svg',
        // S8 backdrop: orthographic Sentinel-2 view of Scandinavia with 120/90 px bleed (make_endcard_backdrop.py)
        endBg: OWN + 'endcard_backdrop.jpg',
      };
      await Promise.all(Object.entries(list).map(async ([k, u]) => { try { A[k] = await X.image(u); } catch (e) { console.error('D: image failed', u); A[k] = null; } }));
      if (!A.globeEnd) A.globeEnd = await X.image(GEO + 'preview_norway_1080p.png');   // backdrop fallback (mosaic preview)
      if (!A.sunNT) A.sunNT = A.sun;
      A.tromsoJ = await X.json(GEO + 'crops/tromso.json');
      A.osloJ = await X.json(GEO + 'crops/oslo.json');
      A.lofotenJ = await X.json(GEO + 'crops/lofoten.json');
      try { A.endJ = await X.json(OWN + 'endcard_backdrop.json'); } catch (e) { A.endJ = null; }
      if (!A.endBg || !A.endJ) {         // fallback: globe plate f0207 as a W×H "backdrop" with no bleed + globe projection
        A.endBg = A.globeEnd; A.endJ = null;
      }
      // screen projection for the S8 backdrop (image placed at (-BX,-BY))
      A.endProj = A.endJ ? (lat, lon) => {
        const J = A.endJ, r = Math.PI / 180, p0 = J.lat0 * r, la = lat * r, dl = (lon - J.lon0) * r;
        return [J.CX + J.R * Math.cos(la) * Math.sin(dl), J.CY - J.R * (Math.cos(p0) * Math.sin(la) - Math.sin(p0) * Math.cos(la) * Math.cos(dl))];
      } : (lat, lon) => { const p = X.project(GLOBE_END, lat, lon); return [p.x, p.y]; };
      A.endBX = A.endJ ? A.endJ.BX : 0; A.endBY = A.endJ ? A.endJ.BY : 0;
      // optional plates (terrain + globe are rendered in parallel; fall back if missing)
      const has = (seq, i) => X.exists(X.SEQ[seq](i));
      A.hasAurora = i => (A._aur[i] ??= has('aurora', i));
      A.hasGeir = i => (A._geir[i] ??= has('geiranger', i));
      A.hasGlobe = i => (A._glb[i] ??= has('globe', i));
      A._aur = {}; A._geir = {}; A._glb = {};
      for (let i = 0; i <= 47; i++) A.hasAurora(i);
      for (let i = 56; i <= 69; i++) A.hasGeir(i);
      for (let i = 170; i <= 185; i++) A.hasGlobe(i);
      // still of the aurora plate's last S5 frame: what shows at the edges of card 07 once it lies under card 08
      A.aurStill = null;
      for (const i of [13, 12, 14, 10, 0]) if (A.hasAurora(i)) { try { A.aurStill = await X.image(X.SEQ.aurora(i)); break; } catch (e) { /* next */ } }
      // derived art
      // S5 desk: navy paper + light-navy halftone satellite map of Norway (globe plate f0207), one bitmap
      const dots = C.halftone(landGrey(C, A.globeEnd, 1000, 563), { width: W + 80, height: H + 60, dot: 11, angle: 30, ink: '#3A5FA6', paper: null, contrast: 1.0, rough: 0.08, cacheKey: 'D-deskdots' });
      A.desk = paperCanvas(C, A, W + 80, H + 60, 'deep', { crumple: 0.75 });
      { const g = A.desk.getContext('2d'); g.globalAlpha = 0.8; g.drawImage(dots, 0, 0); g.globalAlpha = 1; }
      return A;
    })();
    return SHARED;
  }

  // =================================================================================== S5 QUICKFIRE
  const CW = 1720, CH = 950, CX0 = 100, CY0 = 65;          // card size + top-left on screen
  const Y0 = 110;                                          // text column vertical offset (card-local)
  COMP.section({
    id: 's5-quickfire', start: Q.start, end: Q.end, z: 30,

    async init(root, X) {
      const C = X.C, A = await loadShared(X);
      this.A = A;
      const b = cueFrames(X, 'paper_slap', Q.start, Q.end);
      this.beats = b.length === 4 ? b : Q.beats;
      if (b.length !== 4) console.warn('D: paper_slap cues not found, using defaults', b);
      root.style.background = '#0B1F4C';
      // desk: baked bitmap cut into 4 edge strips (the centre is always under the top card), integer-translated
      this.desk = div(root, '', { left: '-40px', top: '-30px', width: (W + 80) + 'px', height: (H + 60) + 'px' });
      const strip = (x, y, w, h) => { const c = C.canvas(w, h); c.getContext('2d').drawImage(A.desk, x, y, w, h, 0, 0, w, h); put(this.desk, c, x, y); };
      const DW = W + 80, DH = H + 60, TS = 210, LS = 270;
      strip(0, 0, DW, TS); strip(0, DH - TS, DW, TS); strip(0, TS, LS, DH - 2 * TS); strip(DW - LS, TS, LS, DH - 2 * TS);
      this.cam = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '50% 50%' });
      this.pile = div(this.cam, '', { left: '0', top: '0', width: W + 'px', height: H + 'px' });
      const F = k => X.fact(k);
      this.cards = [
        this.card05(C, X, F('currency'), 0),
        this.card06(C, X, F('language'), 1),
        this.card07(C, X, F('aurora'), 2),
        this.card08(C, X, F('midnight_sun'), 3),
      ];
      this.cards.forEach(K => this.bakeBuried(C, K));
      this.flash = div(root, '', { inset: '0', background: '#FFF8EC', opacity: 0, zIndex: 90 });
    },

    // ---------------------------------------------------------------- shared card template
    // bake: CW×CH canvas (paper + static content); edges: torn sides; ov: marker overlay box [x,y,w,h] (card-local)
    shell(C, i, o) {
      const box = div(this.pile, '', { left: CX0 + 'px', top: CY0 + 'px', width: CW + 'px', height: CH + 'px', transformOrigin: '25% 45%', visibility: 'hidden', zIndex: 10 + i });
      // drop shadow baked once (same look as box-shadow 0 26px 50px + 0 4px 9px; a CSS blur per frame x3 cards is slow)
      const sh = C.canvas(1, 1); if (!this.shadowC) {
        const SP = 120, c = C.canvas(CW + 2 * SP, CH + 2 * SP), g = c.getContext('2d'), off = 20000;
        g.fillStyle = '#000';
        g.shadowColor = 'rgba(0,4,16,0.75)'; g.shadowBlur = 50; g.shadowOffsetX = off; g.shadowOffsetY = 26; g.fillRect(SP + 8 - off, SP + 8, CW - 16, CH - 16);
        g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 9; g.shadowOffsetY = 4; g.fillRect(SP + 8 - off, SP + 8, CW - 16, CH - 16);
        this.shadowC = c; this.shadowP = SP;
      }
      const shc = this.shadowC; sh.width = shc.width; sh.height = shc.height; sh.getContext('2d').drawImage(shc, 0, 0);
      put(box, sh, -this.shadowP, -this.shadowP);
      const wrap = div(box, '', { left: '0', top: '0', width: CW + 'px', height: CH + 'px' });
      const tc = o.edges ? C.tornPaper(o.bake, { seed: 'D-card' + i, edges: o.edges, rim: 9, roughness: 1.2, width: CW, height: CH, shadow: false, fit: 'stretch', pad: 24 }) : o.bake;
      const pad = o.edges ? tc.pad : 0;
      const body = put(wrap, tc, -pad, -pad, { zIndex: 1 });
      const K = { i, box, sh, wrap, body, bodyPad: pad };
      if (o.ov) {
        const [x, y, w, h] = o.ov;
        K.ov = cv(wrap, w, h, { left: x + 'px', top: y + 'px', zIndex: 30 });
        K.og = K.ov.getContext('2d'); K.ovBox = o.ov;
      }
      return K;
    },
    // what a card looks like once it lies under the next one (only its torn edges + shadow show): shadow, torn body and
    // a static picture baked ONCE into a half-res bitmap -> one cheap layer instead of the live card (big raster saving)
    bakeBuried(C, K) {
      const SP = this.shadowP, sc = 0.5, w = CW + 2 * SP, h = CH + 2 * SP;
      const c = C.canvas(w * sc, h * sc), g = c.getContext('2d');
      g.scale(sc, sc); g.translate(SP, SP);
      g.drawImage(this.shadowC, -SP, -SP);
      g.drawImage(K.body, -K.bodyPad, -K.bodyPad);
      if (K.snapPic) K.snapPic(g);
      K.snapEl = put(K.box, c, -SP, -SP, { width: w + 'px', height: h + 'px', display: 'none' });
    },
    ovBegin(K) { const g = K.og, [x, y, w, h] = K.ovBox; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h); g.setTransform(1, 0, 0, 1, -x, -y); return g; },
    // text column: FACT dymo, label (ink strip), main (red plate), optional en (white plate) + sub (white tape) + footnote
    column(C, K, fact, code, o = {}) {
      const A = this.A, w = K.wrap, x0 = 58;
      K.dymo = div(w, 'dymo dymo--red', { left: (x0 + 6) + 'px', top: (Y0 + 40) + 'px', fontSize: '30px', transformOrigin: '0 50%', zIndex: 40, visibility: 'hidden' }, code);
      const lS = 84, lW = Math.round(textW(C, 'sans', lS, fact.label, 0.06) + 80);
      const lab = bakePlate(C, A, { w: lW, h: 128, kind: 'ink', seed: 'D-lab' + K.i, edges: 'lr', rim: 6, crumple: 0.5, lines: [{ text: fact.label, font: 'sans', size: lS, color: CREAM, track: 0.06, dy: 2 }] });
      K.label = put(w, lab, x0 - lab.pad, Y0 + 108 - lab.pad, { zIndex: 36, visibility: 'hidden', transformOrigin: `${lab.pad + 20}px 50%` });
      const n = C.graphemes(fact.main).length, mS = n >= 4 ? 176 : n === 3 ? 204 : 236;
      const mW = Math.round(textW(C, 'sans', mS, fact.main, 0.02) + 110), mH = Math.round(mS * 1.36);
      K.mainBox = [x0 - 20, Y0 + 250, mW, mH];
      const mp = bakePlate(C, A, { w: mW, h: mH, kind: 'red', seed: 'D-main' + K.i, edges: 'tb', rim: 8, lines: [{ text: fact.main, font: 'sans', size: mS, color: '#FFFFFF', track: 0.02, dy: Math.round(mS * 0.02), shadow: true }] });
      K.main = put(w, mp, x0 - 20 - mp.pad, Y0 + 250 - mp.pad, { zIndex: 35, visibility: 'hidden', transformOrigin: `${mp.pad + mW * 0.3}px 50%` });
      let y = Y0 + 250 + mH + 18;
      if (o.en) {
        const eS = 170, eW = Math.round(textW(C, 'anton', eS, o.en, 0.05) + 120), eH = 200;
        const ep = bakePlate(C, A, { w: eW, h: eH, kind: 'white', seed: 'D-en' + K.i, edges: 'lrb', rim: 6, crumple: 0.45, lines: [{ text: o.en, font: 'anton', size: eS, color: INK, track: 0.05, dy: 4 }] });
        K.en = put(w, ep, x0 + 40 - ep.pad, y - ep.pad, { zIndex: 37, visibility: 'hidden', transformOrigin: `${ep.pad + eW * 0.2}px 50%` });
        K.enBox = [x0 + 40, y, eW, eH];
        K.enTape = div(w, 'tape tape--beige tape--sm', { left: (x0 + 40 + eW - 110) + 'px', top: (y - 20) + 'px', width: '160px', zIndex: 38, visibility: 'hidden' });
        y += eH + 14;
      }
      if (fact.sub_zh) {
        const tp = bakeTape(C, A, fact.sub_zh, { size: 42, h: 88, padX: 46, tape: o.subTape || 'tapeWhite', wash: o.subWash });
        K.sub = put(w, tp, x0 - 4 - tp.pad, y + 4 - tp.pad, { zIndex: 39, visibility: 'hidden', transformOrigin: `${tp.pad + 40}px 50%` });
      }
      if (fact.footnote) {
        // 24 px Space Mono Regular (not the kit's 19 px Bold): the small bold 'w' blurs into an 'm' ('Visit Norway')
        K.foot = div(w, 'footnote', { left: 'auto', bottom: 'auto', right: '64px', top: (CH - 64 - 48) + 'px', fontSize: '24px', fontWeight: '400', letterSpacing: '0.03em', zIndex: 41, visibility: 'hidden' }, foot('資料來源：' + fact.footnote));
      }
    },
    placeColumn(C, K, f, t) {
      const i = K.i;
      C.place(K.main, { rotate: -2 }, C.jitter('D-m' + i, f, 1.6));
      // FACT dymo + category land WITH the card (hit frame); the long sub line snaps in on the very next frame
      C.place(K.label, { rotate: -3 + (i % 2) * 2 }, C.snapInAt(f, t, { dur: 3, from: 1.18, seed: 'D-lb' + i }), C.jitter('D-lb' + i, f, 1.2));
      C.place(K.dymo, { rotate: -2 }, C.snapInAt(f, t, { dur: 3, from: 1.2, seed: 'D-dy' + i }), C.jitter('D-dy' + i, f, 0.8));
      if (K.en) {
        C.place(K.en, { rotate: 2.5 }, C.snapInAt(f, t + 1, { dur: 3, seed: 'D-en' + i }), C.jitter('D-en' + i, f, 1.3));
        C.place(K.enTape, { rotate: 32 }, C.snapInAt(f, t + 2, { dur: 2, seed: 'D-et' + i }));
      }
      if (K.sub) C.place(K.sub, { rotate: -1.5 }, C.snapInAt(f, t + 1, { dur: 2, from: 1.14, seed: 'D-sb' + i }), C.jitter('D-sb' + i, f, 1));
      if (K.foot) C.place(K.foot, {}, { visible: f >= t + 1 });
    },

    // ---------------------------------------------------------------- FACT 05 currency
    card05(C, X, fact, i) {
      const A = this.A;
      const bake = paperCanvas(C, A, CW, CH, 'cream', { crumple: 0.6 });
      { const g = bake.getContext('2d'); g.drawImage(guilloche(C, CW, CH), 0, 0);
        g.font = C.font('anton', 820); g.fillStyle = 'rgba(186,12,47,0.055)'; g.textBaseline = 'top'; g.fillText('kr', 1040, -40); }
      const K = this.shell(C, i, { bake, edges: 'r', ov: [520, 60, 1180, 840] });
      this.column(C, K, fact, 'FACT 05 / CURRENCY', { en: fact.en });
      // NOK token (kit SVG carries its own soft shadow): two small behind + the hero coin
      const coin = (x, y, s) => imgEl(K.wrap, A.coin.src, { left: (x - 200 * s) + 'px', top: (y - 210 * s) + 'px', width: (400 * s) + 'px', height: (420 * s) + 'px', transformOrigin: '50% 55%', visibility: 'hidden' });
      K.coins = [{ x: 1390, y: 730, s: 0.78, rot: -18, t: 3 }, { x: 1590, y: 500, s: 0.62, rot: 24, t: 4 }].map(o => Object.assign(o, { el: coin(o.x, o.y, o.s) }));
      K.coins.forEach(o => { o.el.style.zIndex = 20; });
      K.heroC = [1200, 460];
      K.hero = coin(K.heroC[0], K.heroC[1], 1.45); K.hero.style.zIndex = 22;
      K.render = (f, t, jobs, buried) => {
        if (buried) return;
        const k = f - t;
        this.placeColumn(C, K, f, t);
        // hero token drops in flipping (scaleX = edge-on turn), lands on t+3 with a squash.
        // |scaleX| so the face is never mirrored; the frame where it shows its back is darkened (back face).
        const drop = [-300, -150, -44, 8, -3, 0], spin = [0.16, -0.78, 0.46, 1, 1, 1];
        const kk = Math.max(0, Math.min(k, 5));
        const sx = k >= 5 ? 0.96 + 0.04 * Math.cos((k - 5) * 0.35) : Math.abs(spin[kk]);
        const back = k < 5 && spin[kk] < 0;
        const j = C.jitter('D-coin', f, 1.2);
        K.hero.style.visibility = k >= 0 ? 'visible' : 'hidden';
        K.hero.style.filter = back ? 'brightness(0.62) saturate(0.8)' : k === 0 ? 'brightness(1.12)' : '';
        K.hero.style.transform = `translate(${px(j.x)},${px(drop[kk] + j.y)}) rotate(${(-8 + 3 * Math.sin(f * 0.21) + j.r).toFixed(2)}deg) scale(${sx.toFixed(3)},${(k === 3 ? 0.95 : 1).toFixed(3)})`;
        K.coins.forEach((o, n) => C.place(o.el, { rotate: o.rot }, C.snapInAt(f, t + o.t, { dur: 3, from: 1.5, seed: 'D-c' + n }), C.jitter('D-c' + n, f, 1.2)));
        const g = this.ovBegin(K);
        if (k >= 5) C.marker.circle(g, { cx: K.heroC[0], cy: K.heroC[1] + 2, rx: 322, ry: 312, rotation: -8, seed: 'D-coinC', width: 13, color: RED, progress: C.prog(f, t + 5, 6), frame: f, boil: 0.8 });
        if (k >= 6) {
          const [ex, ey, ew] = K.enBox;
          C.marker.arrow(g, { x1: ex + ew + 26, y1: ey + 110, x2: 860, y2: 610, bend: -0.3, seed: 'D-coinA', width: 10, color: INK, progress: C.prog(f, t + 6, 5), frame: f, boil: 0.8 });
        }
      };
      return K;
    },

    // ---------------------------------------------------------------- FACT 06 language
    card06(C, X, fact, i) {
      const A = this.A;
      const bake = paperCanvas(C, A, CW, CH, 'newsprint', { crumple: 0.65, cx: 300, cy: 200 });
      const K = this.shell(C, i, { bake, edges: 'tb' });
      this.column(C, K, fact, 'FACT 06 / LANGUAGE', { subTape: 'tapeBeige', subWash: YEL });
      // speech bubble sticker with the language name. bubbleCanvas() leaves its context translated by (P,P):
      // reset it, then centre the word in the bubble body with an even margin (size capped to bw - 150).
      const bw = 800, bh = 410, bub = bubbleCanvas(C, bw, bh, RED, { tail: 'bl' });
      const bg = bub.getContext('2d');
      bg.setTransform(1, 0, 0, 1, 0, 0);
      let bS = 200; bg.font = C.font('marker', bS);
      const tw0 = bg.measureText(fact.en).width;
      if (tw0 > bw - 150) bS = Math.floor(bS * (bw - 150) / tw0);
      bg.font = C.font('marker', bS); bg.fillStyle = '#fff'; bg.textAlign = 'center'; bg.textBaseline = 'alphabetic';
      const mt = bg.measureText(fact.en), capH = mt.actualBoundingBoxAscent - mt.actualBoundingBoxDescent;
      bg.shadowColor = 'rgba(60,0,12,0.35)'; bg.shadowOffsetY = 5;
      bg.save(); bg.translate(bub.P + bw / 2, bub.P + bh / 2 + capH / 2); bg.rotate(-0.045); bg.fillText(fact.en, 0, 0); bg.restore();
      bg.shadowColor = 'transparent'; bg.shadowOffsetY = 0;
      const st = C.sticker(bub, { border: 14, shadow: { x: 0, y: 14, blur: 22, color: 'rgba(0,0,0,0.42)' }, cacheKey: 'D-bub1' });
      K.bub = put(K.wrap, st, 1250 - st.width / 2, 410 - st.height / 2, { zIndex: 22, visibility: 'hidden', transformOrigin: '30% 80%' });
      // small navy "typing" bubble with three dots
      const tb = bubbleCanvas(C, 280, 150, NAVY, { tail: 'br' });
      const st2 = C.sticker(tb, { border: 11, shadow: { x: 0, y: 10, blur: 16, color: 'rgba(0,0,0,0.4)' }, cacheKey: 'D-bub2' });
      K.tb = put(K.wrap, st2, 1500 - st2.width / 2, 770 - st2.height / 2, { zIndex: 21, visibility: 'hidden', transformOrigin: '70% 80%' });
      K.dots = [0, 1, 2].map(n => div(K.wrap, '', { left: (1500 - 70 + n * 70 - 20) + 'px', top: (770 - 26) + 'px', width: '40px', height: '40px', borderRadius: '50%', background: '#fff', zIndex: 23, visibility: 'hidden' }));
      const fl = imgEl(K.wrap, A.flagNo.src, { left: (1580 - 131) + 'px', top: (170 - 101) + 'px', width: '262px', height: '202px', zIndex: 24, visibility: 'hidden', transformOrigin: '50% 50%' });
      K.flag = fl;
      K.render = (f, t, jobs, buried) => {
        if (buried) return;
        const k = f - t;
        this.placeColumn(C, K, f, t);
        C.place(K.bub, { rotate: -5 }, hitAt(f, t, { seq: [0.62, 1.12, 0.96, 1.02, 1], rot0: -8 }), C.jitter('D-bub', f, 1.4));
        C.place(K.flag, { rotate: 12 }, C.snapInAt(f, t + 2, { dur: 3, from: 1.6, seed: 'D-fl6' }), C.jitter('D-fl6', f, 1.2));
        C.place(K.tb, { rotate: 4 }, C.snapInAt(f, t + 4, { dur: 3, seed: 'D-tb' }), C.jitter('D-tb', f, 1));
        K.dots.forEach((d, n) => {
          const on = k >= 5, ph = ((C.onTwos(f) / 2 - n) % 3 + 3) % 3;
          C.place(d, {}, { visible: on, y: ph === 0 ? -10 : 0, scale: ph === 0 ? 1.12 : 0.92 }, C.jitter('D-tb', f, 1));
        });
      };
      return K;
    },

    // ---------------------------------------------------------------- FACT 07 aurora (terrain plate inside a photo print)
    card07(C, X, fact, i) {
      const A = this.A;
      const bake = paperCanvas(C, A, CW, CH, 'white', { crumple: 0.35 });
      const K = this.shell(C, i, { bake, ov: [560, 150, 620, 420] });
      const B = 22, ww = CW - 2 * B, wh = CH - 2 * B;
      K.win = div(K.wrap, '', { left: B + 'px', top: B + 'px', width: ww + 'px', height: wh + 'px', overflow: 'hidden', background: '#02060d', zIndex: 3 });
      K.plate = X.plate(K.win, { z: 0 });
      const ph = Math.round(ww * 1080 / 1920), pTop = Math.round((wh - ph) / 2);
      Object.assign(K.plate.style, { width: ww + 'px', height: ph + 'px', top: pTop + 'px', transformOrigin: '60% 45%' });
      // fallback: Lofoten crop, night-graded (+ the aurora sticker, fallback only)
      K.fb = put(K.win, nightGrade(C, A.lofoten, ww, wh), 0, 0, { visibility: 'hidden', transformOrigin: '50% 50%' });
      // buried state: a still of the plate (or the fallback grade) so the pile's edges keep showing the real picture
      K.still = C.canvas(ww, wh);
      { const g = K.still.getContext('2d');
        if (A.aurStill) { g.fillStyle = '#02060d'; g.fillRect(0, 0, ww, wh); g.save(); g.translate(ww * 0.6, pTop + ph * 0.45); g.scale(1.05, 1.05); g.translate(-ww * 0.6, -(pTop + ph * 0.45)); g.drawImage(A.aurStill, 0, pTop, ww, ph); g.restore(); }
        else g.drawImage(K.fb, 0, 0); }
      div(K.win, '', { inset: '0', background: 'linear-gradient(90deg, rgba(2,8,20,.5) 0%, rgba(2,8,20,.16) 36%, rgba(2,8,20,0) 58%)', zIndex: 2 });
      // masking tape on the print's top corners
      K.tapes = [
        div(K.wrap, 'tape tape--beige', { left: '-58px', top: '-8px', transform: 'rotate(-38deg)', zIndex: 26 }),
        div(K.wrap, 'tape tape--beige', { left: (CW - 150) + 'px', top: '-4px', transform: 'rotate(36deg)', zIndex: 26 }),
      ];
      K.snapPic = g => {
        g.drawImage(K.still, B, B);
        const tp = A.tapeBeige;
        [[-58, -8, -38], [CW - 150, -4, 36]].forEach(([x, y, r]) => { g.save(); g.translate(x + 130, y + 31); g.rotate(r * Math.PI / 180); g.drawImage(tp, -130, -31, 260, 62); g.restore(); });
      };
      this.column(C, K, fact, 'FACT 07 / AURORA');
      K.stk = imgEl(K.wrap, A.aurora.src, { left: (1575 - 145) + 'px', top: (190 - 145) + 'px', width: '290px', height: '290px', zIndex: 24, visibility: 'hidden', transformOrigin: '50% 50%' });
      K.render = (f, t, jobs, buried) => {
        const k = f - t, li = Math.max(0, Math.min(47, k));
        const usePlate = A.hasAurora(li);
        if (buried) return;
        this.placeColumn(C, K, f, t);
        const s = 1.0 + 0.05 * eOutCubic(prog(f, t, 16)), w = C.wander('D-aurW', f, 6, 0.06);
        K.plate.style.visibility = usePlate ? 'visible' : 'hidden';
        K.fb.style.visibility = usePlate ? 'hidden' : 'visible';
        const tr = `translate(${px(w.x)},${px(w.y)}) scale(${s.toFixed(4)})`;
        if (usePlate) { K.plate.style.transform = tr; jobs.push(K.plate.setFrame('aurora', li)); } else K.fb.style.transform = tr;
        // cartoon aurora sticker only when the photoreal plate is missing (it would cheapen the real plate)
        if (usePlate) K.stk.style.visibility = 'hidden';
        else C.place(K.stk, { rotate: 10 }, C.snapInAt(f, t + 3, { dur: 3, from: 1.6, seed: 'D-st7' }), C.jitter('D-st7', f, 1.2));
        // hand-drawn marker arrow from 極光 up into the aurora band (editorial 'look here')
        const g = this.ovBegin(K);
        if (k >= 4) {
          const [mx, my, mw] = K.mainBox;
          C.marker.arrow(g, { x1: mx + mw + 30, y1: my + 96, x2: 1010, y2: 262, bend: 0.36, seed: 'D-ar7', width: 15, color: '#FFFFFF', head: 52, headAngle: 32, progress: C.prog(f, t + 4, 4), frame: f, boil: 0.8, composite: 'source-over' });
        }
      };
      return K;
    },

    // ---------------------------------------------------------------- FACT 08 midnight sun (warm-graded Tromsø print)
    card08(C, X, fact, i) {
      const A = this.A;
      const bake = paperCanvas(C, A, CW, CH, 'white', { crumple: 0.35, cx: 500 });
      const K = this.shell(C, i, { bake, edges: 'l', ov: [960, 0, 760, 700] });
      const BL = 34, B = 22, ww = CW - BL - B, wh = CH - 2 * B;
      // tromso crop at 1:1 source px, shifted so the city centre sits right of the text column
      const cen = A.tromsoJ.landmarks['Tromso centre'].px;
      const target = [1150 - BL, 470 - B];
      const crop = { x: Math.max(0, Math.min(2400 - ww, cen[0] - target[0])), y: Math.max(0, Math.min(1350 - wh, cen[1] - target[1])), w: ww, h: wh };
      K.pinPos = [BL + cen[0] - crop.x, B + cen[1] - crop.y];
      K.win = div(K.wrap, '', { left: BL + 'px', top: B + 'px', width: ww + 'px', height: wh + 'px', overflow: 'hidden', zIndex: 3 });
      K.winBox = [BL, B, ww, wh];
      K.sunC = [1478, 250]; const sunS = 340;
      const sunUV = [(K.sunC[0] - BL) / ww, (K.sunC[1] - B) / wh];
      A.tromsoWarm = gradientMap(C, A.tromso, ww, wh, crop, SUN_RAMP, { lo: 14, hi: 200, gamma: 0.85, mix: 0.2, glow: [sunUV[0], sunUV[1], 0.6] });
      K.photo = put(K.win, A.tromsoWarm, 0, 0, { transformOrigin: `${K.pinPos[0] - BL}px ${K.pinPos[1] - B}px` });
      div(K.win, '', { inset: '0', background: 'linear-gradient(90deg, rgba(40,6,24,.45) 0%, rgba(40,6,24,.12) 38%, rgba(40,6,24,0) 58%)', zIndex: 2 });
      K.snapPic = g => {
        const [ox, oy] = K.pinPos, s = 1.045;             // the photo's push-in scale at the moment it gets buried
        g.save(); g.beginPath(); g.rect(BL, B, ww, wh); g.clip();
        g.translate(ox, oy); g.scale(s, s); g.translate(-ox, -oy); g.drawImage(A.tromsoWarm, BL, B); g.restore();
      };
      this.column(C, K, fact, 'FACT 08 / MIDNIGHT SUN');
      K.sunR = sunS * 200 / 460;                                // visible radius of the die-cut disc
      K.sun = imgEl(K.wrap, A.sunNT.src, { left: (K.sunC[0] - sunS / 2) + 'px', top: (K.sunC[1] - sunS / 2) + 'px', width: sunS + 'px', height: sunS + 'px', zIndex: 24, visibility: 'hidden', transformOrigin: '50% 50%' });
      K.pin = imgEl(K.wrap, A.pin.src, { left: (K.pinPos[0] - 44) + 'px', top: (K.pinPos[1] - 88 * 0.9615) + 'px', width: '88px', transformOrigin: '50% 96%', filter: 'drop-shadow(0 6px 5px rgba(0,0,0,.45))', zIndex: 25, visibility: 'hidden' });
      K.render = (f, t, jobs, buried) => {
        const k = f - t;
        if (buried) return;
        const s = 1.0 + 0.045 * eOutCubic(prog(f, t, 16));
        K.photo.style.transform = `scale(${s.toFixed(4)})`;
        this.placeColumn(C, K, f, t);
        C.place(K.sun, { rotate: -4 }, hitAt(f, t + 1, { seq: [1.35, 0.92, 1.05, 0.99, 1], rot0: 14 }), C.jitter('D-sun', f, 1.3));
        C.place(K.pin, {}, C.snapInAt(f, t + 3, { dur: 3, from: 1.8, rot0: 0, drop: 50 }), C.jitter('D-pin8', f, 0.8));
        const g = this.ovBegin(K);
        if (k >= 2) {       // 12 even marker rays around the sun sticker, turning on twos, clipped to the photo
          const [wx, wy, wW, wH] = K.winBox;
          g.save(); g.beginPath(); g.rect(wx, wy, wW, wH); g.clip();
          sunRays(C, g, K.sunC[0], K.sunC[1], K.sunR + 16, K.sunR + 70, 12, 0.13 + C.onTwos(f) * 0.011, f, C.prog(f, t + 2, 4), 'D-rays', 17, YEL);
          g.restore();
        }
        if (k >= 4) C.marker.circle(g, { cx: K.pinPos[0] + 4, cy: K.pinPos[1] - 30, rx: 150, ry: 112, rotation: -10, seed: 'D-tc', width: 11, color: RED, progress: C.prog(f, t + 4, 6), frame: f, boil: 0.7 });
      };
      return K;
    },

    // ---------------------------------------------------------------- frame
    async render(f, root, X) {
      const C = X.C, T = this.beats, jobs = [];
      const top = T.reduce((a, t, n) => (f >= t ? n : a), 0), tc = T[top];
      // camera: slow push over the section + decaying shake on every slap
      const push = 1 + 0.03 * eInOut(prog(f, Q.start, Q.end - Q.start));
      const sh = C.shake('D-s5', f, tc, { amp: 12, decay: 4 });
      const wv = C.wander('D-s5cam', f, 5, 0.05);
      this.cam.style.transform = `translate(${px(sh.x + wv.x)},${px(sh.y + wv.y)}) rotate(${(sh.r + wv.r).toFixed(3)}deg) scale(${push.toFixed(4)})`;
      const dw = C.wander('D-desk', f, 14, 0.04);
      this.desk.style.transform = `translate(${Math.round(dw.x + sh.x * 0.5)}px,${Math.round(dw.y + sh.y * 0.5)}px)`;
      this.flash.style.opacity = flashAt(f, tc, [0.3, 0.12, 0.04]);
      const BASE = [{ r: -1.6, x: 0, y: 0 }, { r: 1.3, x: 10, y: -6 }, { r: -1.0, x: -8, y: 5 }, { r: 1.7, x: 6, y: 8 }];
      for (const K of this.cards) {
        const t = T[K.i];
        // the top card + up to two buried ones under it (their torn edges + shadows build the pile)
        // display (not visibility): children placed with visibility:visible would otherwise still show when rendering backwards
        if (f < t || K.i < top - 2) { K.box.style.display = 'none'; continue; }
        K.box.style.display = '';
        let lvl = 0;
        for (let n = K.i + 1; n < T.length; n++) lvl += eOutCubic(prog(f, T[n], 3));
        const b = BASE[K.i], k = f - t;
        const hit = hitAt(f, t, { seq: [1.1, 0.97, 1.012, 0.997, 1], rot0: K.i % 2 ? -2.5 : 2.5, dy: -14 });
        const hold = 1 + 0.012 * prog(f, t + 4, 14);
        C.place(K.box, { x: b.x - 18 * lvl, y: b.y + 12 * lvl, rotate: b.r - 0.7 * lvl, scale: hold }, hit, C.jitter('D-card' + K.i, f, 1.1, 0.12));
        const lift = k < 3 ? [1.4, 1.1, 1.0][k] : 1;
        K.sh.style.transform = `translate(${px(30 * (lift - 1))},${px(48 * (lift - 1))})`;
        // buried under the next card (from its 2nd frame on): swap the live card for its baked half-res snapshot
        // (torn body + shadow + static picture: the edges of the pile stay real paper, at a fraction of the raster cost)
        const buried = K.i < top && f >= T[top] + 1;
        K.wrap.style.display = K.sh.style.display = buried ? 'none' : '';
        K.snapEl.style.display = buried ? '' : 'none';
        K.render(f, t, jobs, buried);
      }
      await Promise.all(jobs);
    },
  });
  // =================================================================================== S8 OUTRO: RECAP MONTAGE
  function withShadow(C, src, o = {}) {
    const P = o.pad ?? 56, c = C.canvas(src.width + 2 * P, src.height + 2 * P), g = c.getContext('2d');
    g.shadowColor = o.color || 'rgba(0,0,0,0.5)'; g.shadowBlur = o.blur ?? 26; g.shadowOffsetX = o.x ?? 0; g.shadowOffsetY = o.y ?? 16;
    g.drawImage(src, P, P); c.pad = P;
    return c;
  }
  // red label-maker FACT callback on a recap print (P-local position)
  const recapDymo = (P, text, x, y, rot) => ({ rot, el: div(P, 'dymo dymo--red', { left: x + 'px', top: y + 'px', fontSize: '34px', transformOrigin: '0 50%', zIndex: 8, visibility: 'hidden' }, text) });
  // a transformable box whose centre sits at (cx, cy)
  const boxAt = (parent, w, h, cx, cy, style = {}) => div(parent, '', Object.assign({ left: (cx - w / 2) + 'px', top: (cy - h / 2) + 'px', width: w + 'px', height: h + 'px', transformOrigin: '50% 50%' }, style));

  COMP.section({
    id: 's8-recap', start: O.start, end: O.hit - 1, z: 30,

    async init(root, X) {
      const C = X.C, A = await loadShared(X);
      this.A = A;
      const c = cueFrames(X, 'stutter_cuts', O.start, O.hit - 1);
      this.cuts = c.length === 8 ? c : O.cuts;
      if (c.length !== 8) console.warn('D: stutter_cuts cues not found, using defaults', c);
      root.style.background = '#111';
      this.cam = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '50% 50%' });
      const mk = (kind, seed) => {
        // no overflow clip here: the papers' bleed must reach past the frame edge under shake (the section root clips)
        const L = div(this.cam, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', display: 'none' });
        // paper background with 160/100 px bleed (drift <= 20 px + shake <= 19 px + rotation never shows an edge)
        L.bg = kind ? put(L, paperCanvas(C, A, W + 320, H + 200, kind, { crumple: 0.75, cx: C.rand(seed, 'x') * 900, cy: C.rand(seed, 'y') * 900 }), -160, -100) : null;
        return L;
      };
      const S = this.S = [];

      // 1 · Geirangerfjord terrain plate (local 56–68, double speed) as a taped photo print on kraft
      {
        const L = mk('kraft', 'c0');
        const P = boxAt(L, 1520, 872, 960, 532, { background: '#FBF9F4', boxShadow: '0 26px 46px rgba(0,0,0,.55), 0 3px 7px rgba(0,0,0,.4)' });
        const win = div(P, '', { left: '20px', top: '20px', width: '1480px', height: '832px', overflow: 'hidden', background: '#223' });
        const plate = X.plate(win); Object.assign(plate.style, { width: '1480px', height: '832px', transformOrigin: '50% 60%' });
        const fb = C.canvas(1480, 832); C.drawCover(fb.getContext('2d'), A.geiranger, 0, 0, 1480, 832, { focus: { x: 0.6, y: 0.55 }, zoom: 1.6 });
        put(win, fb, 0, 0, { visibility: 'hidden' });
        div(P, 'tape tape--white', { left: '-66px', top: '-14px', transform: 'rotate(-34deg)' });
        div(P, 'tape tape--white', { right: '-66px', top: '-14px', transform: 'rotate(33deg)' });
        S.push({ L, P, rot: -3, dymo: recapDymo(P, 'FACT 04 / FJORDS', 44, 44, -2), render: (f, k, jobs) => {
          const li = 56 + 2 * k, ok = A.hasGeir(li);
          plate.style.visibility = ok ? 'visible' : 'hidden'; fb.style.visibility = ok ? 'hidden' : 'visible';
          if (ok) jobs.push(plate.setFrame('geiranger', li)); else fb.style.transform = `scale(${(1 + 0.012 * k).toFixed(4)})`;
        } });
      }
      // 2 · Oslo: Sentinel-2 colour print as a torn newspaper clipping on red paper, circle + pin on the Opera House
      {
        const L = mk('red', 'c1');
        const pw = 1400, ph = 788, oj = A.osloJ.landmarks['Oslo Opera House'].px, zoom = 1.35;
        const pc = C.canvas(pw, ph), pg = pc.getContext('2d');
        const fx = oj[0] / 2400, fy = oj[1] / 1350;
        C.drawCover(pg, A.oslo, 0, 0, pw, ph, { focus: { x: fx, y: fy }, zoom });
        pg.globalCompositeOperation = 'multiply'; pg.globalAlpha = 0.3; pg.fillStyle = pg.createPattern(C.images.newsprint, 'repeat'); pg.fillRect(0, 0, pw, ph);
        pg.globalCompositeOperation = 'source-over'; pg.globalAlpha = 1;
        const s0 = Math.max(pw / 2400, ph / 1350) * zoom, sx0 = (2400 - pw / s0) * fx, sy0 = (1350 - ph / s0) * fy;
        const tp = C.tornPaper(pc, { seed: 'D-oslo', edges: 'all', rim: 9, width: pw, height: ph, fit: 'stretch', pad: 44, shadow: { x: 0, y: 18, blur: 26, color: 'rgba(40,0,10,0.5)' } });
        const P = boxAt(L, tp.width, tp.height, 960, 540);
        put(P, tp, 0, 0);
        const ov = cv(P, tp.width, tp.height, { zIndex: 2 }), og = ov.getContext('2d');
        const cx = tp.pad + (oj[0] - sx0) * s0, cy = tp.pad + (oj[1] - sy0) * s0;
        const pin = imgEl(P, A.pin.src, { left: (cx - 40) + 'px', top: (cy - 80 * 0.9615) + 'px', width: '80px', transformOrigin: '50% 96%', zIndex: 3, filter: 'drop-shadow(0 5px 4px rgba(0,0,0,.45))' });
        S.push({ L, P, rot: 3.5, dymo: recapDymo(P, 'FACT 01 / CAPITAL', 96, 84, -3), render: (f, k) => {
          og.clearRect(0, 0, ov.width, ov.height);
          C.marker.circle(og, { cx: cx + 4, cy: cy - 30, rx: 170, ry: 124, rotation: -8, seed: 'D-oc', width: 13, color: RED, progress: C.prog(k, 1, 4), frame: f, boil: 0.8 });
          C.place(pin, {}, C.snapInAt(k, 0, { dur: 3, from: 1.8, rot0: 0, drop: 50 }));
        } });
      }
      // 3 · Aurora plate (local 20–44, 4× speed) as a polaroid on black paper, handwritten caption
      {
        const L = mk('ink', 'c2');
        const P = boxAt(L, 1100, 900, 960, 540, { background: '#FBF9F4', boxShadow: '0 28px 50px rgba(0,0,0,.7), 0 3px 7px rgba(0,0,0,.5)' });
        const win = div(P, '', { left: '40px', top: '40px', width: '1020px', height: '690px', overflow: 'hidden', background: '#02060d' });
        const plate = X.plate(win); Object.assign(plate.style, { width: '1227px', height: '690px', left: '-120px', transformOrigin: '50% 40%' });
        const fb = put(win, nightGrade(C, A.lofoten, 1020, 690), 0, 0, { visibility: 'hidden' });
        div(P, 'f-hand', { left: '70px', top: '752px', fontSize: '92px', lineHeight: '1', color: '#23201c', transform: 'rotate(-2deg)' }, X.fact('aurora').main);
        const st = imgEl(P, A.aurora.src, { left: '850px', top: '650px', width: '260px', height: '260px', transformOrigin: '50% 50%' });
        S.push({ L, P, rot: -5, dy: -36, dymo: recapDymo(P, 'FACT 07 / AURORA', 64, 62, 2), render: (f, k, jobs) => {
          const li = 20 + 4 * k, ok = A.hasAurora(li);
          plate.style.visibility = ok ? 'visible' : 'hidden'; fb.style.visibility = ok ? 'hidden' : 'visible';
          plate.style.transform = `scale(${(1 + 0.01 * k).toFixed(4)})`;
          if (ok) jobs.push(plate.setFrame('aurora', li));
          C.place(st, { rotate: 12 }, C.snapInAt(k, 1, { dur: 3, from: 1.5, seed: 'D-r3s' }), C.jitter('D-r3s', f, 1.2));
        } });
      }
      // 4 · Lofoten as a postage stamp on cream paper, postmark thunk
      {
        const L = mk('cream', 'c3');
        const stamp = postageStamp(C, A.lofoten, 1240, 780, { label: 'NORGE', labelSize: 70, rotImg: { fx: 0.435, fy: 0.53, deg: 18, s: 0.56 * 4000 / (A.lofoten.naturalWidth || 4000) } });
        const sc = withShadow(C, stamp, { blur: 22, y: 14, color: 'rgba(40,24,6,0.45)' });
        const P = boxAt(L, sc.width, sc.height, 960, 540);
        put(P, sc, 0, 0);
        // postmark in ink black: its ring sits on the cream paper and only bites the stamp's top-right corner
        const pm = C.makeStamp({ shape: 'postmark', w: 760, h: 300, color: INK, top: 'NORGE', bottom: 'NORWAY', center: [{ text: '挪威', font: 'sans', size: 84, y: 0.5 }] }, { seed: 'D-pm', ink: 0.85 });
        const ov = cv(P, 900, 460, { left: (sc.width - 420) + 'px', top: '-170px', zIndex: 2 }), og = ov.getContext('2d');
        S.push({ L, P, rot: 4, render: (f, k) => {
          og.clearRect(0, 0, 900, 460);
          C.drawStamp(og, pm, 420, 230, C.progRaw(k, 1, 4), { rot: -9, scale: 0.78, composite: 'source-over' });
        } });
      }
      // 5 · Lysefjord in a sliding film strip on yellow paper (energy up: reverse cymbal starts here)
      {
        const L = mk('yellow', 'c4');
        const fs = filmStrip(C, [
          { img: A.geiranger, o: { focus: { x: 0.62, y: 0.55 }, zoom: 1.5 } },
          { img: A.lysefjord, o: { focus: { x: 0.5, y: 0.72 }, zoom: 1.25 } },
          { img: A.tromso, o: { focus: { x: 0.5, y: 0.5 }, zoom: 1.3 } },
        ], 1100, 620);
        const P = boxAt(L, fs.width, fs.height, 960, 540, { boxShadow: '0 26px 44px rgba(60,40,0,.5)' });
        put(P, fs, 0, 0);
        const mid = fs.gap + fs.frameW + 550;                  // centre of the middle frame
        S.push({ L, P, rot: -4, dx: fs.width / 2 - mid, slide: 30 });
      }
      // 6 · Tromsø, warm midnight-sun grade, wide torn strip on navy + sun sticker + rays
      {
        const L = mk('navy', 'c5');
        const crop = { x: 0, y: 246, w: 2400, h: 875 };
        const wm = gradientMap(C, A.tromso, 1700, 620, crop, SUN_RAMP, { lo: 14, hi: 200, gamma: 0.85, mix: 0.2, glow: [0.86, 0.12, 0.55] });
        const tp = C.tornPaper(wm, { seed: 'D-trs', edges: 'lr', rim: 8, width: 1700, height: 620, fit: 'stretch', pad: 44, shadow: { x: 0, y: 18, blur: 26, color: 'rgba(0,0,0,0.55)' } });
        const P = boxAt(L, tp.width, tp.height, 960, 560);
        put(P, tp, 0, 0);
        const ov = cv(P, tp.width, tp.height, { zIndex: 2 }), og = ov.getContext('2d');
        const sunS = 300, sx = tp.pad + 1700 - 250, sy = tp.pad + 205, sR = sunS * 200 / 460;
        const sun = imgEl(P, A.sunNT.src, { left: (sx - sunS / 2) + 'px', top: (sy - sunS / 2) + 'px', width: sunS + 'px', height: sunS + 'px', zIndex: 3, transformOrigin: '50% 50%' });
        S.push({ L, P, rot: 2.5, dymo: recapDymo(P, 'FACT 08 / MIDNIGHT SUN', tp.pad + 60, tp.pad + 44, -2), render: (f, k) => {
          og.clearRect(0, 0, ov.width, ov.height);
          og.save(); og.beginPath(); og.rect(tp.pad + 10, tp.pad + 6, 1680, 608); og.clip();
          sunRays(C, og, sx, sy, sR + 14, sR + 64, 12, 0.2 + C.onTwos(f) * 0.02, f, C.prog(k, 1, 3), 'D-r6', 15, YEL);
          og.restore();
          C.place(sun, { rotate: -6 }, C.snapInAt(k, 0, { dur: 3, from: 1.5, seed: 'D-r6s' }), C.jitter('D-r6s', f, 1.2));
        } });
      }
      // 7 · Globe plates f176–182 seen through a torn hole in cream paper, Norway circled + pinned
      {
        const L = mk(null, 'c6');
        L.style.background = '#000';
        const gw = div(L, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '50% 47%' });
        const plate = X.plate(gw);
        const hole = put(L, tornWindow(C, A, 190, 120, 1540, 850, 'D-hole'), -120, -120, { transformOrigin: '50% 50%' });
        const ov = cv(gw, W, H, { zIndex: 2 }), og = ov.getContext('2d');
        const pin = imgEl(gw, A.pin.src, { left: '0px', top: '0px', width: '64px', transformOrigin: '50% 96%', zIndex: 3 });
        S.push({ L, P: hole, rot: 0, noSlam: true, render: (f, k, jobs) => {
          let gf = 176 + k;
          if (!A.hasGlobe(gf)) gf = [179, 180, 178, 182, 176, 185, 170].find(g => A.hasGlobe(g)) ?? null;
          if (gf === null) { gf = GLOBE_END; jobs.push(plate.setSrc(A.globeEnd.src)); } else jobs.push(plate.setFrame('globe', gf));
          gw.style.transform = `scale(${(1.05 + 0.012 * k).toFixed(4)})`;
          og.clearRect(0, 0, W, H);
          const c = X.project(gf, 65.2, 15.5), o = X.project(gf, 59.91, 10.75);
          C.marker.circle(og, { cx: c.x, cy: c.y, rx: 74, ry: 118, rotation: 27, seed: 'D-gc', width: 11, color: RED, progress: C.prog(k, 1, 4), frame: f, boil: 0.8 });
          C.place(pin, { x: o.x - 32, y: o.y - 64 * 0.9615 }, C.snapInAt(k, 2, { dur: 3, from: 1.8, rot0: 0, drop: 40 }));
        } });
      }
      // 8 · Title reprise 挪威 NORWAY over the navy duotone of the end-card satellite frame, rushing into the hit
      {
        const L = mk(null, 'c7');
        // navy duotone of the end-card backdrop (same framing, with bleed): at f840 it 'develops' into full colour
        L.bg = put(L, C.duotone(A.endBg, { width: A.endBg.naturalWidth, height: A.endBg.naturalHeight, dark: '#04102C', light: '#6B8CC8', contrast: 1.3, grain: 0.05 }), -A.endBX, -A.endBY);
        const [zh, en] = X.facts.copy.title.split(' ');
        const T = boxAt(L, W, H, 960, 540);
        const red = bakePlate(C, A, { w: 700, h: 330, kind: 'red', seed: 'D-t-red', edges: 'tb', rim: 9, lines: [{ text: zh, font: 'sans', size: 250, color: '#fff', track: 0.04, dy: 6, shadow: true }] });
        const crm = bakePlate(C, A, { w: 720, h: 200, kind: 'cream', seed: 'D-t-en', edges: 'lrb', rim: 7, lines: [{ text: en, font: 'anton', size: 170, color: INK, track: 0.06, dy: 6 }] });
        const r = put(T, red, 960 - red.width / 2 - 20, 430 - red.height / 2, { transformOrigin: '50% 50%' });
        const e = put(T, crm, 960 - crm.width / 2 + 40, 704 - crm.height / 2, { transformOrigin: '50% 50%' });
        const fl = imgEl(T, A.flagNo.src, { left: '410px', top: '104px', width: '240px', height: '185px', transformOrigin: '50% 50%' });
        const ov = cv(T, W, H, { zIndex: 5 }), og = ov.getContext('2d');
        const stp = C.makeStamp('norge', { color: '#F1E9D8' });
        S.push({ L, P: T, rot: 0, noSlam: true, render: (f, k) => {
          C.place(r, { rotate: -2 }, hitAt(k, 0, { seq: [1.3, 0.95, 1.02, 1] }), C.jitter('D-t8r', f, 1.6));
          C.place(e, { rotate: 2 }, C.snapInAt(k, 1, { dur: 3, seed: 'D-t8e' }), C.jitter('D-t8e', f, 1.4));
          C.place(fl, { rotate: -10 }, C.snapInAt(k, 2, { dur: 3, from: 1.7, seed: 'D-t8f' }), C.jitter('D-t8f', f, 1.2));
          og.clearRect(0, 0, W, H);
          // stamp thunk: 0.6 -> lands on k=3 fully opaque at 0.46 (no big translucent ghost over the plate)
          if (k >= 2) {
            const sS = [0.6, 0.445, 0.465, 0.46][Math.min(k - 2, 3)], sA = k === 2 ? 0.55 : 1, rr = (12 + (k === 2 ? 6 : 0)) * Math.PI / 180;
            og.save(); og.translate(1390, 350); og.rotate(rr); og.scale(sS, sS); og.globalAlpha = sA * 0.94;
            if (k === 3) { og.globalAlpha = 0.4; og.filter = 'blur(3px)'; og.drawImage(stp, -stp.width / 2, -stp.height / 2); og.filter = 'none'; og.globalAlpha = 0.94; }
            og.drawImage(stp, -stp.width / 2, -stp.height / 2); og.restore();
          }
          // rush into the final hit: accelerating push-in over the last frames
          const q = eInCubic(prog(k, 2, 4));
          T.style.transform = `scale(${(1 + 0.2 * q).toFixed(4)}) rotate(${(-1.5 * q).toFixed(3)}deg)`;
        } });
      }
      // horizontal motion-blur filters for the whip smear (cut n, strength 1|2)
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
      let defs = '';
      for (let n = 4; n < 8; n++) {
        const e = n / 7, d2 = Math.round(18 + 22 * e), d1 = Math.round(5 + 5 * e);
        defs += `<filter id="D-mb${n}-2" x="-10%" y="0%" width="120%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${d2} 0" edgeMode="duplicate"/></filter>`;
        defs += `<filter id="D-mb${n}-1" x="-10%" y="0%" width="120%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${d1} 0" edgeMode="duplicate"/></filter>`;
      }
      svg.innerHTML = '<defs>' + defs + '</defs>';
      root.appendChild(svg);
      this.flash = div(root, '', { inset: '0', background: '#FFFFFF', opacity: 0, zIndex: 90 });
    },

    async render(f, root, X) {
      const C = X.C, T = this.cuts, jobs = [];
      const n = T.reduce((a, t, i) => (f >= t ? i : a), 0), t = T[n], k = f - t;
      const e = n / 7;                                            // energy 0 → 1 over the montage
      this.S.forEach((s, i) => { s.L.style.display = i === n ? '' : 'none'; });
      const s = this.S[n];
      // camera: shake on every cut (stronger each time) + creeping zoom under the reverse cymbal (812 -> 840).
      // Never below 1.03, so shake + rotation can't open a gap at the frame edge.
      const sh = C.shake('D-rc' + n, f, t, { amp: 7 + 12 * e, decay: 3 });
      const pc = prog(f, T[4], O.hit - T[4]);
      const creep = 1.03 + 0.08 * pc * pc;
      this.cam.style.transform = `translate(${px(sh.x)},${px(sh.y)}) rotate(${sh.r.toFixed(3)}deg) scale(${creep.toFixed(4)})`;
      const clamp20 = v => Math.max(-20, Math.min(20, v));
      if (s.L.bg) s.L.bg.style.transform = `translate(${Math.round(clamp20(-6 * k * (n % 2 ? -1 : 1)))}px,${Math.round(clamp20(-3 * k))}px)`;
      // whip smear on the entry frames of cuts 5–8 (horizontal: the slam direction), stronger each cut
      const smear = n >= 4 ? (k === 0 ? 2 : k === 1 ? 1 : 0) : 0;
      s.L.style.filter = smear ? `url(#D-mb${n}-${smear})` : '';
      if (!s.noSlam) {
        const zr = 0.008 + 0.012 * e;
        const x = (s.dx || 0) + (s.slide ? s.slide * (3 - k) : 0);
        C.place(s.P, { x, rotate: s.rot, scale: 1 + zr * k }, hitAt(f, t, { seq: [1.08 + 0.12 * e, 0.965, 1.012, 0.998, 1], rot0: (n % 2 ? 1 : -1) * (3 + 3 * e), dx: (n % 2 ? 1 : -1) * (80 + 90 * e), dy: s.dy ?? (n % 3 - 1) * 40, settle: 2 }), C.jitter('D-rp' + n, f, 1.5));
      } else if (s.P) {
        C.place(s.P, {}, hitAt(f, t, { seq: [1.08 + 0.06 * e, 0.98, 1.005, 1] }), C.jitter('D-rp' + n, f, 1.2));
      }
      // FACT callback label (red label-maker, house style) snaps onto the print on the cut's 2nd frame
      if (s.dymo) C.place(s.dymo.el, { rotate: s.dymo.rot }, C.snapInAt(k, 1, { dur: 2, from: 1.25, seed: 'D-rd' + n }), C.jitter('D-rd' + n, f, 0.8));
      if (s.render) s.render(f, k, jobs);
      this.flash.style.opacity = flashAt(f, t, [0.18 + 0.3 * e, 0.06 + 0.08 * e, 0.02]);
      await Promise.all(jobs);
    },
  });

  // =================================================================================== S8 OUTRO: END CARD
  const EO = [1220, 450];                       // ecam push-in origin (centre of Norway on screen)
  COMP.section({
    id: 's8-endcard', start: O.hit, end: O.end, z: 30,

    async init(root, X) {
      const C = X.C, A = await loadShared(X);
      this.A = A;
      const h = cueFrames(X, 'impact_final', O.hit - 10, O.end);
      this.hit = h.length ? h[0] : O.hit;
      root.style.background = '#06142f';
      // backdrop: orthographic Sentinel-2 view (own bake, 120/90 px bleed) with the whole of Norway above the credits;
      // outline marker, Oslo pin and the departing flight are projected with the same camera (A.endProj)
      this.ecam = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: `${EO[0]}px ${EO[1]}px` });
      const bw = A.endBg.naturalWidth || W, bh = A.endBg.naturalHeight || H;
      imgEl(this.ecam, A.endBg.src, { left: -A.endBX + 'px', top: -A.endBY + 'px', width: bw + 'px', height: bh + 'px' });
      div(this.ecam, '', { left: -A.endBX + 'px', top: -A.endBY + 'px', width: bw + 'px', height: bh + 'px',
        background: 'linear-gradient(90deg, rgba(3,12,34,.70) 0%, rgba(3,12,34,.50) 26%, rgba(3,12,34,.12) 44%, rgba(3,12,34,0) 54%), linear-gradient(0deg, rgba(3,12,34,.62) 0%, rgba(3,12,34,0) 24%), radial-gradient(ellipse at 62% 42%, rgba(0,0,0,0) 40%, rgba(2,8,24,.35) 100%)' });
      this.ocv = cv(this.ecam, W, H, { zIndex: 2 }); this.og = this.ocv.getContext('2d');
      // clean country outline: the generalised ring made for S2 (fjord slots closed) + big islands; fallback: geojson
      let gen = null; try { gen = await X.json('assets/A-globe/norway_border_generalized.json'); } catch (e) { gen = null; }
      const ringLL = gen && gen.ring || (X.geo.norwaySimple.features.find(ft => ft.properties.part === 'mainland_main_ring_coarse') || X.geo.norwaySimple.features.find(ft => ft.properties.part === 'mainland_main_ring')).geometry.coordinates;
      const pj = ([lon, lat]) => A.endProj(lat, lon);
      this.ring = ringLL.map(pj); this.ring.push(this.ring[0]);
      this.islands = (gen && gen.islands || []).map(r => { const q = r.map(pj); q.push(q[0]); return q; });
      const o = A.endProj(59.91, 10.75);
      this.oslo = o;
      this.pin = imgEl(this.ecam, A.pin.src, { left: (o[0] - 38) + 'px', top: (o[1] - 76 * 0.9615) + 'px', width: '76px', transformOrigin: '50% 96%', filter: 'drop-shadow(0 5px 4px rgba(0,0,0,.5))', zIndex: 4, visibility: 'hidden' });
      // departing flight: Oslo -> out of frame to the east (toward Taiwan), quadratic curve (ecam-local)
      this.fp = [[o[0] + 12, o[1] - 34], [1480, 560], [2080, 330]];
      this.plane = imgEl(root, A.plane.src, { left: '-80px', top: '-80px', width: '160px', height: '160px', zIndex: 20, visibility: 'hidden', transformOrigin: '50% 50%' });

      // text block (left, over the Norwegian Sea)
      const copy = X.facts.copy, [wNo, wZh] = copy.endcard_welcome.split(' · ');
      const nS = 80, nW = Math.round(textW(C, 'anton', nS, wNo.toUpperCase(), 0.05) + 100);
      const cream = bakePlate(C, A, { w: nW, h: 134, kind: 'cream', seed: 'D-e-no', edges: 'lrb', rim: 7, lines: [{ text: wNo.toUpperCase(), font: 'anton', size: nS, color: INK, track: 0.05, dy: 3 }] });
      this.pNo = put(root, cream, 118 - cream.pad, 232 - cream.pad, { zIndex: 10, visibility: 'hidden', transformOrigin: `${cream.pad + 40}px 50%` });
      const zS = 124, zW = Math.round(textW(C, 'sans', zS, wZh, 0.03) + 104);
      const red = bakePlate(C, A, { w: zW, h: 190, kind: 'red', seed: 'D-e-zh', edges: 'tb', rim: 8, lines: [{ text: wZh, font: 'sans', size: zS, color: '#fff', track: 0.03, dy: 5, shadow: true }] });
      this.pZh = put(root, red, 96 - red.pad, 372 - red.pad, { zIndex: 11, visibility: 'hidden', transformOrigin: `${red.pad + 60}px 50%` });
      this.zhBox = [96, 372, zW, 190];
      const nx = bakeTape(C, A, copy.endcard_next, { size: 66, h: 112, padX: 60, tape: 'tapeBeige' });
      this.pNext = put(root, nx, 124 - nx.pad, 610 - nx.pad, { zIndex: 12, visibility: 'hidden', transformOrigin: `${nx.pad + 40}px 50%` });
      this.nextBox = [124, 610, nx.tw, nx.th];
      if (zW + 96 > 1000) console.warn('D: end-card plate wider than the sea column', zW);
      // flag stickers (Norway + ROC), top left
      this.fNo = imgEl(root, A.flagNo.src, { left: '120px', top: '58px', width: '196px', height: '151px', zIndex: 13, visibility: 'hidden', transformOrigin: '50% 50%' });
      this.fRoc = imgEl(root, A.flagRoc.src, { left: '286px', top: '70px', width: '200px', height: '144px', zIndex: 14, visibility: 'hidden', transformOrigin: '50% 50%' });
      // stamp + marker overlay (screen space)
      this.scv = cv(root, 520, 420, { left: '470px', top: '540px', zIndex: 9 }); this.sg = this.scv.getContext('2d');
      this.stamp = C.makeStamp('norge', { color: '#F1E9D8' });
      this.mcv = cv(root, 1000, 260, { left: '60px', top: '520px', zIndex: 15 }); this.mg = this.mcv.getContext('2d');

      // credits (static, crisp): facts credits_line + imagery attributions (Space Mono Regular 20 px: the small bold
      // 'w' reads as 'm'); three lines, inside title-safe, below the map
      const IA = X.facts.imagery_attributions;
      const lines = [X.facts.credits_line, `${IA[0]} · ${IA[2]} · Natural Earth`, IA[1]];
      const fs = 20, lh = 30, padX = 26, padY = 14, cf = C.font('mono', fs, 400);
      // CJK runs in Noto Sans TC 700 (like .footnote .zh), Latin in Space Mono
      const CJK = /[\u3000-\u9fff\uff00-\uffef]/;
      const runs = (g, l, draw, y) => {
        let x = padX;
        for (const run of l.split(/([\u3000-\u9fff\uff00-\uffef]+)/)) {
          if (!run) continue;
          g.font = CJK.test(run) ? C.font('sans', fs, 700) : cf;
          if (draw) g.fillText(run, x, y);
          x += g.measureText(run).width;
        }
        return x + padX;
      };
      const g0 = C.canvas(8, 8).getContext('2d');
      const cw = Math.round(Math.max(...lines.map(l => runs(g0, l, false)))), ch = lines.length * lh + 2 * padY;
      const cp = paperCanvas(C, A, cw, ch, 'newsprint', { crumple: 0.3 });
      { const g = cp.getContext('2d'); g.fillStyle = INK; g.textBaseline = 'middle';
        lines.forEach((l, i) => runs(g, l, true, padY + lh * (i + 0.5) + 1)); }
      const ct = C.tornPaper(cp, { seed: 'D-cred', edges: 't', rim: 6, width: cw, height: ch, fit: 'stretch', pad: 30, shadow: { x: 0, y: 6, blur: 12, color: 'rgba(0,0,0,0.45)' } });
      this.credW = cw; this.credTop = 1026 - ch;
      this.cred = put(root, ct, 96 - ct.pad, 1026 - ch - ct.pad, { zIndex: 16 });
      if (cw > 1728) console.warn('D: credits wider than title-safe', cw);
      this.flash = div(root, '', { inset: '0', background: '#FFFFFF', opacity: 0, zIndex: 90 });
    },

    async render(f, root, X) {
      const C = X.C, T = this.hit, k = f - T;
      // backdrop: slow push-in + gentle drift (smooth, 30 fps), impact shake
      const p = prog(f, T, O.end - T);
      const sh = C.shake('D-end', f, T, { amp: 16, decay: 5 });
      const wv = C.wander('D-endw', f, 4, 0.05);
      const S = 1.0 + 0.05 * eOutCubic(p) + 0.03 * (1 - eOutCubic(prog(f, T, 8)));      // tiny 1.03 punch on the hit
      const tx = sh.x + wv.x, ty = sh.y + wv.y;
      this.ecam.style.transform = `translate(${px(tx)},${px(ty)}) scale(${S.toFixed(4)})`;
      this.flash.style.opacity = flashAt(f, T, [0.8, 0.22, 0.07, 0.02]);
      // Norway outline marker + Oslo pin
      const g = this.og; g.clearRect(0, 0, W, H);
      C.markerPath(g, this.ring, { width: 5, color: '#FFFFFF', alpha: 0.92, progress: C.prog(f, T + 1, 18), seed: 'D-ring', frame: f, boil: 0.6 });
      if (f >= T + 12) this.islands.forEach((r, i) => C.markerPath(g, r, { width: 3.5, color: '#FFFFFF', alpha: 0.85, progress: C.prog(f, T + 12 + (i % 5), 4), seed: 'D-isl' + i, taper: [2, 4] }));
      C.place(this.pin, {}, C.snapInAt(f, T + 6, { dur: 3, from: 1.8, rot0: 0, drop: 40 }), C.jitter('D-epin', f, 0.8));
      // title plates: slam ON the final hit, then drift on twos
      const jx = sh.x * 0.6, jy = sh.y * 0.6;
      C.place(this.pNo, { x: jx, y: jy, rotate: -2.2 }, hitAt(f, T, { seq: [1.22, 0.95, 1.02, 0.997, 1], rot0: -4 }), C.jitter('D-eno', f, 1.3));
      C.place(this.pZh, { x: jx, y: jy, rotate: 1.4 }, hitAt(f, T, { seq: [1.3, 0.94, 1.025, 0.996, 1], rot0: 5 }), C.jitter('D-ezh', f, 1.6));
      C.place(this.pNext, { x: jx, y: jy, rotate: -1.8 }, C.snapInAt(f, T + 8, { dur: 4, seed: 'D-enx' }), C.jitter('D-enx', f, 1.2));
      C.place(this.fNo, { rotate: -9 }, C.snapInAt(f, T + 2, { dur: 4, from: 1.7, seed: 'D-efn' }), C.jitter('D-efn', f, 1.4), C.wander('D-efnw', f, 3, 0.05));
      C.place(this.fRoc, { rotate: 7 }, C.snapInAt(f, T + 4, { dur: 4, from: 1.7, seed: 'D-efr' }), C.jitter('D-efr', f, 1.4), C.wander('D-efrw', f, 3, 0.05));
      // stamp thunk (cream ink on the dark sea)
      const sg = this.sg; sg.clearRect(0, 0, 520, 420);
      C.drawStamp(sg, this.stamp, 262, 250, C.progRaw(f, T + 10, 6), { rot: -14, scale: 0.38, composite: 'source-over' });
      // marker underline under 歡迎來到挪威
      const mg = this.mg; mg.setTransform(1, 0, 0, 1, 0, 0); mg.clearRect(0, 0, 1000, 260); mg.setTransform(1, 0, 0, 1, -60, -520);
      const [zx, zy, zw, zh] = this.zhBox;
      C.marker.underline(mg, { x1: zx + 30, x2: zx + zw - 16, y: zy + zh + 8, seed: 'D-eul', width: 12, color: YEL, progress: C.prog(f, T + 5, 6), frame: f, boil: 0.8 });
      // departing plane along the dashed flight path (smooth), from T+9
      const q = prog(f, T + 9, O.end - T - 9), qe = 0.08 + 0.92 * (q * q * (1.4 - 0.4 * q));
      const [a, b, c] = this.fp;
      const bez = (u) => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * b[0] + u * u * c[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * b[1] + u * u * c[1]];
      const pts = []; for (let i = 0; i <= 60; i++) pts.push(bez(qe * i / 60));
      if (f >= T + 9) {
        const seg = 5;                                                  // dashes: every other segment of the trail
        for (let i = 0; i + seg < pts.length; i += 2 * seg) C.markerPath(g, pts.slice(i, i + seg + 1), { width: 6, color: YEL, alpha: 0.95, seed: 'D-fd' + i, taper: [2, 2] });
        const [x, y] = pts[pts.length - 1], [x0, y0] = pts[pts.length - 3];
        const hd = Math.atan2(x - x0, -(y - y0)) * 180 / Math.PI;       // 0 = north (nose up)
        // the plane lives in screen space: map the ecam-local point through the ecam transform
        const X0 = EO[0] + (x - EO[0]) * S + tx, Y0 = EO[1] + (y - EO[1]) * S + ty;
        C.place(this.plane, { x: X0, y: Y0, rotate: hd, scale: 1 + 0.25 * q }, C.snapInAt(f, T + 9, { dur: 3, from: 1.6, rot0: 0 }));
      } else this.plane.style.visibility = 'hidden';
    },
  });
})();
