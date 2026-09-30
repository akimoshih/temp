/* S3 TITLE_DROP (f224–282, overlay above the globe plate) + S4 FACTS F1–F4 (f280–503, full frame).
 * Owner: B-title-facts. Generated inputs (comp/assets/B-title-facts/):
 *   make_islands.py -> islands.json   Svalbard + Jan Mayen at the same 1 unit = 1 km equal-area scale as assets/kit/svg/*_silhouette.svg
 *   make_fills.py   -> fills.json + norway_fill.jpg (Sentinel-2 mosaic), svalbard/janmayen_fill.jpg (Blue Marble),
 *                      taiwan_relief.png — real imagery reprojected into each silhouette's own LAEA frame.
 *
 *   S3  f224  DROP: title slam (red torn plate 挪威 + cream NORWAY), flash frame, shake; tape f226–227, newsprint tag f228,
 *             flag sticker f231, navy KONGERIKET NORGE stamp inked into the tag f238 (clap), marker underline f240,
 *             kicker + map-locked arrow f245, burst f252.
 *       f280–282 the whole S3 frame (a copy of globe plate 279 + border + title) is torn away (paper-rip wipe).
 *   F1  f280  Oslo: Sentinel-2 10 m live view, fast push-in + viewfinder with FACT 01 + 首都 OSD label (f284–285);
 *             shutter flash f294 -> photo print, pin + marker circle, 首都 / 奧斯陸 / OSLO, postmark.
 *   F2  f336  人口 約 563 萬: count-up on every counter_tick f336–363, lands f364 (ding: paper flash, bursts, shake)
 *             + halftone crowd in depth + the F1 print left on the desk.
 *   F3  f392  面積 約 38.5 萬 km²: satellite-filled Norway (mainland + Svalbard + Jan Mayen inset, equal-area) + 10 printed
 *             Taiwans, one per pop cue with a ×N counter; 超過 10 個台灣大 on the 6th pop (f420), re-hit on the 10th (f436).
 *   F4  f448  峽灣 FJORDS: terrain plate renders/terrain/geiranger (local = f-448), lower third (hit f450), cream tag f470,
 *             世界遺產 stamp inked into it on f476.
 * Every fact layer is torn away over the first 3 frames of the next one (the incoming layer draws the rip shadow).
 * All wording/numbers come from facts.json (onscreen.* / copy.*). render(f) is a pure function of f.
 */
(function () {
  const W = 1920, H = 1080;
  const RED = '#BA0C2F', NAVY = '#00205B', CREAM = '#F1E9D8', INK = '#141414', YEL = '#FFE14D', RIM = '#FBF8F0';
  const T = { drop: 224, stampS3: 238, f1: 280, shutter: 294, f2: 336, ding: 364, f3: 392, f4: 448, stamp: 476, end: 503 };
  const GEO = '../assets/geo/';
  const KIT = s => window.Collage.asset(s);

  const cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (f, a, d) => cl01((f - a) / d);
  const eOutCubic = t => 1 - Math.pow(1 - t, 3), eOutQuart = t => 1 - Math.pow(1 - t, 4), eInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const px = v => v.toFixed(2) + 'px';
  // footnote markup: Space Mono, CJK runs in Noto Sans TC (.footnote .zh)
  const foot = t => t.replace(/([\u3000-\u9fff\uff00-\uffef]+)/g, '<span class="zh">$1</span>');

  function div(parent, cls, style = {}, html) {
    const e = document.createElement('div');
    if (cls) e.className = cls;
    Object.assign(e.style, { position: 'absolute' }, style);
    if (html !== undefined) e.innerHTML = html;
    parent.appendChild(e);
    return e;
  }
  function img(parent, src, style = {}, cls = '') {
    const e = document.createElement('img');
    e.src = src; e.className = cls; e.decoding = 'sync';
    Object.assign(e.style, { position: 'absolute' }, style);
    parent.appendChild(e);
    return e;
  }
  function cv(parent, w, h, style = {}) {
    const c = window.Collage.canvas(w, h);
    Object.assign(c.style, { position: 'absolute', left: '0px', top: '0px' }, style);
    parent.appendChild(c);
    return c;
  }
  // torn paper plate (DOM): returns the torn-wrap (animate that)
  function tornDiv(C, parent, o, html) {
    const d = div(parent, 'paper ' + (o.cls || ''), Object.assign({ left: o.x + 'px', top: o.y + 'px', width: o.w + 'px', height: o.h + 'px' }, o.style || {}), html);
    d.setAttribute('data-torn-done', '1');
    const wrap = C.tornPaper(d, { seed: o.seed, edges: o.edges || 'tb', rim: o.rim ?? 7, roughness: o.rough ?? 1, width: o.w, height: o.h, bite: o.bite ?? 1 });
    wrap.style.visibility = 'hidden';
    return wrap;
  }
  // FACT category label: torn ink strip with cream Noto Sans TC 900 (same treatment as section D's column())
  function inkStrip(C, parent, x, y, text, o = {}) {
    const size = o.size || 84, w = Math.round(textW(C, 'sans', size, text, 0.06) + 80), h = o.h || 128;
    const wrap = tornDiv(C, parent, { x, y, w, h, cls: 'paper--ink crumple center', seed: o.seed, edges: 'lr', rim: 6, style: o.style },
      `<div class="f-sans" style="font-size:${size}px;line-height:1;letter-spacing:.06em;margin-top:2px;color:${CREAM}">${text}</div>`);
    wrap.style.transformOrigin = '20px 50%';
    wrap.box = [x, y, w, h];
    return wrap;
  }
  function textW(C, kind, size, text, track = 0) {
    const g = textW.g || (textW.g = C.canvas(8, 8).getContext('2d'));
    g.font = C.font(kind, size);
    return g.measureText(text).width + track * size * Math.max(0, C.graphemes(text).length - 1);
  }
  // impact that lands ON frame t (the element is already at full size on t): overshoot -> squash -> settle
  function hitAt(f, t, o = {}) {
    const k = f - t;
    if (k < 0) return { visible: false, opacity: 0 };
    const S = o.seq || [1.2, 0.955, 1.02, 0.996, 1];
    return { scale: S[Math.min(k, S.length - 1)], rotate: (o.rot0 || 0) * Math.max(0, 1 - k / 3), x: (o.dx || 0) * Math.max(0, 1 - k / 2), y: (o.dy || 0) * Math.max(0, 1 - k / 2) };
  }
  // small beat bump (scale punch) on frame t
  function bump(f, t, amp = 0.025) {
    const k = f - t;
    if (k < 0 || k > 3) return null;
    return { scale: 1 + amp * [1, 0.45, 0.15, 0][k] };
  }
  // quick flash opacity after an impact
  const flashAt = (f, t, seq = [0.92, 0.45, 0.16, 0.05]) => (f >= t && f - t < seq.length ? seq[f - t] : 0);

  // ------------------------------------------------------------------ paper-rip wipe
  // The outgoing layer keeps the part u < tear (u = axis at `ang` degrees) and is pulled toward -u.
  // The pull is horizontal (never exposes the untorn top/bottom edges) and the piece is scaled just enough
  // (s = cos r + W/H·|sin r|) that its rotation never uncovers a sliver of the incoming layer along the untorn edges.
  const RIP = { q: [0.74, 0.43, 0.15], pull: [26, 110, 260], rot: [-0.4, -1.3, -2.8] };
  function ripGeom(C, k, seed, angDeg) {
    const a = angDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const U = 960 * Math.abs(ca) + 540 * Math.abs(sa), V = 960 * Math.abs(sa) + 540 * Math.abs(ca);
    const slant = (C.srand(seed, 'sl') > 0 ? 1 : -1) * 0.2;
    const span = U + V * Math.abs(slant) + 90;
    const u0 = -span + RIP.q[k] * 2 * span;
    const toXY = (u, v) => [960 + u * ca - v * sa, 540 + u * sa + v * ca];
    const N = 220, edge = [], inner = [];
    for (let i = 0; i <= N; i++) {
      const v = -V - 90 + (2 * V + 180) * i / N;
      const jag = C.fbm1(C.hash(seed, 'b'), v / 290, 3) * 64 + C.noise1(C.hash(seed, 'm'), v / 36) * 13 + C.srand(seed, 'f', i) * 4.2;
      const u = u0 + v * slant + jag;
      const rw = 5 + 10 * (0.5 + 0.5 * C.fbm1(C.hash(seed, 'r'), v / 70, 2)) + C.srand(seed, 'rf', i) * 1.6;
      edge.push(toXY(u, v)); inner.push(toXY(u - rw, v));
    }
    const far = -U - 1200;
    const poly = edge.concat([toXY(far, V + 90), toXY(far, -V - 90)]);
    const sgn = C.srand(seed, 'rs') > 0 ? 1 : -1;
    const rot = RIP.rot[k] * sgn, rr = Math.abs(rot) * Math.PI / 180;
    const sc = Math.cos(rr) + (W / H) * Math.sin(rr) + 0.006;
    return { poly, edge, inner, tx: -RIP.pull[k] * Math.sign(ca || 1), ty: 0, rot, sc };
  }
  // apply the rip to a layer div (k<0 or >2: off). rimCv = full-frame canvas inside the layer.
  function applyRip(C, layer, rimCv, k, seed, ang) {
    const g = rimCv.getContext('2d');
    if (k < 0 || k > 2) {
      if (layer._rip) { layer.style.clipPath = ''; layer.style.transform = ''; g.clearRect(0, 0, W, H); layer._rip = false; }
      return;
    }
    layer._rip = true;
    const r = ripGeom(C, k, seed, ang);
    layer.style.clipPath = C.clipPathCss(r.poly);
    layer.style.transformOrigin = '960px 540px';
    layer.style.transform = `translate(${px(r.tx)},${px(r.ty)}) rotate(${r.rot.toFixed(3)}deg) scale(${r.sc.toFixed(4)})`;
    g.clearRect(0, 0, W, H);
    // white paper core along the tear, textured, with a thin shade where the print meets the core
    g.save();
    g.beginPath(); r.edge.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    for (let i = r.inner.length - 1; i >= 0; i--) g.lineTo(r.inner[i][0], r.inner[i][1]);
    g.closePath();
    g.fillStyle = RIM; g.fill();
    if (C.images.paper) {
      let x0 = W, x1 = 0; for (const p of r.edge) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; }
      x0 = Math.max(0, x0 - 30); x1 = Math.min(W, x1 + 10);
      g.save(); g.clip(); g.globalAlpha = 0.55; g.globalCompositeOperation = 'multiply'; g.fillStyle = g.createPattern(C.images.paper, 'repeat'); g.fillRect(x0, 0, x1 - x0, H); g.restore();
    }
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.6;
    g.beginPath(); r.inner.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    // fibres
    g.strokeStyle = RIM; g.lineCap = 'round';
    for (let i = 1; i < r.edge.length - 1; i++) {
      if (C.rand(seed, 'fib', i) > 0.6) continue;
      const [x0, y0] = r.edge[i], [xa, ya] = r.edge[i - 1], [xb, yb] = r.edge[i + 1];
      let nx = -(yb - ya), ny = xb - xa; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
      const [xi, yi] = r.inner[i]; if (nx * (x0 - xi) + ny * (y0 - yi) < 0) { nx = -nx; ny = -ny; }
      const L = 1.5 + 4 * C.rand(seed, 'fl', i), aa = C.srand(seed, 'fa', i) * 0.8;
      const dx = nx * Math.cos(aa) - ny * Math.sin(aa), dy = nx * Math.sin(aa) + ny * Math.cos(aa);
      g.globalAlpha = 0.5 + 0.45 * C.rand(seed, 'fo', i); g.lineWidth = 0.6 + 0.6 * C.rand(seed, 'fw', i);
      g.beginPath(); g.moveTo(x0 - dx, y0 - dy); g.lineTo(x0 + dx * L, y0 + dy * L); g.stroke();
    }
    g.restore();
  }
  // shadow the torn piece casts on the incoming layer (screen space)
  function drawRipShadow(C, g, k, seed, ang) {      // g: half-resolution canvas (960×540, CSS-scaled ×2)
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W / 2, H / 2);
    if (k < 0 || k > 2) return;
    g.setTransform(0.5, 0, 0, 0.5, 0, 0);
    const r = ripGeom(C, k, seed, ang);
    const a = r.rot * Math.PI / 180, ca = Math.cos(a) * r.sc, sa = Math.sin(a) * r.sc;
    const tr = ([x, y]) => [960 + r.tx + (x - 960) * ca - (y - 540) * sa, 540 + r.ty + (x - 960) * sa + (y - 540) * ca];
    const pts = r.poly.map(tr), box = [[0, 0], [W, 0], [W, H], [0, H]].map(tr);
    const path = (dx, dy) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy))); g.closePath(); };
    g.save();
    // the piece is (torn polygon ∩ layer box): clip the shadow to the box (shifted like the shadow)
    g.beginPath(); box.forEach((p, i) => (i ? g.lineTo(p[0] + 14, p[1] + 16) : g.moveTo(p[0] + 14, p[1] + 16))); g.closePath(); g.clip();
    g.filter = 'blur(7px)'; g.fillStyle = 'rgba(12,8,4,0.55)'; path(14, 16); g.fill();
    g.filter = 'blur(1.5px)'; g.fillStyle = 'rgba(0,0,0,0.35)'; path(3, 4); g.fill();
    g.restore();
  }

  // Norway mainland silhouette offsets (assets/kit/svg/norway_silhouette.svg: LAEA 15E 65N, 1 unit = 1 km)
  const R_E = 6371.0088;
  function laea(lon, lat, lon0 = 15, lat0 = 65) {
    const d = Math.PI / 180, l = lon * d, p = lat * d, l0 = lon0 * d, p0 = lat0 * d;
    const k = Math.sqrt(2 / (1 + Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l - l0)));
    return [R_E * k * Math.cos(p) * Math.sin(l - l0), R_E * k * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l - l0))];
  }
  const NO_SIL = { x0: -558.3031, y1: 726.9554, w: 1169.53, h: 1477.68 };
  const silXY = (lon, lat) => { const [x, y] = laea(lon, lat); return [x - NO_SIL.x0, NO_SIL.y1 - y]; };
  // recoloured silhouette canvas from an SVG image (alpha shape) at `s` px per km
  function tint(C, im, w, h, color, texture) {
    const c = C.canvas(w, h), g = c.getContext('2d');
    g.drawImage(im, 0, 0, w, h);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
    if (texture) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.5; g.fillStyle = g.createPattern(texture, 'repeat'); g.fillRect(0, 0, w, h); g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(im, 0, 0, w, h); }
    return c;
  }

  // =================================================================================== S3 TITLE DROP
  COMP.section({
    id: 's3-title', start: T.drop, end: T.f1 + 2, z: 20,

    async init(root, X) {
      const C = X.C;
      const [zh, en] = X.facts.copy.title.split(' ');          // 挪威 / NORWAY
      this.piece = div(root, 'layer', { inset: '0' });
      // copy of the last globe plate + border, only for the rip-out frames (f280–282)
      this.globe = X.plate(this.piece, { z: 0 }); this.globe.style.visibility = 'hidden';
      this.bcv = X.canvasLayer(this.piece, 1); this.bg = this.bcv.getContext('2d');
      let gen = null; try { gen = await X.json('assets/A-globe/norway_border_generalized.json'); } catch (e) { gen = null; }
      this.ring = gen && gen.ring || X.geo.norwaySimple.features.find(ft => ft.properties.part === 'mainland_main_ring').geometry.coordinates;
      this.islands = gen && gen.islands || [];
      this.flash = div(this.piece, '', { inset: '0', background: '#FFF7EA', opacity: 0, zIndex: 2 });
      this.mcv = X.canvasLayer(this.piece, 3); this.mg = this.mcv.getContext('2d');       // map-locked marker (arrow)
      this.cam = div(this.piece, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', zIndex: 4, transformOrigin: '1400px 600px' });
      this.rim = X.canvasLayer(this.piece, 9);

      this.scv = cv(this.cam, W, H, { zIndex: 0 }); this.sg = this.scv.getContext('2d');   // scraps, behind the plates
      // newsprint tag tucked under the lower-left of the title block: it takes the KONGERIKET NORGE stamp (f238)
      const tgW = 340, tgH = 318;
      this.tagBase = C.tornPaper(null, { width: tgW, height: tgH, seed: 'B-s3tag', edges: 'all', fill: '#E4E0D6', texture: 'newsprint', rim: 6, pad: 34, roughness: 0.9, bite: 0.8, shadow: { x: 0, y: 12, blur: 20, color: 'rgba(0,0,0,0.5)' } });
      this.tagC = [1036, 890];
      const tb = this.tagBase;
      this.tag = div(this.cam, '', { left: (this.tagC[0] - tb.width / 2) + 'px', top: (this.tagC[1] - tb.height / 2) + 'px', width: tb.width + 'px', height: tb.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden', zIndex: 0 });
      this.tagCv = cv(this.tag, tb.width, tb.height); this.tagG = this.tagCv.getContext('2d');
      this.tagG.drawImage(tb, 0, 0); this._tagDirty = false;
      div(this.tag, 'tape tape--white tape--sm', { right: '-40px', bottom: '40px', transform: 'rotate(-40deg)' });
      this.stamp = C.makeStamp('norge', { ink: 0.95, seed: 'B-norge' });                // navy, multiplied into the newsprint

      // red plate 挪威 (glyphs sit high on the plate so the cream NORWAY plate never covers a stroke)
      const zSize = 262, zW = textW(C, 'sans', zSize, zh, 0.02);
      const rw = Math.round(zW + 170), rh = 318;
      this.redC = [1432, 452];
      this.red = tornDiv(C, this.cam, { x: this.redC[0] - rw / 2, y: this.redC[1] - rh / 2, w: rw, h: rh, cls: 'paper--red crumple center', seed: 'B-red', edges: 'tb', rim: 8 },
        `<div class="f-sans c-white" style="font-size:${zSize}px;line-height:1;letter-spacing:.02em;margin-top:-52px;position:relative;top:-12px;text-shadow:0 4px 0 rgba(0,0,0,.2)">${zh}</div>`);
      // cream plate NORWAY
      const eSize = 188, eW = textW(C, 'anton', eSize, en, 0.05);
      const cw = Math.round(eW + 120), ch = 206;
      this.creamC = [1436, 700];
      this.cream = tornDiv(C, this.cam, { x: this.creamC[0] - cw / 2, y: this.creamC[1] - ch / 2, w: cw, h: ch, cls: 'crumple center', seed: 'B-cream', edges: 'lrb', rim: 6 },
        `<div class="f-anton c-ink" style="font-size:${eSize}px;line-height:1;letter-spacing:.05em;margin-top:4px">${en}</div>`);
      this.creamBox = { x1: this.creamC[0] - cw / 2, x2: this.creamC[0] + cw / 2, y1: this.creamC[1] - ch / 2, y2: this.creamC[1] + ch / 2 };
      this.tapeA = div(this.cam, 'tape tape--beige tape--sm', { left: (this.creamC[0] - cw / 2 - 86) + 'px', top: (this.creamC[1] - ch / 2 - 4) + 'px', zIndex: 6, visibility: 'hidden' });
      this.tapeB = div(this.cam, 'tape tape--beige tape--sm', { left: (this.creamC[0] + cw / 2 - 104) + 'px', top: (this.creamC[1] - ch / 2 - 30) + 'px', zIndex: 6, visibility: 'hidden' });
      // Norway flag sticker (kit SVG: exact flag geometry)
      this.flag = img(this.cam, KIT('svg/sticker_flag_no.svg'), { left: (1128 - 125) + 'px', top: (222 - 96) + 'px', width: '250px', zIndex: 5, transformOrigin: '50% 50%', visibility: 'hidden' });
      // series kicker (callback to S1): 30 秒認識一個國家 — bottom right, under the underline
      this.kicker = div(this.cam, 'tape-label', { left: '1150px', top: '872px', fontSize: '46px', height: '94px', padding: '0 52px', zIndex: 6, transformOrigin: '30% 50%', visibility: 'hidden' }, X.facts.copy.kicker);
      // marker canvas (moves with the collage)
      this.ocv = cv(this.cam, W, H, { zIndex: 7 }); this.og = this.ocv.getContext('2d');
      // paper scraps knocked loose by the slam (drawn on twos, f224–235)
      this.scraps = [];
      const fills = [RED, CREAM, '#E4E0D6', RED, CREAM, NAVY, CREAM, RED, '#E4E0D6', CREAM];
      for (let i = 0; i < fills.length; i++) {
        const w = 26 + 40 * C.rand('B-scw', i), h = 16 + 26 * C.rand('B-sch', i);
        const cvs = C.tornPaper(null, { width: w, height: h, seed: 'B-scrap' + i, edges: 'all', fill: fills[i], texture: 'paper', textureAlpha: 0.4, rim: 3, pad: 10, shadow: { x: 0, y: 4, blur: 6, color: 'rgba(0,0,0,0.3)' }, roughness: 0.5, bite: 0.4 });
        const a = (-150 + 300 * (i + C.rand('B-sca', i) * 0.8) / fills.length) * Math.PI / 180;
        this.scraps.push({ cvs, a, v: 70 + 50 * C.rand('B-scv', i), spin: C.srand('B-scs', i) * 40, x0: 1440 + C.srand('B-scx', i) * 260, y0: 540 + C.srand('B-scy', i) * 120 });
      }
      await this.globe.setSrc(X.SEQ.globe(279));
    },

    drawBorder(X, gf) {   // matches the S3 look of the globe section's border (white halo + red core)
      const g = this.bg, P = (lat, lon) => X.project(gf, lat, lon);
      g.clearRect(0, 0, W, H);
      const pts = this.ring.map(([lon, lat]) => P(lat, lon));
      g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); g.rect(0, 0, W, H); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
      g.fillStyle = 'rgba(0,12,34,0.22)'; g.fill('evenodd');
      const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); };
      g.shadowColor = 'rgba(255,255,255,0.35)'; g.shadowBlur = 8; g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 5.2; path(); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = RED; g.lineWidth = 3; path(); g.stroke();
      g.lineWidth = 3.4; g.strokeStyle = 'rgba(255,255,255,0.85)'; g.beginPath();
      for (const r of this.islands) { r.forEach(([lon, lat], i) => { const p = P(lat, lon); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); }
      g.stroke(); g.lineWidth = 1.6; g.strokeStyle = RED; g.stroke();
      g.restore();
    },

    async render(f, root, X) {
      const C = X.C;
      // ---- rip-out (f280–282): own copy of the frozen plate, torn away to reveal F1
      const rk = f - T.f1;
      if (rk >= 0) {
        this.globe.style.visibility = 'visible';
        if (!this._border) { this.drawBorder(X, 279); this._border = true; }
      } else if (this.globe.style.visibility !== 'hidden') {
        this.globe.style.visibility = 'hidden'; this.bg.clearRect(0, 0, W, H); this._border = false;
      }
      applyRip(C, this.piece, this.rim, rk, 'B-rip-s3', 0);

      // ---- flash frame on the drop (under the title, over the map)
      this.flash.style.opacity = flashAt(f, T.drop, [0.84, 0.4, 0.14, 0.04]);

      // ---- camera: heavy shake on the drop, a thunk on the stamp; continuous slow push
      const sh = C.shake('B-drop', f, T.drop, { amp: 30, decay: 6.5, freq: 1.1 });
      const s2 = C.shake('B-thunk', f, T.stampS3, { amp: 10, decay: 3.2 });
      const push = 1 + 0.036 * eInOut(prog(f, T.drop, 58));
      this.cam.style.transform = `translate(${px(sh.x + s2.x)},${px(sh.y + s2.y)}) rotate(${(sh.r + s2.r).toFixed(3)}deg) scale(${push.toFixed(4)})`;

      // ---- collage
      const beat = f >= 252 ? bump(f, 252) : null, beat4 = bump(f, 266, 0.02);
      C.place(this.red, { rotate: -2.5 }, hitAt(f, T.drop, { seq: [1.13, 0.955, 1.022, 0.996, 1], rot0: -3 }), C.jitter('B-red', f, 2.2), beat, beat4);
      C.place(this.cream, { rotate: 1.6 }, hitAt(f, T.drop, { seq: [1.11, 0.95, 1.025, 0.992, 1], rot0: 2, dy: 30 }), C.jitter('B-cream', f, 2), beat, beat4);
      C.place(this.tapeA, { rotate: -38 }, C.snapInAt(f, 226, { dur: 3, from: 1.5, seed: 'B-ta' }), C.jitter('B-ta', f, 1.2));
      C.place(this.tapeB, { rotate: 32 }, C.snapInAt(f, 227, { dur: 3, from: 1.5, seed: 'B-tb' }), C.jitter('B-tb', f, 1.2));
      C.place(this.tag, { rotate: -7 }, C.snapInAt(f, 228, { dur: 4, from: 1.35, seed: 'B-tag' }), C.jitter('B-tag', f, 1.6), C.wander('B-tagw', f, 2.5, 0.04), f >= T.stampS3 ? hitAt(f, T.stampS3, { seq: [0.965, 1.012, 1] }) : null);
      C.place(this.kicker, { rotate: -2 }, C.snapInAt(f, 245, { dur: 4, from: 1.14, seed: 'B-kick' }), C.jitter('B-kick', f, 1.4));
      C.place(this.flag, { rotate: -9 }, C.snapInAt(f, 231, { dur: 4, from: 1.7, rot0: -14 }), C.jitter('B-flag', f, 2), bump(f, 266, 0.04));

      // ---- stamp: in the air (f236–237) over everything, then inked INTO the newsprint tag (multiply) from the hit
      const sp = C.progRaw(f, T.stampS3 - 2.1, 6);
      const sx = this.tagBase.width / 2 + 4, sy = this.tagBase.height / 2 + 2;
      const tg = this.tagG;
      if (f >= T.stampS3 || this._tagDirty) {
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, this.tagCv.width, this.tagCv.height); tg.drawImage(this.tagBase, 0, 0);
        this._tagDirty = f >= T.stampS3;
        if (f >= T.stampS3) C.drawStamp(tg, this.stamp, sx, sy, sp, { rot: -13, scale: 0.5, composite: 'multiply' });
      }

      // ---- markers (collage canvas)
      const g = this.og;
      g.clearRect(0, 0, W, H);
      if (f >= T.stampS3 - 2 && f < T.stampS3) {     // the stamp coming down (tag-local -> collage coords)
        const tgr = -7 * Math.PI / 180, ox = sx - this.tagBase.width / 2, oy = sy - this.tagBase.height / 2;
        C.drawStamp(g, this.stamp, this.tagC[0] + ox * Math.cos(tgr) - oy * Math.sin(tgr), this.tagC[1] + ox * Math.sin(tgr) + oy * Math.cos(tgr), sp, { rot: -20, scale: 0.5, composite: 'source-over' });
      }
      const j = C.jitter('B-mk', f, 1.2);
      g.save(); g.translate(j.x, j.y);
      const cb = this.creamBox;
      C.marker.underline(g, { x1: cb.x1 + 150, x2: cb.x2 - 26, y: cb.y2 + 26, seed: 'B-ul', width: 15, color: YEL, progress: C.prog(f, 240, 7), double: true, gap: 17, frame: f, boil: 0.8 });
      C.marker.starburst(g, { cx: this.redC[0] + 330, cy: this.redC[1] - 150, r1: 58, r2: 124, rays: 7, from: -110, to: 10, seed: 'B-sb', width: 10, color: YEL, progress: C.prog(f, 252, 5), frame: f, boil: 0.6 });
      g.restore();
      const sg = this.sg; sg.clearRect(0, 0, W, H);
      if (f >= T.drop && f < T.drop + 12) {       // scraps fly out from behind the plates, decelerate + fall
        const t = C.onTwos(f - T.drop) + 1, g = sg;
        for (const sc of this.scraps) {
          const d = sc.v * (1 - Math.pow(0.8, t)) / 0.2;
          const x = sc.x0 + Math.cos(sc.a) * d, y = sc.y0 + Math.sin(sc.a) * d + 2.2 * t * t;
          g.save(); g.globalAlpha = Math.min(1, (12 - (f - T.drop)) / 4); g.translate(x, y); g.rotate(sc.spin * t * Math.PI / 180);
          g.drawImage(sc.cvs, -sc.cvs.width / 2, -sc.cvs.height / 2); g.restore();
        }
      }

      // ---- map-locked marker arrow: from the title INTO the country (tracks the drifting plate)
      const mg = this.mg; mg.clearRect(0, 0, W, H);
      if (f >= 245) {                              // (kept through the rip-out, frozen on plate 279)
        const gf = Math.min(279, f), tip = X.project(gf, 62.3, 9.0);
        C.marker.arrow(mg, { x1: 1040, y1: 636, x2: tip.x + 10, y2: tip.y + 4, bend: 0.26, seed: 'B-arr', width: 9, color: '#FFFFFF', progress: C.prog(f, 245, 7), frame: f, boil: 0.6 });
      }
    },
  });

  // =================================================================================== S4 FACTS
  COMP.section({
    id: 's4-facts', start: T.f1, end: T.end, z: 10,

    async init(root, X) {
      const C = X.C;
      this.C = C;
      const F = key => X.fact(key);
      this.L = {};
      const mk = (id, z, a, b) => {
        const d = div(root, 'layer', { left: '0', top: '0', width: W + 'px', height: H + 'px', overflow: 'hidden', zIndex: z, display: 'none' });
        const L = { id, div: d, a, b, fx: null };
        this.L[id] = L;
        return L;
      };
      // z: outgoing layers above incoming ones (so each can be torn away)
      const L1 = mk('f1', 4, T.f1, T.f2 + 2), L2 = mk('f2', 3, T.f2, T.f3 + 2), L3 = mk('f3', 2, T.f3, T.f4 + 2), L4 = mk('f4', 1, T.f4, T.end);
      const images = {};
      await Promise.all([
        ['oslo', GEO + 'crops/oslo.jpg'], ['geir', GEO + 'crops/geiranger.jpg'], ['noSil', KIT('svg/norway_silhouette.svg')],
        ['twSil', KIT('svg/taiwan_silhouette.svg')], ['pin', KIT('svg/pin.svg')],
      ].map(async ([k, u]) => { images[k] = await X.image(u); }));
      this.images = images;
      const osloJ = await X.json(GEO + 'crops/oslo.json');
      this.osloJ = osloJ;
      const islands = await X.json('assets/B-title-facts/islands.json');
      this.fillsJ = await X.json('assets/B-title-facts/fills.json');
      this.fillImgs = {};
      await Promise.all([['norway', 'norway_fill.jpg'], ['svalbard', 'svalbard_fill.jpg'], ['janmayen', 'janmayen_fill.jpg'], ['twRelief', 'taiwan_relief.png']]
        .map(async ([k, fn]) => { this.fillImgs[k] = await X.image('assets/B-title-facts/' + fn); }));

      await this.initF1(L1, X, F, osloJ);
      await this.initF2(L2, X, F);
      await this.initF3(L3, X, F, islands);
      await this.initF4(L4, X, F);
      for (const L of [L1, L2, L3, L4]) {
        L.sh = cv(L.div, W / 2, H / 2, { zIndex: 49, width: W + 'px', height: H + 'px' }); L.shg = L.sh.getContext('2d');   // incoming rip shadow
        L.fx = cv(L.div, W, H, { zIndex: 50 });                                                                          // outgoing rip rim
      }
    },

    // ---------------------------------------------------------------- F1 capital / Oslo
    async initF1(L, X, F, oj) {
      const C = X.C, d = L.div, cap = F('capital');
      d.style.background = '#08142c';
      const oslo = this.images.oslo;
      // backdrop after the shutter: the same crop as a navy duotone map
      const duo = C.duotone(oslo, { width: 1920, height: 1080, dark: '#061127', light: '#7f98bd', contrast: 1.3, grain: 0.05 });
      L.bg = div(d, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '50% 50%' });
      L.bg.appendChild(duo);
      L.bgShade = div(d, '', { inset: '0', background: 'radial-gradient(ellipse at 38% 52%, rgba(6,17,39,0) 30%, rgba(6,17,39,.55) 100%)' });
      // live view: full-bleed Sentinel-2 (2400×1350 = exact 16:9 -> 0.8 px per source px at 1:1)
      const cs = oj.landmarks['Oslo Central Station'].px;
      L.focus = [cs[0] * 0.8, cs[1] * 0.8];
      L.live = img(d, oslo.src, { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: `${L.focus[0]}px ${L.focus[1]}px` });
      L.vf = cv(d, W, H); L.vg = L.vf.getContext('2d');
      // photo print of the frame captured at the shutter (push S_SHOT)
      const S = L.shotS = 1.9;
      const sx = L.focus[0] * (1 - 1 / S) / 0.8, sy = L.focus[1] * (1 - 1 / S) / 0.8, sw = 2400 / S, sh = 1350 / S;
      const PW = 1120, PH = 630, B = 24;
      const pc = C.canvas(PW + 2 * B, PH + 2 * B), pg = pc.getContext('2d');
      pg.fillStyle = '#FBF8F1'; pg.fillRect(0, 0, pc.width, pc.height);
      pg.globalCompositeOperation = 'multiply'; pg.globalAlpha = 0.35; pg.fillStyle = pg.createPattern(C.images.paper, 'repeat'); pg.fillRect(0, 0, pc.width, pc.height);
      pg.globalCompositeOperation = 'source-over'; pg.globalAlpha = 1;
      pg.drawImage(oslo, sx, sy, sw, sh, B, B, PW, PH);
      const gl = pg.createLinearGradient(0, 0, pc.width, pc.height);
      gl.addColorStop(0, 'rgba(255,255,255,0.16)'); gl.addColorStop(0.4, 'rgba(255,255,255,0.02)'); gl.addColorStop(0.41, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.10)');
      pg.fillStyle = gl; pg.fillRect(B, B, PW, PH);
      pg.font = C.font('mono', 17); pg.fillStyle = 'rgba(20,20,20,0.55)'; pg.textBaseline = 'middle';
      pg.fillText('COPERNICUS SENTINEL-2', B + 4, PH + B + B / 2 + 1);
      const tp = C.tornPaper(pc, { seed: 'B-oslo-print', edges: 'r', rim: 5, width: pc.width, height: pc.height, fit: 'stretch', shadow: { x: 0, y: 14, blur: 26, color: 'rgba(0,0,0,0.5)' } });
      L.printSize = [tp.width, tp.height]; L.printCv = tp;
      L.print = div(d, '', { left: (960 - tp.width / 2) + 'px', top: (540 - tp.height / 2) + 'px', width: tp.width + 'px', height: tp.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      L.print.appendChild(tp);
      L.pinPos = [tp.pad + B + (cs[0] - sx) / sw * PW, tp.pad + B + (cs[1] - sy) / sh * PH];
      L.pcv = cv(L.print, tp.width, tp.height); L.pg = L.pcv.getContext('2d');
      L.pin = img(L.print, this.images.pin.src, { left: (L.pinPos[0] - 48) + 'px', top: (L.pinPos[1] - 96 * 0.9615) + 'px', width: '96px', transformOrigin: '50% 96%', filter: 'drop-shadow(0 6px 5px rgba(0,0,0,.45))', visibility: 'hidden' });
      L.printTapes = [
        div(L.print, 'tape tape--white', { left: '-10px', top: '6px', transform: 'rotate(-32deg)' }),
        div(L.print, 'tape tape--white', { right: '-16px', bottom: '26px', transform: 'rotate(-28deg)' }),
      ];
      L.postmark = C.makeStamp({ shape: 'postmark', w: 760, h: 330, color: INK, top: cap.en.toUpperCase(), bottom: 'NORGE', center: [{ text: '★', font: 'sans', size: 110, y: 0.52 }] }, { seed: 'B-post', ink: 0.92 });
      // title block (right). During the live view (f285–293) the FACT label + 首都 strip sit inside the viewfinder's
      // top-left bracket like a camera OSD; under the shutter flash they jump to the title column.
      const TX = 1300;                                            // title column (right), text ends < 1824
      L.dymo = div(d, 'dymo dymo--red', { left: (TX + 10) + 'px', top: '122px', fontSize: '30px', transformOrigin: '0 50%', zIndex: 10, visibility: 'hidden' }, 'FACT 01 / CAPITAL');
      L.kick = inkStrip(C, d, TX, 180, cap.label, { seed: 'B-f1lab' });
      L.kick.style.zIndex = 10;
      L.liveOff = { dymo: [204 - (TX + 10), 196 - 122], kick: [198 - TX, 256 - 180] };
      const mSize = 150, mW = textW(C, 'sans', mSize, cap.main, 0.02);
      const rw = Math.round(mW + 84), rh = 226;
      L.mainBox = [TX - 10, 336, rw, rh];
      L.main = tornDiv(C, d, { x: L.mainBox[0], y: L.mainBox[1], w: rw, h: rh, cls: 'paper--red crumple center', seed: 'B-f1main', edges: 'tb', rim: 8 },
        `<div class="f-sans c-white" style="font-size:${mSize}px;line-height:1;letter-spacing:.02em;margin-top:-14px;text-shadow:0 4px 0 rgba(0,0,0,.2)">${cap.main}</div>`);
      const eSize = 118, eW = textW(C, 'anton', eSize, cap.en.toUpperCase(), 0.06), ew = Math.round(eW + 150);
      L.en = tornDiv(C, d, { x: TX + 40, y: 548, w: ew, h: 142, cls: 'crumple center', seed: 'B-f1en', edges: 'lrb', rim: 6 },
        `<div class="f-anton c-ink" style="font-size:${eSize}px;line-height:1;letter-spacing:.06em;margin-top:4px">${cap.en}</div>`);
      L.enTape = div(d, 'tape tape--beige tape--sm', { left: (TX + 40 + ew - 100) + 'px', top: '526px', width: '150px', zIndex: 8, visibility: 'hidden' });
      L.enUL = [TX + 70, TX + 40 + ew - 40, 708];
      // locator card: Norway silhouette (equal-area) with Oslo marked
      const ls = 0.14, lw = Math.round(NO_SIL.w * ls), lh = Math.round(NO_SIL.h * ls);
      const card = C.tornPaper(null, { width: lw + 56, height: lh + 44, seed: 'B-f1card', edges: 'all', texture: 'paper', fill: CREAM, rim: 5, pad: 26 });
      L.card = div(d, '', { left: '1566px', top: '738px', width: card.width + 'px', height: card.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      L.card.appendChild(card);
      const sil = tint(C, this.images.noSil, lw, lh, NAVY);
      const sc = cv(L.card, lw, lh, { left: (card.pad + 28) + 'px', top: (card.pad + 22) + 'px' });
      sc.getContext('2d').drawImage(sil, 0, 0);
      const [ox, oy] = silXY(10.7528, 59.9111);
      L.cardDot = [card.pad + 28 + ox * ls, card.pad + 22 + oy * ls];
      L.ccv = cv(L.card, card.width, card.height); L.cg = L.ccv.getContext('2d');
      L.flash = div(d, '', { inset: '0', background: '#FFFFFF', opacity: 0, zIndex: 40 });
    },

    renderF1(f, L, X) {
      const C = X.C;
      const live = f < T.shutter;
      // live view: fast push-in on the city centre
      const pp = eOutQuart(prog(f, T.f1, T.shutter - 1 - T.f1));
      const S = lerp(1.0, L.shotS, pp);
      L.live.style.visibility = live ? 'visible' : 'hidden';
      if (live) {
        const w = C.wander('B-f1live', f, 3, 0.08);
        L.live.style.transform = `translate(${px(w.x)},${px(w.y)}) scale(${S.toFixed(4)})`;
      }
      // viewfinder
      const vg = L.vg; vg.clearRect(0, 0, W, H);
      if (live) this.drawViewfinder(vg, f, L);
      // backdrop (after the shutter) drifts + pushes slowly
      const bp = prog(f, T.shutter, T.f2 + 2 - T.shutter);
      L.bg.style.visibility = live ? 'hidden' : 'visible';
      L.bgShade.style.visibility = L.bg.style.visibility;
      if (!live) L.bg.style.transform = `scale(${(1.06 + 0.05 * bp).toFixed(4)}) translate(${px(-14 * bp)},${px(6 * bp)})`;
      // shutter flash
      L.flash.style.opacity = flashAt(f, T.shutter, [0.88, 0.55, 0.25, 0.08]);
      // print: at the shutter it IS the frame (content = 1920 px wide), then snaps to its place on the collage
      if (!live) {
        const q = eOutQuart(prog(f, T.shutter, 5));
        const s0 = 1920 / 1120, s = lerp(s0, 0.9, q) * (1 + 0.025 * bp);
        const cx = lerp(960, 660, q), cy = lerp(540, 566, q), rot = lerp(0, -3.4, q);
        const j = q >= 1 ? C.jitter('B-f1pr', f, 1.3) : { x: 0, y: 0, r: 0 };
        C.place(L.print, { x: cx - 960 + j.x, y: cy - 540 + j.y, rotate: rot + j.r, scale: s });
        L.printTapes.forEach((t, i) => { t.style.visibility = f >= T.shutter + 5 + i ? 'visible' : 'hidden'; });
      } else C.place(L.print, {}, { visible: false });
      // pin + marker circle + postmark (print-local)
      C.place(L.pin, {}, C.snapInAt(f, 303, { dur: 4, from: 1.8, rot0: 0, drop: 60 }), C.jitter('B-f1pin', f, 0.8));
      const pg = L.pg; pg.clearRect(0, 0, L.pcv.width, L.pcv.height);
      if (!live) {
        const [x, y] = L.pinPos;
        C.marker.circle(pg, { cx: x + 6, cy: y - 22, rx: 170, ry: 118, rotation: -0.12, seed: 'B-f1c', width: 11, color: RED, progress: C.prog(f, 305, 8), frame: f, boil: 0.7 });
        C.drawStamp(pg, L.postmark, L.printSize[0] - 300, 150, C.progRaw(f, 308 - 2.1, 6), { rot: 8, scale: 0.42, composite: 'multiply' });
      }
      // title block: OSD position in the viewfinder while live, title column after the shutter
      const od = live ? L.liveOff.dymo : [0, 0], ok = live ? L.liveOff.kick : [0, 0];
      C.place(L.dymo, { rotate: -2, x: od[0], y: od[1] }, live ? C.snapInAt(f, 284, { dur: 3, seed: 'B-d1' }) : C.snapInAt(f, 295, { dur: 3, from: 1.15, seed: 'B-d1b' }), C.jitter('B-d1', f, 1));
      C.place(L.kick, { rotate: live ? -2 : -3, x: ok[0], y: ok[1] }, live ? C.snapInAt(f, 285, { dur: 3, from: 1.25, seed: 'B-k1' }) : C.snapInAt(f, 296, { dur: 4, from: 1.2, seed: 'B-k1b' }), C.jitter('B-k1', f, 1.3), bump(f, 322, 0.03));
      C.place(L.main, { rotate: -2 }, hitAt(f, 298, { seq: [1.12, 0.96, 1.02, 0.996, 1], rot0: -3 }), C.jitter('B-m1', f, 2), bump(f, 322, 0.03));
      C.place(L.en, { rotate: 2.5 }, C.snapInAt(f, 301, { dur: 4, seed: 'B-e1' }), C.jitter('B-e1', f, 1.6));
      C.place(L.enTape, { rotate: 34 }, C.snapInAt(f, 302, { dur: 3, seed: 'B-et' }));
      C.place(L.card, { rotate: 5 }, C.snapInAt(f, 311, { dur: 4, seed: 'B-card' }), C.jitter('B-card', f, 1.4));
      const cg = L.cg; cg.clearRect(0, 0, L.ccv.width, L.ccv.height);
      if (f >= 313) {
        const [x, y] = L.cardDot, pulse = 1 + 0.25 * Math.max(0, 1 - (f - 313) / 6);
        cg.fillStyle = '#fff'; cg.beginPath(); cg.arc(x, y, 9 * pulse, 0, Math.PI * 2); cg.fill();
        cg.fillStyle = RED; cg.beginPath(); cg.arc(x, y, 6.5 * pulse, 0, Math.PI * 2); cg.fill();
        C.marker.circle(cg, { cx: x, cy: y, rx: 22, ry: 18, seed: 'B-cc', width: 4, color: RED, progress: C.prog(f, 314, 5) });
      }
      // marker underline under 奧斯陸 / OSLO (beat f322 -> drawn f316–321)
      if (!live) {
        const [x1, x2, y] = L.enUL, jj = C.jitter('B-e1', f, 1.6);
        L.vg.save(); L.vg.translate(jj.x, jj.y);
        C.marker.underline(L.vg, { x1, x2, y, seed: 'B-ul1', width: 13, color: YEL, progress: C.prog(f, 316, 6), frame: f, boil: 0.6, composite: 'source-over' });
        L.vg.restore();
      }
    },

    drawViewfinder(g, f, L) {
      const C = this.C;
      const j = C.jitter('B-vf', f, 0.6);
      g.save(); g.translate(j.x, j.y);
      g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = 5; g.lineCap = 'square';
      const m = [176, 168], len = 84;
      for (const [x, y, sx, sy] of [[m[0], m[1], 1, 1], [W - m[0], m[1], -1, 1], [m[0], H - m[1], 1, -1], [W - m[0], H - m[1], -1, -1]]) {
        g.beginPath(); g.moveTo(x, y + sy * len); g.lineTo(x, y); g.lineTo(x + sx * len, y); g.stroke();
      }
      // focus box closing in on the city centre, locks (yellow) two frames before the shutter
      const [fx, fy] = L.focus;
      const q = eOutCubic(prog(f, 283, 8));
      const bw = lerp(460, 250, q), bh = lerp(290, 160, q);
      const lock = f >= T.shutter - 2;
      g.strokeStyle = lock ? YEL : 'rgba(255,255,255,0.9)'; g.lineWidth = lock ? 5 : 3.5;
      const c = 34;
      for (const [x, y, sx, sy] of [[fx - bw / 2, fy - bh / 2, 1, 1], [fx + bw / 2, fy - bh / 2, -1, 1], [fx - bw / 2, fy + bh / 2, 1, -1], [fx + bw / 2, fy + bh / 2, -1, -1]]) {
        g.beginPath(); g.moveTo(x, y + sy * c); g.lineTo(x, y); g.lineTo(x + sx * c, y); g.stroke();
      }
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.moveTo(fx - 16, fy); g.lineTo(fx + 16, fy); g.moveTo(fx, fy - 16); g.lineTo(fx, fy + 16); g.stroke();
      // rec dot blinking on twos-of-four
      if (Math.floor(f / 4) % 2 === 0) { g.fillStyle = '#E8213F'; g.beginPath(); g.arc(W - m[0] - 30, m[1] + 34, 11, 0, Math.PI * 2); g.fill(); }
      g.restore();
    },

    // ---------------------------------------------------------------- F2 population
    async initF2(L, X, F) {
      const C = X.C, d = L.div, pop = F('population');
      L.pop = pop;
      L.bg = div(d, 'paper paper--kraft crumple', { left: '-40px', top: '-40px', width: (W + 80) + 'px', height: (H + 80) + 'px' });
      // navy torn panel for the crowd (right)
      const PW = 700, PH = 930;
      const panel = C.tornPaper(null, { width: PW, height: PH, seed: 'B-f2panel', edges: 'all', fill: NAVY, texture: 'paper', textureAlpha: 0.35, rim: 7, pad: 40 });
      L.panel = div(d, '', { left: (1500 - panel.width / 2) + 'px', top: (548 - panel.height / 2) + 'px', width: panel.width + 'px', height: panel.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden', zIndex: 2 });
      L.panel.appendChild(panel);
      L.crowd = cv(L.panel, panel.width, panel.height); L.crg = L.crowd.getContext('2d');
      // crowd in depth: small rows at the back (top) -> big rows at the front (bottom), printed as a halftone
      // (one cached halftone strip per row, cream and a yellow copy for the ding flash)
      const R = 21, pad = panel.pad, rows = [];
      const hOf = r => { const t = r / (R - 1); return lerp(30, 76, t * t * 0.4 + t * 0.6); };
      let hs = 0; for (let r = 0; r < R - 1; r++) hs += hOf(r);
      const kStep = (PH - 50 - hOf(R - 1)) / hs;                        // rows overlap (heads in front of bodies)
      let y = pad + 22;
      for (let r = 0; r < R; r++) {
        const h = hOf(r), fw = h * 40 / 52, cw = h * 0.9;
        const n = Math.floor((PW - 40 - fw) / cw) + 1, x0 = pad + (PW - ((n - 1) * cw + fw)) / 2 + ((r % 2) - 0.5) * cw * 0.45;
        rows.push({ r, h, fw, cw, n, x0, y, H: Math.ceil(h + 10) });
        y += h * kStep;
      }
      L.rows = rows; L.cells = [];
      for (const rw of rows) {
        const src = C.canvas(panel.width, rw.H), sg = src.getContext('2d');
        sg.fillStyle = '#fff'; sg.fillRect(0, 0, src.width, src.height);
        for (let i = 0; i < rw.n; i++) {
          const k = rw.r * 40 + i;
          const x = rw.x0 + i * rw.cw + C.srand('B-cx', k) * rw.cw * 0.08, hh = rw.h * (0.93 + 0.1 * C.rand('B-ch', k));
          const tone = 0.62 + 0.26 * C.rand('B-tone', k) + 0.1 * (rw.r / R);
          const gr = sg.createLinearGradient(0, rw.H - hh - 4, 0, rw.H - 4);
          const v = c => Math.round(255 * (1 - Math.min(1, c)));
          gr.addColorStop(0, `rgb(${v(tone - 0.2)},${v(tone - 0.2)},${v(tone - 0.2)})`); gr.addColorStop(0.45, `rgb(${v(tone)},${v(tone)},${v(tone)})`); gr.addColorStop(1, `rgb(${v(tone + 0.18)},${v(tone + 0.18)},${v(tone + 0.18)})`);
          sg.save(); sg.translate(x, rw.H - hh - 4); sg.scale(hh / 52, hh / 52); sg.fillStyle = gr; sg.fill(new Path2D(C.PATHS.person)); sg.restore();
          L.cells.push({ rw, x, hh, o: rw.r + 0.98 * C.rand('B-order', k) });
        }
        const dot = lerp(4.2, 6.2, rw.r / (R - 1));
        rw.ht = C.halftone(src, { dot, angle: 45, ink: CREAM, paper: null, contrast: 1.05, rough: 0.1, cacheKey: 'B-crowd-' + rw.r });
        rw.hy = C.halftone(src, { dot, angle: 45, ink: YEL, paper: null, contrast: 1.05, rough: 0.1, cacheKey: 'B-crowdY-' + rw.r });
      }
      L.order = L.cells.slice().sort((a, b) => a.o - b.o);           // back rows fill first, shuffled within a row
      L.drawOrder = L.cells.slice().sort((a, b) => a.rw.r - b.rw.r); // paint back -> front
      L.order.forEach((c, i) => { c.rank = i; });
      div(L.panel, 'tape tape--white', { left: '250px', top: '4px', transform: 'rotate(-3deg)' });
      // label + heading
      L.dymo = div(d, 'dymo dymo--red', { left: '112px', top: '84px', fontSize: '30px', transformOrigin: '0 50%', visibility: 'hidden', zIndex: 6 }, 'FACT 02 / POPULATION');
      L.kick = inkStrip(C, d, 100, 150, pop.label, { seed: 'B-f2lab' });
      L.kick.style.zIndex = 6;
      // number plate: 約 [563] 萬 (digits right-aligned in a fixed box so the count doesn't wobble)
      const nSize = 360, digitsW = Math.ceil(textW(C, 'anton', nSize, String(pop.count_to), 0.02)) + 8;
      const aW = 110, uW = 170, gap = 26, padL = 46;
      const pw = Math.round(padL + aW + gap + digitsW + gap + uW + padL), ph = 430;
      L.plateBox = [100, 316, pw, ph];
      L.plate = tornDiv(C, d, { x: 100, y: 316, w: pw, h: ph, cls: 'crumple', seed: 'B-f2plate', edges: 'tb', rim: 8, style: { display: 'flex', alignItems: 'center', paddingLeft: padL + 'px' } },
        `<span class="f-sans c-ink" style="position:relative;z-index:1;display:inline-block;width:${aW}px;font-size:${aW}px;line-height:1;margin-top:96px">${pop.prefix}</span>` +
        `<span class="f-anton c-red" style="position:relative;z-index:1;display:inline-block;width:${digitsW}px;text-align:right;font-size:${nSize}px;line-height:1;letter-spacing:.02em;margin:0 ${gap}px">0</span>` +
        `<span class="f-sans c-ink" style="position:relative;z-index:1;display:inline-block;width:${uW}px;font-size:${uW}px;line-height:1;margin-top:52px">${pop.count_unit}</span>`);
      L.plate.style.transformOrigin = '8% 50%';
      L.plate.style.zIndex = 4;
      L.num = L.plate.querySelector('.f-anton');
      // ding flash: the paper pops to white UNDER the digits (the number itself stays full-strength red on the hit)
      L.plateFlash = div(L.plate.lastChild, '', { left: '0', top: '0', width: pw + 'px', height: ph + 'px', background: '#FFFFFF', opacity: 0, pointerEvents: 'none', zIndex: 0 });
      L.digitsX = [100 + padL + aW + gap, 100 + padL + aW + gap + digitsW];
      // the F1 photo print, left on the desk under the number plate (continuity with F1): baked with its pin + circle
      {
        const L1 = this.L.f1, src = L1.printCv, k = 0.42;
        const c = C.canvas(Math.round(src.width * k), Math.round(src.height * k)), g = c.getContext('2d');
        g.drawImage(src, 0, 0, c.width, c.height);
        const [x, y] = L1.pinPos;
        C.marker.circle(g, { cx: (x + 6) * k, cy: (y - 22) * k, rx: 170 * k, ry: 118 * k, rotation: -0.12, seed: 'B-f1c', width: 6, color: RED, progress: 1 });
        const pin = this.images.pin, ph = 96 * k * 1.3;
        g.save(); g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 4; g.shadowOffsetY = 3;
        g.drawImage(pin, x * k - ph / 2, y * k - ph * 0.9615, ph, ph); g.restore();
        L.print = div(d, '', { left: (690 - c.width / 2) + 'px', top: (858 - c.height / 2) + 'px', width: c.width + 'px', height: c.height + 'px', transformOrigin: '50% 30%', visibility: 'hidden', zIndex: 3 });
        L.print.appendChild(c);
        div(L.print, 'tape tape--white tape--sm', { right: '-6px', bottom: '40px', transform: 'rotate(-36deg)' });
      }
      L.foot = div(d, 'footnote', { visibility: 'hidden', zIndex: 8 }, foot('資料來源：' + pop.footnote));
      L.ov = cv(d, W, H, { zIndex: 20 }); L.og = L.ov.getContext('2d');
    },

    renderF2(f, L, X) {
      const C = X.C;
      const w = C.wander('B-f2bg', f, 10, 0.03);
      L.bg.style.transform = `translate(${px(w.x)},${px(w.y)}) scale(${(1 + 0.02 * prog(f, T.f2, 58)).toFixed(4)})`;
      // count-up: changes on every counter_tick (f336–363), lands on the ding f364
      const p = prog(f, T.f2, T.ding - T.f2);
      const val = f >= T.ding ? L.pop.count_to : Math.min(L.pop.count_to - 1, Math.floor(L.pop.count_to * (1 - (1 - p) * (1 - p))));
      L.num.textContent = String(val);
      const sh = C.shake('B-f2ding', f, T.ding, { amp: 9, decay: 3 });
      C.place(L.dymo, { rotate: -2 }, C.snapInAt(f, 338, { dur: 4, seed: 'B-d2' }), C.jitter('B-d2', f, 1));
      C.place(L.kick, { rotate: -3 }, C.snapInAt(f, 337, { dur: 3, from: 1.18, seed: 'B-k2' }), C.jitter('B-k2', f, 1.2));
      const ding = f >= T.ding ? hitAt(f, T.ding, { seq: [1.12, 0.965, 1.02, 0.995, 1] }) : null;
      C.place(L.plate, { rotate: -1.5 }, C.snapInAt(f, 337, { dur: 4, from: 1.12, seed: 'B-p2' }), ding, C.jitter('B-p2', f, f < T.ding ? 2.6 : 1.8), bump(f, 378, 0.02), sh);
      L.plateFlash.style.opacity = flashAt(f, T.ding, [0.9, 0.45, 0.15]);
      C.place(L.panel, { rotate: 2 }, C.snapInAt(f, 340, { dur: 4, seed: 'B-pan' }), C.jitter('B-pan', f, 1.2), f >= T.ding ? hitAt(f, T.ding, { seq: [1.04, 0.99, 1.005, 1] }) : null, { x: sh.x * 0.5, y: sh.y * 0.5 });
      C.place(L.print, { rotate: 5 }, C.snapInAt(f, 343, { dur: 4, from: 1.3, seed: 'B-f2pr' }), C.jitter('B-f2pr', f, 1.4), C.wander('B-f2prw', f, 2.5, 0.05));
      C.place(L.foot, {}, { visible: f >= 342 });          // footnotes: no transform (stable text raster)
      // crowd: fills with the count (back rows first), halftone strips per person, bobbing after the ding
      const g = L.crg; g.clearRect(0, 0, L.crowd.width, L.crowd.height);
      const N = L.order.length;
      const n = f >= T.ding ? N : Math.floor(N * (1 - (1 - p) * (1 - p)));
      const hot = f >= T.ding && f < T.ding + 3;
      const ft = C.onTwos(f);
      for (const c of L.drawOrder) {
        if (c.rank >= n) continue;
        const rw = c.rw;
        const age = f >= T.ding ? 99 : f - (T.f2 + (1 - Math.sqrt(1 - c.rank / N)) * (T.ding - T.f2));
        const s = age < 2 ? 1.22 : 1;
        const bob = f >= T.ding ? Math.sin((ft - T.ding) * 0.42 + c.x * 0.03 + rw.r) * (2 + rw.h * 0.04) : 0;
        const sx = Math.max(0, c.x - 2), sw = Math.min(rw.ht.width - sx, c.hh * 40 / 52 + 4);
        const dx = sx, dyTop = rw.y + (rw.h + 10 - rw.H) + bob;
        // navy knock-out so the front figure separates from the row behind it
        if (rw.r > 0) { g.save(); g.translate(c.x + c.hh * 0.385, dyTop + rw.H - 4); g.scale(s * 1.1, s * 1.08); g.translate(-c.hh * 0.385, -c.hh); C.drawPerson(g, 0, 0, c.hh, NAVY); g.restore(); }
        const src = hot ? rw.hy : rw.ht;
        g.save(); g.translate(c.x + c.hh * 0.385, dyTop + rw.H - 4); g.scale(s, s); g.translate(-(c.x + c.hh * 0.385), -(dyTop + rw.H - 4));
        g.drawImage(src, sx, 0, sw, rw.H, dx, dyTop, sw, rw.H);
        g.restore();
      }
      // ding: bursts (already a quarter drawn ON the hit frame) + red marker underline inside the plate
      const og = L.og; og.clearRect(0, 0, W, H);
      if (f >= T.ding - 1) {
        const [x1, x2] = L.digitsX, pb = L.plateBox, top = pb[1] + 40;
        const bp = C.prog(f, T.ding - 1, 4);
        const jj = C.jitter('B-p2', f, 1.8);
        og.save(); og.translate(jj.x + sh.x, jj.y + sh.y);
        C.marker.starburst(og, { cx: x2 + 6, cy: top + 26, r1: 34, r2: 110, rays: 5, from: -80, to: 0, seed: 'B-f2sbR', width: 12, color: RED, progress: bp, frame: f, boil: 0.6 });
        C.marker.starburst(og, { cx: x1 - 4, cy: top + 26, r1: 34, r2: 104, rays: 4, from: -175, to: -115, seed: 'B-f2sbL', width: 12, color: RED, progress: bp, frame: f, boil: 0.6 });
        if (f >= T.ding + 1) C.marker.underline(og, { x1: x1 + 4, x2: x2 - 6, y: pb[1] + pb[3] - 32, slope: -0.027, gap: 12, seed: 'B-f2ul', width: 14, color: RED, progress: C.prog(f, T.ding + 1, 6), double: true, frame: f, boil: 0.7 });
        og.restore();
      }
    },

    // ---------------------------------------------------------------- F3 area
    async initF3(L, X, F, islands) {
      const C = X.C, d = L.div, area = F('area'), tw = F('area_taiwan_multiple');
      L.area = area;
      L.bg = div(d, 'paper fold', { left: '-40px', top: '-40px', width: (W + 80) + 'px', height: (H + 80) + 'px', '--crumple': '.75' });
      L.grid = div(d, '', { inset: '0', backgroundImage: 'linear-gradient(rgba(0,32,91,.07) 2px, transparent 2px), linear-gradient(90deg, rgba(0,32,91,.07) 2px, transparent 2px)', backgroundSize: '90px 90px' });
      // shared equal-area scale for every silhouette
      const s = L.s = 0.5;
      const nw = Math.round(NO_SIL.w * s), nh = Math.round(NO_SIL.h * s);
      // real imagery: the Sentinel-2 mosaic reprojected into the silhouette's own LAEA frame (make_fills.py), masked by the SVG
      const FJ = this.fillsJ, FI = this.fillImgs;
      const noC = C.canvas(nw, nh);
      { const g = noC.getContext('2d');
        g.filter = 'contrast(1.12) saturate(1.1) brightness(1.04)';
        g.drawImage(FI.norway, 0, 0, FJ.norway.w * s, FJ.norway.h * s); g.filter = 'none';
        g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.18; g.fillStyle = g.createPattern(C.images.paper, 'repeat'); g.fillRect(0, 0, nw, nh);
        g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(this.images.noSil, 0, 0, nw, nh); }
      const noSt = C.sticker(noC, { border: 7, shadow: { x: 0, y: 8, blur: 14, color: 'rgba(0,0,0,0.3)' }, cacheKey: 'B-noSt' });
      L.noOrigin = [384, 142];
      L.no = div(d, '', { left: (L.noOrigin[0] - noSt.pad) + 'px', top: (L.noOrigin[1] - noSt.pad) + 'px', width: noSt.width + 'px', height: noSt.height + 'px', transformOrigin: '40% 70%', visibility: 'hidden' });
      L.no.appendChild(noSt);
      // Svalbard + Jan Mayen at the same scale, in an inset box (NW of the mainland, like an atlas inset)
      // (Blue Marble fills: outside the Sentinel-2 mosaic; printed as an icy duotone so the glaciers separate from the white die-cut)
      const mkIsland = (key, fkey) => {
        const it = islands[key], w = Math.ceil(it.w * s) + 2, h = Math.ceil(it.h * s) + 2;
        const c = C.canvas(w, h), g = c.getContext('2d');
        const duo = C.duotone(FI[fkey], { dark: '#0d2a57', light: '#dfe9f3', contrast: 1.35, grain: 0.03, cacheKey: 'B-duo-' + key });
        g.drawImage(duo, 1, 1, FJ[fkey].w * s, FJ[fkey].h * s);
        const path = new Path2D(it.d);
        g.globalCompositeOperation = 'destination-in'; g.setTransform(s, 0, 0, s, 1, 1); g.fill(path, 'evenodd');
        g.globalCompositeOperation = 'source-over'; g.strokeStyle = 'rgba(0,32,91,0.85)'; g.lineWidth = 1.3 / s; g.stroke(path);
        return C.sticker(c, { border: 5, shadow: { x: 0, y: 6, blur: 10, color: 'rgba(0,0,0,0.28)' }, cacheKey: 'B-isl-' + key });
      };
      const sv = mkIsland('svalbard', 'svalbard'), jm = mkIsland('jan_mayen', 'janmayen');
      const bw = 272, bh = 486;
      L.inset = div(d, '', { left: '96px', top: '118px', width: bw + 'px', height: bh + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      div(L.inset, '', { left: '0', top: '0', width: bw + 'px', height: bh + 'px', border: '3px dashed rgba(0,32,91,.5)', borderRadius: '4px', background: 'rgba(0,32,91,.035)' });
      const svW = Math.ceil(islands.svalbard.w * s), svH = Math.ceil(islands.svalbard.h * s);
      const svEl = div(L.inset, '', { left: ((bw - svW) / 2 - sv.pad) + 'px', top: (18 - sv.pad) + 'px' }); svEl.appendChild(sv);
      const [svN, jmN] = [islands.svalbard.name_zh, islands.jan_mayen.name_zh];
      div(L.inset, 'f-sans-b', { left: '0', width: bw + 'px', top: (18 + svH + 10) + 'px', fontSize: '25px', lineHeight: '1', color: NAVY, textAlign: 'center', whiteSpace: 'nowrap' }, svN);
      const jmY = 18 + svH + 58;
      const jmEl = div(L.inset, '', { left: (58 - jm.pad) + 'px', top: (jmY - jm.pad) + 'px' }); jmEl.appendChild(jm);
      div(L.inset, 'f-sans-b', { left: '96px', top: (jmY - 2) + 'px', fontSize: '23px', lineHeight: '1', color: NAVY, whiteSpace: 'nowrap' }, jmN);
      // Taiwans: 10 die-cut stickers, 5 × 2, same km scale
      const tw0 = Math.round(198.05 * s), th0 = Math.round(375.82 * s);
      // printed red cut-out with the Central Mountain Range as halftone dots (relief from earth-topology, make_fills.py)
      const twC = C.canvas(tw0, th0);
      { const g = twC.getContext('2d');
        g.fillStyle = RED; g.fillRect(0, 0, tw0, th0);
        const inv = C.canvas(FI.twRelief.width, FI.twRelief.height), ig = inv.getContext('2d');
        ig.filter = 'invert(1)'; ig.drawImage(FI.twRelief, 0, 0);
        const ht = C.halftone(inv, { width: tw0, height: th0, dot: 4.2, angle: 45, ink: '#5E0016', paper: null, contrast: 1.5, brightness: 0.12, rough: 0.12, cacheKey: 'B-tw-ht' });
        g.globalAlpha = 0.75; g.drawImage(ht, 0, 0); g.globalAlpha = 1;
        g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.35; g.fillStyle = g.createPattern(C.images.paper, 'repeat'); g.fillRect(0, 0, tw0, th0);
        g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(this.images.twSil, 0, 0, tw0, th0); }
      const twSt = C.sticker(twC, { border: 6, shadow: { x: 0, y: 7, blur: 10, color: 'rgba(0,0,0,0.32)' }, cacheKey: 'B-twSt' });
      L.tw = [];
      const gx0 = 1112, gy0 = 718, dx = 124, dy = 204;
      for (let i = 0; i < area.taiwan_stack_count; i++) {
        const cx = gx0 + (i % 5) * dx + (Math.floor(i / 5) % 2) * 26, cy = gy0 + Math.floor(i / 5) * dy;
        const e = div(d, '', { left: (cx - twSt.width / 2) + 'px', top: (cy - twSt.height / 2) + 'px', width: twSt.width + 'px', height: twSt.height + 'px', transformOrigin: '50% 60%', visibility: 'hidden', zIndex: 5 });
        const c2 = C.canvas(twSt.width, twSt.height); c2.getContext('2d').drawImage(twSt, 0, 0); e.appendChild(c2);
        L.tw.push({ e, rot: C.srand('B-twr', i) * 7 });
      }
      L.pops = X.cues.sfx.filter(s => s.name === 'pops').map(s => s.frame).sort((a, b) => a - b).slice(0, area.taiwan_stack_count);
      while (L.pops.length < area.taiwan_stack_count) L.pops.push(400 + 4 * L.pops.length);
      // labels + number
      const TX = 1040;
      L.dymo = div(d, 'dymo dymo--red', { left: TX + 'px', top: '84px', fontSize: '30px', transformOrigin: '0 50%', visibility: 'hidden', zIndex: 6 }, 'FACT 03 / AREA');
      L.kick = inkStrip(C, d, TX - 12, 144, area.label, { seed: 'B-f3lab' });
      L.kick.style.zIndex = 6;
      // "約 38.5 萬 km²" from area.main
      const m = area.main.match(/^(\S+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);  // 約 / 38.5 / 萬 / km²
      const nSize = 176;
      const nW = textW(C, 'anton', nSize, m[2], 0.02);
      const pw = Math.round(40 + 64 + 16 + nW + 16 + 92 + 12 + textW(C, 'anton', 72, m[4]) + 44), ph = 206;
      L.plateBox = [TX - 16, 286, pw, ph];
      L.plate = tornDiv(C, d, { x: TX - 16, y: 286, w: pw, h: ph, cls: 'crumple center', seed: 'B-f3plate', edges: 'tb', rim: 7 },
        `<span class="f-sans c-ink" style="font-size:64px;line-height:1;margin-top:56px">${m[1]}</span>` +
        `<span class="f-anton c-red" style="font-size:${nSize}px;line-height:1;letter-spacing:.02em;margin:0 16px">${m[2]}</span>` +
        `<span class="f-sans c-ink" style="font-size:92px;line-height:1;margin-top:30px">${m[3]}</span>` +
        `<span class="f-anton c-ink" style="font-size:72px;line-height:1;margin-left:12px;margin-top:52px;text-transform:none">${m[4]}</span>`);
      // punchline: 超過 10 個台灣大 (tape label between the number and the Taiwans)
      L.tag = div(d, 'tape-label', { left: (TX + 10) + 'px', top: '504px', fontSize: '54px', height: '98px', padding: '0 56px', transformOrigin: '20% 50%', visibility: 'hidden', zIndex: 8 },
        area.taiwan_multiple_zh.replace(/(\d+)/, '<span class="c-red" style="font-family:var(--f-anton);font-size:70px;margin:0 .14em">$1</span>'));
      L.tagW = textW(C, 'sans', 54, area.taiwan_multiple_zh, 0.04) + 112;
      L.foot = div(d, 'footnote', { visibility: 'hidden', zIndex: 9 }, foot(area.footnote) + '<br>' + foot(tw.footnote));
      // hand labels (copy.title / copy.pin_taiwan)
      const noName = X.facts.copy.title.split(' ')[0], twName = X.facts.copy.pin_taiwan.split(' ')[0];
      L.noLbl = div(d, 'marker-label marker-label--cjk', { left: '716px', top: '792px', fontSize: '62px', color: NAVY, transformOrigin: '0 50%', visibility: 'hidden', zIndex: 6 }, noName);
      L.twLbl = div(d, 'marker-label marker-label--cjk', { left: '908px', top: '668px', fontSize: '50px', color: RED, transformOrigin: '100% 50%', visibility: 'hidden', zIndex: 6 }, twName);
      // hand-marker counter under the label: ×1 … ×10, one step per pop cue (counts the build toward the claim)
      L.twCount = div(d, 'f-marker', { left: '922px', top: '728px', fontSize: '64px', lineHeight: '1', color: RED, transformOrigin: '30% 60%', visibility: 'hidden', zIndex: 6, whiteSpace: 'nowrap' }, '×1');
      L.ov = cv(d, W, H, { zIndex: 20 }); L.og = L.ov.getContext('2d');
    },

    renderF3(f, L, X) {
      const C = X.C;
      const w = C.wander('B-f3bg', f, 8, 0.03);
      L.bg.style.transform = `translate(${px(w.x)},${px(w.y)})`;
      L.grid.style.transform = `translate(${px(w.x * 0.6)},${px(w.y * 0.6)})`;
      C.place(L.dymo, { rotate: -2 }, C.snapInAt(f, 393, { dur: 4, from: 1.15, seed: 'B-d3' }), C.jitter('B-d3', f, 1));
      C.place(L.kick, { rotate: -2 }, C.snapInAt(f, 394, { dur: 3, from: 1.18, seed: 'B-k3' }), C.jitter('B-k3', f, 1.2));
      C.place(L.plate, { rotate: -1.5 }, C.snapInAt(f, 395, { dur: 4, seed: 'B-p3' }), C.jitter('B-p3', f, 1.8), bump(f, 420, 0.02));
      C.place(L.no, { rotate: -1 }, C.snapInAt(f, 392, { dur: 5, seed: 'B-no', from: 1.12 }), C.jitter('B-no', f, 1.2));
      C.place(L.inset, { rotate: 0 }, C.snapInAt(f, 397, { dur: 4, seed: 'B-in', from: 1.2 }), C.jitter('B-in', f, 1.2));
      C.place(L.noLbl, { rotate: -6 }, C.snapInAt(f, 398, { dur: 4, seed: 'B-nol' }), C.jitter('B-nol', f, 1.2));
      C.place(L.twLbl, { rotate: -8 }, C.snapInAt(f, L.pops[0], { dur: 3, seed: 'B-twl' }), C.jitter('B-twl', f, 1.2));
      L.tw.forEach((t, i) => C.place(t.e, { rotate: t.rot }, C.snapInAt(f, L.pops[i], { dur: 3, from: 1.55, seed: 'B-tw' + i }), C.jitter('B-tw' + i, f, 1.3)));
      // ×N counter: steps on every pop
      let nPop = 0; for (const pf of L.pops) if (f >= pf) nPop++;
      if (nPop > 0) {
        const txt = '×' + nPop; if (L.twCount.textContent !== txt) L.twCount.textContent = txt;
        C.place(L.twCount, { rotate: -7 }, hitAt(f, L.pops[nPop - 1], { seq: nPop === L.pops.length ? [1.45, 0.9, 1.08, 0.98, 1] : [1.28, 0.95, 1.02, 1] }), C.jitter('B-twc', f, 1.2));
      } else C.place(L.twCount, {}, { visible: false });
      // punchline lands on the 6th pop / beat f420 (6 Taiwans already on screen, reads ~0.9 s); the last pop (f436) re-hits it
      const last = L.pops[L.pops.length - 1], tagAt = L.pops[5];
      C.place(L.tag, { rotate: -2.5 }, hitAt(f, tagAt, { seq: [1.25, 0.95, 1.03, 0.99, 1], rot0: -5 }), C.jitter('B-tag', f, 1.6), bump(f, last, 0.07));
      C.place(L.foot, {}, { visible: f >= 398 });
      const og = L.og; og.clearRect(0, 0, W, H);
      if (f >= last) {
        const j = C.jitter('B-tag', f, 1.6);
        og.save(); og.translate(j.x, j.y);
        C.marker.underline(og, { x1: 1070, x2: 1040 + L.tagW - 30, y: 610, slope: -0.04, seed: 'B-f3ul', width: 12, color: RED, progress: C.prog(f, last + 1, 5), frame: f, boil: 0.6 });
        og.restore();
      }
    },

    // ---------------------------------------------------------------- F4 fjords
    async initF4(L, X, F) {
      const C = X.C, d = L.div, fj = F('fjords_unesco');
      d.style.background = '#0c1a14';
      L.fb = div(d, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '56% 50%' });  // fallback crop (push-in)
      const fbImg = img(L.fb, this.images.geir.src, { left: '0', top: '0', width: W + 'px', height: H + 'px', objectFit: 'cover', objectPosition: '55% 55%' });
      L.fbImg = fbImg;
      L.plate = X.plate(d, { z: 1 });
      L.grade = div(d, '', { inset: '0', zIndex: 2, background: 'linear-gradient(180deg, rgba(4,10,20,.35) 0%, rgba(4,10,20,0) 22%, rgba(4,10,20,0) 55%, rgba(4,10,20,.62) 100%)' });
      // lower third
      L.lt = div(d, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', zIndex: 5 });
      L.dymo = div(L.lt, 'dymo dymo--red', { left: '112px', top: '640px', fontSize: '30px', transformOrigin: '0 50%', visibility: 'hidden' }, 'FACT 04 / FJORDS');
      const zSize = 150, zW = textW(C, 'sans', zSize, fj.label, 0.02);
      const rw = Math.round(zW + 90), rh = 206;
      L.red = tornDiv(C, L.lt, { x: 100, y: 704, w: rw, h: rh, cls: 'paper--red crumple center', seed: 'B-f4red', edges: 'tb', rim: 8 },
        `<div class="f-sans c-white" style="font-size:${zSize}px;line-height:1;letter-spacing:.02em;margin-top:-14px;text-shadow:0 4px 0 rgba(0,0,0,.2)">${fj.label}</div>`);
      const eSize = 128, eW = textW(C, 'anton', eSize, fj.en, 0.06);
      L.en = tornDiv(C, L.lt, { x: 100 + rw - 30, y: 726, w: Math.round(eW + 130), h: 170, cls: 'crumple center', seed: 'B-f4en', edges: 'lrb', rim: 6 },
        `<div class="f-anton c-ink" style="font-size:${eSize}px;line-height:1;letter-spacing:.06em;margin-top:4px">${fj.en}</div>`);
      L.enTape = div(L.lt, 'tape tape--beige tape--sm', { left: (100 + rw - 30 + eW + 130 - 92) + 'px', top: '706px', width: '150px', zIndex: 3, visibility: 'hidden' });
      L.sub = div(L.lt, 'tape-label tape-label--white', { left: '112px', top: '904px', fontSize: '42px', height: '86px', padding: '0 46px', transformOrigin: '10% 50%', visibility: 'hidden' }, fj.sub_zh);
      L.foot = div(d, 'footnote', { left: 'auto', right: '96px', visibility: 'hidden', zIndex: 6 }, foot(fj.footnote));
      // locator card (same as F1): Norway silhouette with Geiranger marked
      const ls = 0.12, lw = Math.round(NO_SIL.w * ls), lh = Math.round(NO_SIL.h * ls);
      const card = C.tornPaper(null, { width: lw + 44, height: lh + 36, seed: 'B-f4card', edges: 'all', texture: 'paper', fill: CREAM, rim: 5, pad: 26 });
      L.card = div(d, '', { left: '104px', top: '58px', width: card.width + 'px', height: card.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden', zIndex: 5 });
      L.card.appendChild(card);
      const sil = tint(C, this.images.noSil, lw, lh, NAVY);
      cv(L.card, lw, lh, { left: (card.pad + 22) + 'px', top: (card.pad + 18) + 'px' }).getContext('2d').drawImage(sil, 0, 0);
      const [gx, gy] = silXY(7.206, 62.1009);
      L.cardDot = [card.pad + 22 + gx * ls, card.pad + 18 + gy * ls];
      L.ccv = cv(L.card, card.width, card.height); L.cg = L.ccv.getContext('2d');
      div(L.card, 'tape tape--white tape--sm', { left: '40px', top: '-6px', transform: 'rotate(-6deg)', width: '130px' });
      L.ov = cv(d, W, H, { zIndex: 7 }); L.og = L.ov.getContext('2d');
      L.stamp = C.makeStamp('heritage', { ink: 0.95, seed: 'B-her' });
      // torn cream tag (taped, top right) that the red 世界遺產 stamp thunks INTO at f476 (multiply on paper)
      const tgW = 620, tgH = 306;
      L.tagBase = C.tornPaper(null, { width: tgW, height: tgH, seed: 'B-f4tag', edges: 'all', fill: CREAM, texture: 'paper', rim: 6, pad: 34, roughness: 0.8, bite: 0.7, shadow: { x: 0, y: 14, blur: 22, color: 'rgba(0,0,0,0.5)' } });
      L.tagC = [1476, 262];
      const tb = L.tagBase;
      L.tag = div(d, '', { left: (L.tagC[0] - tb.width / 2) + 'px', top: (L.tagC[1] - tb.height / 2) + 'px', width: tb.width + 'px', height: tb.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden', zIndex: 6 });
      L.tagCv = cv(L.tag, tb.width, tb.height); L.tagG = L.tagCv.getContext('2d'); L.tagG.drawImage(tb, 0, 0); L._tagDirty = false;
      div(L.tag, 'tape tape--white tape--sm', { left: '-18px', top: '14px', transform: 'rotate(-34deg)' });
      div(L.tag, 'tape tape--white tape--sm', { right: '-22px', bottom: '22px', transform: 'rotate(-30deg)' });
      // which terrain plates exist (checked once here; frames still missing are re-checked at render time)
      L.have = new Map();
      for (let i = 0; i <= T.end - T.f4; i++) if (X.exists(X.SEQ.geiranger(i))) L.have.set(i, true);
    },

    async renderF4(f, L, X) {
      const C = X.C;
      const i = f - T.f4;
      // hero: terrain flyover plate if rendered, else the Sentinel-2 crop with a slow push-in
      let ok = L.have.get(i);
      if (ok === undefined) { ok = X.exists(X.SEQ.geiranger(i)); if (ok) L.have.set(i, ok); }
      if (ok) {
        await L.plate.setFrame('geiranger', i);
        L.plate.style.visibility = 'visible'; L.fb.style.visibility = 'hidden';
      } else {
        L.plate.style.visibility = 'hidden'; L.fb.style.visibility = 'visible';
        if (!this._warnedF4) { this._warnedF4 = true; console.warn('[B-title-facts] geiranger plate missing, using the crop fallback from frame', f); }
        const q = prog(f, T.f4, T.end - T.f4);
        L.fb.style.transform = `scale(${(1.12 + 0.2 * q).toFixed(4)}) translate(${px(-30 * q)},${px(-10 * q)})`;
      }
      // lower third
      const sh = C.shake('B-f4st', f, T.stamp, { amp: 7, decay: 3.5 });
      L.lt.style.transform = `translate(${px(sh.x)},${px(sh.y)})`;
      // (the lower-left is clear of the outgoing F3 piece from f450: the plate's impact frame is f450)
      C.place(L.dymo, { rotate: -2 }, C.snapInAt(f, 451, { dur: 4, seed: 'B-d4' }), C.jitter('B-d4', f, 1));
      C.place(L.red, { rotate: -2 }, hitAt(f, 450, { rot0: -4 }), C.jitter('B-f4r', f, 2), bump(f, 490, 0.025));
      C.place(L.en, { rotate: 2.5 }, C.snapInAt(f, 453, { dur: 4, seed: 'B-f4e' }), C.jitter('B-f4e', f, 1.6));
      C.place(L.enTape, { rotate: 30 }, C.snapInAt(f, 454, { dur: 3, seed: 'B-f4t' }));
      C.place(L.sub, { rotate: -1 }, C.snapInAt(f, 456, { dur: 4, from: 1.12, rot0: -2.5 }), C.jitter('B-f4s', f, 1.2));
      C.place(L.foot, {}, { visible: f >= 457 });
      C.place(L.card, { rotate: -4 }, C.snapInAt(f, 458, { dur: 4, seed: 'B-f4c' }), C.jitter('B-f4c', f, 1.2));
      const cg = L.cg; cg.clearRect(0, 0, L.ccv.width, L.ccv.height);
      if (f >= 460) {
        const [x, y] = L.cardDot, pulse = 1 + 0.3 * Math.max(0, 1 - (f - 460) / 6);
        cg.fillStyle = '#fff'; cg.beginPath(); cg.arc(x, y, 8 * pulse, 0, Math.PI * 2); cg.fill();
        cg.fillStyle = RED; cg.beginPath(); cg.arc(x, y, 5.5 * pulse, 0, Math.PI * 2); cg.fill();
        C.marker.circle(cg, { cx: x, cy: y, rx: 19, ry: 15, seed: 'B-gc', width: 4, color: RED, progress: C.prog(f, 461, 5) });
      }
      // heritage tag snaps in on the half-beat f470, the stamp thunks into it on the cue f476
      C.place(L.tag, { rotate: -5 }, C.snapInAt(f, 470, { dur: 4, from: 1.3, seed: 'B-f4tg' }), C.jitter('B-f4tg', f, 1.4), { x: sh.x, y: sh.y },
        f >= T.stamp ? hitAt(f, T.stamp, { seq: [0.97, 1.012, 1] }) : null);
      const sp = C.progRaw(f, T.stamp - 2.1, 6);
      const sx = L.tagBase.width / 2, sy = L.tagBase.height / 2 + 2;
      const tg = L.tagG;
      if (f >= T.stamp || L._tagDirty) {
        tg.globalCompositeOperation = 'source-over'; tg.clearRect(0, 0, L.tagCv.width, L.tagCv.height); tg.drawImage(L.tagBase, 0, 0);
        L._tagDirty = f >= T.stamp;
        if (f >= T.stamp) C.drawStamp(tg, L.stamp, sx, sy, sp, { rot: -4, scale: 0.6, composite: 'multiply' });
      }
      const og = L.og; og.clearRect(0, 0, W, H);
      if (f >= T.stamp - 2 && f < T.stamp) C.drawStamp(og, L.stamp, L.tagC[0], L.tagC[1] + 2, sp, { rot: -12, scale: 0.6, composite: 'source-over' });
    },

    // ---------------------------------------------------------------- frame
    async render(f, root, X) {
      const C = X.C;
      const L = this.L;
      const jobs = [];
      const order = ['f1', 'f2', 'f3', 'f4'];
      const ripSeed = { f1: ['B-rip-f1', 180], f2: ['B-rip-f2', -22], f3: ['B-rip-f3', 0] };   // [seed, angle] of each layer's rip-out
      for (let n = 0; n < order.length; n++) {
        const id = order[n], Ly = L[id];
        const on = f >= Ly.a && f <= Ly.b;
        Ly.div.style.display = on ? '' : 'none';
        if (!on) continue;
        if (id === 'f1') this.renderF1(f, Ly, X);
        if (id === 'f2') this.renderF2(f, Ly, X);
        if (id === 'f3') this.renderF3(f, Ly, X);
        if (id === 'f4') jobs.push(this.renderF4(f, Ly, X));
        // rip-out (this layer torn away during the next layer's first 3 frames)
        const next = order[n + 1];
        const rk = next ? f - L[next].a : -1;
        const out = !!next && rk >= 0;
        applyRip(C, Ly.div, Ly.fx, out ? rk : -1, out ? ripSeed[id][0] : 0, out ? ripSeed[id][1] : 0);
        // incoming: shadow of the piece being torn away above (always cleared otherwise, so any render order gives the same frame)
        const prev = n === 0 ? ['B-rip-s3', 0] : ripSeed[order[n - 1]];
        const ik = f - Ly.a;
        if (!out && ik >= 0 && ik <= 2) { drawRipShadow(C, Ly.shg, ik, prev[0], prev[1]); Ly._sh = true; }
        else if (Ly._sh) { drawRipShadow(C, Ly.shg, -1); Ly._sh = false; }
      }
      await Promise.all(jobs);
    },
  });
})();
