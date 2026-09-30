/* S1 INTRO_TAIWAN (f0–111) + S2 FLIGHT_ZOOM (f112–223) + globe background plate under S3 (f224–279).
 * Owner: A-globe. z 0 (bottom of the stack).
 *
 * Layers inside one "camera" div (so CSS pushes/shake keep every overlay pixel-locked to the plate):
 *   plate <img>  -> renders/globe/fNNNN.jpg (nearest existing frame if one is still rendering)
 *   blur canvas  -> half-res radial zoom blur / disc-clipped whip blur built from the plate itself
 *   fx canvas    -> everything projected on the globe (COMP.project): Taiwan highlight, pin rings,
 *                   flight arc + ground track + curtain, plane, airport dots, speed lines, Norway border
 *   DOM          -> collage cut-outs (torn tag, tape kicker, dymo labels, counter card, readout)
 *   cloud canvas -> cloud wisps flying past the lens during the push-in
 * Every value is a pure function of f (seeded hashes, jitter on twos). Wording/numbers come from facts.json.
 */
(function () {
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  // Geo points. TPE/OSL = the exact endpoints of facts.taipei_oslo_distance_km (Taipei 101 -> Oslo S).
  const TPE = [25.033, 121.5654];
  const OSL = [59.9111, 10.7528];
  const ARC_H = 0.28;               // flight-arc peak altitude (Earth radii), sin profile
  const RED = '#BA0C2F', NAVY = '#00205B', YEL = '#FFE14D', CREAM = '#F1E9D8', INK = '#141414';

  // ------------------------------------------------------------------ timeline (frames, see audio/cues.json)
  const K = {
    whoosh: 0, lockOn: 12, pin: 28, tag: 30, flag: 42, tape: 56, underline: 70,
    jet: 112, tickA: 114, tickB: 166, oslIn: 140, tpeOut: 154, land: 166,
    zoom: 168, clearUI: 182, border: 200, borderEnd: 218, readout: 205, dropout: 220, drop: 224,
  };
  const TICKS = [];                 // flight_ticks frames (cues.json), filled in init
  const PULSES = [42, 56, 70, 84, 98];  // pin radar pings on the beats

  const E = {
    outCubic: t => 1 - Math.pow(1 - t, 3), inCubic: t => t * t * t, outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: t => 0.5 - 0.5 * Math.cos(Math.PI * t), outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  };
  const cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (f, a, d) => cl01((f - a) / d);
  const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;

  // quick 2-frame exit ("flick"): f=s scale 1.06, f=s+1 small + thrown, f>=s+2 gone
  function flick(f, s, dx = 0, dy = -30, rot = 6) {
    if (f < s) return null;
    const k = f - s;
    if (k >= 2) return { visible: false, opacity: 0 };
    return k === 0 ? { scale: 1.06, x: dx * 0.15, y: dy * 0.15, rotate: rot * 0.3 } : { scale: 0.58, x: dx, y: dy, rotate: rot, opacity: 0.75 };
  }

  // plane progress along the great circle (0 at f112, 1 at f166 = last flight tick); leads the camera slightly
  const planeP = f => E.inOutSine(prog(f, K.jet, K.land - K.jet));

  // ------------------------------------------------------------------ camera helpers (renders/globe/camera.json)
  function camAt(X, gf) { return X.cam[String(Math.max(0, Math.min(899, Math.round(gf))))]; }
  function globeR(X, gf) {   // on-screen globe radius (globe centre is always the screen centre)
    const c = camAt(X, gf), d = Math.hypot(c.C[0], c.C[1], c.C[2]);
    return Math.tan(Math.asin(1 / d)) / c.tany * H / 2;
  }
  function screenOf(c, P) {  // world point -> screen with camera c
    const v = [P[0] - c.C[0], P[1] - c.C[1], P[2] - c.C[2]];
    const z = v[0] * c.fwd[0] + v[1] * c.fwd[1] + v[2] * c.fwd[2];
    const xn = (v[0] * c.right[0] + v[1] * c.right[1] + v[2] * c.right[2]) / (z * c.tanx);
    const yn = (v[0] * c.up[0] + v[1] * c.up[1] + v[2] * c.up[2]) / (z * c.tany);
    return [(xn + 1) / 2 * W, (1 - yn) / 2 * H];
  }
  // focus of expansion of the push-in: where the camera's motion ray meets the globe
  function foe(X, gf) {
    const a = camAt(X, gf), b = camAt(X, gf + 1);
    let d = [b.C[0] - a.C[0], b.C[1] - a.C[1], b.C[2] - a.C[2]];
    const L = Math.hypot(d[0], d[1], d[2]);
    if (L < 1e-9) return [W / 2, H / 2];
    d = d.map(v => v / L);
    const bb = a.C[0] * d[0] + a.C[1] * d[1] + a.C[2] * d[2];
    const cc = a.C[0] ** 2 + a.C[1] ** 2 + a.C[2] ** 2 - 1, disc = bb * bb - cc;
    if (disc <= 0) return [W / 2, H / 2];
    const t = -bb - Math.sqrt(disc);
    const p = screenOf(a, [a.C[0] + d[0] * t, a.C[1] + d[1] * t, a.C[2] + d[2] * t]);
    return [Math.max(200, Math.min(W - 200, p[0])), Math.max(150, Math.min(H - 150, p[1]))];
  }
  // screen velocity of the surface point under the screen centre (for the whip blur)
  function centreVel(X, gf) {
    const a = camAt(X, gf), b = camAt(X, gf + 1);
    const L = Math.hypot(a.C[0], a.C[1], a.C[2]);
    const u = a.C.map(v => v / L);
    const p0 = screenOf(a, u), p1 = screenOf(b, u);
    return [p1[0] - p0[0], p1[1] - p0[1]];
  }

  // ------------------------------------------------------------------ plate availability (plates may still be rendering)
  const haveCache = new Map();
  function havePlate(X, i) {
    if (haveCache.get(i)) return true;
    const ok = X.exists(X.SEQ.globe(i));
    if (ok) haveCache.set(i, true);
    return ok;
  }
  function plateFrame(X, f) {
    const want = Math.max(0, Math.min(279, f));
    if (havePlate(X, want)) return want;
    for (let d = 1; d < 280; d++) {
      if (want - d >= 0 && havePlate(X, want - d)) return want - d;
      if (want + d <= 279 && havePlate(X, want + d)) return want + d;
    }
    return null;
  }

  // ------------------------------------------------------------------ drawing helpers
  function strokeRun(g, pts, from, to) {        // polyline over visible points (breaks at occlusion)
    let open = false;
    g.beginPath();
    for (let i = from; i <= to; i++) {
      const p = pts[i];
      if (!p || !p.visible) { open = false; continue; }
      if (!open) { g.moveTo(p.x, p.y); open = true; } else g.lineTo(p.x, p.y);
    }
    g.stroke();
  }
  // geodesic circle (radius in degrees) around lat/lon, projected -> ring on the globe surface
  function geoCircle(X, gf, lat, lon, rDeg, n = 48) {
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180, r = rDeg * Math.PI / 180, out = [];
    for (let k = 0; k <= n; k++) {
      const b = k / n * TAU;
      const lat2 = Math.asin(Math.sin(la) * Math.cos(r) + Math.cos(la) * Math.sin(r) * Math.cos(b));
      const lon2 = lo + Math.atan2(Math.sin(b) * Math.sin(r) * Math.cos(la), Math.cos(r) - Math.sin(la) * Math.sin(lat2));
      out.push(X.project(gf, lat2 * 180 / Math.PI, lon2 * 180 / Math.PI));
    }
    return out;
  }
  function tri(g, x, y, ang, r0, len, w) {       // tapered radial streak (speed line)
    const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
    const x0 = x + ca * r0, y0 = y + sa * r0, x1 = x + ca * (r0 + len), y1 = y + sa * (r0 + len);
    g.moveTo(x0 + nx * w * 0.15, y0 + ny * w * 0.15);
    g.lineTo(x0 + ca * len * 0.35 + nx * w, y0 + sa * len * 0.35 + ny * w);
    g.lineTo(x1, y1);
    g.lineTo(x0 + ca * len * 0.35 - nx * w, y0 + sa * len * 0.35 - ny * w);
    g.lineTo(x0 - nx * w * 0.15, y0 - ny * w * 0.15);
    g.closePath();
  }

  // ================================================================== section
  COMP.section({
    id: 's1s2-globe', start: 0, end: 279, z: 0,

    async init(root, X) {
      const C = X.C, el = X.el;
      this.C = C;
      const copy = X.facts.copy, dist = X.fact('distance_tpe_osl');
      // --- verified copy (facts.json) ------------------------------------------------
      const [twZh, twEn] = copy.pin_taiwan.split(' ');                 // 台灣 / TAIWAN
      this.kickerText = copy.kicker;                                  // 30 秒認識一個國家
      this.route = dist.zh.replace(/\s*約.*$/, '');                   // 台北 → 奧斯陸
      this.distTo = dist.count_to;                                    // 8700
      this.distPrefix = dist.prefix; this.distUnit = dist.unit;       // 約 / km
      this.distFoot = dist.footnote;                                  // 大圓距離
      [this.codeA, this.codeB] = copy.boarding_pass.split(/\s*→\s*/);  // TPE / OSL
      this.nameNO = copy.title.split(' ').pop();                      // NORWAY
      for (const s of X.cues.sfx) if (s.name === 'flight_ticks') TICKS.push(s.frame);
      TICKS.sort((a, b) => a - b);
      if (!TICKS.length) for (let t = K.tickA; t <= K.tickB; t += 2) TICKS.push(t);

      // --- geo -------------------------------------------------------------------------
      const ns = X.geo.norwaySimple.features;
      // Border stroke: generalised ring derived from norway_outline_simplified.geojson (fjord slots closed,
      // see tmp/A-globe/make_border.py) so the draw-on reads as one clean outline; falls back to the raw
      // mainland_main_ring. Both start at Lindesnes and run up the west coast first.
      let gen = null;
      try { gen = await X.json('assets/A-globe/norway_border_generalized.json'); } catch (e) { gen = null; }
      if (gen && gen.ring && gen.ring.length > 100) { this.ring = gen.ring; this.islands = gen.islands || []; }
      else {
        this.ring = ns.find(ft => ft.properties.part === 'mainland_main_ring').geometry.coordinates;
        const mls = ns.filter(ft => ft.properties.part === 'mainland');
        const polys = mls[mls.length - 1].geometry.coordinates.map(p => p[0]).sort((a, b) => b.length - a.length);
        this.islands = polys.slice(1).filter(r => r.length >= 6);
      }
      this.ringLen = [0];
      for (let i = 1; i < this.ring.length; i++) {
        const [a, b] = [this.ring[i - 1], this.ring[i]];
        const dx = (b[0] - a[0]) * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180), dy = b[1] - a[1];
        this.ringLen.push(this.ringLen[i - 1] + Math.hypot(dx, dy));
      }
      this.twRing = X.geo.taiwanSimple.features.find(ft => ft.properties.part === 'main_island_ring').geometry.coordinates;
      this.route3 = [];                                               // great circle samples
      const NR = 200;
      for (let i = 0; i <= NR; i++) this.route3.push({ t: i / NR, ll: X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], i / NR) });

      // --- images ----------------------------------------------------------------------
      const A = 'assets/A-globe/';
      this.clouds = await Promise.all([0, 1, 2, 3, 4].map(i => X.image(A + `cloud_${i}.png`).catch(() => null)));
      const planeBase = C.canvas(240, 240);
      C.drawPlane(planeBase.getContext('2d'), 120, 120, 0, 220, RED);
      this.plane = C.sticker(planeBase, { border: 11, shadow: false, cacheKey: 'A-plane-red' });

      // --- DOM -------------------------------------------------------------------------
      const cam = this.cam = el(root, 'div', { className: 'A-cam' }, { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '50% 50%' });
      this.plate = X.plate(cam, { z: 0 });
      this.blur = C.canvas(W / 2, H / 2);
      Object.assign(this.blur.style, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', zIndex: 1 });
      cam.appendChild(this.blur);
      this.bg = this.blur.getContext('2d');
      this.fx = X.canvasLayer(cam, 2); this.g = this.fx.getContext('2d');
      const ui = this.ui = el(cam, 'div', {}, { left: '0', top: '0', width: W + 'px', height: H + 'px', zIndex: 4 });
      this.cloudCv = X.canvasLayer(cam, 6); this.cg = this.cloudCv.getContext('2d');

      // pin (kit svg; tip at 96.15% of its height)
      this.pinW = 58; this.pinH = 58 * 208 / 200;
      this.pin = el(ui, 'img', { src: C.asset('svg/pin.svg') }, { left: '0', top: '0', width: this.pinW + 'px', transformOrigin: '50% 96.15%', filter: 'drop-shadow(0 6px 5px rgba(0,0,0,.45))' });

      // Taiwan tag: torn cream plate + tape + ROC sticker + coordinates
      const TAG = this.TAG = { x: 1398, y: 196, w: 372, h: 300 };
      const tag = this.tag = el(ui, 'div', {}, { left: TAG.x + 'px', top: TAG.y + 'px', width: TAG.w + 'px', height: TAG.h + 'px', transformOrigin: '0% 55%' });
      const tp = el(tag, 'div', { className: 'paper paper--cream crumple' }, { left: '0', top: '0', width: TAG.w + 'px', height: TAG.h + 'px' });
      el(tp, 'div', { className: 'f-sans c-ink', textContent: twZh }, { left: '34px', top: '26px', fontSize: '124px', lineHeight: '1', letterSpacing: '.02em' });
      el(tp, 'div', { className: 'f-anton c-red', textContent: twEn }, { left: '38px', top: '160px', fontSize: '66px', lineHeight: '1', letterSpacing: '.07em' });
      this.tagCoord = el(tp, 'div', { className: 'f-mono', textContent: '' }, { left: '38px', top: '248px', fontSize: '22px', lineHeight: '1', letterSpacing: '.06em', color: 'rgba(20,20,20,.78)', whiteSpace: 'nowrap' });
      this.tagCoordText = fmtLL(TPE[0], TPE[1]);
      C.tornPaper(tp, { seed: 'A-twtag', edges: 'all', rim: 7, roughness: 0.9, width: TAG.w, height: TAG.h });
      this.tagCv = C.canvas(TAG.w + 40, TAG.h + 40);
      Object.assign(this.tagCv.style, { position: 'absolute', left: '-20px', top: '-20px', zIndex: 6, mixBlendMode: 'multiply' });
      tag.appendChild(this.tagCv); this.tg = this.tagCv.getContext('2d');
      this.tagTape = el(tag, 'div', { className: 'tape tape--white tape--sm' }, { left: '-62px', top: '-6px', zIndex: 7 });
      this.tagFlag = el(tag, 'img', { src: C.asset('svg/sticker_flag_roc.svg') }, { left: (TAG.w - 118) + 'px', top: '-58px', width: '168px', zIndex: 8, transformOrigin: '50% 50%' });

      // kicker tape label
      this.kicker = el(ui, 'div', { className: 'tape-label', textContent: this.kickerText }, { left: '100px', top: '856px', fontSize: '70px', height: '132px', padding: '0 74px', transformOrigin: '30% 50%' });
      { // red marker underline on the kicker tape (drawn on a beat), sized from the text metrics
        const mg = C.canvas(10, 10).getContext('2d'); mg.font = C.font('sans', 70);
        this.kickW = mg.measureText(this.kickerText).width + C.graphemes(this.kickerText).length * 70 * 0.04;
        this.kickCv = C.canvas(this.kickW + 200, 132);
        Object.assign(this.kickCv.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', mixBlendMode: 'multiply' });
        this.kicker.appendChild(this.kickCv); this.kg = this.kickCv.getContext('2d');
      }
      this.kickTape = el(ui, 'div', { className: 'tape tape--kraft tape--sm' }, { left: (100 + 74 * 2 + Math.round(this.kickW) - 52) + 'px', top: '842px', width: '110px', transformOrigin: '50% 50%' });

      // airport dymo labels (label-maker tape)
      this.dTPE = el(ui, 'div', { className: 'dymo dymo--red', textContent: this.codeA }, { left: '0', top: '0', fontSize: '28px', padding: '8px 16px 9px', transformOrigin: '0% 0%' });
      this.dOSL = el(ui, 'div', { className: 'dymo dymo--navy', textContent: this.codeB }, { left: '0', top: '0', fontSize: '28px', padding: '8px 16px 9px', transformOrigin: '100% 100%' });

      // distance counter card (bottom-left, title-safe)
      const CARD = this.CARD = { x: 104, y: 730, w: 736, h: 226 };
      const card = this.card = el(ui, 'div', {}, { left: CARD.x + 'px', top: CARD.y + 'px', width: CARD.w + 'px', height: CARD.h + 'px', transformOrigin: '20% 60%' });
      const cp = el(card, 'div', { className: 'paper paper--cream crumple' }, { left: '0', top: '0', width: CARD.w + 'px', height: CARD.h + 'px' });
      el(cp, 'div', { className: 'f-sans-b c-ink', textContent: this.route }, { left: '36px', top: '24px', fontSize: '30px', lineHeight: '1', letterSpacing: '.08em' });
      const row = el(cp, 'div', {}, { left: '34px', top: '58px', height: '150px', display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' });
      el(row, 'span', { className: 'f-sans c-ink', textContent: this.distPrefix }, { position: 'relative', fontSize: '62px', lineHeight: '1', marginRight: '16px' });
      this.num = el(row, 'span', { className: 'f-anton c-red' }, { position: 'relative', fontSize: '146px', lineHeight: '1', display: 'inline-flex' });
      el(row, 'span', { className: 'f-anton c-ink', textContent: this.distUnit }, { position: 'relative', fontSize: '76px', lineHeight: '1', marginLeft: '14px', textTransform: 'none' });
      C.tornPaper(cp, { seed: 'A-card', edges: 'tb', rim: 7, roughness: 0.9, width: CARD.w, height: CARD.h });
      this.cardCv = C.canvas(CARD.w + 60, CARD.h + 60);
      Object.assign(this.cardCv.style, { position: 'absolute', left: '-30px', top: '-30px', zIndex: 6, mixBlendMode: 'multiply' });
      card.appendChild(this.cardCv); this.ccg = this.cardCv.getContext('2d');
      this.cardDymo = el(card, 'div', { className: 'dymo dymo--red', textContent: copy.boarding_pass }, { left: '330px', top: '-30px', fontSize: '24px', padding: '7px 14px 8px', zIndex: 7, transformOrigin: '50% 50%' });
      el(card, 'div', { className: 'tape tape--beige tape--sm' }, { left: '-64px', top: '-4px', transform: 'rotate(-34deg)', zIndex: 7 });
      // arrival stamp (thunks on the last flight tick); city names from copy.boarding_pass_cities
      const cities = (copy.boarding_pass_cities || '').match(/[A-Z]{3,}/g) || ['TAIPEI', 'OSLO'];
      this.stamp = C.makeStamp({ shape: 'circle', w: 520, h: 520, color: NAVY, top: cities[0], bottom: cities[cities.length - 1], center: [{ text: this.codeB, font: 'anton', size: 190, y: 0.52, track: 6 }], stars: true, seed: 'A-arr' });
      this.foot = el(card, 'div', { className: 'footnote', innerHTML: `<span class="zh">${this.distFoot}</span>` }, { left: '26px', top: (CARD.h + 14) + 'px', bottom: 'auto', zIndex: 7 });

      // Norway data readout (tiny)
      this.readout = el(ui, 'div', {}, { left: '0', top: '0', whiteSpace: 'nowrap', transformOrigin: '0% 50%' });
      this.roChip = el(this.readout, 'div', { className: 'dymo dymo--navy', textContent: this.nameNO }, { position: 'relative', display: 'inline-block', fontSize: '20px', padding: '6px 11px 7px', verticalAlign: 'middle' });
      this.roTxt = el(this.readout, 'span', { className: 'f-mono' }, { position: 'relative', display: 'inline-block', marginLeft: '12px', fontSize: '22px', letterSpacing: '.08em', color: '#fff', verticalAlign: 'middle', textShadow: '0 1px 3px rgba(0,0,0,.85), 0 0 10px rgba(0,20,60,.6)' });
      this.roText = fmtLL(OSL[0], OSL[1]);
    },

    // ================================================================ render
    async render(f, root, X) {
      const C = this.C, g = this.g;
      // ---- plate (frame-accurate; nearest existing plate if still rendering) ----
      let gf = plateFrame(X, f);
      if (gf === null) gf = f;
      if (gf !== f && !this._warned) { this._warned = true; console.warn(`[A-globe] globe plate ${f} missing, showing ${gf}`); }
      await this.plate.setFrame('globe', gf);
      const P = (lat, lon, alt = 0) => X.project(gf, lat, lon, alt);

      // ---- camera div: whoosh-in scale (f0–16), dropout push (f220–223) ----
      let camS = 1;
      if (f < 18) camS = 1 + 0.11 * Math.pow(1 - E.outQuart(prog(f, 0, 18)), 1);
      if (f >= K.dropout && f < K.drop) camS = 1 + 0.018 * E.inCubic(prog(f, K.dropout - 1, 4));
      this.cam.style.transform = camS !== 1 ? `scale(${camS.toFixed(4)})` : '';

      g.clearRect(0, 0, W, H);
      this.cg.clearRect(0, 0, W, H);

      // ---- plate-derived blur (whoosh / whip / push-in) ----
      this.drawBlur(f, gf, X);

      if (f <= 223) {
        this.drawS1(f, gf, X, P);
        this.drawS2(f, gf, X, P);
      } else {
        this.hideUI();
      }
      this.drawBorder(f, gf, X, P);
    },

    hideUI() {
      for (const e of [this.pin, this.tag, this.kicker, this.kickTape, this.dTPE, this.dOSL, this.card, this.readout]) { e.style.visibility = 'hidden'; e.style.opacity = 0; }
    },

    // ---------------------------------------------------------------- blur layer
    drawBlur(f, gf, X) {
      const bg = this.bg, img = this.plate, cv = this.blur;
      let mode = null, amt = 0, str = 0, cx = W / 2, cy = H / 2, v = [0, 0];
      if (f < 13) { mode = 'zoom'; amt = 0.10 * Math.pow(1 - f / 13, 1.6); str = 1; }
      else if (f >= 120 && f <= 160) {
        v = centreVel(X, gf); const sp = Math.hypot(v[0], v[1]);
        if (sp > 8) { mode = 'whip'; str = 0.7 * cl01((sp - 8) / 16); }
      } else if (f >= 174 && f <= 214) {
        const r0 = globeR(X, gf), r1 = globeR(X, gf + 1), rate = r1 / r0 - 1;
        if (rate > 0.015) { mode = 'zoom'; amt = Math.min(0.04, rate * 0.55); str = 0.85 * cl01((rate - 0.015) / 0.035); [cx, cy] = foe(X, gf); }
      }
      if (!mode || str <= 0.01) { cv.style.visibility = 'hidden'; return; }
      cv.style.visibility = 'visible';
      bg.setTransform(1, 0, 0, 1, 0, 0);
      bg.globalCompositeOperation = 'source-over'; bg.globalAlpha = 1;
      bg.clearRect(0, 0, W / 2, H / 2);
      const N = 10;
      if (mode === 'zoom') {
        for (let k = 0; k < N; k++) {
          const s = 1 + amt * k / (N - 1);
          bg.globalAlpha = 1 / (k + 1);
          bg.setTransform(0.5 * s, 0, 0, 0.5 * s, 0.5 * cx * (1 - s), 0.5 * cy * (1 - s));
          bg.drawImage(img, 0, 0, W, H);
        }
        // keep the focus sharp: radial mask (blur grows toward the frame edge)
        bg.setTransform(1, 0, 0, 1, 0, 0);
        bg.globalAlpha = 1; bg.globalCompositeOperation = 'destination-in';
        const rg = bg.createRadialGradient(cx / 2, cy / 2, 0, cx / 2, cy / 2, 560);
        rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.3, 'rgba(0,0,0,0.12)'); rg.addColorStop(0.65, 'rgba(0,0,0,0.75)'); rg.addColorStop(1, 'rgba(0,0,0,1)');
        bg.fillStyle = rg; bg.fillRect(0, 0, W / 2, H / 2);
      } else {
        // whip: directional blur of the globe surface only (limb + stars stay crisp)
        const r = globeR(X, gf), len = 0.75;
        bg.save(); bg.beginPath(); bg.arc(W / 4, H / 4, r / 2 * 0.985, 0, TAU); bg.clip();
        for (let k = 0; k < N; k++) {
          const t = (k / (N - 1) - 0.5) * len;
          bg.globalAlpha = 1 / (k + 1);
          bg.setTransform(0.5, 0, 0, 0.5, 0.5 * v[0] * t, 0.5 * v[1] * t);
          bg.drawImage(img, 0, 0, W, H);
        }
        bg.restore();
        bg.setTransform(1, 0, 0, 1, 0, 0);
        bg.globalAlpha = 1; bg.globalCompositeOperation = 'destination-in';
        const rg = bg.createRadialGradient(W / 4, H / 4, 0, W / 4, H / 4, r / 2);
        rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.62, 'rgba(0,0,0,0.9)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        bg.fillStyle = rg; bg.fillRect(0, 0, W / 2, H / 2);
      }
      bg.globalCompositeOperation = 'source-over';
      cv.style.opacity = str.toFixed(3);
    },

    // ---------------------------------------------------------------- S1: Taiwan
    drawS1(f, gf, X, P) {
      const C = this.C, g = this.g;
      const tpe = P(TPE[0], TPE[1]);
      const twc = P(23.7, 120.97);

      // lock-on brackets converge on Taiwan (f12–28)
      if (f >= K.lockOn && f < K.pin + 2) {
        const p = E.outCubic(prog(f, K.lockOn, K.pin - K.lockOn));
        const half = lerp(190, 46, p), arm = lerp(34, 16, p);
        const a = f >= K.pin ? 1 - (f - K.pin) / 2 : cl01((f - K.lockOn) / 3);
        g.save(); g.strokeStyle = `rgba(255,255,255,${(0.9 * a).toFixed(3)})`; g.lineWidth = 3.5; g.lineCap = 'square';
        g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 4;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const x = twc.x + sx * half, y = twc.y + sy * half;
          g.beginPath(); g.moveTo(x, y - sy * arm); g.lineTo(x, y); g.lineTo(x - sx * arm, y); g.stroke();
        }
        // centre ticks
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(twc.x + dx * half * 0.55, twc.y + dy * half * 0.55); g.lineTo(twc.x + dx * (half * 0.55 + 10), twc.y + dy * (half * 0.55 + 10)); g.stroke(); }
        g.restore();
      }

      // Taiwan highlight: outline draw-on + red fill (stays until the island leaves the view)
      if (f >= K.pin && f < 170) {
        const pts = this.twRing.map(([lon, lat]) => P(lat, lon));
        const vis = pts.filter(p => p.visible).length > pts.length * 0.6;
        if (vis) {
          const pr = E.outCubic(prog(f, K.pin, 8)), n = Math.max(2, Math.round(pr * (pts.length - 1)));
          const fa = 0.62 * prog(f, K.pin + 3, 5);
          g.save();
          if (fa > 0) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = `rgba(186,12,47,${fa.toFixed(3)})`; g.fill(); }
          g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.shadowColor = 'rgba(255,255,255,.8)'; g.shadowBlur = 6;
          g.beginPath(); for (let i = 0; i <= n; i++) { const p = pts[i]; i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke();
          g.restore();
        }
      }

      // shock ring on the pin pop + radar pings on the beats (geodesic rings = correct foreshortening)
      const rings = [[K.pin, 16, 9.5, 1], [K.pin + 3, 14, 6, 0.6], ...PULSES.map(b => [b, 16, 5.5, 0.55])];
      for (const [s, dur, maxDeg, amp] of rings) {
        if (f < s || f >= s + dur || f >= K.jet) continue;
        const t = (f - s) / dur, rd = 0.2 + maxDeg * E.outCubic(t);
        const pts = geoCircle(X, gf, TPE[0], TPE[1], rd);
        g.save(); g.strokeStyle = `rgba(255,255,255,${(amp * (1 - t) ** 1.4).toFixed(3)})`; g.lineWidth = 2.6 * (1 - t) + 1;
        strokeRun(g, pts, 0, pts.length - 1); g.restore();
      }
      // flash at the pop
      if (f >= K.pin && f < K.pin + 4) {
        const t = (f - K.pin) / 4;
        const rg = g.createRadialGradient(tpe.x, tpe.y, 0, tpe.x, tpe.y, 120 + 60 * t);
        rg.addColorStop(0, `rgba(255,255,255,${(0.9 * (1 - t)).toFixed(3)})`); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(tpe.x - 200, tpe.y - 200, 400, 400);
      }

      // marker circle around the island (yellow, boils on twos)
      if (f >= K.pin + 1 && f < K.jet) {
        C.marker.circle(g, { cx: twc.x + 2, cy: twc.y - 4, rx: 44, ry: 58, rotation: -14, seed: 'A-twc', width: 6.5, color: YEL,
          progress: E.outCubic(prog(f, K.pin + 1, 7)), frame: f, boil: 0.7, composite: 'source-over' });
      }

      // pin: pops on f28, pops out on the jet whoosh f112
      const pinM = f < K.jet ? C.snapInAt(f, K.pin, { dur: 5, from: 1.9, rot0: -10 }) : flick(f, K.jet, 0, -20, 0);
      if (f >= K.pin) {
        const hop = f >= 98 && f < 106 ? { y: -14 * Math.sin(Math.PI * (f - 98) / 8), scale: 1 + 0.06 * Math.sin(Math.PI * (f - 98) / 8) } : null;   // anticipation before take-off
        C.place(this.pin, { x: tpe.x - this.pinW / 2, y: tpe.y - this.pinH * 0.9615 }, pinM, hop, C.jitter('A-pin', f, 0.6, 0.8));
      } else C.place(this.pin, {}, { visible: false });

      // tag + leader line
      const tagIn = C.snapInAt(f, K.tag + 1, { dur: 4, from: 1.25, rot0: 5 });
      const tagOut = flick(f, K.jet, 60, -40, 8);
      const tj = C.jitter('A-tag', f, 1.6, 0.35), tw = C.wander('A-tagw', f, 3, 0.03);
      const tagM = [tagIn, tagOut, tj, { x: tw.x, y: tw.y }];
      C.place(this.tag, { rotate: -2.2 }, ...tagM);
      if (f >= K.tag && f < K.jet + 1) {
        const TAG = this.TAG;
        // attach point = tag's left edge (includes the tag's jitter/wander; rotation is small)
        const ax = TAG.x + tj.x + tw.x + 2, ay = TAG.y + TAG.h * 0.55 + tj.y + tw.y;
        const sx = tpe.x + 14, sy = tpe.y - this.pinH * 0.62;
        const dy = ay - sy, kx = sx + Math.abs(dy) * 0.9;   // 1 diagonal + 1 horizontal leg
        const L1 = Math.hypot(kx - sx, ay - sy), L2 = Math.abs(ax - kx), p = E.outCubic(prog(f, K.tag, 5)) * (L1 + L2);
        const out = f >= K.jet ? 0.5 : 1;
        g.save(); g.globalAlpha = out;
        g.strokeStyle = '#fff'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
        g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 5;
        g.beginPath(); g.moveTo(sx, sy);
        if (p <= L1) g.lineTo(sx + (kx - sx) * p / L1, sy + (ay - sy) * p / L1);
        else { g.lineTo(kx, ay); g.lineTo(kx + (ax - kx) * (p - L1) / L2, ay); }
        g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, sy, 4.5, 0, TAU); g.fill();
        if (p >= L1 + L2 - 1) { g.beginPath(); g.arc(ax, ay, 4, 0, TAU); g.fill(); }
        g.restore();
      }
      // tag details: coordinates typed on, tape, ROC sticker slap, red underline under TAIWAN
      const ty = C.typewriterAt(this.tagCoordText, f, K.tag + 4, K.tag + 13);
      this.tagCoord.textContent = ty.text + (ty.done ? '' : '▌');
      C.place(this.tagTape, { rotate: -38 }, C.snapInAt(f, K.tag + 3, { dur: 3, from: 1.4, rot0: -6 }));
      C.place(this.tagFlag, { rotate: 9 }, C.snapInAt(f, K.flag, { dur: 4, from: 1.6, rot0: 14 }), C.jitter('A-flag', f, 1.2, 0.6));
      const tg = this.tg; tg.clearRect(0, 0, this.tagCv.width, this.tagCv.height);
      if (f >= K.underline) C.marker.underline(tg, { x1: 56, x2: 318, y: 256, seed: 'A-tul', width: 9, color: RED, progress: E.outCubic(prog(f, K.underline, 6)), slope: -0.015, composite: 'multiply' });

      // kicker tape slap on f56 (tape SFX)
      if (f < K.jet + 2) {
        const kin = C.snapInAt(f, K.tape, { dur: 4, from: 1.22, rot0: -4 });
        const kout = flick(f, K.jet, -40, 40, -5);
        const sh = C.shake('A-kick', f, K.tape + 2, { amp: 5, decay: 4 });
        C.place(this.kicker, { rotate: -2.4 }, kin, kout, C.jitter('A-kick', f, 1.4, 0.3), { x: sh.x, y: sh.y });
        C.place(this.kickTape, { rotate: 62 }, C.snapInAt(f, K.tape + 3, { dur: 3, from: 1.5 }), kout, C.jitter('A-kt', f, 1, 0.5));
        const kg = this.kg; kg.clearRect(0, 0, this.kickCv.width, this.kickCv.height);
        if (f >= 84) C.marker.underline(kg, { x1: 70, x2: 74 + this.kickW, y: 108, seed: 'A-kul', width: 8, color: RED, progress: E.outCubic(prog(f, 84, 6)), slope: 0.004, composite: 'multiply' });
      } else { C.place(this.kicker, {}, { visible: false }); C.place(this.kickTape, {}, { visible: false }); }
    },

    // ---------------------------------------------------------------- S2: flight + push-in
    drawS2(f, gf, X, P) {
      const C = this.C, g = this.g;
      const inFlight = f >= K.jet;
      if (!inFlight) { for (const e of [this.dTPE, this.dOSL, this.card, this.readout]) C.place(e, {}, { visible: false }); return; }
      const tpe = P(TPE[0], TPE[1]), osl = P(OSL[0], OSL[1]);

      // light streak sweeping L->R with the jet whoosh pan (f112–122)
      if (f < K.jet + 11) {
        const t = (f - K.jet) / 10, x = lerp(-500, W + 500, E.inOutCubic(t));
        const lg = g.createLinearGradient(x - 420, 0, x + 420, 0);
        lg.addColorStop(0, 'rgba(160,200,255,0)'); lg.addColorStop(0.5, `rgba(200,225,255,${(0.22 * Math.sin(Math.PI * t)).toFixed(3)})`); lg.addColorStop(1, 'rgba(160,200,255,0)');
        g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = lg; g.fillRect(0, 0, W, H); g.restore();
      }

      // ---- flight arc ----
      const pp = planeP(f), arcFade = 1 - prog(f, 176, 16);
      if (arcFade > 0) {
        const R = this.route3, NR = R.length - 1;
        const air = R.map(r => P(r.ll[0], r.ll[1], ARC_H * Math.sin(Math.PI * r.t)));
        const gnd = R.map(r => P(r.ll[0], r.ll[1], 0));
        const hi = Math.floor(pp * NR);
        // exact head point
        const hll = X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], pp);
        const head = P(hll[0], hll[1], ARC_H * Math.sin(Math.PI * pp));
        const headG = P(hll[0], hll[1], 0);
        const airF = air.slice(0, hi + 1).concat([head]), gndF = gnd.slice(0, hi + 1).concat([headG]);
        g.save(); g.globalAlpha = arcFade;
        // altitude profile: the arc's shadow on the ground, displaced like the plane's shadow (~ altitude),
        // joined to the trail by thin drop lines. (The chase camera flies the same great circle, so the
        // elevated arc itself projects to a straight line; the shadow is what reads as height.)
        const SHX = 22, SHY = 36;
        const shd = (p, t) => ({ x: p.x + SHX * Math.sin(Math.PI * t), y: p.y + SHY * Math.sin(Math.PI * t), visible: p.visible });
        const shF = gndF.map((p, i) => shd(p, i <= hi ? R[i].t : pp));
        g.fillStyle = 'rgba(255,255,255,0.06)';
        g.beginPath(); let started = false;
        for (let i = 0; i < airF.length; i++) { const p = airF[i]; if (!p.visible || !shF[i].visible) continue; started ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); started = true; }
        for (let i = shF.length - 1; i >= 0; i--) { const p = shF[i]; if (!p.visible || !airF[i].visible) continue; g.lineTo(p.x, p.y); }
        g.closePath(); if (started) g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.32)'; g.lineWidth = 1.2;
        for (let k = 1; k < 20; k++) {
          const i = Math.round(k / 20 * NR); if (i > hi) break;
          if (air[i].visible && gnd[i].visible) { const q = shF[i]; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(air[i].x, air[i].y); g.stroke(); }
        }
        g.save(); g.filter = 'blur(2px)'; g.lineCap = 'round'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,8,24,0.55)';
        strokeRun(g, shF, 0, shF.length - 1); g.restore();
        g.setLineDash([2, 8]); g.lineCap = 'round'; g.lineWidth = 2.4; g.strokeStyle = 'rgba(255,255,255,0.5)';
        strokeRun(g, shF, 0, shF.length - 1);
        // planned remainder (faint dotted, elevated)
        g.setLineDash([3, 9]); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.6)';
        const rem = [head].concat(air.slice(hi + 1));
        if (pp < 1) strokeRun(g, rem, 0, rem.length - 1);
        // flown trail: shadow + red under-glow + white dashes marching toward the plane
        g.setLineDash([]); g.lineWidth = 9; g.strokeStyle = 'rgba(0,10,30,0.35)'; strokeRun(g, airF, 0, airF.length - 1);
        g.lineWidth = 6; g.strokeStyle = 'rgba(186,12,47,0.85)'; strokeRun(g, airF, 0, airF.length - 1);
        g.setLineDash([16, 11]); g.lineDashOffset = -f * 3.2; g.lineWidth = 3.4; g.strokeStyle = '#fff'; g.lineCap = 'butt';
        strokeRun(g, airF, 0, airF.length - 1);
        g.setLineDash([]);
        g.restore();

        // airport dots
        const dot = (p, a) => {
          if (!p.visible || a <= 0) return;
          g.save(); g.globalAlpha = a;
          g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(p.x, p.y + 2, 10, 0, TAU); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 9, 0, TAU); g.fill();
          g.fillStyle = RED; g.beginPath(); g.arc(p.x, p.y, 5, 0, TAU); g.fill();
          g.restore();
        };
        dot(tpe, arcFade * (1 - prog(f, K.tpeOut, 4)));
        dot(osl, arcFade * prog(f, K.oslIn - 2, 3));
        // arrival ping at OSL
        if (f >= K.land && f < K.land + 16) {
          const t = (f - K.land) / 16;
          const pts = geoCircle(X, gf, OSL[0], OSL[1], 0.3 + 6 * E.outCubic(t));
          g.save(); g.strokeStyle = `rgba(255,255,255,${(0.9 * (1 - t) ** 1.3).toFixed(3)})`; g.lineWidth = 3 * (1 - t) + 1; strokeRun(g, pts, 0, pts.length - 1); g.restore();
        }

        // plane sticker at the arc head, oriented along the path, shadow offset ~ altitude
        if (f <= K.land + 3 && head.visible) {
          const ll2 = X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], Math.min(1, pp + 0.004));
          const ll1 = X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], Math.max(0, pp - 0.004));
          const a2 = P(ll2[0], ll2[1], ARC_H * Math.sin(Math.PI * Math.min(1, pp + 0.004)));
          const a1 = P(ll1[0], ll1[1], ARC_H * Math.sin(Math.PI * Math.max(0, pp - 0.004)));
          const hd = Math.atan2(a2.x - a1.x, -(a2.y - a1.y)) * 180 / Math.PI;
          const altK = Math.sin(Math.PI * pp);
          const landS = f > K.land - 4 ? 1 - E.inCubic(prog(f, K.land - 4, 7)) : 1;
          const takeS = C.snapIn(C.progRaw(f, K.jet, 5), { from: 0.4, rot0: 0 }).scale;
          const sz = (70 + 30 * altK) * landS * takeS;
          if (sz > 2) {
            const pl = this.plane, k = sz / 220;
            g.save();
            g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 8 + 10 * altK; g.shadowOffsetX = 6 + 16 * altK; g.shadowOffsetY = 10 + 26 * altK;
            g.translate(head.x, head.y); g.rotate(hd * Math.PI / 180); g.scale(k, k);
            g.drawImage(pl, -pl.width / 2, -pl.height / 2);
            g.restore();
          }
        }
      }

      // ---- airport dymo labels ----
      const tj = C.jitter('A-dt', f, 0.8, 0.4), oj = C.jitter('A-do', f, 0.8, 0.4);
      if (tpe.visible && f < K.tpeOut + 3) C.place(this.dTPE, { x: tpe.x + 18, y: tpe.y + 12, rotate: -3 }, C.snapInAt(f, K.jet, { dur: 4 }), f >= K.tpeOut ? C.popOutAt(f, K.tpeOut, { dur: 3 }) : null, tj);
      else C.place(this.dTPE, {}, { visible: false });
      if (osl.visible && f >= K.oslIn && f < K.clearUI + 3) {
        // anchored by its bottom-right corner, up-left of the dot
        C.place(this.dOSL, { x: osl.x - 18 - 86, y: osl.y - 16 - 46, rotate: 3 }, C.snapInAt(f, K.oslIn, { dur: 4 }), f >= K.clearUI ? C.popOutAt(f, K.clearUI, { dur: 3 }) : null, oj);
      } else C.place(this.dOSL, {}, { visible: false });

      // ---- distance counter card (ticks on flight_ticks, final 約 8,700 km on f166) ----
      if (f < K.clearUI + 3) {
        let lastTick = null; for (const t of TICKS) if (t <= f) lastTick = t;
        const val = lastTick === null ? 0 : Math.round(this.distTo * planeP(lastTick) / 10) * 10;
        // tabular digit cells so the unit doesn't wobble between ticks
        const disp = C.formatNumber(Math.min(this.distTo, val));
        const html = Array.from(disp).map(ch => `<span style="display:inline-block;text-align:center;width:${ch === ',' ? '.27em' : '.47em'}">${ch}</span>`).join('');
        if (this._numHtml !== html) { this.num.innerHTML = html; this._numHtml = html; }
        const tickBump = TICKS.includes(f) ? { scale: 1.012 } : null;
        const land = f >= K.land ? { scale: 1 + 0.07 * C.settle(prog(f, K.land, 6)) } : null;
        const cin = C.snapInAt(f, K.tickA, { dur: 4, from: 1.25, rot0: -4 });
        const cout = f >= K.clearUI ? C.popOutAt(f, K.clearUI, { dur: 3, rot: -5 }) : null;
        C.place(this.card, { rotate: -1.6 }, cin, cout, tickBump, land, C.jitter('A-card', f, 1.3, 0.3));
        C.place(this.cardDymo, { rotate: 3.5 }, C.snapInAt(f, K.tickA + 3, { dur: 3, from: 1.4 }));
        const cg = this.ccg; cg.clearRect(0, 0, this.cardCv.width, this.cardCv.height);
        C.drawStamp(cg, this.stamp, 30 + this.CARD.w - 104, 30 + this.CARD.h / 2 + 4, C.progRaw(f, K.land - 2, 6), { rot: -14, scale: 0.36, composite: 'multiply' });
        if (f >= K.land) C.marker.highlight(cg, { x: 140, y: 118, w: 380, h: 104, seed: 'A-chl', progress: E.outCubic(prog(f, K.land, 5)), color: YEL, composite: 'source-over', alpha: 1.6 });
      } else C.place(this.card, {}, { visible: false });

      // ---- push-in energy: speed lines + cloud wisps ----
      if (f >= 172 && f <= 216) this.drawSpeed(f, gf, X);
      if (f >= 189 && f <= 205) this.drawClouds(f, gf, X);

      // ---- Norway readout (types on f205–213, sits next to Oslo) ----
      if (f >= K.readout && f <= 223) {
        const ty = C.typewriterAt(this.roText, f, K.readout + 1, K.readout + 9);
        const cur = !ty.done || (f >= K.dropout && f % 4 < 2) ? '▌' : '';
        const txt = ty.text + cur;
        if (this._roT !== txt) { this.roTxt.textContent = txt; this._roT = txt; }
        C.place(this.readout, { x: osl.x + 24, y: osl.y - 18 }, C.snapInAt(f, K.readout, { dur: 3, from: 1.3, rot0: 0 }), C.jitter('A-ro', f, 0.6, 0.2));
        // Oslo crosshair
        const a = prog(f, K.readout, 3);
        g.save(); g.globalAlpha = a; g.strokeStyle = '#fff'; g.lineWidth = 2; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 4;
        const r = 8 + 5 * (1 - E.outCubic(prog(f, K.readout, 6)));
        g.beginPath(); g.arc(osl.x, osl.y, r, 0, TAU); g.stroke();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(osl.x + dx * (r + 3), osl.y + dy * (r + 3)); g.lineTo(osl.x + dx * (r + 10), osl.y + dy * (r + 10)); g.stroke(); }
        g.fillStyle = RED; g.beginPath(); g.arc(osl.x, osl.y, 3.2, 0, TAU); g.fill();
        g.restore();
      } else C.place(this.readout, {}, { visible: false });
    },

    drawSpeed(f, gf, X) {
      const C = this.C, g = this.g;
      const r0 = globeR(X, gf), r1 = globeR(X, gf + 1), rate = r1 / r0 - 1;
      const k = cl01((rate - 0.01) / 0.05) * (1 - prog(f, 212, 5));
      if (k <= 0.01) return;
      const [cx, cy] = foe(X, gf);
      g.save(); g.fillStyle = '#fff';
      const n = 44;
      for (let i = 0; i < n; i++) {
        if (C.rand('A-sl-on', i, f) > 0.45 + 0.4 * k) continue;
        const ang = C.rand('A-sl-a', i) * TAU + C.srand('A-sl-j', i, f) * 0.03;
        const rr = lerp(460, 1150, C.rand('A-sl-r', i, f));
        const len = (140 + 420 * C.rand('A-sl-l', i, f)) * k * (rr / 800);
        const w = (0.7 + 1.6 * C.rand('A-sl-w', i, f)) * (0.6 + 0.5 * k);
        g.globalAlpha = (0.06 + 0.22 * C.rand('A-sl-o', i, f)) * k;
        g.beginPath(); tri(g, cx, cy, ang, rr, len, w); g.fill();
      }
      g.restore();
    },

    drawClouds(f, gf, X) {
      const cg = this.cg, imgs = this.clouds;
      const [fx, fy] = foe(X, gf);
      // [img, start, dur, angle(deg), offset(px at s0), s0, s1, alpha, rot(deg)]
      const WISP = [
        [2, 189, 10, 205, 430, 0.8, 3.0, 0.42, -6], [0, 190, 10, 30, 460, 0.8, 3.2, 0.45, 10],
        [1, 192, 9, 135, 430, 0.9, 3.4, 0.40, -12], [0, 193, 8, 190, 170, 1.6, 5.5, 0.28, 4],
        [3, 194, 8, 320, 440, 0.9, 3.4, 0.42, 5], [4, 196, 8, 80, 480, 0.9, 3.4, 0.36, -3],
        [1, 197, 7, 255, 520, 1.0, 3.4, 0.30, 12], [2, 198, 7, 355, 560, 1.0, 3.2, 0.24, -5],
      ];
      for (const [ii, s, d, angD, off, s0, s1, amax, rot] of WISP) {
        if (f < s || f >= s + d || !imgs[ii]) continue;
        const t = (f - s) / d;
        const sc = s0 * Math.pow(s1 / s0, t);
        const a = amax * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.8) * (1 - Math.max(0, t - 0.75) * 2);
        if (a <= 0.01) continue;
        const ang = angD * Math.PI / 180, dist = off * Math.pow(sc / s0, 1.05);
        const x = fx + Math.cos(ang) * dist, y = fy + Math.sin(ang) * dist;
        const im = imgs[ii], w = im.width * sc, h = im.height * sc;
        cg.save(); cg.globalAlpha = Math.min(1, a);
        cg.translate(x, y); cg.rotate(rot * Math.PI / 180);
        cg.drawImage(im, -w / 2, -h / 2, w, h);
        cg.restore();
      }
    },

    // ---------------------------------------------------------------- Norway border (f200–279)
    drawBorder(f, gf, X, P) {
      if (f < K.border) return;
      const g = this.g, ring = this.ring, L = this.ringLen, total = L[L.length - 1];
      const pr = f >= K.borderEnd ? 1 : E.inOutCubic(prog(f, K.border, K.borderEnd - K.border));
      const end = pr * total;
      const pts = [];
      for (let i = 0; i < ring.length; i++) {
        if (L[i] > end) {
          const t = (end - L[i - 1]) / (L[i] - L[i - 1] || 1);
          const lon = lerp(ring[i - 1][0], ring[i][0], t), lat = lerp(ring[i - 1][1], ring[i][1], t);
          pts.push(P(lat, lon)); break;
        }
        pts.push(P(ring[i][1], ring[i][0]));
      }
      if (pts.length < 2) return;
      const post = f >= K.drop;                                  // S3 background: thinner, crisp
      const wW = post ? 5.2 : 7, wR = post ? 3 : 4.2;
      const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); if (pr >= 1) g.closePath(); };
      g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
      // spotlight: once the outline is closed, the rest of the map dims slightly (settles into the drop)
      const dim = post ? 0.22 : 0.22 * E.outCubic(prog(f, K.borderEnd - 2, 5));
      if (dim > 0.002) {
        g.beginPath(); g.rect(0, 0, W, H);
        pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
        g.fillStyle = `rgba(0,12,34,${dim.toFixed(3)})`; g.fill('evenodd');
      }
      // glow (pulses on the dropout hold)
      const hold = f >= K.dropout && f < K.drop ? E.inCubic(prog(f, K.dropout - 1, 4)) : 0;
      g.shadowColor = post ? 'rgba(255,255,255,0.35)' : `rgba(255,255,255,${(0.45 + 0.3 * hold).toFixed(3)})`;
      g.shadowBlur = post ? 8 : 10 + 10 * hold;
      g.strokeStyle = 'rgba(255,255,255,0.92)'; g.lineWidth = wW; path(); g.stroke();
      g.shadowBlur = 0;
      g.strokeStyle = RED; g.lineWidth = wR; path(); g.stroke();
      // islands (thin), fade in once the main ring is well under way
      const ia = post ? 1 : prog(f, 208, 8);
      if (ia > 0) {
        g.globalAlpha = ia;
        g.lineWidth = post ? 3.4 : 4; g.strokeStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        for (const r of this.islands) { r.forEach(([lon, lat], i) => { const p = P(lat, lon); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); }
        g.stroke();
        g.lineWidth = post ? 1.6 : 2; g.strokeStyle = RED; g.stroke();
        g.globalAlpha = 1;
      }
      // drawing head: spark
      if (pr < 1) {
        const h = pts[pts.length - 1];
        const rg = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, 34);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,230,230,0.8)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(h.x - 34, h.y - 34, 68, 68);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(h.x, h.y, 5, 0, TAU); g.fill();
      }
      g.restore();
    },
  });
})();
