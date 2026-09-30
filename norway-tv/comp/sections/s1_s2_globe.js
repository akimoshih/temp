/* S1 INTRO_TAIWAN (f0–111) + S2 FLIGHT_ZOOM (f112–223) + globe background plate under S3 (f224–279).
 * Owner: A-globe. z 0 (bottom of the stack).
 *
 * Layers inside one "camera" div (so CSS pushes keep every overlay pixel-locked to the plate):
 *   plate <img>  -> renders/globe/fNNNN.jpg (nearest existing frame if one is still rendering)
 *   blur canvas  -> half-res radial zoom blur / disc-clipped whip blur built from the plate itself
 *   fx canvas    -> everything projected on the globe (COMP.project): lock-on HUD, Taiwan highlight, pin rings,
 *                   flight route (screen-space bow over the ground track), plane + ground shadow, airport dots,
 *                   speed lines, Norway border
 *   DOM          -> collage cut-outs (pin sticker, torn tag, tape kicker, dymo labels, counter card, readout)
 *   cloud canvas -> cloud wisps flying past the lens during the push-in (screen blend)
 * Generated inputs: comp/assets/A-globe/make_clouds.py (cloud_N.png), make_border.py (norway_border_generalized.json).
 * Every value is a pure function of f (seeded hashes, jitter on twos). Wording/numbers come from facts.json.
 *
 * Shared helper for other sections: COMP.A_drawNorwayBorder(ctx, gf) draws the exact post-drop (f224+) border
 * + spotlight dim for globe frame gf, so a copy of the plate (e.g. the S3 rip-out) can match this section.
 */
(function () {
  const W = 1920, H = 1080, TAU = Math.PI * 2;
  // Geo points. TPE/OSL = the exact endpoints of facts.taipei_oslo_distance_km (Taipei 101 -> Oslo S).
  const TPE = [25.033, 121.5654];
  const OSL = [59.9111, 10.7528];
  const TWC = [23.7, 120.97];        // centre of Taiwan's main island (lock-on / marker circle)
  const BOW = 0.18;                  // flight-arc screen bow: peak offset = BOW * globe radius (sin profile)
  const RED = '#BA0C2F', NAVY = '#00205B', YEL = '#FFE14D', CREAM = '#F1E9D8', INK = '#141414';

  // ------------------------------------------------------------------ timeline (frames, see audio/cues.json)
  const K = {
    whoosh: 0, lock: 14, pin: 28, tag: 30, flag: 42, tape: 56, underline: 70, kickUl: 84, hop: 98,
    jet: 112, tickA: 114, tickB: 166, oslIn: 140, tpeOut: 154, land: 166,
    zoom: 168, clearUI: 182, bloom: 196, border: 200, borderOslo: 212, borderEnd: 216, dropout: 220, drop: 224,
  };
  const LOCK_SNAPS = [14, 18, 22, 26];            // lock-on brackets step in on twos, 1-frame flash on each
  const TICKS = [];                                // flight_ticks frames (cues.json), filled in init
  const PULSES = [42, 56, 70, 84, 98];             // pin radar pings on the beats

  const E = {
    outCubic: t => 1 - Math.pow(1 - t, 3), inCubic: t => t * t * t, outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inOutSine: t => 0.5 - 0.5 * Math.cos(Math.PI * t), outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outQuad: t => 1 - (1 - t) * (1 - t),
  };
  const cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (f, a, d) => cl01((f - a) / d);
  const smooth = t => t * t * (3 - 2 * t);
  const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;

  // quick 2-frame exit ("flick"): f=s scale 1.06, f=s+1 small + thrown, f>=s+2 gone
  function flick(f, s, dx = 0, dy = -30, rot = 6) {
    if (f < s) return null;
    const k = f - s;
    if (k >= 2) return { visible: false, opacity: 0 };
    return k === 0 ? { scale: 1.04, x: dx * 0.15, y: dy * 0.15, rotate: rot * 0.3 } : { scale: 0.62, x: dx, y: dy, rotate: rot, opacity: 0.75 };
  }

  // plane progress along the great circle (0 at f112, 1 at f166 = last flight tick)
  const planeP = f => E.inOutSine(prog(f, K.jet, K.land - K.jet));

  // ------------------------------------------------------------------ camera helpers (renders/globe/camera.json)
  function camAt(X, gf) { return X.cam[String(Math.max(0, Math.min(899, Math.round(gf))))]; }
  function globeR(X, gf) {   // on-screen globe radius (globe centre is always the screen centre: fwd = -C/|C|)
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
  // cos of the angle between the surface normal and the direction to the camera (0 = on the horizon)
  function facing(X, gf, lat, lon) {
    const c = camAt(X, gf), la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    const u = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
    const v = [c.C[0] - u[0], c.C[1] - u[1], c.C[2] - u[2]];
    return (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / Math.hypot(v[0], v[1], v[2]);
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

  // ------------------------------------------------------------------ Norway border (shared by S2 draw-on + S3 plate)
  // style: dark separation shadow, 1.5 px white rim (white pass under the red), red core; islands = thin red only
  function borderPath(g, pts, close) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); if (close) g.closePath(); }
  function strokeBorder(g, pts, close, o) {
    g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
    if (o.glow > 0) {           // dropout swell: soft red bloom under the line
      g.shadowColor = `rgba(255,40,80,${(0.75 * o.glow).toFixed(3)})`; g.shadowBlur = 22 * o.glow;
      g.strokeStyle = `rgba(186,12,47,${(0.55 * o.glow).toFixed(3)})`; g.lineWidth = o.wW + 4; borderPath(g, pts, close); g.stroke();
    }
    g.shadowColor = 'rgba(0,10,30,0.45)'; g.shadowBlur = 6; g.shadowOffsetY = 1.5;
    g.strokeStyle = '#fff'; g.lineWidth = o.wW; borderPath(g, pts, close); g.stroke();
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    g.strokeStyle = RED; g.lineWidth = o.wR; borderPath(g, pts, close); g.stroke();
    g.restore();
  }
  function strokeIslands(g, islands, P, alpha, w) {
    if (alpha <= 0) return;
    g.save(); g.globalAlpha = alpha; g.lineJoin = 'round';
    g.shadowColor = 'rgba(0,10,30,0.5)'; g.shadowBlur = 3;
    g.strokeStyle = RED; g.lineWidth = w; g.beginPath();
    for (const r of islands) { r.forEach(([lon, lat], i) => { const p = P(lat, lon); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }); g.closePath(); }
    g.stroke(); g.restore();
  }
  function dimOutside(g, pts, a) {
    if (a <= 0.002) return;
    g.save(); g.beginPath(); g.rect(0, 0, W, H);
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath();
    g.fillStyle = `rgba(0,12,34,${a.toFixed(3)})`; g.fill('evenodd'); g.restore();
  }
  const POST = { wW: 8, wR: 5, dim: 0.22, isl: 2 };   // f224+ (under the S3 title)

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
      // Border stroke: generalised ring derived from norway_outline_simplified.geojson (fjord slots closed, islands
      // >= 500 km2, see comp/assets/A-globe/make_border.py); falls back to the raw mainland_main_ring.
      // Both start at Lindesnes and run up the west coast first.
      let gen = null;
      try { gen = await X.json('assets/A-globe/norway_border_generalized.json'); } catch (e) { gen = null; }
      if (gen && gen.ring && gen.ring.length > 100) { this.ring = gen.ring; this.islands = gen.islands || []; }
      else {
        this.ring = ns.find(ft => ft.properties.part === 'mainland_main_ring').geometry.coordinates;
        this.islands = [];
      }
      this.ringLen = [0];
      for (let i = 1; i < this.ring.length; i++) {
        const [a, b] = [this.ring[i - 1], this.ring[i]];
        const dx = (b[0] - a[0]) * Math.cos((a[1] + b[1]) / 2 * Math.PI / 180), dy = b[1] - a[1];
        this.ringLen.push(this.ringLen[i - 1] + Math.hypot(dx, dy));
      }
      const total = this.ringLen[this.ringLen.length - 1];
      { // ring parameter where the drawing spark passes Oslo (on the east/south leg, near the end)
        let bi = 0, bd = 1e9;
        const n0 = Math.floor(this.ring.length * 0.6);
        for (let i = n0; i < this.ring.length; i++) {
          const [lon, lat] = this.ring[i];
          const d = Math.hypot((lon - OSL[1]) * Math.cos(OSL[0] * Math.PI / 180), lat - OSL[0]);
          if (d < bd) { bd = d; bi = i; }
        }
        this.sOslo = this.ringLen[bi] / total;
      }
      this.twRing = X.geo.taiwanSimple.features.find(ft => ft.properties.part === 'main_island_ring').geometry.coordinates;
      this.route3 = [];                                               // great circle samples
      const NR = 160;
      for (let i = 0; i <= NR; i++) this.route3.push({ t: i / NR, ll: X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], i / NR) });

      // --- images ----------------------------------------------------------------------
      const A = 'assets/A-globe/';
      this.clouds = await Promise.all([0, 1, 2, 3, 4].map(i => X.image(A + `cloud_${i}.png`).catch(() => null)));
      const planeBase = C.canvas(240, 240);
      C.drawPlane(planeBase.getContext('2d'), 120, 120, 0, 220, RED);
      this.plane = C.sticker(planeBase, { border: 11, shadow: false, cacheKey: 'A-plane-red' });
      // plane ground shadow: dark, pre-blurred silhouette of the die-cut sticker (shadow-offset trick, no ctx.filter)
      {
        const pw = this.plane.width, ph = this.plane.height;
        const sil = C.canvas(pw, ph), sg = sil.getContext('2d');
        sg.drawImage(this.plane, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = 'rgb(0,8,22)'; sg.fillRect(0, 0, pw, ph);
        this.planeSh = C.canvas(pw, ph);
        const bg2 = this.planeSh.getContext('2d');
        bg2.shadowColor = 'rgb(0,8,22)'; bg2.shadowBlur = 16; bg2.shadowOffsetX = pw * 2;
        bg2.drawImage(sil, -pw * 2, 0);
      }

      // --- DOM -------------------------------------------------------------------------
      const cam = this.cam = el(root, 'div', { className: 'A-cam' }, { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '50% 50%' });
      this.plate = X.plate(cam, { z: 0 });
      this.blur = C.canvas(W / 2, H / 2);
      Object.assign(this.blur.style, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', zIndex: 1 });
      cam.appendChild(this.blur);
      this.bg = this.blur.getContext('2d');
      this.fx = X.canvasLayer(cam, 2); this.g = this.fx.getContext('2d');
      this.rc = C.canvas(W, H); this.rg = this.rc.getContext('2d');   // offscreen: flight route (limb-faded, then composited)
      const ui = this.ui = el(cam, 'div', {}, { left: '0', top: '0', width: W + 'px', height: H + 'px', zIndex: 4 });
      this.cloudCv = X.canvasLayer(cam, 6); this.cg = this.cloudCv.getContext('2d');
      this.cloudCv.style.mixBlendMode = 'screen';

      // pin: kit pin.svg turned into a die-cut sticker (white border) so it matches the plane sticker
      const pinImg = await X.image(C.asset('svg/pin.svg'));
      const pc = C.canvas(100, 104); pc.getContext('2d').drawImage(pinImg, 0, 0, 100, 104);
      const pinSt = C.sticker(pc, { border: 8, shadow: { x: 0, y: 5, blur: 7, color: 'rgba(0,0,0,0.5)' }, cacheKey: 'A-pin-sticker' });
      const pk = 0.46;                                   // display scale: pin body 46 px wide
      this.pinK = pk; this.pinTip = [(pinSt.pad + 50) * pk, (pinSt.pad + 100) * pk]; this.pinHead = (pinSt.pad + 38) * pk;
      this.pin = pinSt;
      Object.assign(pinSt.style, { position: 'absolute', left: '0', top: '0', width: (pinSt.width * pk) + 'px', height: (pinSt.height * pk) + 'px', transformOrigin: `${this.pinTip[0]}px ${this.pinTip[1]}px` });
      ui.appendChild(pinSt);

      // Taiwan tag: torn cream plate + tape + ROC sticker + coordinates
      const TAG = this.TAG = { x: 1380, y: 196, w: 372, h: 300 };
      const tag = this.tag = el(ui, 'div', {}, { left: TAG.x + 'px', top: TAG.y + 'px', width: TAG.w + 'px', height: TAG.h + 'px', transformOrigin: '100% 55%' });
      const tp = el(tag, 'div', { className: 'paper paper--cream crumple' }, { left: '0', top: '0', width: TAG.w + 'px', height: TAG.h + 'px' });
      el(tp, 'div', { className: 'f-sans c-ink', textContent: twZh }, { left: '34px', top: '26px', fontSize: '124px', lineHeight: '1', letterSpacing: '.02em' });
      el(tp, 'div', { className: 'f-anton c-red', textContent: twEn }, { left: '38px', top: '160px', fontSize: '66px', lineHeight: '1', letterSpacing: '.07em' });
      this.tagCoordText = fmtLL(TPE[0], TPE[1]);
      el(tp, 'div', { className: 'f-mono', textContent: this.tagCoordText }, { left: '38px', top: '248px', fontSize: '22px', lineHeight: '1', letterSpacing: '.06em', color: 'rgba(20,20,20,.78)', whiteSpace: 'nowrap' });
      C.tornPaper(tp, { seed: 'A-twtag', edges: 'all', rim: 7, roughness: 0.9, width: TAG.w, height: TAG.h });
      this.tagCv = C.canvas(TAG.w + 40, TAG.h + 40);
      Object.assign(this.tagCv.style, { position: 'absolute', left: '-20px', top: '-20px', zIndex: 6, mixBlendMode: 'multiply' });
      tag.appendChild(this.tagCv); this.tg = this.tagCv.getContext('2d');
      this.tagTape = el(tag, 'div', { className: 'tape tape--white tape--sm' }, { left: '-62px', top: '-6px', zIndex: 7 });
      this.tagFlag = el(tag, 'img', { src: C.asset('svg/sticker_flag_roc.svg') }, { left: (TAG.w - 132) + 'px', top: '-52px', width: '160px', zIndex: 8, transformOrigin: '80% 80%' });

      // kicker tape label
      const KX = 124;
      this.kicker = el(ui, 'div', { className: 'tape-label', textContent: this.kickerText }, { left: KX + 'px', top: '850px', fontSize: '70px', height: '132px', padding: '0 74px', transformOrigin: '12% 70%' });
      { // red marker underline on the kicker tape (drawn on a beat), sized from the text metrics
        const mg = C.canvas(10, 10).getContext('2d'); mg.font = C.font('sans', 70);
        this.kickW = mg.measureText(this.kickerText).width + C.graphemes(this.kickerText).length * 70 * 0.04;
        this.kickCv = C.canvas(this.kickW + 200, 132);
        Object.assign(this.kickCv.style, { position: 'absolute', left: '0', top: '0', pointerEvents: 'none', mixBlendMode: 'multiply' });
        this.kicker.appendChild(this.kickCv); this.kg = this.kickCv.getContext('2d');
      }
      this.kickTape = el(ui, 'div', { className: 'tape tape--kraft tape--sm' }, { left: (KX + 74 * 2 + Math.round(this.kickW) - 52) + 'px', top: '836px', width: '110px', transformOrigin: '50% 50%' });

      // airport dymo labels (label-maker tape)
      this.dTPE = el(ui, 'div', { className: 'dymo dymo--red', textContent: this.codeA }, { left: '0', top: '0', fontSize: '28px', padding: '8px 16px 9px', transformOrigin: '0% 0%' });
      this.dOSL = el(ui, 'div', { className: 'dymo dymo--navy', textContent: this.codeB }, { left: '0', top: '0', fontSize: '28px', padding: '8px 16px 9px', transformOrigin: '100% 100%' });

      // distance counter card (bottom-left, title-safe). Number = fixed 5-cell field ('8,700'), right-aligned,
      // leading cells ghosted like a mechanical counter, so '約' and 'km' never move.
      const CARD = this.CARD = { x: 132, y: 742, w: 610, h: 212 };
      const card = this.card = el(ui, 'div', {}, { left: CARD.x + 'px', top: CARD.y + 'px', width: CARD.w + 'px', height: CARD.h + 'px', transformOrigin: '30% 80%' });
      const cp = el(card, 'div', { className: 'paper paper--cream crumple' }, { left: '0', top: '0', width: CARD.w + 'px', height: CARD.h + 'px' });
      el(cp, 'div', { className: 'f-sans-b c-ink', textContent: this.route }, { left: '38px', top: '24px', fontSize: '30px', lineHeight: '1', letterSpacing: '.08em' });
      const row = el(cp, 'div', {}, { left: '34px', top: '54px', height: '150px', display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' });
      el(row, 'span', { className: 'f-sans c-ink', textContent: this.distPrefix }, { position: 'relative', fontSize: '62px', lineHeight: '1', marginRight: '14px' });
      this.num = el(row, 'span', { className: 'f-anton c-red' }, { position: 'relative', fontSize: '146px', lineHeight: '1', display: 'inline-flex' });
      this.cells = [];
      for (let i = 0; i < 5; i++) this.cells.push(el(this.num, 'span', { textContent: '0' }, { position: 'relative', display: 'inline-block', textAlign: 'center', width: i === 1 ? '.27em' : '.47em' }));
      el(row, 'span', { className: 'f-anton c-ink', textContent: this.distUnit }, { position: 'relative', fontSize: '76px', lineHeight: '1', marginLeft: '14px', textTransform: 'none' });
      // ink canvas inside the paper (clipped by the torn edge): highlighter + arrival stamp over the card's edge
      this.cardCv = C.canvas(CARD.w, CARD.h);
      Object.assign(this.cardCv.style, { position: 'absolute', left: '0', top: '0', zIndex: 6, mixBlendMode: 'multiply', pointerEvents: 'none' });
      cp.appendChild(this.cardCv); this.ccg = this.cardCv.getContext('2d');
      C.tornPaper(cp, { seed: 'A-card', edges: 'tb', rim: 7, roughness: 0.9, width: CARD.w, height: CARD.h });
      el(card, 'div', { className: 'tape tape--beige tape--sm' }, { left: '-56px', top: '-6px', transform: 'rotate(-34deg)', zIndex: 7 });
      // arrival stamp (thunks on the last flight tick); city names from copy.boarding_pass_cities, star in the centre
      const cities = (copy.boarding_pass_cities || '').match(/[A-Z]{3,}/g) || ['TAIPEI', 'OSLO'];
      this.stamp = C.makeStamp({ shape: 'circle', w: 520, h: 520, color: NAVY, top: cities[0], bottom: cities[cities.length - 1], center: [{ text: '★', font: 'sans', size: 230, y: 0.53 }], stars: true, seed: 'A-arr' });
      this.foot = el(card, 'div', { className: 'footnote', innerHTML: `<span class="zh">${this.distFoot}</span>` }, { left: '26px', top: (CARD.h + 12) + 'px', bottom: 'auto', zIndex: 7 });

      // Norway data readout: stacked (dymo chip + Space Mono coordinates), right-aligned at a leader over the sea
      this.roText = fmtLL(OSL[0], OSL[1]);
      const ro = this.readout = el(ui, 'div', {}, { left: '0', top: '0', whiteSpace: 'nowrap', transformOrigin: '100% 50%' });
      this.roChip = el(ro, 'div', { className: 'dymo dymo--navy', textContent: this.nameNO }, { right: '0', top: '0', fontSize: '22px', padding: '7px 12px 8px' });
      const mono = { fontSize: '25px', letterSpacing: '.06em', color: '#fff', lineHeight: '1', textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 12px rgba(0,20,60,.75)' };
      this.roTxt = el(ro, 'div', { className: 'f-mono' }, Object.assign({ left: '0', top: '50px' }, mono));
      this.roTxtSpan = el(this.roTxt, 'span', {}, { position: 'relative' });
      this.roCursor = el(this.roTxt, 'span', {}, { position: 'relative', display: 'inline-block', width: '.55em', height: '.82em', marginLeft: '.1em', verticalAlign: '-0.05em', background: '#fff', boxShadow: '0 0 8px rgba(0,20,60,.8)' });
      { // full width of the coordinate line (for right alignment while it types on); canvas metrics, because the
        // section root is display:none during init
        const mg = C.canvas(10, 10).getContext('2d'); mg.font = C.font('mono', 25);
        this.roW = Math.ceil(mg.measureText(this.roText).width + C.graphemes(this.roText).length * 25 * 0.06) + 4;
        ro.style.width = this.roW + 'px';
      }

      // shared post-drop border for other sections (e.g. S3's copy of plate 279 during its rip-out)
      const self = this;
      X.A_drawNorwayBorder = function (ctx, gf) {
        const P = (lat, lon) => X.project(gf, lat, lon);
        const pts = self.ring.map(([lon, lat]) => P(lat, lon));
        dimOutside(ctx, pts, POST.dim);
        strokeBorder(ctx, pts, true, { wW: POST.wW, wR: POST.wR, glow: 0 });
        strokeIslands(ctx, self.islands, P, 1, POST.isl);
      };
    },

    // ================================================================ render
    async render(f, root, X) {
      // ---- plate (frame-accurate; nearest existing plate if still rendering) ----
      let gf = plateFrame(X, f);
      if (gf === null) gf = f;
      if (gf !== f && !this._warned) { this._warned = true; console.warn(`[A-globe] globe plate ${f} missing, showing ${gf}`); }
      await this.plate.setFrame('globe', gf);
      const P = (lat, lon, alt = 0) => X.project(gf, lat, lon, alt);

      // ---- camera div: whoosh-in (f0–28), jet punch (f112–114), dropout push (f220–223) ----
      let camS = 1, camR = 0;
      if (f < 30) { const e = E.outCubic(prog(f, 0, 29)); camS = 1 + 0.32 * (1 - e); camR = -5 * (1 - e); }
      if (f >= K.jet && f <= K.jet + 3) camS = 1 + 0.035 * Math.pow(1 - (f - K.jet) / 3, 2);
      if (f >= K.dropout && f < K.drop) camS = 1 + 0.018 * E.inCubic(prog(f, K.dropout - 1, 4));
      // drop (f224+): share section B's camera shake so plate, border and title collage move as one frame
      let camX = 0, camY = 0;
      if (f >= K.drop) {
        const sh = C.shake('B-drop', f, K.drop, { amp: 30, decay: 6.5, freq: 1.1 });
        camX = sh.x; camY = sh.y; camR += sh.r;
        camS = Math.max(camS, 1 + 0.045 * Math.exp(-(f - K.drop) / 8)); // overscan so shaken edges never show
      }
      this.cam.style.transform = camS !== 1 || camR !== 0 || camX || camY
        ? `translate(${camX.toFixed(2)}px,${camY.toFixed(2)}px) rotate(${camR.toFixed(3)}deg) scale(${camS.toFixed(4)})` : '';

      this.g.clearRect(0, 0, W, H);
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
      if (f < 17) { mode = 'zoom'; amt = 0.13 * Math.pow(1 - f / 17, 1.4); str = 1; }
      else if (f >= K.jet && f <= K.jet + 4) {              // jet whoosh hit: synthetic L->R whip before the plate moves
        const k = 1 - (f - K.jet) / 5; mode = 'whip'; v = [90 * k, 0]; str = 0.6 * k;
      } else if (f >= 118 && f <= 160) {
        v = centreVel(X, gf); const sp = Math.hypot(v[0], v[1]);
        if (sp > 8) { mode = 'whip'; str = 0.7 * cl01((sp - 8) / 16); }
      } else if (f >= 174 && f <= 214) {
        const r0 = globeR(X, gf), r1 = globeR(X, gf + 1), rate = r1 / r0 - 1;
        if (rate > 0.015) { mode = 'zoom'; amt = Math.min(0.045, rate * 0.6); str = 0.9 * cl01((rate - 0.015) / 0.035); [cx, cy] = foe(X, gf); }
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
      const twc = P(TWC[0], TWC[1]);

      // lock-on: brackets step in on twos (f14/18/22/26), 1-frame flash on each snap; coordinates type on beside them
      if (f >= K.lock && f < K.pin + 1) {
        let s = 0; for (let i = 0; i < LOCK_SNAPS.length; i++) if (f >= LOCK_SNAPS[i]) s = i;
        const half = [176, 118, 78, 50][s], arm = [30, 25, 20, 16][s];
        const flash = LOCK_SNAPS.includes(f);
        const a = f >= K.pin ? 0.45 : 1;
        g.save(); g.lineCap = 'square'; g.lineJoin = 'miter';
        g.strokeStyle = `rgba(255,255,255,${(flash ? 1 : 0.92) * a})`; g.lineWidth = flash ? 8 : 5.5;
        g.shadowColor = flash ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,.55)'; g.shadowBlur = flash ? 16 : 5;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
          const x = twc.x + sx * half, y = twc.y + sy * half;
          g.beginPath(); g.moveTo(x, y - sy * arm); g.lineTo(x, y); g.lineTo(x - sx * arm, y); g.stroke();
        }
        g.lineWidth = flash ? 4 : 3;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(twc.x + dx * half * 0.62, twc.y + dy * half * 0.62); g.lineTo(twc.x + dx * (half * 0.62 + 12), twc.y + dy * (half * 0.62 + 12)); g.stroke(); }
        // HUD coordinates (Space Mono), typed on f14–24, pinned to the top-right bracket
        if (f < K.pin) {
          const ty = C.typewriterAt(this.tagCoordText, f, K.lock, K.lock + 10);
          const tx = twc.x + half + 14, tyy = twc.y - half + 6;
          g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 5;
          g.font = C.font('mono', 22); g.textBaseline = 'top'; g.textAlign = 'left'; g.fillStyle = '#fff';
          const mw = C.spacedTextLeft(g, ty.text, tx, tyy, 1.2);
          if (!ty.done || Math.floor(f / 3) % 2 === 0) g.fillRect(tx + mw + 3, tyy + 1, 12, 20);   // block cursor (no glyph)
        }
        g.restore();
      }

      // Taiwan highlight: outline draw-on + red fill (stays until the island leaves the view)
      if (f >= K.pin && f < 170) {
        const pts = this.twRing.map(([lon, lat]) => P(lat, lon));
        const face = cl01((facing(X, gf, TWC[0], TWC[1]) - 0.3) / 0.25);   // fades out before the island reaches the limb
        const vis = face > 0 && pts.filter(p => p.visible).length > pts.length * 0.6;
        if (vis) {
          const pr = E.outCubic(prog(f, K.pin, 8)), n = Math.max(2, Math.round(pr * (pts.length - 1)));
          const fa = 0.62 * prog(f, K.pin + 3, 5);
          g.save(); g.globalAlpha = face;
          if (fa > 0) { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.fillStyle = `rgba(186,12,47,${fa.toFixed(3)})`; g.fill(); }
          g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.shadowColor = 'rgba(255,255,255,.8)'; g.shadowBlur = 6;
          g.beginPath(); for (let i = 0; i <= n; i++) { const p = pts[i]; i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); } g.stroke();
          g.restore();
        }
      }

      // shock ring on the pin pop + radar pings on the beats (geodesic rings = correct foreshortening)
      const rings = [[K.pin, 16, 9.5, 1], ...PULSES.map(b => [b, 16, 5.5, 0.55])];
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

      // marker circle framing the island (yellow, boils on twos)
      if (f >= K.pin + 1 && f < K.jet) {
        C.marker.circle(g, { cx: twc.x + 1, cy: twc.y + 5, rx: 40, ry: 54, rotation: -14, seed: 'A-twc', width: 6.5, color: YEL,
          progress: E.outCubic(prog(f, K.pin + 1, 7)), frame: f, boil: 0.7, composite: 'source-over' });
      }

      // pin sticker: pops on f28, pops out on the jet whoosh f112
      const pinM = f < K.jet ? C.snapInAt(f, K.pin, { dur: 5, from: 1.9, rot0: -10 }) : flick(f, K.jet, 0, -20, 0);
      if (f >= K.pin) {
        const hop = f >= K.hop && f < K.hop + 8 ? { y: -14 * Math.sin(Math.PI * (f - K.hop) / 8), scale: 1 + 0.06 * Math.sin(Math.PI * (f - K.hop) / 8) } : null;   // anticipation before take-off
        C.place(this.pin, { x: tpe.x - this.pinTip[0], y: tpe.y - this.pinTip[1] }, pinM, hop, C.jitter('A-pin', f, 0.6, 0.8));
      } else C.place(this.pin, {}, { visible: false });

      // tag + leader line
      const tagIn = C.snapInAt(f, K.tag + 1, { dur: 4, from: 1.08, rot0: 4 });
      const tagOut = flick(f, K.jet, 40, -40, 8);
      const tj = C.jitter('A-tag', f, 1.6, 0.35), tw = C.wander('A-tagw', f, 3, 0.03);
      C.place(this.tag, { rotate: -2.2 }, tagIn, tagOut, tj, { x: tw.x, y: tw.y });
      if (f >= K.tag && f < K.jet + 1) {
        const TAG = this.TAG;
        // attach point = tag's left edge (includes the tag's jitter/wander; rotation is small)
        const ax = TAG.x + tj.x + tw.x + 2, ay = TAG.y + TAG.h * 0.55 + tj.y + tw.y;
        const sx = tpe.x + 10, sy = tpe.y - (this.pinTip[1] - this.pinHead);
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
        g.fillStyle = '#fff';
        if (p >= L1 + L2 - 1) { g.beginPath(); g.arc(ax, ay, 4, 0, TAU); g.fill(); }
        g.restore();
      }
      // tag details: tape, ROC sticker slap, red underline under TAIWAN
      C.place(this.tagTape, { rotate: -38 }, C.snapInAt(f, K.tag + 3, { dur: 3, from: 1.3, rot0: -6 }));
      C.place(this.tagFlag, { rotate: 9 }, C.snapInAt(f, K.flag, { dur: 4, from: 1.22, rot0: 12 }), C.jitter('A-flag', f, 1.2, 0.6));
      const tg = this.tg; tg.clearRect(0, 0, this.tagCv.width, this.tagCv.height);
      if (f >= K.underline) C.marker.underline(tg, { x1: 56, x2: 318, y: 256, seed: 'A-tul', width: 9, color: RED, progress: E.outCubic(prog(f, K.underline, 6)), slope: -0.015, composite: 'multiply' });

      // kicker tape slap on f56 (tape SFX)
      if (f < K.jet + 2) {
        const kin = C.snapInAt(f, K.tape, { dur: 4, from: 1.1, rot0: -4 });
        const kout = flick(f, K.jet, 30, 50, -5);
        const sh = C.shake('A-kick', f, K.tape + 2, { amp: 5, decay: 4 });
        C.place(this.kicker, { rotate: -2.4 }, kin, kout, C.jitter('A-kick', f, 1.4, 0.3), { x: sh.x, y: sh.y });
        C.place(this.kickTape, { rotate: 62 }, C.snapInAt(f, K.tape + 3, { dur: 3, from: 1.5 }), kout, C.jitter('A-kt', f, 1, 0.5));
        const kg = this.kg; kg.clearRect(0, 0, this.kickCv.width, this.kickCv.height);
        if (f >= K.kickUl) C.marker.underline(kg, { x1: 70, x2: 74 + this.kickW, y: 108, seed: 'A-kul', width: 8, color: RED, progress: E.outCubic(prog(f, K.kickUl, 6)), slope: 0.004, composite: 'multiply' });
      } else { C.place(this.kicker, {}, { visible: false }); C.place(this.kickTape, {}, { visible: false }); }
    },

    // ---------------------------------------------------------------- S2: flight + push-in
    drawS2(f, gf, X, P) {
      const C = this.C, g = this.g;
      const inFlight = f >= K.jet;
      if (!inFlight) { for (const e of [this.dTPE, this.dOSL, this.card, this.readout]) C.place(e, {}, { visible: false }); return; }
      const tpe = P(TPE[0], TPE[1]), osl = P(OSL[0], OSL[1]);

      // ---- flight route: great-circle ground track + screen-space bow (altitude), faded at the limb ----
      const pp = planeP(f), arcFade = 1 - prog(f, 176, 16);
      let head = null, headG = null, hd = 0;
      if (arcFade > 0) {
        const R = this.route3, NR = R.length - 1, rG = globeR(X, gf);
        const gnd = R.map(r => { const p = P(r.ll[0], r.ll[1]); p.visible = p.visible && facing(X, gf, r.ll[0], r.ll[1]) > 0.03; return p; });
        const A = gnd[0], B = gnd[NR];
        const dl = Math.hypot(B.x - A.x, B.y - A.y) || 1;
        const nx = -(B.y - A.y) / dl, ny = (B.x - A.x) / dl;           // bow side: right-hand normal of TPE->OSL (reads as "up")
        const bow = (p, t) => { const h = BOW * rG * Math.sin(Math.PI * t); return { x: p.x + nx * h, y: p.y + ny * h, visible: p.visible }; };
        const air = gnd.map((p, i) => bow(p, R[i].t));
        const hll = X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], pp);
        headG = P(hll[0], hll[1]); headG.visible = headG.visible && facing(X, gf, hll[0], hll[1]) > 0.03;
        head = bow(headG, pp);
        const hi = Math.min(NR, Math.floor(pp * NR));
        const airF = air.slice(0, hi + 1).concat([head]), gndF = gnd.slice(0, hi + 1).concat([headG]);
        const rem = [head].concat(air.slice(hi + 1));

        const rg = this.rg;
        rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalAlpha = 1; rg.globalCompositeOperation = 'source-over';
        rg.clearRect(0, 0, W, H);
        rg.lineJoin = 'round'; rg.lineDashOffset = 0; rg.setLineDash([]);   // reset per-frame state (pure function of f)
        // ground track under the flown part (thin dotted) + a few drop lines = altitude profile
        rg.setLineDash([2, 7]); rg.lineCap = 'round'; rg.lineWidth = 2; rg.strokeStyle = 'rgba(255,255,255,0.45)';
        strokeRun(rg, gndF, 0, gndF.length - 1);
        rg.setLineDash([]); rg.lineWidth = 1.3; rg.strokeStyle = 'rgba(255,255,255,0.42)'; rg.fillStyle = 'rgba(255,255,255,0.6)';
        for (const t of [0.3, 0.425, 0.55, 0.675, 0.8]) {
          if (t > pp) break;
          const i = Math.round(t * NR), a = air[i], b = gnd[i];
          if (!a.visible || !b.visible) continue;
          rg.beginPath(); rg.moveTo(b.x, b.y); rg.lineTo(a.x, a.y); rg.stroke();
          rg.beginPath(); rg.arc(b.x, b.y, 2.2, 0, TAU); rg.fill();
        }
        // planned remainder (faint dotted, bowed)
        if (pp < 1) { rg.lineDashOffset = 0; rg.setLineDash([3, 9]); rg.lineWidth = 3; rg.strokeStyle = 'rgba(255,255,255,0.55)'; strokeRun(rg, rem, 0, rem.length - 1); }
        // flown trail: shadow + red under-stroke + white dashes marching toward the plane
        rg.setLineDash([]); rg.lineCap = 'round';
        rg.lineWidth = 10; rg.strokeStyle = 'rgba(0,10,30,0.35)'; strokeRun(rg, airF, 0, airF.length - 1);
        rg.lineWidth = 6.5; rg.strokeStyle = 'rgba(186,12,47,0.92)'; strokeRun(rg, airF, 0, airF.length - 1);
        rg.setLineDash([16, 11]); rg.lineDashOffset = -f * 3.2; rg.lineWidth = 3.4; rg.strokeStyle = '#fff'; rg.lineCap = 'butt';
        strokeRun(rg, airF, 0, airF.length - 1);
        rg.setLineDash([]);
        // fade everything to 0 toward the limb: the route comes cleanly over the horizon and never leaves the globe
        // (mask + composite only inside the route's bounding box)
        let x0 = W, y0 = H, x1 = 0, y1 = 0;
        for (const q of [air, gnd]) for (const p of q) if (p.visible) { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; }
        x0 = Math.max(0, Math.floor(x0 - 24)); y0 = Math.max(0, Math.floor(y0 - 24)); x1 = Math.min(W, Math.ceil(x1 + 24)); y1 = Math.min(H, Math.ceil(y1 + 24));
        if (x1 > x0 && y1 > y0) {
          rg.globalCompositeOperation = 'destination-in';
          const mk = rg.createRadialGradient(W / 2, H / 2, rG * 0.8, W / 2, H / 2, rG * 0.975);
          mk.addColorStop(0, 'rgba(0,0,0,1)'); mk.addColorStop(0.55, 'rgba(0,0,0,0.6)'); mk.addColorStop(1, 'rgba(0,0,0,0)');
          rg.fillStyle = mk; rg.fillRect(x0, y0, x1 - x0, y1 - y0);
          rg.globalCompositeOperation = 'source-over';
          g.save(); g.globalAlpha = arcFade; g.drawImage(this.rc, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0); g.restore();
        }

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

        // plane sticker at the bowed head, oriented along the screen path; its ground shadow sits on the track
        if (f <= K.land + 3 && head.visible) {
          const q2 = Math.min(1, pp + 0.004), q1 = Math.max(0, pp - 0.004);
          const l2 = X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], q2), l1 = X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], q1);
          const a2 = bow(P(l2[0], l2[1]), q2), a1 = bow(P(l1[0], l1[1]), q1);
          hd = Math.atan2(a2.x - a1.x, -(a2.y - a1.y));
          const altK = Math.sin(Math.PI * pp);
          const landS = f > K.land - 4 ? 1 - E.inCubic(prog(f, K.land - 4, 7)) : 1;
          const takeS = C.snapIn(C.progRaw(f, K.jet, 5), { from: 0.4, rot0: 0 }).scale;
          const sz = (66 + 34 * altK) * landS * takeS;
          if (sz > 2) {
            const pl = this.plane, k = sz / 220;
            // drop line plane -> shadow
            if (altK > 0.08) {
              g.save(); g.strokeStyle = `rgba(255,255,255,${(0.5 * cl01(altK * 3)).toFixed(3)})`; g.lineWidth = 1.4; g.setLineDash([3, 4]);
              g.beginPath(); g.moveTo(headG.x, headG.y); g.lineTo(head.x, head.y); g.stroke(); g.restore();
            }
            g.save(); g.globalAlpha = 0.62 * (0.7 + 0.3 * (1 - altK));
            g.translate(headG.x, headG.y); g.rotate(hd); g.scale(k * 0.82, k * 0.82);
            g.drawImage(this.planeSh, -pl.width / 2, -pl.height / 2); g.restore();
            g.save();
            g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = 6; g.shadowOffsetX = 3; g.shadowOffsetY = 5;
            g.translate(head.x, head.y); g.rotate(hd); g.scale(k, k);
            g.drawImage(pl, -pl.width / 2, -pl.height / 2);
            g.restore();
          }
        }
      }

      // ---- jet whoosh hit (f112–119): anamorphic streak crossing L->R at the plane's height ----
      if (f < K.jet + 8) {
        const t = (f - K.jet) / 7, x = lerp(-300, W + 300, E.inOutSine(t)), y = head ? head.y : tpe.y;
        const a = 0.5 * Math.pow(Math.sin(Math.PI * Math.min(1, (f - K.jet + 1) / 8)), 0.7);
        g.save(); g.globalCompositeOperation = 'screen';
        // soft bloom around the line (~120 px tall), pale blue
        g.save(); g.translate(x, y); g.scale(1, 0.075);
        const bl = g.createRadialGradient(0, 0, 0, 0, 0, 1600);
        bl.addColorStop(0, `rgba(185,210,255,${(a * 0.8).toFixed(3)})`); bl.addColorStop(0.35, `rgba(140,180,255,${(a * 0.3).toFixed(3)})`); bl.addColorStop(1, 'rgba(140,180,255,0)');
        g.fillStyle = bl; g.fillRect(-1600, -1600, 3200, 3200); g.restore();
        // core line 8 px, white -> transparent (long tail behind the sweep)
        for (const [hh, k] of [[8, 0.55], [3, 1]]) {
          const lg = g.createLinearGradient(x - 1500, 0, x + 500, 0);
          lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.72, `rgba(255,255,255,${(a * k).toFixed(3)})`); lg.addColorStop(0.8, `rgba(255,255,255,${(a * k).toFixed(3)})`); lg.addColorStop(1, 'rgba(255,255,255,0)');
          g.fillStyle = lg; g.fillRect(x - 1500, y - hh / 2, 2000, hh);
        }
        g.restore();
      }

      // ---- airport dymo labels ----
      const tj = C.jitter('A-dt', f, 0.8, 0.4), oj = C.jitter('A-do', f, 0.8, 0.4);
      if (tpe.visible && f < K.tpeOut + 3) {
        // clear of the plane while it climbs out of TPE
        const away = head ? Math.hypot(head.x - tpe.x, head.y - tpe.y) : 999;
        const push = 34 * (1 - cl01((away - 60) / 60));
        C.place(this.dTPE, { x: tpe.x + 22 + push, y: tpe.y + 14, rotate: -3 }, C.snapInAt(f, K.jet, { dur: 4 }), flick(f, K.tpeOut, 20, -10, 5), tj);
      } else C.place(this.dTPE, {}, { visible: false });
      if (osl.visible && f >= K.oslIn && f < K.clearUI + 3) {
        // anchored by its bottom-right corner, up-left of the dot
        C.place(this.dOSL, { x: osl.x - 18 - 86, y: osl.y - 16 - 46, rotate: 3 }, C.snapInAt(f, K.oslIn, { dur: 4 }), flick(f, K.clearUI, -20, -20, 5), oj);
      } else C.place(this.dOSL, {}, { visible: false });

      // ---- distance counter card (ticks on flight_ticks, final 約 8,700 km on f166) ----
      if (f < K.clearUI + 3) {
        let lastTick = null; for (const t of TICKS) if (t <= f) lastTick = t;
        const val = Math.min(this.distTo, lastTick === null ? 0 : Math.round(this.distTo * planeP(lastTick) / 10) * 10);
        const key = String(val);
        if (this._numKey !== key) {
          this._numKey = key;
          const d = String(val).padStart(4, '0'), chars = [d[0], ',', d[1], d[2], d[3]];
          let lead = 0; while (lead < 3 && d[lead] === '0') lead++;         // index of the first significant digit
          const ghost = [lead > 0, lead > 0, lead > 1, lead > 2, false];
          chars.forEach((ch, i) => { this.cells[i].textContent = ch; this.cells[i].style.color = ghost[i] ? 'rgba(186,12,47,0.07)' : ''; });
        }
        const tickBump = TICKS.includes(f) ? { scale: 1.012 } : null;
        const land = f >= K.land ? { scale: 1 + 0.045 * C.settle(prog(f, K.land, 6)) } : null;
        const cin = C.snapInAt(f, K.tickA, { dur: 4, from: 1.1, rot0: -3 });
        const cout = flick(f, K.clearUI, 40, -24, -6);
        C.place(this.card, { rotate: -1.6 }, cin, cout, tickBump, land, C.jitter('A-card', f, 1.3, 0.3));
        const cg = this.ccg; cg.clearRect(0, 0, this.CARD.w, this.CARD.h);
        if (f >= K.land - 1) C.marker.highlight(cg, { x: 108, y: 110, w: 330, h: 96, seed: 'A-chl', progress: E.outCubic(prog(f, K.land - 1, 5)), color: YEL, composite: 'source-over', alpha: 1.6 });
        // stamp impact exactly on f166 (stampFx hits at p=.35): top-right corner, partly off the ticket's torn top edge
        C.drawStamp(cg, this.stamp, this.CARD.w - 78, 40, C.progRaw(f, K.land - 2, 5.7), { rot: -14, scale: 0.3, composite: 'source-over' });
      } else C.place(this.card, {}, { visible: false });

      // ---- push-in energy: speed lines + cloud wisps + exposure bloom ----
      if (f >= 176 && f <= 216) this.drawSpeed(f, gf, X);
      if (f >= 188 && f <= 206) this.drawClouds(f, gf, X);
      if (f === K.bloom || f === K.bloom + 1) {
        const [fx, fy] = foe(X, gf), a = f === K.bloom ? 1 : 0.35;
        const bl = g.createRadialGradient(fx, fy, 0, fx, fy, 1300);
        bl.addColorStop(0, `rgba(255,255,255,${(0.16 * a).toFixed(3)})`); bl.addColorStop(1, `rgba(255,255,255,${(0.06 * a).toFixed(3)})`);
        g.save(); g.globalCompositeOperation = 'screen'; g.fillStyle = bl; g.fillRect(0, 0, W, H); g.restore();
      }

      // ---- Norway readout: crosshair pops as the drawing spark passes Oslo (f212), leader out to the North Sea ----
      if (f >= K.borderOslo && f <= 223) {
        const a = prog(f, K.borderOslo, 2);
        const r = 8 + 6 * (1 - E.outCubic(prog(f, K.borderOslo, 6)));
        g.save(); g.globalAlpha = a; g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.shadowColor = 'rgba(0,0,0,.65)'; g.shadowBlur = 4;
        g.beginPath(); g.arc(osl.x, osl.y, r, 0, TAU); g.stroke();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.beginPath(); g.moveTo(osl.x + dx * (r + 3), osl.y + dy * (r + 3)); g.lineTo(osl.x + dx * (r + 10), osl.y + dy * (r + 10)); g.stroke(); }
        g.fillStyle = RED; g.beginPath(); g.arc(osl.x, osl.y, 3.4, 0, TAU); g.fill();
        // 2-segment leader: short diagonal up-left, then horizontal out over the sea (left of the west coast)
        const s0 = { x: osl.x - (r + 3) * 0.707, y: osl.y - (r + 3) * 0.707 };
        const e1 = { x: osl.x - 44, y: osl.y - 44 }, e2 = { x: osl.x - 262, y: osl.y - 44 };
        const L1 = Math.hypot(e1.x - s0.x, e1.y - s0.y), L2 = e1.x - e2.x;
        const lp = E.outCubic(prog(f, K.borderOslo, 3)) * (L1 + L2);
        g.lineWidth = 2; g.beginPath(); g.moveTo(s0.x, s0.y);
        if (lp <= L1) g.lineTo(lerp(s0.x, e1.x, lp / L1), lerp(s0.y, e1.y, lp / L1));
        else { g.lineTo(e1.x, e1.y); g.lineTo(e1.x - (lp - L1), e1.y); }
        g.stroke();
        if (lp >= L1 + L2 - 0.5) { g.fillStyle = '#fff'; g.beginPath(); g.arc(e2.x, e2.y, 3.2, 0, TAU); g.fill(); }
        g.restore();
        // readout box: right edge at the leader end, vertically centred on it
        const ty = C.typewriterAt(this.roText, f, K.borderOslo + 1, K.borderOslo + 6);
        if (this._roT !== ty.text) { this.roTxtSpan.textContent = ty.text; this._roT = ty.text; }
        this.roCursor.style.visibility = !ty.done || (f >= K.dropout && f % 4 < 2) || (f < K.dropout && f % 6 < 3) ? 'visible' : 'hidden';
        C.place(this.readout, { x: e2.x - 12 - this.roW, y: e2.y - 40 }, C.snapInAt(f, K.borderOslo + 1, { dur: 3, from: 1.12, rot0: 0 }), C.jitter('A-ro', f, 0.6, 0.2));
      } else C.place(this.readout, {}, { visible: false });
    },

    drawSpeed(f, gf, X) {
      const C = this.C, g = this.g;
      const r0 = globeR(X, gf), r1 = globeR(X, gf + 1), rate = r1 / r0 - 1;
      const k = cl01((rate - 0.008) / 0.04) * (1 - prog(f, 211, 6));
      if (k <= 0.01) return;
      const [cx, cy] = foe(X, gf);
      const build = 0.35 + 0.65 * prog(f, 184, 16);              // count rises f184 -> 200 with the reverse cymbal
      g.save(); g.fillStyle = '#fff';
      const n = 56;
      for (let i = 0; i < n; i++) {
        if (C.rand('A-sl-on', i, f) > build * (0.4 + 0.6 * k)) continue;
        const ang = C.rand('A-sl-a', i) * TAU + C.srand('A-sl-j', i, f) * 0.03;
        const rr = lerp(420, 1150, C.rand('A-sl-r', i, f));
        const len = (160 + 460 * C.rand('A-sl-l', i, f)) * (0.5 + 0.5 * k) * (rr / 800);
        const w = (2 + 2 * C.rand('A-sl-w', i, f)) * (0.7 + 0.3 * k);
        g.globalAlpha = (0.3 + 0.15 * C.rand('A-sl-o', i, f)) * k;
        g.beginPath(); tri(g, cx, cy, ang, rr, len, w); g.fill();
      }
      g.restore();
    },

    drawClouds(f, gf, X) {
      const cg = this.cg, imgs = this.clouds;
      const [fx, fy] = foe(X, gf);
      // [img, start, dur, angle(deg), offset(px at s0), s0, s1, alpha, rot(deg)]
      const WISP = [
        [2, 188, 10, 205, 430, 0.8, 3.0, 0.62, -6], [0, 189, 10, 30, 460, 0.8, 3.2, 0.62, 10],
        [1, 191, 9, 135, 430, 0.9, 3.4, 0.58, -12], [0, 193, 7, 200, 300, 1.4, 5.2, 0.6, 4],
        [3, 193, 8, 320, 440, 0.9, 3.4, 0.6, 5], [4, 195, 8, 80, 500, 0.9, 3.4, 0.55, -3],
        [1, 196, 7, 255, 540, 1.0, 3.4, 0.5, 12], [2, 198, 7, 355, 580, 1.0, 3.2, 0.45, -5],
      ];
      // trailing copies (smaller = where the wisp was a moment ago) -> radial streak toward the focus
      const TRAIL = [[1, 1], [0.92, 0.5], [0.85, 0.25]];
      for (const [ii, s, d, angD, off, s0, s1, amax, rot] of WISP) {
        if (f < s || f >= s + d || !imgs[ii]) continue;
        const t = (f - s) / d;
        const a0 = amax * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * (1 - Math.max(0, t - 0.75) * 2);
        if (a0 <= 0.01) continue;
        for (let j = TRAIL.length - 1; j >= 0; j--) {
          const [ks, ka] = TRAIL[j];
          const sc = s0 * Math.pow(s1 / s0, t) * ks;
          const ang = angD * Math.PI / 180, dist = off * Math.pow(sc / s0, 1.05);
          const x = fx + Math.cos(ang) * dist, y = fy + Math.sin(ang) * dist;
          const im = imgs[ii], w = im.width * sc, h = im.height * sc;
          cg.save(); cg.globalAlpha = Math.min(1, a0 * ka);
          cg.translate(x, y); cg.rotate(rot * Math.PI / 180);
          cg.drawImage(im, -w / 2, -h / 2, w, h);
          cg.restore();
        }
      }
    },

    // ---------------------------------------------------------------- Norway border (f200–279)
    // draw-on from Lindesnes up the west coast: visible on f200, spark passes Oslo on f212, closed on f216
    borderProgress(f) {
      if (f < K.border) return -1;
      if (f >= K.borderEnd) return 1;
      const so = this.sOslo;
      if (f <= K.borderOslo) { const u = (f - K.border + 1) / (K.borderOslo - K.border + 1); return so * (0.5 * u + 0.5 * E.outQuad(u)); }
      return so + (1 - so) * E.outCubic((f - K.borderOslo) / (K.borderEnd - K.borderOslo));
    },
    drawBorder(f, gf, X, P) {
      const pr = this.borderProgress(f);
      if (pr < 0) return;
      const g = this.g, ring = this.ring, L = this.ringLen, total = L[L.length - 1];
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
      const post = f >= K.drop;                                  // S3 background: slightly thinner, crisp, no bloom
      // spotlight: once the outline is closed, the rest of the map dims slightly (settles into the drop)
      const dim = post ? POST.dim : POST.dim * E.outCubic(prog(f, K.borderEnd - 1, 5));
      if (pr >= 1) dimOutside(g, pts, dim);
      const hold = f >= K.dropout && f < K.drop ? E.inCubic(prog(f, K.dropout - 1, 4)) : 0;
      strokeBorder(g, pts, pr >= 1, post ? { wW: POST.wW, wR: POST.wR, glow: 0 } : { wW: 9, wR: 6, glow: hold });
      // islands (thin red), fade in once the outline is closed
      strokeIslands(g, this.islands, P, post ? 1 : prog(f, K.borderEnd - 2, 5), post ? POST.isl : 2.2);
      // start flash ring at Lindesnes (f200–201)
      if (f <= K.border + 1) {
        const p0 = pts[0], k = f - K.border;
        g.save(); g.strokeStyle = `rgba(255,255,255,${k ? 0.45 : 0.95})`; g.lineWidth = k ? 2.5 : 4;
        g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 14;
        g.beginPath(); g.arc(p0.x, p0.y, k ? 58 : 34, 0, TAU); g.stroke(); g.restore();
      }
      // drawing head: spark
      if (pr < 1) {
        const h = pts[pts.length - 1];
        g.save();
        const rg = g.createRadialGradient(h.x, h.y, 0, h.x, h.y, 38);
        rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,225,230,0.8)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = rg; g.fillRect(h.x - 38, h.y - 38, 76, 76);
        g.fillStyle = '#fff'; g.beginPath(); g.arc(h.x, h.y, 5.5, 0, TAU); g.fill();
        g.restore();
      }
    },
  });
})();
