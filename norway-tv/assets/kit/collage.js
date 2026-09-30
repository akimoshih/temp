/* collage.js: deterministic editorial-collage toolkit for the NORWAY-in-30s compositor.
 *
 * Classic script -> window.Collage   (ES module users: import Collage from './collage.mjs')
 * Every visual is a PURE FUNCTION of (frame, seed, options): no Math.random, no Date, no CSS animation.
 * Canvas results that are expensive (halftone, torn plates, stamps, stickers, boarding pass) are cached.
 * Needs Chromium flags --allow-file-access-from-files (the recorder already passes them) because
 * halftone() reads pixels of file:// images.
 * API docs: README.md
 */
(function (root) {
  'use strict';
  const C = {};
  const PI = Math.PI, TAU = PI * 2;

  // ------------------------------------------------------------------ base path / assets
  let BASE = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src)
    ? new URL('.', document.currentScript.src).href : (root.COLLAGE_BASE || './');
  C.setBase = (b) => { BASE = b.endsWith('/') ? b : b + '/'; };
  C.asset = (p) => new URL(p, BASE).href;

  C.colors = {
    cream: '#F1E9D8', newsprint: '#E4E0D6', kraft: '#C8A27A', ink: '#141414',
    red: '#BA0C2F', navy: '#00205B', white: '#FFFFFF', aurora: '#3CF2B0', yellow: '#FFE14D',
    rocRed: '#FE0000', rocBlue: '#000095', rim: '#FBF8F0',
  };
  // font shorthands for canvas ctx.font (px = size in px)
  const FONT_FAMILY = {
    sans: '"Noto Sans TC", sans-serif', serif: '"Noto Serif TC", serif', anton: 'Anton, "Noto Sans TC", sans-serif',
    mono: '"Space Mono", "Noto Sans TC", monospace', hand: '"LXGW WenKai TC", "Noto Sans TC", sans-serif',
    marker: '"Permanent Marker", "LXGW WenKai TC", sans-serif',
  };
  const FONT_WEIGHT = { sans: 900, serif: 900, anton: 400, mono: 700, hand: 700, marker: 400 };
  C.font = (kind, px, weight) => `${weight || FONT_WEIGHT[kind] || 400} ${px}px ${FONT_FAMILY[kind] || kind}`;
  C.FONT_FAMILY = FONT_FAMILY;

  // ------------------------------------------------------------------ timing
  C.FPS = 30; C.BEAT = 14; C.BAR = 56; C.FRAMES = 900;
  C.beat = (n) => 14 * n;
  C.bar = (k) => 56 * k;
  C.onTwos = (f) => f - (((f % 2) + 2) % 2);            // hold every other frame (15 fps)
  C.onN = (f, n) => f - (((f % n) + n) % n);
  C.prog = (f, start, dur) => clamp01((f - start) / Math.max(1e-9, dur));
  C.progRaw = (f, start, dur) => (f - start) / Math.max(1e-9, dur); // may be <0 or >1
  C.inRange = (f, a, b) => f >= a && f <= b;

  // ------------------------------------------------------------------ math
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  C.clamp = clamp; C.clamp01 = clamp01; C.lerp = lerp;
  C.remap = (v, a, b, c, d, clampIt = true) => { let t = (v - a) / (b - a); if (clampIt) t = clamp01(t); return c + (d - c) * t; };
  C.smoothstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  C.deg = (r) => r * 180 / PI; C.rad = (d) => d * PI / 180;

  // ------------------------------------------------------------------ PRNG (seeds may be numbers or strings)
  function strHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function mix32(h) { h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16; return h >>> 0; }
  function hash(...args) {
    let h = 0x9e3779b9;
    for (const a of args) {
      const v = typeof a === 'string' ? strHash(a) : (Number.isInteger(a) ? a : Math.floor(a * 65536));
      h = mix32((h ^ v) + 0x632be5ab | 0);
    }
    return h;
  }
  C.hash = hash;
  C.rand = (...args) => hash(...args) / 4294967296;                       // [0,1)
  C.srand = (...args) => hash(...args) / 2147483648 - 1;                  // [-1,1)
  C.rng = function (seed) {                                               // mulberry32 stream
    let s = hash(seed);
    const next = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    return {
      next, range: (a, b) => a + (b - a) * next(), int: (a, b) => a + Math.floor(next() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(next() * arr.length)], sign: () => (next() < 0.5 ? -1 : 1),
      normal: () => { const u = Math.max(1e-12, next()), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); },
    };
  };
  // smooth 1-D value noise in [-1,1] and fbm
  C.noise1 = function (seed, x) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(C.srand(seed, i), C.srand(seed, i + 1), u);
  };
  C.fbm1 = function (seed, x, oct = 4) {
    let a = 0.5, s = 0, n = 0;
    for (let o = 0; o < oct; o++) { s += a * C.noise1(hash(seed, o), x); n += a; x *= 2.03; a *= 0.5; }
    return s / n;
  };

  // stop-motion jitter: value is held for 2 frames (on twos)
  C.jitter = function (seed, frame, amp = 2, rotAmp) {
    if (rotAmp === undefined) rotAmp = amp * 0.3;
    const k = Math.floor(frame / 2);
    const x = C.srand(seed, k, 1) * amp, y = C.srand(seed, k, 2) * amp, r = C.srand(seed, k, 3) * rotAmp;
    return { x, y, r, css: `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg)` };
  };
  // smooth wander (30 fps, for camera drift / gate weave)
  C.wander = function (seed, frame, amp = 1, speed = 0.05) {
    return { x: C.fbm1(hash(seed, 1), frame * speed, 3) * amp, y: C.fbm1(hash(seed, 2), frame * speed, 3) * amp, r: C.fbm1(hash(seed, 3), frame * speed, 3) * amp * 0.05 };
  };

  // ------------------------------------------------------------------ easing
  const E = {};
  E.linear = (t) => t;
  E.inQuad = (t) => t * t; E.outQuad = (t) => 1 - (1 - t) * (1 - t); E.inOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  E.inCubic = (t) => t * t * t; E.outCubic = (t) => 1 - Math.pow(1 - t, 3); E.inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  E.outQuart = (t) => 1 - Math.pow(1 - t, 4); E.outQuint = (t) => 1 - Math.pow(1 - t, 5);
  E.inExpo = (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
  E.outExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  E.inOutExpo = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2);
  E.outCirc = (t) => Math.sqrt(1 - Math.pow(t - 1, 2));
  E.outBack = (t, s = 1.70158) => { const c3 = s + 1; return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  E.inBack = (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t;
  E.inOutBack = (t, s = 1.70158) => { const c2 = s * 1.525; return t < 0.5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2; };
  E.overshoot = (t) => { t = clamp01(t); return 1 - Math.pow(1 - t, 2) * Math.cos(t * PI * 1.5); };   // 0 -> ~1.18 -> 1
  E.outElastic = (t, amp = 1, period = 0.3) => {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const a = Math.max(1, amp), s = period / TAU * Math.asin(1 / a);
    return a * Math.pow(2, -10 * t) * Math.sin((t - s) * TAU / period) + 1;
  };
  E.outBounce = (t) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
  E.smooth = (t) => t * t * (3 - 2 * t);
  E.steps = (t, n) => Math.floor(clamp01(t) * n) / n;             // stepped (stop-motion) easing
  C.ease = E;

  /** Damped spring, analytic (pure function of t in SECONDS).
   *  opts: {from=0,to=1,stiffness=170,damping=14,mass=1,velocity=0} */
  C.spring = function (t, o = {}) {
    const from = o.from ?? 0, to = o.to ?? 1, k = o.stiffness ?? 170, c = o.damping ?? 14, m = o.mass ?? 1, v0 = o.velocity ?? 0;
    if (t <= 0) return from;
    const x0 = from - to, w0 = Math.sqrt(k / m), z = c / (2 * Math.sqrt(k * m));
    let x;
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); x = Math.exp(-z * w0 * t) * (x0 * Math.cos(wd * t) + ((v0 + z * w0 * x0) / wd) * Math.sin(wd * t)); }
    else if (z === 1) { x = Math.exp(-w0 * t) * (x0 + (v0 + w0 * x0) * t); }
    else { const s = Math.sqrt(z * z - 1), r1 = -w0 * (z - s), r2 = -w0 * (z + s), c1 = (v0 - r2 * x0) / (r1 - r2), c2 = x0 - c1; x = c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t); }
    return to + x;
  };
  C.springF = (frames, o) => C.spring(frames / C.FPS, o);         // same, t in frames

  // ------------------------------------------------------------------ motion presets
  // damped curve with f(0)=1, f(1)=0 and one undershoot -> used for "snap" presets
  const settle = (p) => { p = clamp01(p); return Math.pow(1 - p, 2) * Math.cos(p * PI * 1.5); };
  C.settle = settle;
  function tf(o) {
    o.css = `translate(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px) rotate(${(o.rotate || 0).toFixed(3)}deg) scale(${(o.scale ?? 1).toFixed(4)})`;
    return o;
  }
  C.transformCss = tf;

  /** snapIn(p): cut-out entrance. p = 0..1 over the snap (3-5 frames; use snapInAt for frames).
   *  scale 1.3 -> ~0.95 -> 1 (overshoot), rotation settles from rot0 to rot. p<0 -> hidden. */
  C.snapIn = function (p, o = {}) {
    const from = o.from ?? 1.3, rot0 = o.rot0 ?? (o.seed !== undefined ? C.srand(o.seed, 'rot') * 7 : 6), rot = o.rot ?? 0;
    if (p < 0) return tf({ scale: from, rotate: rot0 + rot, opacity: 0, x: 0, y: 0, visible: false });
    const f = settle(p);
    const dy = o.drop ?? 0;
    return tf({ scale: 1 + (from - 1) * f, rotate: rot + rot0 * f, opacity: 1, x: 0, y: -dy * f, visible: true });
  };
  C.snapInAt = (frame, start, o = {}) => C.snapIn(C.progRaw(frame, start, o.dur ?? 4), o);

  /** popOut(p): quick exit 1 -> 1.08 -> 0 (3 frames). */
  C.popOut = function (p, o = {}) {
    p = clamp01(p);
    const s = p < 0.35 ? lerp(1, o.peak ?? 1.08, E.outQuad(p / 0.35)) : lerp(o.peak ?? 1.08, 0, E.inCubic((p - 0.35) / 0.65));
    return tf({ scale: s, rotate: (o.rot ?? 8) * p, opacity: p >= 1 ? 0 : 1, x: 0, y: 0, visible: p < 1 });
  };
  C.popOutAt = (frame, start, o = {}) => C.popOut(C.progRaw(frame, start, o.dur ?? 3), o);

  /** slam(p): heavy title slam: scale from 2.4 to 1 with expo, 1-frame 0.96 squash. */
  C.slam = function (p, o = {}) {
    const from = o.from ?? 2.4;
    if (p < 0) return tf({ scale: from, rotate: 0, opacity: 0, visible: false });
    const hit = o.hit ?? 0.55;
    const s = p < hit ? lerp(from, 1, E.inQuad(p / hit)) : 1 - 0.045 * Math.pow(1 - clamp01((p - hit) / (1 - hit)), 2);  // squash then settle
    return tf({ scale: s, rotate: (o.rot ?? 0) * (1 - clamp01(p / hit)), opacity: 1, visible: true, impact: p >= hit });
  };
  C.slamAt = (frame, start, o = {}) => C.slam(C.progRaw(frame, start, o.dur ?? 5), o);

  /** stamp(p): rubber-stamp thunk. p=0..1 over ~6 frames (stampAt). Returns transform + ink params.
   *  scale 1.9 -> 0.93 (impact at p=.35) -> 1; inkSpread peaks at impact then settles to 0.15. */
  C.stampFx = function (p, o = {}) {
    const from = o.from ?? 1.9, hit = 0.35;
    if (p < 0) return tf({ scale: from, rotate: 0, opacity: 0, inkSpread: 0, blur: 0, visible: false, impact: false });
    let s, spread;
    if (p < hit) { const q = E.inCubic(p / hit); s = lerp(from, 0.93, q); spread = 0; }
    else { const q = (p - hit) / (1 - hit); s = 1 - 0.07 * settle(q); spread = lerp(1, 0.15, E.outCubic(clamp01(q))); }
    const opacity = p < hit ? lerp(0.0, 0.55, p / hit) : lerp(1, 0.94, clamp01((p - hit) / (1 - hit)));
    return tf({ scale: s, rotate: (o.rot ?? 0) + (o.twist ?? 5) * (1 - clamp01(p / hit)), opacity, inkSpread: spread, blur: p < hit ? (1 - p / hit) * 2 : 0, visible: true, impact: p >= hit });
  };
  C.stamp = C.stampFx;   // alias: C.stamp(progress) as named in the brief
  C.stampAt = (frame, start, o = {}) => C.stampFx(C.progRaw(frame, start, o.dur ?? 6), o);

  /** Decaying camera shake after an impact frame (smooth, 30 fps). */
  C.shake = function (seed, frame, hitFrame, o = {}) {
    const amp = o.amp ?? 16, decay = o.decay ?? 7, freq = o.freq ?? 0.9;
    const t = frame - hitFrame;
    if (t < 0) return { x: 0, y: 0, r: 0, css: 'none' };
    const env = Math.exp(-t / decay);
    const x = C.noise1(hash(seed, 1), t * freq) * amp * env, y = C.noise1(hash(seed, 2), t * freq + 17) * amp * env, r = C.noise1(hash(seed, 3), t * freq + 5) * amp * 0.06 * env;
    return { x, y, r, css: `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg)` };
  };

  /** Film overlay state for a frame: which grain / dust texture, offsets, gate weave, flicker. */
  C.film = function (frame, seed = 'film') {
    let gi = Math.floor(C.rand(seed, 'g', frame) * 8);
    const prev = Math.floor(C.rand(seed, 'g', frame - 1) * 8);
    if (gi === prev) gi = (gi + 3) % 8;
    const k = Math.floor(frame / 2);
    const dustOn = C.rand(seed, 'dOn', k) < 0.7;
    const w = C.wander(hash(seed, 'weave'), frame, 0.7, 0.35);
    return {
      grain: C.asset(`textures/grain_${gi}.png`), grainIndex: gi,
      grainOffset: { x: Math.floor(C.rand(seed, 'gx', frame) * 128) - 64, y: Math.floor(C.rand(seed, 'gy', frame) * 128) - 64 },
      dust: dustOn ? C.asset(`textures/dust_${Math.floor(C.rand(seed, 'd', k) * 4)}.png`) : null,
      dustOffset: { x: Math.floor(C.srand(seed, 'dx', k) * 300), y: Math.floor(C.srand(seed, 'dy', k) * 200) },
      dustFlip: C.rand(seed, 'df', k) < 0.5,
      weave: { x: w.x, y: w.y * 0.6, r: w.r * 0.4, css: `translate(${w.x.toFixed(3)}px,${(w.y * 0.6).toFixed(3)}px) rotate(${(w.r * 0.4).toFixed(4)}deg)` },
      flicker: 1 + C.srand(seed, 'fl', frame) * 0.012,
    };
  };

  /** Film overlay layer (grain, dust, optional light leak, vignette) with ALL frames pre-decoded and
   *  toggled by visibility, so no image decode happens between render() and screenshot.
   *  await Collage.createFilmLayer(parent, {grain:.2, dust:.75, leak:0, vignette:true, zIndex:1000})
   *  -> {el, render(frame, {leak, grain, dust})}  */
  C.createFilmLayer = async function (parent, o = {}) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { position: 'absolute', left: '0', top: '0', width: '1920px', height: '1080px', pointerEvents: 'none', zIndex: o.zIndex ?? 1000, overflow: 'hidden' });
    const mk = (src, cls) => { const im = new Image(); im.src = C.asset(src); im.className = 'overlay ' + cls; im.style.visibility = 'hidden'; wrap.appendChild(im); return im; };
    const grains = Array.from({ length: 8 }, (_, i) => mk(`textures/grain_${i}.png`, 'grain-overlay'));
    const dusts = Array.from({ length: 4 }, (_, i) => mk(`textures/dust_${i}.png`, 'dust-overlay'));
    const leaks = [mk('textures/leak_0.jpg', 'leak-overlay'), mk('textures/leak_1.jpg', 'leak-overlay')];
    let vig = null;
    if (o.vignette !== false) { vig = document.createElement('div'); vig.className = 'overlay vignette'; wrap.appendChild(vig); }
    await Promise.all([...grains, ...dusts, ...leaks].map((im) => im.decode().catch(() => {})));
    parent.appendChild(wrap);
    let lastG = null, lastD = null;
    return {
      el: wrap,
      render(frame, r = {}) {
        const s = C.film(frame, o.seed || 'film');
        if (lastG) lastG.style.visibility = 'hidden';
        const g = grains[s.grainIndex]; g.style.visibility = 'visible'; g.style.opacity = r.grain ?? o.grain ?? 0.2;
        g.style.transform = `translate(${s.grainOffset.x}px,${s.grainOffset.y}px) scale(1.14)`; lastG = g;
        if (lastD) lastD.style.visibility = 'hidden'; lastD = null;
        if (s.dust && (r.dust ?? o.dust ?? 0.75) > 0) {
          const d = dusts[+s.dust.match(/dust_(\d)/)[1]]; d.style.visibility = 'visible'; d.style.opacity = r.dust ?? o.dust ?? 0.75;
          d.style.transform = `translate(${s.dustOffset.x}px,${s.dustOffset.y}px) scaleX(${s.dustFlip ? -1 : 1})`; lastD = d;
        }
        const lk = r.leak ?? o.leak ?? 0;       // 0..1 (animate it yourself, e.g. on transitions)
        leaks.forEach((l, i) => { const v = (r.leakIndex ?? 0) === i ? lk : 0; l.style.visibility = v > 0 ? 'visible' : 'hidden'; l.style.opacity = v; });
        return s;
      },
    };
  };

  // ------------------------------------------------------------------ text helpers
  C.formatNumber = function (n, o = {}) {
    const d = o.decimals ?? 0, sep = o.sep ?? ',', dot = o.dot ?? '.';
    const neg = n < 0; n = Math.abs(n);
    const fixed = n.toFixed(d);
    let [i, f] = fixed.split('.');
    i = i.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return (neg ? '-' : '') + i + (f ? dot + f : '');
  };
  /** count-up: value at progress p (eased), formatted. countUp(5630000, p) -> '5,630,000' */
  C.countUpValue = (to, p, o = {}) => { const e = (o.ease || E.outExpo)(clamp01(p)); const from = o.from ?? 0; return from + (to - from) * e; };
  C.countUp = function (to, p, o = {}) {
    const d = o.decimals ?? 0, m = Math.pow(10, d);
    let v = C.countUpValue(to, p, o);
    v = (o.floor ?? true) ? Math.floor(v * m + 1e-9) / m : Math.round(v * m) / m;
    if (p >= 1) v = to;
    return (o.prefix || '') + C.formatNumber(v, o) + (o.suffix || '');
  };
  C.countUpAt = (to, frame, start, end, o) => C.countUp(to, C.prog(frame, start, end - start), o);
  /** 5630000 -> {value: 563, unit: '萬'}; 38500 -> {value: 3.85, unit: '萬'} */
  C.toWan = (n, decimals = 0) => ({ value: +(n / 1e4).toFixed(decimals), unit: '萬', text: C.formatNumber(n / 1e4, { decimals }) + ' 萬' });

  const SEG = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('zh-Hant', { granularity: 'grapheme' }) : null;
  C.graphemes = (s) => (SEG ? Array.from(SEG.segment(s), (x) => x.segment) : Array.from(s));
  const PAUSE = { '，': 3, '、': 2.5, ',': 2, '。': 5, '.': 3, '？': 5, '?': 4, '！': 5, '!': 4, '：': 3, ':': 2, '…': 2.2, '—': 1.5, ' ': 0.6, '\n': 3 };
  /** Frame at which each grapheme appears when `text` types between frames start..end
   *  (punctuation gets longer holds). Use it for typewriter SFX timing too. */
  C.typeSchedule = function (text, start, end, o = {}) {
    const g = C.graphemes(text), pause = Object.assign({}, PAUSE, o.pause || {});
    const w = g.map((ch, i) => (i === 0 ? 0 : 1 + (pause[g[i - 1]] ? pause[g[i - 1]] - 1 : 0)));
    const tot = w.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return g.map((ch, i) => { acc += w[i]; return { ch, frame: Math.round(start + (end - start) * (acc / tot)) }; });
  };
  /** typewriter(text, p): string revealed at progress p (0..1). Returns {text, count, total, done, cursor}. */
  C.typewriter = function (text, p, o = {}) {
    const g = C.graphemes(text);
    const n = Math.floor(clamp01(p) * g.length + 1e-9);
    return { text: g.slice(0, n).join(''), count: n, total: g.length, done: n >= g.length, cursor: o.cursor ?? '▍' };
  };
  /** typewriterAt(text, frame, start, end): schedule-based reveal (pauses at punctuation).
   *  cursorOn blinks every 8 frames once typing is done. */
  C.typewriterAt = function (text, frame, start, end, o = {}) {
    const sch = C.typeSchedule(text, start, end, o);
    let n = 0; for (const s of sch) if (frame >= s.frame) n++;
    const done = n >= sch.length;
    return { text: sch.slice(0, n).map((s) => s.ch).join(''), count: n, total: sch.length, done,
      justTyped: sch.some((s) => s.frame === frame), cursorOn: !done || Math.floor((frame - end) / 8) % 2 === 0 };
  };

  // ------------------------------------------------------------------ canvas & asset loading
  C.canvas = function (w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const imgCache = new Map();
  /** url: absolute, page-relative ('../renders/globe/f0000.jpg'), or kit-relative with the 'kit:' prefix ('kit:svg/pin.svg'). */
  C.resolve = (url) => (url.startsWith('kit:') ? C.asset(url.slice(4)) : /^(https?:|file:|data:|blob:)/.test(url) ? url : new URL(url, document.baseURI).href);
  C.loadImage = function (url) {
    const u = C.resolve(url);
    if (!imgCache.has(u)) {
      imgCache.set(u, new Promise((res, rej) => { const im = new Image(); im.decoding = 'sync'; im.onload = () => res(im); im.onerror = () => rej(new Error('image failed: ' + u)); im.src = u; }));
    }
    return imgCache.get(u);
  };
  C.images = {};    // name -> HTMLImageElement once loaded via C.ready / C.preload
  C.preload = async function (map) {   // {name: url}
    await Promise.all(Object.entries(map).map(async ([k, u]) => { C.images[k] = await C.loadImage(u); }));
    return C.images;
  };
  C.FONT_FACES = [
    ['900', 'Noto Sans TC'], ['700', 'Noto Sans TC'], ['500', 'Noto Sans TC'], ['900', 'Noto Serif TC'],
    ['400', 'LXGW WenKai TC'], ['700', 'LXGW WenKai TC'], ['400', 'Anton'], ['700', 'Space Mono'], ['400', 'Space Mono'], ['400', 'Permanent Marker'],
  ];
  /** Load fonts (fonts.css must be linked) + the textures the kit itself uses. Resolves to Collage. */
  C.ready = async function (extra = {}) {   // extra: {name: url} (page-relative or 'kit:...') -> Collage.images[name]
    if (typeof document !== 'undefined' && document.fonts) {
      await Promise.all(C.FONT_FACES.map(([w, f]) => document.fonts.load(`${w} 40px "${f}"`, '挪威台灣Aa1')));
    }
    await C.preload(Object.assign({
      grunge: 'kit:textures/stamp_grunge.png', paper: 'kit:textures/paper_cream.jpg', newsprint: 'kit:textures/newsprint.jpg',
      kraft: 'kit:textures/kraft.jpg', halftoneTile: 'kit:textures/halftone_tile.png',
    }, extra));
    ensureFilters();
    C.isReady = true;
    return C;
  };

  // hidden SVG filters (rough ink edge) referenced by ctx.filter = 'url(#ck-rough-N)'
  function ensureFilters() {
    if (typeof document === 'undefined' || document.getElementById('collage-filters')) return;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('id', 'collage-filters'); svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    let html = '';
    for (let i = 0; i < 4; i++) {
      html += `<filter id="ck-rough-${i}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="${0.045 + i * 0.012}" numOctaves="3" seed="${11 + i * 7}" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="${2.2 + i * 0.4}" xChannelSelector="R" yChannelSelector="G"/></filter>`;
    }
    svg.innerHTML = html;
    document.body.appendChild(svg);
  }

  function parseColor(c) {
    if (Array.isArray(c)) return c;
    if (c[0] === '#') { let h = c.slice(1); if (h.length === 3) h = h.split('').map((x) => x + x).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
    const m = c.match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
  }
  C.parseColor = parseColor;
  C.rgba = (hex, a) => { const [r, g, b] = parseColor(hex); return `rgba(${r},${g},${b},${a})`; };

  /** draw image with object-fit: cover into (x,y,w,h). focus: {x:0..1,y:0..1}; crop: source rect */
  C.drawCover = function (ctx, img, x, y, w, h, o = {}) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    let sx = 0, sy = 0, sw = iw, sh = ih;
    if (o.crop) ({ x: sx, y: sy, w: sw, h: sh } = o.crop);
    const zoom = o.zoom ?? 1;
    const s = Math.max(w / sw, h / sh) * zoom;
    const cw = w / s, ch = h / s;
    const fx = o.focus?.x ?? 0.5, fy = o.focus?.y ?? 0.5;
    const cx = sx + (sw - cw) * fx, cy = sy + (sh - ch) * fy;
    ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
  };

  // ------------------------------------------------------------------ torn paper
  /** Irregular torn outline for a w×h plate.
   *  opts: {seed, roughness=1, rim=7, edges='all'|'tb'|'lr'|'t'|'rb'..., step=3, bite=1}
   *  Returns {outer, inner} arrays of [x,y] in plate coords (0..w, 0..h; torn edges bite inward). */
  C.tornPath = function (w, h, o = {}) {
    const seed = o.seed ?? 1, R = o.roughness ?? 1, rim = o.rim ?? 7, step = o.step ?? 3;
    const edges = o.edges ?? 'all';
    const torn = (k) => edges === 'all' || edges.includes(k);
    const outer = [], inner = [];
    const sides = [
      ['t', [0, 0], [w, 0], [0, 1]], ['r', [w, 0], [w, h], [-1, 0]],
      ['b', [w, h], [0, h], [0, -1]], ['l', [0, h], [0, 0], [1, 0]],
    ];
    const bite = (o.bite ?? 1) * 10 * R;
    for (const [k, a, b, n] of sides) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const N = Math.max(2, Math.ceil(len / step));
      const sd = hash(seed, k);
      const isT = torn(k);
      for (let i = 0; i < N; i++) {
        const t = i / N, s = t * len;
        let d = 0, rw = 0;
        if (isT) {
          // big meander + mid wobble + fine fibre tooth; always >= 0 (bites into the sheet)
          const big = C.fbm1(sd, s / 140, 3), mid = C.noise1(hash(sd, 7), s / 22), fine = C.srand(sd, 'f', i);
          d = bite * (0.9 + 0.75 * big) + 3.2 * R * mid + 1.1 * R * fine;
          d = Math.max(0.5, d);
          // taper to zero near corners so torn edge meets the neighbouring edge cleanly
          const edgeTaper = Math.min(1, s / 18, (len - s) / 18);
          d *= edgeTaper;
          rw = rim * clamp(0.35 + 1.25 * (0.5 + 0.5 * C.fbm1(hash(sd, 3), s / 45, 3)) + 0.25 * C.srand(sd, 'r', i), 0.15, 2.2) * edgeTaper;
        } else {
          d = (o.cut === 'scissors' ? 0.8 * C.noise1(hash(sd, 9), s / 60) + 0.8 : 0);
        }
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
        outer.push([x + n[0] * d, y + n[1] * d]);
        inner.push([x + n[0] * (d + rw), y + n[1] * (d + rw)]);
      }
    }
    return { outer, inner };
  };
  function polyPath(ctx, pts, dx = 0, dy = 0) {
    ctx.beginPath(); ctx.moveTo(pts[0][0] + dx, pts[0][1] + dy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] + dx, pts[i][1] + dy);
    ctx.closePath();
  }
  C.polyPath = polyPath;
  C.clipPathCss = (pts, dx = 0, dy = 0) => 'polygon(' + pts.map((p) => `${(p[0] + dx).toFixed(1)}px ${(p[1] + dy).toFixed(1)}px`).join(',') + ')';

  /** Draw the rim + fibres + shadow for a torn outline into ctx (offset dx,dy). */
  function drawTornBacking(ctx, tp, o, dx, dy) {
    const shadow = o.shadow === false ? null : Object.assign({ x: 0, y: 9, blur: 16, color: 'rgba(20,14,6,0.38)' }, o.shadow || {});
    const rimColor = o.rimColor || C.colors.rim;
    if (shadow) {
      ctx.save();
      ctx.shadowColor = shadow.color; ctx.shadowBlur = shadow.blur; ctx.shadowOffsetX = shadow.x; ctx.shadowOffsetY = shadow.y;
      polyPath(ctx, tp.outer, dx, dy); ctx.fillStyle = rimColor; ctx.fill();
      ctx.restore();
      // tight contact shadow
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 2.5; ctx.shadowOffsetY = 1.2;
      polyPath(ctx, tp.outer, dx, dy); ctx.fillStyle = rimColor; ctx.fill(); ctx.restore();
    }
    polyPath(ctx, tp.outer, dx, dy); ctx.fillStyle = rimColor; ctx.fill();
    // paper-core texture on the rim
    if (C.images.paper) {
      ctx.save(); polyPath(ctx, tp.outer, dx, dy); ctx.clip();
      ctx.globalAlpha = 0.5; ctx.globalCompositeOperation = 'multiply';
      const pat = ctx.createPattern(C.images.paper, 'repeat'); ctx.fillStyle = pat; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();
    }
    // fibres poking out of the torn edge
    if (o.fibres !== false) {
      const r = C.rng(hash(o.seed ?? 1, 'fib'));
      ctx.save(); ctx.strokeStyle = rimColor; ctx.lineCap = 'round';
      const pts = tp.outer, inn = tp.inner;
      for (let i = 0; i < pts.length; i++) {
        const gap = Math.hypot(inn[i][0] - pts[i][0], inn[i][1] - pts[i][1]);
        if (gap < 0.8 || r.next() > 0.55) continue;
        const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
        // outward = away from inner point
        if (nx * (pts[i][0] - inn[i][0]) + ny * (pts[i][1] - inn[i][1]) < 0) { nx = -nx; ny = -ny; }
        const ang = Math.atan2(ny, nx) + r.range(-0.9, 0.9), L = r.range(1.2, 4.5) * (o.fibreLength ?? 1);
        const x0 = pts[i][0] + dx - nx * 1.2, y0 = pts[i][1] + dy - ny * 1.2;
        ctx.globalAlpha = r.range(0.45, 0.95); ctx.lineWidth = r.range(0.5, 1.1);
        ctx.beginPath(); ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + Math.cos(ang) * L * 0.6 + r.range(-1, 1), y0 + Math.sin(ang) * L * 0.6 + r.range(-1, 1), x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /** Rim/shadow backing canvas (w+2pad square-ish) to place behind a DOM element clipped with tornClip. */
  C.tornRim = function (w, h, o = {}) {
    const pad = o.pad ?? 40, tp = o.path || C.tornPath(w, h, o);
    const c = C.canvas(w + pad * 2, h + pad * 2), ctx = c.getContext('2d');
    drawTornBacking(ctx, tp, o, pad, pad);
    c.style && Object.assign(c.style, { position: 'absolute', left: -pad + 'px', top: -pad + 'px', pointerEvents: 'none' });
    return c;
  };

  const tornCache = new Map();
  /** tornPaper(target, opts)
   *  - target = HTMLElement: wraps it in <div class="torn-wrap"> (inherits its left/top/width/height), clips the
   *    element to the inner torn polygon and places a rim+shadow canvas behind it. Returns the wrapper
   *    (animate the wrapper's transform).
   *  - target = image/canvas (or null with opts.width/height + opts.fill/texture): returns a NEW canvas with the
   *    torn cut-out (content clipped to inner polygon, white fibre rim, soft shadow). Padding = opts.pad (40).
   *    The result has .pad, .plateW, .plateH, .path properties. Cached by opts.cacheKey if given.
   *  opts: {seed, roughness, rim, edges, pad, shadow:{x,y,blur,color}|false, rimColor, fill, texture,
   *         textureAlpha, fit:'cover'|'stretch', focus, crop, width, height, innerShade=true} */
  C.tornPaper = function (target, o = {}) {
    if (typeof HTMLElement !== 'undefined' && target instanceof HTMLElement && !(target instanceof HTMLCanvasElement) && !(target instanceof HTMLImageElement)) {
      const el = target;
      const w = o.width ?? el.offsetWidth, h = o.height ?? el.offsetHeight;
      const tp = C.tornPath(w, h, o);
      const wrap = document.createElement('div');
      wrap.className = 'torn-wrap ' + (o.className || '');
      const cs = el.style;
      Object.assign(wrap.style, { position: cs.position || 'absolute', left: cs.left, top: cs.top, right: cs.right, bottom: cs.bottom, width: w + 'px', height: h + 'px', transformOrigin: '50% 50%' });
      if (cs.transform) { wrap.style.transform = cs.transform; cs.transform = ''; }
      el.parentNode.insertBefore(wrap, el);
      Object.assign(cs, { position: 'absolute', left: '0px', top: '0px', right: '', bottom: '', width: w + 'px', height: h + 'px', clipPath: C.clipPathCss(tp.inner) });
      wrap.appendChild(C.tornRim(w, h, Object.assign({}, o, { path: tp })));
      wrap.appendChild(el);
      wrap.tornPath = tp;
      return wrap;
    }
    if (o.cacheKey && tornCache.has(o.cacheKey)) return tornCache.get(o.cacheKey);
    const src = target;
    const w = Math.round(o.width ?? (src ? (src.naturalWidth || src.width) : 800));
    const h = Math.round(o.height ?? (src ? (src.naturalHeight || src.height) : 500));
    const pad = o.pad ?? 40;
    const tp = C.tornPath(w, h, o);
    const c = C.canvas(w + 2 * pad, h + 2 * pad), ctx = c.getContext('2d');
    drawTornBacking(ctx, tp, o, pad, pad);
    ctx.save(); polyPath(ctx, tp.inner, pad, pad); ctx.clip();
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fillRect(pad, pad, w, h); }
    if (o.texture) {
      const tex = typeof o.texture === 'string' ? C.images[o.texture] : o.texture;
      if (tex) { ctx.globalAlpha = o.textureAlpha ?? 1; ctx.globalCompositeOperation = o.fill ? 'multiply' : 'source-over'; ctx.fillStyle = ctx.createPattern(tex, 'repeat'); ctx.translate(pad, pad); ctx.fillRect(0, 0, w, h); ctx.translate(-pad, -pad); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
    }
    if (src) {
      if ((o.fit ?? 'cover') === 'cover') C.drawCover(ctx, src, pad, pad, w, h, o); else ctx.drawImage(src, pad, pad, w, h);
    }
    if (o.innerShade !== false) {           // a hair of shade where print meets the white core
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1.4; polyPath(ctx, tp.inner, pad, pad); ctx.stroke();
    }
    ctx.restore();
    c.pad = pad; c.plateW = w; c.plateH = h; c.path = tp;
    if (o.cacheKey) tornCache.set(o.cacheKey, c);
    return c;
  };

  // ------------------------------------------------------------------ halftone
  const COS_N = 8192, COS_LUT = new Float32Array(COS_N);
  for (let i = 0; i < COS_N; i++) COS_LUT[i] = Math.cos(i / COS_N * TAU);
  const LUT_K = COS_N / TAU;
  const htCache = new Map();
  let texDataCache = new Map();
  function texData(img) {
    if (!texDataCache.has(img)) { const c = C.canvas(img.naturalWidth || img.width, img.naturalHeight || img.height); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); texDataCache.set(img, { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data }); }
    return texDataCache.get(img);
  }
  const imgIds = new WeakMap(); let imgIdN = 0;
  const imgId = (im) => { if (!imgIds.has(im)) imgIds.set(im, ++imgIdN); return imgIds.get(im); };

  /** halftone(image, opts) -> canvas: photo rendered as a printed AM halftone (or duotone) on paper.
   *  opts: {width,height (output, default = source size), crop:{x,y,w,h}, focus, zoom,
   *         dot=9 (screen pitch px), angle=45, ink='#141414', paper='#F1E9D8'|null (transparent),
   *         paperTexture: true|'paper'|'newsprint'|img (multiplied under the ink),
   *         contrast=1.2, brightness=0, gamma=1, rough=0.06 (ragged dot edges),
   *         mode:'mono'|'duotone', ink2='#BA0C2F', angle2=15, dot2=dot, misreg=[2,-1] (ink2 offset px),
   *         tone2:'mid'|'shadow'|'light'|'same', tint:null (flat colour multiplied under ink, e.g. yellow),
   *         cacheKey}  Cached per (image, opts). ~60-150 ms for 1600×900 on first call. */
  C.halftone = function (img, o = {}) {
    const key = o.cacheKey || (imgId(img) + '|' + JSON.stringify(o, (k, v) => (v && typeof v === 'object' && v.nodeType ? imgId(v) : v)));
    if (htCache.has(key)) return htCache.get(key);
    const W = Math.round(o.width ?? (img.naturalWidth || img.width)), H = Math.round(o.height ?? (img.naturalHeight || img.height));
    const dot = o.dot ?? 9, ang = (o.angle ?? 45) * PI / 180;
    const src = C.canvas(W, H), sg = src.getContext('2d', { willReadFrequently: true });
    sg.filter = `blur(${(dot * 0.3).toFixed(2)}px)`;
    C.drawCover(sg, img, 0, 0, W, H, o);
    sg.filter = 'none';
    const sd = sg.getImageData(0, 0, W, H).data;
    const contrast = o.contrast ?? 1.2, bright = o.brightness ?? 0, gamma = o.gamma ?? 1, rough = o.rough ?? 0.06;
    const out = C.canvas(W, H), og = out.getContext('2d');
    const od = og.createImageData(W, H), D = od.data;
    const ink = parseColor(o.ink || C.colors.ink);
    const paper = o.paper === null ? null : parseColor(o.paper || C.colors.cream);
    const tint = o.tint ? parseColor(o.tint) : null;
    const duo = o.mode === 'duotone';
    const ink2 = parseColor(o.ink2 || C.colors.red);
    const ang2 = (o.angle2 ?? 15) * PI / 180, dot2 = o.dot2 ?? dot;
    const mis = o.misreg || [2, -1];
    const tone2 = o.tone2 || 'mid';
    let tex = null;
    if (o.paperTexture && paper) { const t = o.paperTexture === true ? C.images.paper : (typeof o.paperTexture === 'string' ? C.images[o.paperTexture] : o.paperTexture); if (t) tex = texData(t); }
    const f1 = TAU / dot, f2 = TAU / dot2;
    const c1 = Math.cos(ang) * f1 * LUT_K, s1 = Math.sin(ang) * f1 * LUT_K;
    const c2 = Math.cos(ang2) * f2 * LUT_K, s2 = Math.sin(ang2) * f2 * LUT_K;
    const aa1 = dot / 2.1, aa2 = dot2 / 2.1;
    const M = COS_N - 1;
    const W4 = W * 4;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W4 + x * 4;
        let v = (0.2126 * sd[i] + 0.7152 * sd[i + 1] + 0.0722 * sd[i + 2]) / 255;
        v = (v - 0.5) * contrast + 0.5 + bright;
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        if (gamma !== 1) v = Math.pow(v, gamma);
        let n = 0;
        if (rough) { let hsh = Math.imul(x * 374761393 + y * 668265263, 1274126177); hsh ^= hsh >>> 13; n = ((hsh & 1023) / 1023 - 0.5) * rough; }
        const dk = 1 - v + n;
        // screen 1
        const u1 = (x * c1 + y * s1), w1 = (-x * s1 + y * c1);
        const sc1 = 0.5 + 0.25 * (COS_LUT[(u1 | 0) & M] + COS_LUT[(w1 | 0) & M]);
        let a1 = (sc1 - (1 - dk)) * aa1 + 0.5; a1 = a1 < 0 ? 0 : a1 > 1 ? 1 : a1;
        let a2 = 0;
        if (duo) {
          let d2 = tone2 === 'same' ? dk : tone2 === 'shadow' ? Math.max(0, dk * 1.4 - 0.4) : tone2 === 'light' ? Math.min(1, dk * 1.5) : Math.max(0, 1 - Math.abs(v - 0.5) * 2.3) * 0.85;
          d2 += n;
          const xx = x - mis[0], yy = y - mis[1];
          const u2 = (xx * c2 + yy * s2), w2 = (-xx * s2 + yy * c2);
          const sc2 = 0.5 + 0.25 * (COS_LUT[(u2 | 0) & M] + COS_LUT[(w2 | 0) & M]);
          a2 = (sc2 - (1 - d2)) * aa2 + 0.5; a2 = a2 < 0 ? 0 : a2 > 1 ? 1 : a2;
        }
        if (paper) {
          let pr = paper[0], pg = paper[1], pb = paper[2];
          if (tex) { const ti = ((y % tex.h) * tex.w + (x % tex.w)) * 4; pr = pr * tex.d[ti] / 241; pg = pg * tex.d[ti + 1] / 233; pb = pb * tex.d[ti + 2] / 216; }
          if (tint) { pr = pr * tint[0] / 255; pg = pg * tint[1] / 255; pb = pb * tint[2] / 255; }
          // multiply inks (like overprinting)
          let r = pr, g = pg, b = pb;
          if (a2) { r *= 1 - a2 * (1 - ink2[0] / 255); g *= 1 - a2 * (1 - ink2[1] / 255); b *= 1 - a2 * (1 - ink2[2] / 255); }
          r *= 1 - a1 * (1 - ink[0] / 255); g *= 1 - a1 * (1 - ink[1] / 255); b *= 1 - a1 * (1 - ink[2] / 255);
          D[i] = r; D[i + 1] = g; D[i + 2] = b; D[i + 3] = 255;
        } else {
          const A = 1 - (1 - a1) * (1 - a2);
          if (A <= 0) { D[i + 3] = 0; continue; }
          D[i] = (ink[0] * a1 + ink2[0] * a2 * (1 - a1)) / A; D[i + 1] = (ink[1] * a1 + ink2[1] * a2 * (1 - a1)) / A; D[i + 2] = (ink[2] * a1 + ink2[2] * a2 * (1 - a1)) / A; D[i + 3] = A * 255;
        }
      }
    }
    og.putImageData(od, 0, 0);
    htCache.set(key, out);
    return out;
  };
  /** duotone(image, {dark, light, contrast, width, height, crop, focus, grain}) -> canvas (continuous-tone print) */
  C.duotone = function (img, o = {}) {
    const key = 'duo|' + (o.cacheKey || imgId(img) + JSON.stringify(o));
    if (htCache.has(key)) return htCache.get(key);
    const W = Math.round(o.width ?? (img.naturalWidth || img.width)), H = Math.round(o.height ?? (img.naturalHeight || img.height));
    const c = C.canvas(W, H), g = c.getContext('2d', { willReadFrequently: true });
    C.drawCover(g, img, 0, 0, W, H, o);
    const id = g.getImageData(0, 0, W, H), d = id.data;
    const dk = parseColor(o.dark || C.colors.navy), lt = parseColor(o.light || C.colors.cream), con = o.contrast ?? 1.15, gr = o.grain ?? 0.04;
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      let v = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      let hsh = Math.imul(p, 2654435761); hsh ^= hsh >>> 15;
      v = clamp01((v - 0.5) * con + 0.5 + ((hsh & 255) / 255 - 0.5) * gr);
      d[i] = dk[0] + (lt[0] - dk[0]) * v; d[i + 1] = dk[1] + (lt[1] - dk[1]) * v; d[i + 2] = dk[2] + (lt[2] - dk[2]) * v;
    }
    g.putImageData(id, 0, 0);
    htCache.set(key, c);
    return c;
  };
  /** halftone print + torn cut-out in one go (cached). opts = halftone opts + {torn: tornPaper opts} */
  C.printCutout = function (img, o = {}) {
    const key = 'pc|' + (o.cacheKey || imgId(img) + JSON.stringify(o));
    if (tornCache.has(key)) return tornCache.get(key);
    const ht = o.halftone === false ? C.duotone(img, o) : C.halftone(img, o);
    const res = C.tornPaper(ht, Object.assign({ fit: 'stretch' }, o.torn || {}));
    tornCache.set(key, res);
    return res;
  };

  // ------------------------------------------------------------------ marker strokes (progressive reveal)
  /** Core: draw a hand-made marker stroke along dense points pts=[[x,y],...] with reveal 0..1.
   *  opts: {width=12, color, progress=1, seed, alpha=1, taper=[5,18], pressure=0.22, streaks=true,
   *         highlighter=false (flat, translucent, multiply), composite} */
  C.markerPath = function (ctx, pts, o = {}) {
    const p = clamp01(o.progress ?? 1);
    if (p <= 0 || pts.length < 2) return;
    const seed = o.seed ?? 1, W0 = o.width ?? 12, col = o.color || C.colors.red;
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = L[L.length - 1], end = total * p;
    const P = [], S = [];
    for (let i = 0; i < pts.length; i++) {
      if (L[i] <= end) { P.push(pts[i]); S.push(L[i]); }
      else { const t = (end - L[i - 1]) / (L[i] - L[i - 1] || 1); P.push([lerp(pts[i - 1][0], pts[i][0], t), lerp(pts[i - 1][1], pts[i][1], t)]); S.push(end); break; }
    }
    if (P.length < 2) return;
    const tap = o.taper || [5, 18], pr = o.pressure ?? 0.3, hl = !!o.highlighter, rough = o.rough ?? Math.min(1.2, W0 * 0.07);
    const wid = (s) => {
      let w = W0 * (1 - pr + pr * (0.5 + 0.5 * C.fbm1(hash(seed, 'w'), s / 70, 2)) + 0.05 * C.noise1(hash(seed, 'w2'), s / 7));
      if (!hl) { w *= Math.min(1, 0.62 + 0.38 * s / tap[0]); w *= Math.min(1, 0.4 + 0.6 * (total - s) / tap[1]); }
      return w / 2;
    };
    const left = [], right = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      let hw = wid(S[i]);
      if (hl) { // chisel tip: width depends on direction vs. fixed nib angle
        const nib = o.nibAngle ?? -0.5; hw = W0 / 2 * (0.35 + 0.65 * Math.abs(Math.sin(Math.atan2(ty, tx) - nib)));
        const sk = W0 * (o.chisel ?? 0.22);   // chisel: slanted ends (parallelogram band)
        const eL = hw + rough * C.noise1(hash(seed, 'hl'), S[i] / 3), eR = hw + rough * C.noise1(hash(seed, 'hr'), S[i] / 3);
        left.push([P[i][0] - ty * eL + tx * sk, P[i][1] + tx * eL + ty * sk]); right.push([P[i][0] + ty * eR - tx * sk, P[i][1] - tx * eR - ty * sk]);
        continue;
      }
      // dry, slightly ragged felt edges: independent noise per side
      const el = hw + rough * (0.6 * C.noise1(hash(seed, 'el'), S[i] / 2.2) + 0.4 * C.noise1(hash(seed, 'el2'), S[i] / 0.9));
      const er = hw + rough * (0.6 * C.noise1(hash(seed, 'er'), S[i] / 2.2) + 0.4 * C.noise1(hash(seed, 'er2'), S[i] / 0.9));
      left.push([P[i][0] - ty * el, P[i][1] + tx * el]); right.push([P[i][0] + ty * er, P[i][1] - tx * er]);
    }
    ctx.save();
    ctx.globalAlpha = (o.alpha ?? 1) * (hl ? 0.55 : 1);
    if (hl) ctx.globalCompositeOperation = 'multiply';
    if (o.composite) ctx.globalCompositeOperation = o.composite;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
    const e = P[P.length - 1], ew = wid(S[S.length - 1]);
    if (!hl) { const a0 = Math.atan2(left[left.length - 1][1] - e[1], left[left.length - 1][0] - e[0]); ctx.arc(e[0], e[1], ew, a0, a0 - PI, true); }
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    if (!hl) { const s0 = P[0], sw = wid(0); const a1 = Math.atan2(right[0][1] - s0[1], right[0][0] - s0[0]); ctx.arc(s0[0], s0[1], sw, a1, a1 - PI, true); }
    ctx.closePath(); ctx.fill();
    // highlighter: ink pools where the nib lands / lifts, and the chisel leaves faint streak lanes
    if (hl) {
      const poolLen = Math.min(S[S.length - 1] * 0.12, W0 * 0.6);
      ctx.globalAlpha = (o.alpha ?? 1) * 0.22;
      for (const [a, b] of [[0, poolLen], [S[S.length - 1] - poolLen, S[S.length - 1]]]) {
        if (p < 1 && a > 0) continue;
        ctx.beginPath(); let st = false;
        for (let i = 0; i < P.length; i++) if (S[i] >= a && S[i] <= b) { if (!st) { ctx.moveTo(left[i][0], left[i][1]); st = true; } else ctx.lineTo(left[i][0], left[i][1]); }
        for (let i = P.length - 1; i >= 0; i--) if (S[i] >= a && S[i] <= b) ctx.lineTo(right[i][0], right[i][1]);
        ctx.closePath(); ctx.fill();
      }
    }
    // felt-tip streaks: slightly lighter lanes along the stroke
    if (o.streaks !== false && !hl && W0 >= 6) {
      const rgb = parseColor(col);
      ctx.strokeStyle = `rgba(${Math.min(255, rgb[0] + 70)},${Math.min(255, rgb[1] + 60)},${Math.min(255, rgb[2] + 60)},${o.streakAlpha ?? 0.28})`;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const lane = C.srand(seed, 'lane', k) * 0.55, lw = W0 * (0.05 + 0.05 * C.rand(seed, 'lw', k));
        const s0 = C.rand(seed, 'ls', k) * 0.4 * S[S.length - 1], s1 = s0 + (0.3 + 0.6 * C.rand(seed, 'le', k)) * S[S.length - 1];
        ctx.lineWidth = lw; ctx.beginPath(); let started = false;
        for (let i = 0; i < P.length; i++) {
          if (S[i] < s0 || S[i] > s1) continue;
          const x = lerp(P[i][0], left[i][0], lane), y = lerp(P[i][1], left[i][1], lane);
          if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  // wobble helper: offsets along the normal of a param path; `boil` re-seeds fine wobble on twos
  function wob(o, s, amp) {        // px offset: low-freq hand wobble (amp px) + optional boil (o.boil px, on twos)
    const seed = o.seed ?? 1;
    let v = amp * C.fbm1(hash(seed, 'wob'), s / 90, 3);
    if (o.boil && o.frame !== undefined) v += o.boil * C.noise1(hash(seed, 'boil', Math.floor(o.frame / 2)), s / 25);
    return v;
  }
  function sampleParam(fn, n) { const pts = []; for (let i = 0; i <= n; i++) pts.push(fn(i / n)); return pts; }
  // run several sub-strokes sequentially within one progress value
  function sequence(ctx, strokes, o) {
    const p = clamp01(o.progress ?? 1);
    const tot = strokes.reduce((a, s) => a + (s.weight ?? 1), 0);
    let acc = 0;
    strokes.forEach((s, k) => {
      const w = (s.weight ?? 1) / tot, lp = clamp01((p - acc) / w); acc += w;
      if (lp > 0) C.markerPath(ctx, s.pts, Object.assign({}, o, s.opts || {}, { progress: lp, seed: hash(o.seed ?? 1, k) }));
    });
  }

  C.marker = {
    /** loose hand-drawn ellipse, overshooting its start. {cx,cy,rx,ry,rotation(deg),turns=1.15,start(deg)} */
    circle(ctx, o) {
      const seed = o.seed ?? 1, turns = o.turns ?? 1.16, rot = C.rad(o.rotation ?? C.srand(seed, 'rot') * 8);
      const a0 = C.rad(o.start ?? (-120 + C.srand(seed, 'a0') * 25));
      const rx = o.rx ?? o.r ?? 100, ry = o.ry ?? o.r ?? 70, avg = Math.sqrt((rx * rx + ry * ry) / 2);
      const circ = TAU * avg * turns;
      const n = Math.max(24, Math.ceil(circ / 3));
      const irr = o.irregular ?? 0.07, spiral = o.spiral ?? 0.09;
      const pts = sampleParam((t) => {
        const a = a0 + t * TAU * turns * (o.dir ?? 1), s = t * circ;
        // hand-made ellipse: lobes (low-freq radius change) + slow spiral so the overshoot doesn't retrace the start
        const lobe = irr * (0.6 * Math.sin(a * 2 + C.rand(seed, 'l2') * TAU) + 0.4 * Math.sin(a * 3 + C.rand(seed, 'l3') * TAU));
        const k = 1 + lobe + spiral * (0.5 - t);
        const off = wob(o, s, avg * 0.02);
        const x = Math.cos(a) * (rx * k + off), y = Math.sin(a) * (ry * k + off);
        return [o.cx + x * Math.cos(rot) - y * Math.sin(rot), o.cy + x * Math.sin(rot) + y * Math.cos(rot)];
      }, n);
      C.markerPath(ctx, pts, Object.assign({ width: 11 }, o, { taper: [4, 30] }));
      return pts;
    },
    /** curved arrow with a two-stroke head. {x1,y1,x2,y2,bend=0.18,head=38} */
    arrow(ctx, o) {
      const { x1, y1, x2, y2 } = o, bend = o.bend ?? 0.18, len = Math.hypot(x2 - x1, y2 - y1);
      const nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      const mx = (x1 + x2) / 2 + nx * bend * len, my = (y1 + y2) / 2 + ny * bend * len;
      const n = Math.max(16, Math.ceil(len / 3));
      const shaft = sampleParam((t) => {
        const it = 1 - t;
        const x = it * it * x1 + 2 * it * t * mx + t * t * x2, y = it * it * y1 + 2 * it * t * my + t * t * y2;
        const w = wob(o, t * len, 5) * Math.sin(t * PI);
        return [x + nx * w, y + ny * w];
      }, n);
      const e = shaft[shaft.length - 1], pe = shaft[shaft.length - 4];
      const dir = Math.atan2(e[1] - pe[1], e[0] - pe[0]);
      const H = o.head ?? Math.min(48, len * 0.3), spread = C.rad(o.headAngle ?? 28);
      const head = (sgn, k) => sampleParam((t) => {
        const a = dir + PI + sgn * (spread + C.srand(o.seed ?? 1, 'h', k) * 0.12);
        const r = H * t;
        return [e[0] + Math.cos(a) * r + C.noise1(hash(o.seed ?? 1, 'hw', k), t * 3) * 1.5, e[1] + Math.sin(a) * r];
      }, 12).reverse();
      sequence(ctx, [{ pts: shaft, weight: 0.72 }, { pts: head(1, 0), weight: 0.14, opts: { taper: [3, 10] } }, { pts: head(-1, 1), weight: 0.14, opts: { taper: [3, 10] } }], Object.assign({ width: 10 }, o));
      return shaft;
    },
    /** underline, optionally double (return stroke). {x1,x2,y,double=false,slope=-0.02} */
    underline(ctx, o) {
      const { x1, x2, y } = o, len = Math.abs(x2 - x1), slope = o.slope ?? -0.02;
      const n = Math.max(12, Math.ceil(len / 3));
      const line = (k, xa, xb, dy) => sampleParam((t) => {
        const x = lerp(xa, xb, t);
        return [x, y + dy + (x - x1) * slope + wob(Object.assign({}, o, { seed: hash(o.seed ?? 1, k) }), t * len, 4) + Math.sin(t * PI) * (o.sag ?? 2)];
      }, n);
      const strokes = [{ pts: line(0, x1, x2, 0), weight: 1 }];
      if (o.double) strokes.push({ pts: line(1, x2 - len * 0.04, x1 + len * 0.12, (o.gap ?? 14)), weight: 0.8 });
      sequence(ctx, strokes, Object.assign({ width: 10 }, o));
    },
    /** emphasis rays around a point (comic "!" burst). {cx,cy,r1=60,r2=110,rays=10,from(deg),to(deg)} */
    starburst(ctx, o) {
      const rays = o.rays ?? 10, r1 = o.r1 ?? 60, r2 = o.r2 ?? 110, a0 = C.rad(o.from ?? 0), a1 = C.rad(o.to ?? 360);
      const full = Math.abs(a1 - a0) >= TAU - 1e-6;
      const strokes = [];
      for (let k = 0; k < rays; k++) {
        const a = a0 + (a1 - a0) * (full ? k / rays : k / Math.max(1, rays - 1)) + C.srand(o.seed ?? 1, 'ra', k) * 0.12;
        const ra = r1 * (1 + C.srand(o.seed ?? 1, 'r1', k) * 0.12), rb = r2 * (1 + C.srand(o.seed ?? 1, 'r2', k) * 0.22) * (k % 2 ? 0.8 : 1);
        strokes.push({ pts: sampleParam((t) => [o.cx + Math.cos(a) * lerp(ra, rb, t), o.cy + Math.sin(a) * lerp(ra, rb, t)], 10), weight: 1, opts: { taper: [3, 12] } });
      }
      sequence(ctx, strokes, Object.assign({ width: 9 }, o));
    },
    /** zig-zag spiky burst outline (sticker-style "NEW!" star). {cx,cy,r1,r2,points=14} */
    burst(ctx, o) {
      const N = o.points ?? 14, r1 = o.r1 ?? 70, r2 = o.r2 ?? 110;
      const pts = [];
      for (let k = 0; k <= N * 2 + 1; k++) {
        const a = (k / (N * 2)) * TAU - PI / 2 + C.srand(o.seed ?? 1, 'ba', k) * 0.05;
        const r = (k % 2 ? r1 : r2) * (1 + C.srand(o.seed ?? 1, 'br', k) * 0.07);
        const x = o.cx + Math.cos(a) * r, y = o.cy + Math.sin(a) * r;
        if (k) { const [px, py] = pts[pts.length - 1]; for (let j = 1; j <= 6; j++) pts.push([lerp(px, x, j / 6), lerp(py, y, j / 6)]); } else pts.push([x, y]);
      }
      C.markerPath(ctx, pts, Object.assign({ width: 8 }, o, { taper: [3, 6] }));
    },
    /** highlighter scribble over a box (zig-zag passes, translucent multiply). {x,y,w,h,passes=3} */
    highlight(ctx, o) {
      const passes = o.passes ?? 1, seed = o.seed ?? 1;
      const strokes = [];
      for (let k = 0; k < passes; k++) {
        const yy = o.y + o.h * (passes === 1 ? 0.5 : k / (passes - 1)) + C.srand(seed, 'hy', k) * o.h * 0.08;
        const xa = k % 2 ? o.x + o.w : o.x, xb = k % 2 ? o.x : o.x + o.w;
        strokes.push({ pts: sampleParam((t) => [lerp(xa, xb, t) + C.srand(seed, 'hx', k) * 6, yy + (t - 0.5) * (o.tilt ?? -6) + C.noise1(hash(seed, 'hn', k), t * 2.5) * o.h * 0.05 + Math.sin(t * PI) * o.h * 0.03], 48), weight: 1 });
      }
      sequence(ctx, strokes, Object.assign({ width: o.h / Math.max(1, passes) * 1.25, color: C.colors.yellow, highlighter: true, nibAngle: -1.2 }, o));
    },
    /** loopy scribble fill ("scribble highlight") behind a word: coil of back-and-forth marker loops.
     *  {x,y,w,h,loops=w/34,color=yellow,width=h*0.3,composite} */
    scribble(ctx, o) {
      const seed = o.seed ?? 1, loops = o.loops ?? Math.max(3, Math.round(o.w / 34));
      const n = loops * 28, pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n, ph = t * loops * TAU + C.rand(seed, 'ph') * TAU;
        const amp = o.h / 2 * (0.86 + 0.14 * C.noise1(hash(seed, 'a'), t * loops * 1.3));
        const back = (o.w / loops) * 0.55;                      // the pen swings back on each loop
        const yy = -Math.cos(ph) * amp;
        pts.push([o.x + o.w * t - Math.sin(ph) * back * 0.5 - yy * (o.slant ?? 0.3), o.y + o.h / 2 + yy + (t - 0.5) * (o.tilt ?? -8)]);
      }
      C.markerPath(ctx, pts, Object.assign({ width: Math.max(8, o.h * 0.3), color: C.colors.yellow, composite: 'multiply', taper: [6, 20], streaks: false }, o));
    },
    /** X mark */
    cross(ctx, o) {
      const s = o.size ?? 60, { cx, cy } = o;
      const ln = (a, b, k) => sampleParam((t) => [lerp(a[0], b[0], t) + C.noise1(hash(o.seed ?? 1, k), t * 3) * 2, lerp(a[1], b[1], t)], 16);
      sequence(ctx, [{ pts: ln([cx - s, cy - s], [cx + s, cy + s * 0.9], 0) }, { pts: ln([cx + s * 0.9, cy - s], [cx - s * 0.9, cy + s], 1) }], Object.assign({ width: 11 }, o));
    },
    /** check mark */
    check(ctx, o) {
      const s = o.size ?? 60, { cx, cy } = o;
      const pts = [...sampleParam((t) => [lerp(cx - s, cx - s * 0.2, t), lerp(cy, cy + s * 0.7, t)], 10), ...sampleParam((t) => [lerp(cx - s * 0.2, cx + s * 1.1, t), lerp(cy + s * 0.7, cy - s * 0.9, t) + Math.sin(t * PI) * 4], 18)];
      C.markerPath(ctx, pts, Object.assign({ width: 11 }, o));
    },
  };

  // ------------------------------------------------------------------ stamps
  function arcText(ctx, text, cx, cy, r, midAngle, o = {}) {
    const chars = C.graphemes(text), track = o.tracking ?? 0.08, inward = o.inward ?? false;
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + track * ctx.measureText('M').width * (chars.length - 1);
    let a = midAngle - (inward ? -1 : 1) * total / r / 2;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    chars.forEach((ch, i) => {
      const w = widths[i], step = (w + track * ctx.measureText('M').width) / r;
      const aa = a + (inward ? -1 : 1) * w / 2 / r;
      ctx.save(); ctx.translate(cx + Math.cos(aa) * r, cy + Math.sin(aa) * r); ctx.rotate(aa + (inward ? -PI / 2 : PI / 2)); ctx.fillText(ch, 0, 0); ctx.restore();
      a += (inward ? -1 : 1) * step;
    });
    ctx.restore();
  }
  function spacedText(ctx, text, x, y, tracking) {
    const chars = C.graphemes(text), ws = chars.map((c) => ctx.measureText(c).width);
    const tw = ws.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
    let cx = x - tw / 2; ctx.save(); ctx.textAlign = 'left';
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + tracking; }); ctx.restore();
    return tw;
  }
  C.spacedText = spacedText;
  const STAMP_PRESETS = {
    heritage: { shape: 'rect', w: 820, h: 330, color: '#BA0C2F', lines: [{ text: '世界遺產', font: 'serif', size: 150, y: 0.47, track: 22 }, { text: 'WORLD HERITAGE', font: 'mono', size: 40, y: 0.83, track: 14 }] },
    norge: { shape: 'circle', w: 560, h: 560, color: '#00205B', top: 'KONGERIKET', bottom: 'NORGE', center: [{ text: '挪威', font: 'sans', size: 150, y: 0.5 }], stars: true },
    ssr: { shape: 'rect', w: 560, h: 330, color: '#BA0C2F', radius: 40, lines: [{ text: '稀有度 RARITY', font: 'sans', size: 42, y: 0.2, track: 6, weight: 900 }, { text: 'SSR', font: 'anton', size: 190, y: 0.62, track: 10 }, { text: '★★★★★', font: 'sans', size: 40, y: 0.9, track: 8 }] },
    oslo: { shape: 'postmark', w: 900, h: 400, color: '#141414', top: 'OSLO', bottom: 'NORGE', center: [{ text: '2026', font: 'mono', size: 64, y: 0.5 }] },
    taiwan: { shape: 'circle', w: 520, h: 520, color: '#000095', top: 'TAIWAN', bottom: 'FORMOSA', center: [{ text: '台灣', font: 'sans', size: 140, y: 0.5 }], stars: true },
    approved: { shape: 'rect', w: 640, h: 230, color: '#BA0C2F', lines: [{ text: 'APPROVED', font: 'anton', size: 150, y: 0.56, track: 8 }] },
  };
  C.STAMP_PRESETS = STAMP_PRESETS;
  const stampCache = new Map();
  /** stamp canvas from a preset name ('heritage','norge','ssr','oslo','taiwan','approved') or a spec:
   *  {shape:'rect'|'circle'|'postmark', w,h, color, lines:[{text,font,size,y(0..1),track}], top,bottom,center[], radius,
   *   seed, ink=0.9 (opacity), wear=1 (grunge strength), misreg=[3,-2] (ghost offset px), ghost=0.28}
   *  Must be called after Collage.ready() (fonts + grunge texture). Cached. */
  C.makeStamp = function (spec, o = {}) {
    const sp = typeof spec === 'string' ? Object.assign({}, STAMP_PRESETS[spec], o) : Object.assign({}, spec, o);
    const key = JSON.stringify(sp);
    if (stampCache.has(key)) return stampCache.get(key);
    const seed = sp.seed ?? (typeof spec === 'string' ? spec : 1);
    const W = sp.w, H = sp.h, pad = 24;
    const base = C.canvas(W + pad * 2, H + pad * 2), g = base.getContext('2d');
    g.translate(pad, pad);
    g.fillStyle = g.strokeStyle = '#000';
    g.textBaseline = 'middle'; g.textAlign = 'center';
    const drawLines = (lines, box) => (lines || []).forEach((l) => {
      g.font = C.font(l.font, l.size, l.weight);
      spacedText(g, l.text, box.x + box.w / 2, box.y + box.h * l.y, l.track ?? 0);
    });
    if (sp.shape === 'rect') {
      const r = sp.radius ?? 18;
      g.lineWidth = 12; roundRect(g, 8, 8, W - 16, H - 16, r); g.stroke();
      g.lineWidth = 4; roundRect(g, 26, 26, W - 52, H - 52, Math.max(4, r - 14)); g.stroke();
      drawLines(sp.lines, { x: 0, y: 0, w: W, h: H });
    } else {
      const cx = sp.shape === 'postmark' ? H / 2 : W / 2, cy = H / 2, R = H / 2 - 10;
      g.lineWidth = 11; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R * 0.66, 0, TAU); g.stroke();
      const band = R * 0.83;
      const fs = R * 0.2;
      g.font = C.font('mono', fs); arcText(g, sp.top || '', cx, cy, band, -PI / 2, { tracking: 0.25 });
      g.font = C.font('mono', fs); arcText(g, sp.bottom || '', cx, cy, band, PI / 2, { tracking: 0.3, inward: true });
      if (sp.stars) { g.font = C.font('sans', fs * 0.9); g.fillText('★', cx - band, cy); g.fillText('★', cx + band, cy); }
      (sp.center || []).forEach((l) => { g.font = C.font(l.font, sp.shape === 'postmark' ? l.size : Math.min(l.size, R * 0.9), l.weight); spacedText(g, l.text, cx, cy - R + 2 * R * l.y, l.track ?? 0); });
      if (sp.shape === 'postmark') {   // wavy cancellation lines
        g.lineWidth = 7; g.lineCap = 'round';
        for (let k = 0; k < 6; k++) {
          const y0 = cy - R * 0.72 + k * R * 0.29;
          g.beginPath();
          for (let x = cx + R * 0.6; x <= W - 10; x += 4) { const yy = y0 + Math.sin((x - cx) / 38 + k * 0.4) * 11; if (x === cx + R * 0.6) g.moveTo(x, yy); else g.lineTo(x, yy); }
          g.stroke();
        }
      }
    }
    // roughen edges (SVG displacement filter), colourise, add wear
    ensureFilters();
    const out = C.canvas(base.width, base.height), og = out.getContext('2d');
    og.filter = `url(#ck-rough-${hash(seed, 'f') % 4})`;
    og.drawImage(base, 0, 0);
    og.filter = 'none';
    og.globalCompositeOperation = 'source-in'; og.fillStyle = sp.color || C.colors.red; og.fillRect(0, 0, out.width, out.height);
    const gr = C.images.grunge;
    if (gr && (sp.wear ?? 1) > 0) {
      og.globalCompositeOperation = 'destination-out';
      og.globalAlpha = clamp01(0.85 * (sp.wear ?? 1));
      const ox = -C.rand(seed, 'gx') * Math.max(0, gr.width - out.width), oy = -C.rand(seed, 'gy') * Math.max(0, gr.height - out.height);
      og.fillStyle = og.createPattern(gr, 'repeat');
      og.save(); og.translate(ox, oy); og.rotate(C.srand(seed, 'gr') * 0.3); og.fillRect(-ox - 200, -oy - 200, out.width + 400, out.height + 400); og.restore();
      og.globalAlpha = 1;
    }
    // uneven pressure: one side lighter
    og.globalCompositeOperation = 'destination-in';
    const ang = C.rand(seed, 'pa') * TAU;
    const gx = out.width / 2 + Math.cos(ang) * out.width / 2, gy = out.height / 2 + Math.sin(ang) * out.height / 2;
    const lg = og.createLinearGradient(gx, gy, out.width - gx, out.height - gy);
    lg.addColorStop(0, 'rgba(0,0,0,0.62)'); lg.addColorStop(0.55, 'rgba(0,0,0,0.95)'); lg.addColorStop(1, 'rgba(0,0,0,1)');
    og.fillStyle = lg; og.fillRect(0, 0, out.width, out.height);
    og.globalCompositeOperation = 'source-over';
    // misregistration: faint ghost strike + main strike
    const mis = sp.misreg || [3 + C.srand(seed, 'mx'), -2 + C.srand(seed, 'my')];
    const fin = C.canvas(out.width + 12, out.height + 12), fg = fin.getContext('2d');
    fg.globalAlpha = sp.ghost ?? 0.28; fg.drawImage(out, 6 + mis[0], 6 + mis[1]);
    fg.globalAlpha = sp.ink ?? 0.9; fg.drawImage(out, 6, 6);
    fin.stampSpec = sp;
    stampCache.set(key, fin);
    return fin;
  };
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  C.roundRect = roundRect;
  /** draw a stamp canvas centred at (x,y) with the stampFx(p) thunk (scale, twist, ink spread). */
  C.drawStamp = function (ctx, stampCanvas, x, y, p, o = {}) {
    const fx = C.stampFx(p, o);
    if (!fx.visible) return fx;
    const s = fx.scale * (o.scale ?? 1);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(C.rad(fx.rotate)); ctx.scale(s, s);
    ctx.globalCompositeOperation = o.composite || 'multiply';
    if (fx.inkSpread > 0.01) {       // ink squeezed out on impact
      ctx.globalAlpha = fx.opacity * 0.45 * fx.inkSpread; ctx.filter = `blur(${(1.5 + 3 * fx.inkSpread).toFixed(2)}px)`;
      ctx.drawImage(stampCanvas, -stampCanvas.width / 2, -stampCanvas.height / 2);
      ctx.filter = 'none';
    }
    ctx.globalAlpha = fx.opacity;
    if (fx.blur > 0.05) ctx.filter = `blur(${fx.blur.toFixed(2)}px)`;
    ctx.drawImage(stampCanvas, -stampCanvas.width / 2, -stampCanvas.height / 2);
    ctx.restore();
    return fx;
  };

  // ------------------------------------------------------------------ stickers (die-cut border around any alpha shape)
  const stickerCache = new Map();
  /** sticker(source, {border=14, color='#fff', shadow:{x,y,blur,color}|false, width, height, cacheKey}) -> canvas */
  C.sticker = function (src, o = {}) {
    const key = o.cacheKey || ('st|' + imgId(src) + JSON.stringify(o));
    if (stickerCache.has(key)) return stickerCache.get(key);
    const w = Math.round(o.width ?? (src.naturalWidth || src.width)), h = Math.round(o.height ?? (src.naturalHeight || src.height));
    const B = o.border ?? 14, sh = o.shadow === false ? null : Object.assign({ x: 0, y: 8, blur: 14, color: 'rgba(0,0,0,0.35)' }, o.shadow || {});
    const pad = B + (sh ? sh.blur * 1.5 + Math.abs(sh.y) : 4) + 4;
    const sil = C.canvas(w, h), sg = sil.getContext('2d');
    sg.drawImage(src, 0, 0, w, h); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = o.color || '#fff'; sg.fillRect(0, 0, w, h);
    const dil = C.canvas(w + pad * 2, h + pad * 2), dg = dil.getContext('2d');
    for (const rr of [B, B * 0.7, B * 0.4]) for (let k = 0; k < 36; k++) { const a = k / 36 * TAU; dg.drawImage(sil, pad + Math.cos(a) * rr, pad + Math.sin(a) * rr); }
    dg.drawImage(sil, pad, pad);
    const out = C.canvas(dil.width, dil.height), g = out.getContext('2d');
    if (sh) { g.save(); g.shadowColor = sh.color; g.shadowBlur = sh.blur; g.shadowOffsetX = sh.x; g.shadowOffsetY = sh.y; g.drawImage(dil, 0, 0); g.restore(); }
    g.drawImage(dil, 0, 0);
    g.drawImage(src, pad, pad, w, h);
    // faint gloss
    if (o.gloss !== false) {
      g.save(); g.globalCompositeOperation = 'source-atop';
      const lg = g.createLinearGradient(0, 0, out.width, out.height);
      lg.addColorStop(0, 'rgba(255,255,255,0.28)'); lg.addColorStop(0.45, 'rgba(255,255,255,0.04)'); lg.addColorStop(0.46, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(0,0,0,0.08)');
      g.fillStyle = lg; g.fillRect(0, 0, out.width, out.height); g.restore();
    }
    out.pad = pad;
    stickerCache.set(key, out);
    return out;
  };

  // ------------------------------------------------------------------ glyph paths (canvas Path2D)
  C.PATHS = {
    plane: 'M50,2 C53.6,2 55.2,7 55.2,13 L55.2,36 L96,58.5 L96,64.5 L55.2,53.5 L55.2,74 C55.2,78 54.8,82 54.3,85 L69,93 L69,97 L52.2,93.6 C51.6,96 51,97.6 50,98 C49,97.6 48.4,96 47.8,93.6 L31,97 L31,93 L45.7,85 C45.2,82 44.8,78 44.8,74 L44.8,53.5 L4,64.5 L4,58.5 L44.8,36 L44.8,13 C44.8,7 46.4,2 50,2 Z M28,40.5 C28,38.8 29.3,37.6 31,37.6 C32.7,37.6 34,38.8 34,40.5 L34,50.5 C34,52.2 32.7,53.2 31,53.2 C29.3,53.2 28,52.2 28,50.5 Z M66,40.5 C66,38.8 67.3,37.6 69,37.6 C70.7,37.6 72,38.8 72,40.5 L72,50.5 C72,52.2 70.7,53.2 69,53.2 C67.3,53.2 66,52.2 66,50.5 Z',
    person: 'M20,0 C25.2,0 29,4.1 29,9.6 C29,15.1 25.2,19.8 20,19.8 C14.8,19.8 11,15.1 11,9.6 C11,4.1 14.8,0 20,0 Z M3,52 L3,38 C3,28.5 9.5,22.6 20,22.6 C30.5,22.6 37,28.5 37,38 L37,52 Z',
    pin: 'M50,98 C44,80 18,64 18,38 A32,32 0 1 1 82,38 C82,64 56,80 50,98 Z',
  };
  const p2d = {};
  const path2d = (k) => (p2d[k] || (p2d[k] = new Path2D(C.PATHS[k])));
  /** plane glyph centred at x,y, heading in degrees (0 = up/north, 90 = east), size px */
  C.drawPlane = function (ctx, x, y, heading, size = 80, color = C.colors.ink, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(C.rad(heading)); ctx.scale(size / 100, size / 100); ctx.translate(-50, -50);
    if (o.outline) { ctx.lineWidth = o.outline * 100 / size; ctx.strokeStyle = o.outlineColor || '#fff'; ctx.lineJoin = 'round'; ctx.stroke(path2d('plane')); }
    ctx.fillStyle = color; ctx.fill(path2d('plane')); ctx.restore();
  };
  /** person glyph with top-left at x,y and height h */
  C.drawPerson = function (ctx, x, y, h, color = C.colors.ink) {
    ctx.save(); ctx.translate(x, y); ctx.scale(h / 52, h / 52); ctx.fillStyle = color; ctx.fill(path2d('person')); ctx.restore();
  };
  /** crowd / dot-matrix of people: grid of cols×rows glyphs. highlight(i)->colour|null; progress reveals row-major;
   *  mode:'people'|'dots'. Returns {cellW, cellH}. */
  C.drawCrowd = function (ctx, o) {
    const { x, y, cols, rows } = o, h = o.size ?? 26, gap = o.gap ?? 6, mode = o.mode ?? 'people';
    const cw = mode === 'people' ? h * 40 / 52 + gap : h + gap, ch = h + gap;
    const n = cols * rows, shown = Math.floor(clamp01(o.progress ?? 1) * n + 1e-9);
    ctx.save();
    for (let i = 0; i < shown; i++) {
      const cx = x + (i % cols) * cw, cy = y + Math.floor(i / cols) * ch;
      const hc = o.highlight ? o.highlight(i) : null;
      const col = hc || o.color || C.colors.ink;
      if (mode === 'people') C.drawPerson(ctx, cx, cy, h, col);
      else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + h / 2, cy + h / 2, h / 2, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    return { cellW: cw, cellH: ch };
  };

  // ------------------------------------------------------------------ barcode + boarding pass
  /** Code-128-looking 1-D barcode (decorative, deterministic). */
  C.drawBarcode = function (ctx, x, y, w, h, seed = 'bc', color = C.colors.ink) {
    const r = C.rng(seed); let cx = x; const unit = w / 260;
    ctx.save(); ctx.fillStyle = color;
    const bar = (m) => { ctx.fillRect(cx, y, m * unit, h); cx += m * unit; };
    const space = (m) => { cx += m * unit; };
    bar(2); space(1); bar(1); space(1);
    while (cx < x + w - 14 * unit) { bar(r.int(1, 4)); space(r.int(1, 3)); }
    while (cx < x + w - 4 * unit) space(1);
    bar(2); space(1); bar(1);
    ctx.restore();
  };
  /** PDF417-looking 2-D code (decorative). */
  C.drawCode2D = function (ctx, x, y, w, h, seed = 'pdf', color = C.colors.ink) {
    const r = C.rng(seed), rows = Math.round(h / 7), rh = h / rows;
    ctx.save(); ctx.fillStyle = color;
    for (let j = 0; j < rows; j++) {
      let cx = x; const u = w / 180;
      ctx.fillRect(cx, y + j * rh, 8 * u, rh * 0.9); cx += 10 * u;
      while (cx < x + w - 12 * u) { const m = r.int(1, 5) * u; if (r.next() < 0.55) ctx.fillRect(cx, y + j * rh, m, rh * 0.9); cx += m; }
      ctx.fillRect(x + w - 8 * u, y + j * rh, 8 * u, rh * 0.9);
    }
    ctx.restore();
  };
  const bpCache = new Map();
  /** Generic boarding pass (no airline branding). Canvas 1600×600 (+pad). Call after Collage.ready().
   *  opts: {from:'TPE', fromCity:'臺北 TAIPEI', to:'OSL', toCity:'奧斯陸 OSLO', passenger:'YOU', flight:'30SEC',
   *         date:'2026', seat:'30A', gate:'N0', boarding:'00:30', cls:'旅人 TRAVELLER', seed, accent, navy, shadow=true} */
  C.boardingPass = function (o = {}) {
    const key = JSON.stringify(o);
    if (bpCache.has(key)) return bpCache.get(key);
    const d = Object.assign({ from: 'TPE', fromCity: '臺北 TAIPEI', to: 'OSL', toCity: '奧斯陸 OSLO', passenger: 'YOU', flight: '30SEC', date: '2026',
      seat: '30A', gate: 'N0', boarding: '00:30', cls: '旅人 TRAVELLER', seed: 'bp', accent: C.colors.red, navy: C.colors.navy }, o);
    const W = 1600, H = 600, pad = 40, stubX = 1170;
    const c = C.canvas(W + pad * 2, H + pad * 2), g = c.getContext('2d');
    g.translate(pad, pad);
    // ticket shape with side notches at the perforation
    const shape = () => {
      g.beginPath(); const r = 28, nr = 26;
      g.moveTo(r, 0); g.lineTo(stubX - nr, 0); g.arc(stubX, 0, nr, PI, 0, true); g.lineTo(W - r, 0); g.arcTo(W, 0, W, r, r);
      g.lineTo(W, H - r); g.arcTo(W, H, W - r, H, r); g.lineTo(stubX + nr, H); g.arc(stubX, H, nr, 0, PI, true); g.lineTo(r, H); g.arcTo(0, H, 0, H - r, r);
      g.lineTo(0, r); g.arcTo(0, 0, r, 0, r); g.closePath();
    };
    if (o.shadow !== false) { g.save(); g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 22; g.shadowOffsetY = 12; shape(); g.fillStyle = '#FBF7EE'; g.fill(); g.restore(); }
    g.save(); shape(); g.clip();
    g.fillStyle = '#FBF7EE'; g.fillRect(0, 0, W, H);
    if (C.images.paper) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55; g.fillStyle = g.createPattern(C.images.paper, 'repeat'); g.fillRect(0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    // header band
    g.fillStyle = d.navy; g.fillRect(0, 0, W, 104);
    g.fillStyle = d.accent; g.fillRect(0, 104, W, 10);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
    g.font = C.font('mono', 34); spacedTextLeft(g, 'BOARDING PASS', 48, 54, 7);
    g.font = C.font('sans', 40); g.fillText('登機證', 430, 55);
    C.drawPlane(g, 1090, 54, 90, 54, '#fff');
    g.font = C.font('mono', 26); g.textAlign = 'left'; spacedTextLeft(g, d.cls.toUpperCase(), stubX + 44, 54, 3);
    // route
    g.fillStyle = C.colors.ink; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.font = C.font('anton', 210); g.fillText(d.from, 44, 355);
    g.textAlign = 'right'; g.fillText(d.to, stubX - 60, 355);
    g.textAlign = 'left'; g.font = C.font('sans', 34, 700); g.fillText(d.fromCity, 50, 405);
    g.textAlign = 'right'; g.fillText(d.toCity, stubX - 62, 405);
    // dashed arc + plane between codes
    const ax = 430, bx = stubX - 400, ay = 250;
    g.save(); g.strokeStyle = d.accent; g.lineWidth = 5; g.setLineDash([2, 14]); g.lineCap = 'round';
    g.beginPath(); g.moveTo(ax, ay + 20); g.quadraticCurveTo((ax + bx) / 2, ay - 90, bx, ay + 20); g.stroke(); g.restore();
    C.drawPlane(g, (ax + bx) / 2, ay - 36, 90, 86, d.navy);
    // fields
    const fields = [['PASSENGER 旅客', d.passenger], ['FLIGHT 航班', d.flight], ['DATE 日期', d.date], ['SEAT 座位', d.seat], ['GATE 登機門', d.gate]];
    fields.forEach(([k, v], i) => {
      const fx = 50 + i * 216;
      g.textAlign = 'left'; g.fillStyle = '#6B645A'; g.font = C.font('sans', 20, 700); g.fillText(k, fx, 462);
      g.fillStyle = C.colors.ink; g.font = C.font('mono', 44); g.fillText(v, fx, 512);
    });
    C.drawBarcode(g, 50, 536, 620, 44, hash(d.seed, 'bar'));
    g.fillStyle = '#6B645A'; g.font = C.font('mono', 18, 400); g.textAlign = 'left'; g.fillText('SEQ 0030  ·  ' + d.from + '→' + d.to + '  ·  NOT A TRAVEL DOCUMENT', 700, 568);
    // perforation
    g.strokeStyle = 'rgba(20,20,20,0.35)'; g.lineWidth = 3; g.setLineDash([3, 11]); g.beginPath(); g.moveTo(stubX, 36); g.lineTo(stubX, H - 36); g.stroke(); g.setLineDash([]);
    // stub
    const sx = stubX + 44;
    g.textAlign = 'left'; g.fillStyle = C.colors.ink; g.font = C.font('anton', 92); g.fillText(d.from, sx, 232);
    g.fillStyle = d.accent; g.font = C.font('anton', 70); g.fillText('→', sx + 166, 226);
    g.fillStyle = C.colors.ink; g.font = C.font('anton', 92); g.fillText(d.to, sx + 244, 232);
    [['PASSENGER', d.passenger], ['SEAT', d.seat], ['BOARDING', d.boarding]].forEach(([k, v], i) => {
      const fx = sx + (i % 2) * 200, fy = 290 + Math.floor(i / 2) * 92;
      g.fillStyle = '#6B645A'; g.font = C.font('mono', 18, 400); g.fillText(k, fx, fy);
      g.fillStyle = C.colors.ink; g.font = C.font('mono', 40); g.fillText(v, fx, fy + 44);
    });
    C.drawCode2D(g, sx, 470, 370, 96, hash(d.seed, '2d'));
    g.restore();
    // subtle edge line
    g.save(); shape(); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.stroke(); g.restore();
    c.pad = pad; c.stubX = stubX + pad;
    bpCache.set(key, c);
    return c;
  };
  function spacedTextLeft(g, text, x, y, tr) { let cx = x; for (const ch of C.graphemes(text)) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + tr; } return cx - x; }
  C.spacedTextLeft = spacedTextLeft;

  // ------------------------------------------------------------------ DOM helpers
  /** set many CSS props quickly: C.css(el, {transform, opacity, ...}) */
  C.css = (el, props) => { for (const k in props) el.style[k] = props[k]; return el; };
  /** apply a transform object (from snapIn/stampFx/jitter...) plus base translate/rotate/scale to an element */
  C.place = function (el, base = {}, ...mods) {
    let x = base.x || 0, y = base.y || 0, r = base.rotate || 0, s = base.scale ?? 1, op = base.opacity ?? 1, vis = true;
    for (const m of mods) { if (!m) continue; x += m.x || 0; y += m.y || 0; r += (m.rotate ?? m.r ?? 0); s *= m.scale ?? 1; op *= m.opacity ?? 1; if (m.visible === false) vis = false; }
    el.style.transform = `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${s.toFixed(4)})`;
    el.style.opacity = vis ? op : 0;
    el.style.visibility = vis && op > 0 ? 'visible' : 'hidden';
    return el;
  };

  /** Apply tornPaper to every .torn element under root. data-seed, data-edges ('all','tb','lr',...),
   *  data-rough, data-rim, data-shadow="0" (no shadow), data-bite. Returns wrappers. Idempotent. */
  C.tornAll = function (rootEl = document) {
    const out = [];
    rootEl.querySelectorAll('.torn:not([data-torn-done])').forEach((el, i) => {
      el.setAttribute('data-torn-done', '1');
      const ds = el.dataset;
      out.push(C.tornPaper(el, { seed: ds.seed ?? ('torn' + i), edges: ds.edges ?? 'all', roughness: ds.rough ? +ds.rough : 1,
        rim: ds.rim ? +ds.rim : 7, bite: ds.bite ? +ds.bite : 1, shadow: ds.shadow === '0' ? false : undefined }));
    });
    return out;
  };
  /** Ransom-note cut letters: splits el's text into .cut-letter spans with seeded paper/colour/font/rotation.
   *  opts: {seed, styles:[{bg,color,font}], rot=6, shift=0.06} */
  C.cutLetters = function (el, o = {}) {
    const seed = o.seed ?? 'cut';
    const styles = o.styles || [
      { bg: 'var(--cream) url(' + C.asset('textures/paper_cream.jpg') + ')', color: 'var(--ink)', font: 'var(--f-anton)' },
      { bg: 'var(--no-red)', color: '#fff', font: 'var(--f-anton)' },
      { bg: 'var(--newsprint) url(' + C.asset('textures/newsprint.jpg') + ')', color: 'var(--ink)', font: 'var(--f-serif)' },
      { bg: 'var(--no-navy)', color: '#fff', font: 'var(--f-mono)' },
      { bg: 'var(--hl-yellow)', color: 'var(--ink)', font: 'var(--f-sans)' },
      { bg: 'var(--kraft) url(' + C.asset('textures/kraft.jpg') + ')', color: 'var(--ink)', font: 'var(--f-anton)' },
    ];
    const text = el.textContent; el.textContent = '';
    C.graphemes(text).forEach((ch, i) => {
      if (ch === ' ') { el.appendChild(document.createTextNode(' ')); return; }
      const st = styles[hash(seed, 's', i) % styles.length];
      const sp = document.createElement('span');
      sp.className = 'cut-letter'; sp.textContent = ch;
      sp.style.background = st.bg; sp.style.color = st.color; sp.style.fontFamily = st.font;
      sp.style.transform = `rotate(${(C.srand(seed, 'r', i) * (o.rot ?? 6)).toFixed(2)}deg) translateY(${(C.srand(seed, 'y', i) * (o.shift ?? 0.06)).toFixed(3)}em)`;
      sp.style.fontSize = (1 + C.srand(seed, 'z', i) * 0.08).toFixed(3) + 'em';
      el.appendChild(sp);
    });
    return el;
  };

  C.version = '1.0.0';
  root.Collage = C;
})(typeof window !== 'undefined' ? window : globalThis);
