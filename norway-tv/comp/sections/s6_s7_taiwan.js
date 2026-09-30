/* S6 TW_BUILD (f560–671) + S7 TW_REVEAL (f672–783): how many Taiwanese live in Norway.
 * Owner: C-taiwan. Full frame, z 30. No generated assets (everything is kit / geo / globe plate + canvas).
 *
 *   S6  f560  breakdown: dark desk under a lamp that flickers on (downlifter). The question
 *             「那麼……在挪威的台灣人有多少？」 (copy.tw_question) is typed glyph by glyph on the exact typewriter cue
 *             frames (audio/cues.json, glyph 1..15); close-up on line 1, re-frame to the whole of line 2 on the
 *             line feed (f571); the carriage creeps left per keystroke and returns on the bell (f600).
 *             The lamp pool follows the typed line; soft-focus desk props (a real Sentinel-2 map print, a NOK token)
 *             sit in the lower third with parallax; the sheet is taped down.
 *             Every heartbeat (lub on the cue frame + dub on dub_frame) thumps the camera, the lamp and a red edge pulse.
 *       f600  bell: 台灣人 highlighter sweep; camera pulls back as the TPE → OSL boarding pass slides in (f603), tape f607.
 *       f616  riser: globe callback print (real globe plate f0140, TPE→OSL great-circle arc via COMP.project) slides in,
 *             arc draws f619–640; OSL arrival stamp thunks on the pass on the f630 heartbeat; red ring round 台灣人 f644.
 *             Accelerating push into 台灣人 (to 3× at f663) with a closing spotlight iris (f644–663, pulsing on the
 *             heartbeats), growing tremble, unstable-bulb flicker and radial streaks in the last frames.
 *       f664  DEAD SILENCE: hard cut to black, a lone blinking red caret (never fully off).
 *   S7  f672  REVEAL (biggest hit): radial flash + shake; the ROC flag sticker (kit SVG) slaps on ON the hit;
 *             「約 N 人」 is a 3-slot odometer (ghost zeros) that changes on every count_tick f672–699 (12 on the hit,
 *             399 on f699) and lands on 400 on the ding f700, then stays. Slow push, ROC bump on every hundred.
 *             Footnote + footnote_2 are visible on every S7 frame.
 *       f700  ding: hero hold of 「約 400 人」 f700–707 (punch, starbursts, bubbles popping on 702/704/706, ROC bump 704);
 *             f708–712 the plate glides to the top-left while a torn newsprint sheet with exactly 14,000 printed dots
 *             (1 dot = 1 resident, 200×70) rises; ratio clipping 「平均每 1.4 萬位挪威居民 / 才 1 位台灣人」 snaps in on
 *             pop 710; dot bands print on pops 712–722; ONE dot lights up on pop 724 (the rest dim), ring pulses
 *             724/728/732, marker ring 726, arrow 726–731, 「1」 bump 730, glint 738.
 *       f731  the HUD label pops out (so it never collides with the zooming plate), back in on f745.
 *       f734  crash zoom into that dot (vector dots, speed lines); f741 its gold disc sits where the badge will land.
 *       f742  punchline on the beat 「在挪威遇到台灣人 → 稀有度 ★★★★★」: the dot is now a gold die-cut badge with a
 *             halftone "the one" silhouette; black strip f745 (gold stars on black, never yellow stars on red),
 *             stars pop 747–755, ROC mini flag sticks onto the badge f749, SSR stamp (Collage.makeStamp('ssr')) thunks
 *             on the beat f756, underline 763, bump 770.
 * All wording/numbers come from facts.json (onscreen.* / copy.*). render(f) is a pure function of f.
 */
(function () {
  const W = 1920, H = 1080;
  const RED = '#BA0C2F', NAVY = '#00205B', CREAM = '#F1E9D8', INK = '#141414', YEL = '#FFE14D';
  const DOTINK = '#10275c';
  const TPE = [25.033, 121.5654], OSL = [59.9111, 10.7528];
  const K6 = { start: 560, bell: 600, pass: 603, passTape: 607, riser: 616, print: 616, printTape: 618, arcA: 619, arcB: 640, stamp: 630, ring: 644, iris: 644, streak: 655, silence: 664, end: 671 };
  const K7 = {
    hit: 672, dymo: 674, tag: 678, ding: 700, rocBump: 704, bubbles: [700, 702, 704, 706],
    glideA: 708, glideB: 712, sheetIn: 708, ratio: 710, lit: 724, rings: [724, 728, 732], markRing: 726, arrowA: 726, one: 730,
    glint: 738, zoomA: 734, zoomB: 741, dymoOut: 731, punch: 742, stripB: 745, dymoIn: 745, stars: [747, 749, 751, 753, 755],
    rocMini: 749, ssr: 756, underline: 763, bump2: 770, end: 783,
  };

  const cl01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const prog = (f, a, d) => cl01((f - a) / d);
  const E = {
    outCubic: t => 1 - Math.pow(1 - t, 3), inCubic: t => t * t * t, outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2), inQuad: t => t * t,
    outBack: (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
    inOutSine: t => 0.5 - 0.5 * Math.cos(Math.PI * t),
  };
  const px = v => v.toFixed(2) + 'px';
  const TAU = Math.PI * 2;
  // footnote markup: Space Mono, CJK runs in Noto Sans TC (.footnote .zh)
  const footHtml = t => t.replace(/([…　-鿿＀-￯]+)/g, '<span class="zh">$1</span>');

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
  function img(parent, src, style = {}) {
    const e = document.createElement('img');
    e.src = src; e.decoding = 'sync';
    Object.assign(e.style, { position: 'absolute' }, style);
    parent.appendChild(e);
    return e;
  }
  // torn paper plate (DOM) -> returns the torn-wrap (animate that); inner = the paper div
  function tornDiv(C, parent, o, html) {
    const d = div(parent, 'paper ' + (o.cls || ''), Object.assign({ left: o.x + 'px', top: o.y + 'px', width: o.w + 'px', height: o.h + 'px' }, o.style || {}), html);
    d.setAttribute('data-torn-done', '1');
    const wrap = C.tornPaper(d, { seed: o.seed, edges: o.edges || 'tb', rim: o.rim ?? 7, roughness: o.rough ?? 1, width: o.w, height: o.h, bite: o.bite ?? 1 });
    wrap.inner = d;
    wrap.style.visibility = 'hidden';
    return wrap;
  }
  function measure(C, kind, size, text, weight) {
    const g = measure.g || (measure.g = C.canvas(8, 8).getContext('2d'));
    g.font = C.font(kind, size, weight);
    return g.measureText(text).width;
  }
  function metrics(C, kind, size, text, weight) {
    const g = measure.g || (measure.g = C.canvas(8, 8).getContext('2d'));
    g.font = C.font(kind, size, weight);
    return g.measureText(text);
  }
  // impact that lands ON frame t (element already full size on t): overshoot -> squash -> settle
  function hitAt(f, t, o = {}) {
    const k = f - t;
    if (k < 0) return { visible: false, opacity: 0 };
    const S = o.seq || [1.22, 0.95, 1.025, 0.995, 1];
    return { scale: S[Math.min(k, S.length - 1)], rotate: (o.rot0 || 0) * Math.max(0, 1 - k / 3), x: (o.dx || 0) * Math.max(0, 1 - k / 3), y: (o.dy || 0) * Math.max(0, 1 - k / 3) };
  }
  function bump(f, t, amp = 0.03) {
    const k = f - t;
    if (k < 0 || k > 3) return null;
    return { scale: 1 + amp * [1, 0.45, 0.15, 0][k] };
  }
  // combined transform of C.place(base, ...mods) (same maths), so canvas overlays can follow a DOM element
  function combine(base, ...mods) {
    let x = base.x || 0, y = base.y || 0, r = base.rotate || 0, s = base.scale ?? 1, vis = true;
    for (const m of mods) { if (!m) continue; x += m.x || 0; y += m.y || 0; r += (m.rotate ?? m.r ?? 0); s *= m.scale ?? 1; if (m.visible === false) vis = false; }
    return { x, y, r, s, vis };
  }
  // element-local point -> parent coords for an element at (L,T) size (w,h), transform-origin 50% 50%, transform T
  function mapPt(box, T, lx, ly) {
    const ox = box.w / 2, oy = box.h / 2, a = T.r * Math.PI / 180, c = Math.cos(a) * T.s, s = Math.sin(a) * T.s;
    const dx = lx - ox, dy = ly - oy;
    return { x: box.x + ox + T.x + c * dx - s * dy, y: box.y + oy + T.y + s * dx + c * dy };
  }
  const flashAt = (f, t, seq) => (f >= t && f - t < seq.length ? seq[f - t] : 0);
  function show(el, on) { el.style.visibility = on ? 'visible' : 'hidden'; }
  // containers: children may carry visibility:visible (C.place), so hide the whole subtree with display
  function showBox(el, on) { el.style.display = on ? '' : 'none'; }

  // 4-point sparkle glint
  function sparkle(g, x, y, r, a, col = '#FFFFFF') {
    if (a <= 0.01 || r <= 0.5) return;
    g.save(); g.globalAlpha = a; g.fillStyle = col; g.translate(x, y);
    g.beginPath();
    g.moveTo(0, -r); g.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0); g.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
    g.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0); g.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
    g.fill(); g.restore();
  }

  // ======================================================================================= S6 TW_BUILD
  COMP.section({
    id: 's6-tw-build', start: 560, end: 671, z: 30,

    async init(root, X) {
      const C = X.C;
      const copy = X.facts.copy;
      this.q = copy.tw_question;                                   // 那麼……在挪威的台灣人有多少？
      const G = C.graphemes(this.q);
      // exact per-glyph frames from the cue sheet
      const tw = X.cues.sfx.filter(s => s.name === 'typewriter').sort((a, b) => a.glyph - b.glyph).map(s => s.frame);
      this.typeF = tw.length === G.length ? tw : C.typeSchedule(this.q, 560, 600).map(s => s.frame);
      this.hb = X.cues.sfx.filter(s => s.name === 'heartbeat').map(s => ({ f: s.frame, d: s.dub_frame }));
      const bellCue = X.cues.sfx.find(s => s.name === 'typewriter_bell');
      this.bell = bellCue ? bellCue.frame : K6.bell;

      root.style.background = '#07090f';
      // ---------------------------------------------------------------- background desk + lamp (the pool follows the typed line)
      this.bg = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: `#141a28 url(${C.asset('textures/paper_cream.jpg')})`, backgroundSize: '768px 768px', backgroundBlendMode: 'multiply' });
      this.lamp = div(root, '', { left: -W / 2 + 'px', top: -H / 2 + 'px', width: 2 * W + 'px', height: 2 * H + 'px', background: 'radial-gradient(ellipse 27% 31% at 50% 50%, rgba(255,214,158,0.48) 0%, rgba(255,198,138,0.2) 40%, rgba(255,190,130,0.05) 66%, rgba(255,190,130,0) 82%)' });
      this.corner = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: 'radial-gradient(ellipse 80% 85% at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' });
      this.motes = cv(root, W, H);
      this.moteG = this.motes.getContext('2d');

      // ---------------------------------------------------------------- camera
      this.cam = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '0 0' });

      // desk props (under everything in the camera; soft focus, dimmed = outside the lamp's hot spot)
      this.props = div(this.cam, '', { left: '0', top: '0', width: W + 'px', height: H + 'px' });
      try {
        const sc = await X.image('../assets/geo/scandinavia_wide_lowres.jpg');
        // southern Norway (lon 3.5–13.5°E, lat 57.8–62.8°N), equirectangular -> x squeezed by cos(60°)
        const x0 = (3.5 + 9) / 0.012, x1 = (13.5 + 9) / 0.012, y0 = (72.5 - 62.8) / 0.012, y1 = (72.5 - 57.8) / 0.012;
        const MW = 600, MH = 600, mc = C.canvas(MW, MH), mg = mc.getContext('2d');
        mg.drawImage(sc, x0, y0, x1 - x0, y1 - y0, 0, 0, MW, MH);
        mg.globalCompositeOperation = 'soft-light'; mg.fillStyle = 'rgba(255,220,170,0.35)'; mg.fillRect(0, 0, MW, MH);
        mg.globalCompositeOperation = 'source-over';
        // map fold lines
        mg.strokeStyle = 'rgba(255,255,255,0.18)'; mg.lineWidth = 2; mg.beginPath(); mg.moveTo(MW / 2, 0); mg.lineTo(MW / 2, MH); mg.moveTo(0, MH / 2); mg.lineTo(MW, MH / 2); mg.stroke();
        mg.strokeStyle = 'rgba(0,0,0,0.25)'; mg.lineWidth = 3; mg.beginPath(); mg.moveTo(MW / 2 + 3, 0); mg.lineTo(MW / 2 + 3, MH); mg.moveTo(0, MH / 2 + 3); mg.lineTo(MW, MH / 2 + 3); mg.stroke();
        const torn = C.tornPaper(mc, { seed: 'C-map', edges: 'all', rim: 6, roughness: 0.8, pad: 40, fit: 'stretch' });
        const soft = C.canvas(torn.width, torn.height), sg = soft.getContext('2d');
        sg.filter = 'blur(2.2px)'; sg.drawImage(torn, 0, 0); sg.filter = 'none';
        sg.globalCompositeOperation = 'source-atop'; sg.fillStyle = 'rgba(6,8,14,0.5)'; sg.fillRect(0, 0, soft.width, soft.height);
        Object.assign(soft.style, { position: 'absolute', left: '-70px', top: '530px', transformOrigin: '50% 50%' });
        this.props.appendChild(soft); this.mapProp = soft;
      } catch (e) { this.mapProp = null; }
      try {
        const coin = await X.image(C.asset('svg/coin_nok.svg'));
        const CW = 210, CH = Math.round(210 * 420 / 400), pad = 30;
        const cc = C.canvas(CW + pad * 2, CH + pad * 2), g2 = cc.getContext('2d');
        g2.filter = 'blur(2.6px)'; g2.shadowColor = 'rgba(0,0,0,0.6)'; g2.shadowBlur = 16; g2.shadowOffsetY = 8;
        g2.drawImage(coin, pad, pad, CW, CH); g2.filter = 'none'; g2.shadowColor = 'transparent';
        g2.globalCompositeOperation = 'source-atop'; g2.fillStyle = 'rgba(6,8,14,0.42)'; g2.fillRect(0, 0, cc.width, cc.height);
        Object.assign(cc.style, { position: 'absolute', left: '1440px', top: '560px', transformOrigin: '50% 50%' });
        this.props.appendChild(cc); this.coinProp = cc;
      } catch (e) { this.coinProp = null; }

      // question sheet (typewriter paper), taped to the desk
      const SW = 1640, SH = 390, SX = 140, SY = 96;
      this.S = { x: SX, y: SY, w: SW, h: SH };
      this.sheet = tornDiv(C, this.cam, { x: SX, y: SY, w: SW, h: SH, seed: 'C-sheet', edges: 'tb', rim: 7, cls: 'crumple crumple--light' });
      this.sheetTapes = [
        div(this.sheet, 'tape tape--white tape--sm', { left: '-58px', top: '-6px', transform: 'rotate(-33deg)', opacity: 0.92 }),
        div(this.sheet, 'tape tape--white tape--sm', { right: '-54px', top: '-2px', transform: 'rotate(31deg)', opacity: 0.92 }),
      ];
      this.hl = cv(this.sheet.inner, SW, SH, { zIndex: 1, mixBlendMode: 'multiply' });
      this.hlg = this.hl.getContext('2d');
      const txt = div(this.sheet.inner, '', { left: '0', top: '0', width: SW + 'px', height: SH + 'px', zIndex: 2 });
      this.mk = cv(this.sheet.inner, SW, SH, { zIndex: 3 });
      this.mkg = this.mk.getContext('2d');
      // layout: line 1 = 那麼……, line 2 = 在挪威的台灣人有多少？
      const L1 = 4, S1 = 84, S2 = 132;
      const w2 = G.slice(L1).reduce((a, ch) => a + measure(C, 'serif', S2, ch), 0);
      const x0 = Math.round((SW - w2) / 2);
      const top1 = 62, top2 = 62 + S1 + 44;
      this.glyphs = [];
      let cx = x0;
      G.forEach((ch, i) => {
        const line2 = i >= L1;
        if (i === L1) cx = x0;
        const size = line2 ? S2 : S1;
        const w = measure(C, 'serif', size, ch);
        const e = div(txt, 'f-serif', { left: px(cx), top: px(line2 ? top2 : top1), fontSize: size + 'px', lineHeight: '1', color: INK, transformOrigin: '50% 70%', visibility: 'hidden', textShadow: '1.2px 0.6px 0 rgba(20,20,20,.28)' }, ch);
        // typewriter imperfections: fixed per glyph (baseline, tilt, ink). U+2026 in Noto Serif TC is already the
        // vertically centred Taiwan form, so it gets no extra offset.
        e.base = { x: C.srand('C-gx', i) * 1.2, y: C.srand('C-gy', i) * 2.6, r: C.srand('C-gr', i) * 1.1, op: 0.84 + 0.16 * C.rand('C-go', i) };
        e.cx = cx; e.w = w; e.top = line2 ? top2 : top1; e.size = size;
        this.glyphs.push(e);
        cx += w;
      });
      // 台灣人 = glyph 8..10
      const g8 = this.glyphs[8], g10 = this.glyphs[10];
      this.hlBox = { x: g8.cx - 14, y: top2 + S2 * 0.2, w: g10.cx + g10.w - g8.cx + 28, h: S2 * 0.78 };
      this.target = { x: SX + (g8.cx + g10.cx + g10.w) / 2, y: SY + top2 + S2 * 0.55 };
      // typing camera: close-up on line 1, then the whole of line 2 (centred, inside title-safe)
      const g3 = this.glyphs[3];
      this.camQ = { x1: SX + (this.glyphs[0].cx + g3.cx + g3.w) / 2 + 40, y1: SY + top1 + S1 * 0.6, x2: SX + x0 + w2 / 2 - 30, y2: SY + top2 + S2 * 0.52 };
      this.caret = div(txt, '', { left: '0', top: '0', width: '10px', height: '10px', background: RED, visibility: 'hidden' });

      // boarding pass (generic kit pass, TPE → OSL from copy.*). Prop fields: the kit's "30 sec" puns, gate '30' (not 'N0')
      const [codeA, codeB] = copy.boarding_pass.split(/\s*→\s*/);
      const [cityA, cityB] = copy.boarding_pass_cities.split(/\s*→\s*/);
      const bpSrc = C.boardingPass({ from: codeA, to: codeB, fromCity: cityA, toCity: cityB, gate: '30', seed: 'C-bp' });
      const BS = 0.6;
      const bp = C.canvas(Math.round(bpSrc.width * BS), Math.round(bpSrc.height * BS));
      { const g = bp.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bpSrc, 0, 0, bp.width, bp.height); }
      this.pass = div(this.cam, '', { left: '120px', top: '566px', width: bp.width + 'px', height: bp.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      this.pass.appendChild(bp); bp.style.position = 'absolute'; bp.style.left = '0'; bp.style.top = '0';
      this.passStamp = cv(this.pass, bp.width, bp.height, { mixBlendMode: 'multiply' });
      this.psg = this.passStamp.getContext('2d');
      this.stampC = C.makeStamp({ shape: 'circle', w: 330, h: 330, color: RED, top: 'OSLO', bottom: 'NORGE', center: [{ text: codeB, font: 'anton', size: 110, y: 0.5 }], stars: true, seed: 'C-osl' });
      // arrival stamp on the main panel, over the city line / seat–gate fields under the big 'OSL' (not on the stub)
      this.stampPos = { x: 990 * BS, y: 462 * BS };
      this.passTapes = [
        div(this.pass, 'tape tape--white', { left: '-66px', top: '-8px', transformOrigin: '50% 50%' }),
        div(this.pass, 'tape tape--white', { right: '-60px', top: '-4px', transformOrigin: '50% 50%' }),
      ];
      this.passTapes.forEach(t => { t.style.visibility = 'hidden'; });

      // globe callback print: real globe plate + flight arc projected with COMP.project
      let gf = [140, 142, 138, 144, 136].find(i => X.exists(X.SEQ.globe(i)));
      this.gf = gf;
      const PS = 470, pad = 40;
      const content = C.canvas(PS, PS), cg = content.getContext('2d');
      let gimg = null;
      if (gf !== undefined) { try { gimg = await X.image(X.SEQ.globe(gf)); } catch (e) { gimg = null; } }
      const ctr = gimg ? X.project(gf, 0, 0, -1) : { x: 960, y: 540 };
      const CROP = 1010, k = PS / CROP;
      const cx0 = ctr.x - CROP / 2 + 10, cy0 = ctr.y - CROP / 2 + 10;
      if (gimg) {
        cg.fillStyle = '#03050a'; cg.fillRect(0, 0, PS, PS);
        cg.drawImage(gimg, cx0, cy0, CROP, CROP, 0, 0, PS, PS);
        // photo-print grade: lift blacks a touch, warm
        cg.globalCompositeOperation = 'soft-light'; cg.fillStyle = 'rgba(255,214,160,0.35)'; cg.fillRect(0, 0, PS, PS);
        cg.globalCompositeOperation = 'source-over'; cg.fillStyle = 'rgba(30,24,40,0.10)'; cg.fillRect(0, 0, PS, PS);
      } else {
        cg.fillStyle = '#0b1a3a'; cg.fillRect(0, 0, PS, PS);
      }
      this.printCv = C.tornPaper(content, { seed: 'C-print', edges: 'all', rim: 8, roughness: 0.9, pad, fit: 'stretch' });
      this.print = div(this.cam, '', { left: (1290 - pad) + 'px', top: (520 - pad) + 'px', width: this.printCv.width + 'px', height: this.printCv.height + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      this.print.appendChild(this.printCv); this.printCv.style.position = 'absolute';
      this.arcCv = cv(this.print, this.printCv.width, this.printCv.height);
      this.arcG = this.arcCv.getContext('2d');
      this.printTape = div(this.print, 'tape tape--beige', { left: (pad + PS / 2 - 130) + 'px', top: (pad - 34) + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      // arc points in print coords (higher arc than S2 so the curve reads on a small print)
      const toP = (p) => ({ x: (p.x - cx0) * k + pad, y: (p.y - cy0) * k + pad, v: p.visible });
      this.arc = [];
      if (gimg) {
        for (let i = 0; i <= 90; i++) {
          const t = i / 90, ll = X.gcPoint(TPE[0], TPE[1], OSL[0], OSL[1], t);
          this.arc.push(toP(X.project(gf, ll[0], ll[1], 0.4 * Math.sin(Math.PI * t))));
        }
        this.pTPE = toP(X.project(gf, TPE[0], TPE[1], 0));
        this.pOSL = toP(X.project(gf, OSL[0], OSL[1], 0));
      }
      this.codes = [codeA, codeB];
      this.printInner = this.printCv.path.inner;
      this.pad = pad;

      // ---------------------------------------------------------------- overlays (outside the camera)
      this.iris = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', opacity: 0, pointerEvents: 'none' });
      this.streaks = cv(root, W, H);
      this.streakG = this.streaks.getContext('2d');
      this.pulseV = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: 'radial-gradient(ellipse 75% 80% at 50% 45%, rgba(90,0,14,0) 45%, rgba(70,0,12,0.75) 100%)', opacity: 0, pointerEvents: 'none' });
      this.dark = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: '#000', opacity: 0, pointerEvents: 'none' });
      // dead silence: black + lone caret (same red caret as the typing, a touch larger)
      this.silence = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: '#050608', display: 'none' });
      this.sCaret = div(this.silence, '', { left: '955px', top: '470px', width: '11px', height: '140px', background: RED, boxShadow: '0 0 18px rgba(186,12,47,0.55), 0 0 4px rgba(255,80,100,0.5)' });
    },

    // heartbeat pulse envelope (lub on the cue frame, softer dub on dub_frame); grows through the riser
    pulse(f) {
      let v = 0;
      this.hb.forEach((h, i) => {
        const amp = i < 2 ? 1 : 1 + (i - 1) * 0.35;
        const k1 = f - h.f, k2 = f - h.d;
        if (k1 >= 0 && k1 < 7) v += amp * Math.exp(-k1 / 1.5);
        if (k2 >= 0 && k2 < 6) v += 0.55 * amp * Math.exp(-k2 / 1.3);
      });
      return v;
    },

    typeCam(f) {
      const Q = this.camQ, lf = this.typeF[4];
      const t = E.outCubic(prog(f, lf, 7));
      const s1 = 1.42 + 0.03 * prog(f, 560, 11), s2 = 1.15 + 0.012 * prog(f, lf + 7, this.bell - lf - 7);
      // the typed line sits a little above centre so the page fills the frame and the desk props show below it
      return { A: { x: lerp(Q.x1, Q.x2, t), y: lerp(Q.y1, Q.y2, t) }, B: { x: 960, y: lerp(430, 505, t) }, s: lerp(s1, s2, t) };
    },

    drawMotes(C, f, lamp, L) {
      const g = this.moteG; g.clearRect(0, 0, W, H);
      for (let i = 0; i < 18; i++) {
        const x = L.x + 820 * C.fbm1(C.hash('C-mx', i), f * 0.006 + i * 3.1, 2);
        const y = L.y - 60 + 460 * C.fbm1(C.hash('C-my', i), f * 0.005 + i * 1.7, 2) - (f - 560) * (0.25 + 0.3 * C.rand('C-mv', i));
        const r = 2 + 5 * C.rand('C-mr', i);
        const a = (0.18 + 0.3 * C.rand('C-ma', i)) * Math.min(1.2, lamp) * (0.6 + 0.4 * Math.sin(f * 0.07 + i));
        const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
        gr.addColorStop(0, `rgba(255,236,200,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,236,200,0)');
        g.fillStyle = gr; g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      }
    },

    async render(f, root, X) {
      const C = X.C;
      const S = this.S;
      const silent = f >= K6.silence;
      showBox(this.silence, silent);
      if (silent) {
        // DEAD SILENCE: only the caret blinks (on 3, off 2), with a breath of drift
        const k = f - K6.silence;
        const on = [1, 1, 1, 0, 0, 1, 1, 1][k] === 1;
        const w = C.wander('C-sc', f, 1.2, 0.2);
        this.sCaret.style.opacity = on ? 1 : 0.2;                  // blink never leaves an empty frame
        this.sCaret.style.transform = `translate(${px(w.x)},${px(w.y)})`;
        showBox(this.cam, false); showBox(this.motes, false); showBox(this.streaks, false); showBox(this.iris, false);
        return;
      }
      showBox(this.cam, true); showBox(this.motes, true); showBox(this.streaks, true); showBox(this.iris, true);
      const pl = this.pulse(f);

      // ------------------------------------------------------------ camera
      // typing: framed on the sheet (slight push); bell: pull back to the desk; riser: accelerating push into 台灣人
      const sheetC = { x: S.x + S.w / 2, y: S.y + S.h / 2 };
      let A, B, s, L;                                               // L = lamp aim (camera space)
      const T = this.target;
      if (f < this.bell) {
        const c = this.typeCam(f);
        A = c.A; B = c.B; s = c.s;
        L = { x: A.x, y: A.y + 40 };
      } else if (f < K6.riser) {
        // bell: pull back from the typing close-up to the whole desk (the pass slides in)
        const c = this.typeCam(this.bell);
        const t = E.outCubic(prog(f, this.bell, 7));
        const tx0 = c.B.x - c.A.x * c.s, ty0 = c.B.y - c.A.y * c.s;
        s = lerp(c.s, 1, t) * (1 + 0.004 * prog(f, 607, 9));
        const txx = lerp(tx0, 0, t), tyy = lerp(ty0, 0, t);
        A = { x: 0, y: 0 }; B = { x: txx, y: tyy };
        L = { x: lerp(c.A.x, 960, t), y: lerp(c.A.y + 40, 520, t) };
      } else {
        const t = prog(f, K6.riser, K6.silence - 1 - K6.riser);
        const e = 0.55 * t * t + 0.45 * t * t * t * t;           // slow start, rushing at the end
        const a = cl01((f - K6.riser) / 10);
        A = { x: lerp(sheetC.x, T.x, E.outCubic(a)), y: lerp(sheetC.y, T.y, E.outCubic(a)) };
        B = { x: lerp(A.x, 960, 0.2 + 0.8 * e), y: lerp(A.y, 520, 0.2 + 0.8 * e) };
        B = { x: lerp(A.x, B.x, a), y: lerp(A.y, B.y, a) };
        s = 1.004 + 2.0 * e;                                        // ends at 3× with 台灣人 filling the frame
        L = { x: lerp(960, T.x, E.outCubic(a)), y: lerp(520, T.y, E.outCubic(a)) };
      }
      const tremble = f >= 636 ? C.jitter('C-trem', f, 0.5 + 6 * prog(f, 636, 27), 0.1 + 0.5 * prog(f, 636, 27)) : { x: 0, y: 0, r: 0 };
      const drift = C.wander('C-cam6', f, 3, 0.04);
      // heartbeat thump: scale about the frame centre on top of the camera move
      const kp = 1 + 0.011 * pl;
      let tx = B.x - A.x * s, ty = B.y - A.y * s;
      tx = 960 + (tx - 960) * kp + tremble.x + drift.x; ty = 540 + (ty - 540) * kp + tremble.y + drift.y; s *= kp;
      this.cam.style.transform = `translate(${px(tx)},${px(ty)}) rotate(${(tremble.r + drift.r).toFixed(3)}deg) scale(${s.toFixed(4)})`;
      const toScreen = (p) => ({ x: tx + p.x * s, y: ty + p.y * s });

      // desk props: slight extra parallax against the camera (closer to the lens -> move a bit more)
      {
        const par = { x: -(A.x - 930) * 0.08 * s, y: -(A.y - 355) * 0.08 * s };
        const pw = C.wander('C-props', f, 2.5, 0.03);
        if (this.mapProp) this.mapProp.style.transform = `translate(${px(par.x + pw.x)},${px(par.y + pw.y)}) rotate(-7deg)`;
        if (this.coinProp) this.coinProp.style.transform = `translate(${px(par.x * 1.2 - pw.y)},${px(par.y * 1.2 + pw.x)}) rotate(${(12 + pw.r * 8).toFixed(2)}deg)`;
      }

      // ------------------------------------------------------------ lamp + pulses + flicker
      let lamp = 1;
      const kOn = f - K6.start;
      if (kOn < 5) lamp = [1.45, 0.35, 1.2, 0.8, 1.0][kOn];
      lamp += 0.12 * pl;
      if (f >= 640) {                                            // unstable bulb during the riser
        const pr = prog(f, 640, 24);
        const r = C.rand('C-flk', f);
        if (r < 0.2 + 0.45 * pr) lamp *= 1 - (0.25 + 0.5 * C.rand('C-flk2', f)) * (0.4 + 0.6 * pr);
      }
      const Ls = toScreen(L);
      this.lamp.style.opacity = Math.max(0, Math.min(1.6, lamp)).toFixed(3);
      this.lamp.style.transform = `translate(${px(Ls.x - 960)},${px(Ls.y - 540)})`;
      this.drawMotes(C, f, lamp, Ls);
      const dk = kOn < 5 ? [0.35, 0.72, 0.1, 0.25, 0][kOn] : 0;
      const flick = f >= 640 ? Math.max(0, 1 - lamp) * 0.55 : 0;
      this.dark.style.opacity = Math.min(0.85, dk + flick + 0.12 * prog(f, 650, 14)).toFixed(3);
      this.pulseV.style.opacity = Math.min(1, 0.12 + 0.22 * pl + 0.35 * prog(f, 630, 34)).toFixed(3);

      // ------------------------------------------------------------ spotlight iris on 台灣人 (closes f644–663, breathes with the heart)
      {
        const ia = f >= K6.iris ? 0.82 * E.inOutSine(prog(f, K6.iris, 17)) : 0;
        const hb = this.hlBox, c = toScreen(T);
        const rx = s * (hb.w / 2 + 110) * (1 - 0.06 * Math.min(1.5, pl)), ry = s * (hb.h / 2 + 95) * (1 - 0.06 * Math.min(1.5, pl));
        if (ia > 0.004) {
          this.iris.style.opacity = '1';
          this.iris.style.background = `radial-gradient(ellipse ${px(rx)} ${px(ry)} at ${px(c.x)} ${px(c.y)}, rgba(3,3,6,0) 0%, rgba(3,3,6,0) 52%, rgba(3,3,6,${(ia * 0.7).toFixed(3)}) 78%, rgba(3,3,6,${Math.min(0.92, ia + 0.06 * pl).toFixed(3)}) 100%)`;
        } else this.iris.style.opacity = '0';
        // radial streaks rushing out of 台灣人 in the last frames of the push
        const sg = this.streakG; sg.clearRect(0, 0, W, H);
        const sa = prog(f, K6.streak, 8);
        if (sa > 0) {
          sg.save(); sg.lineCap = 'round';
          for (let i = 0; i < 42; i++) {
            const ang = C.rand('C-st', i) * TAU;
            const r0 = Math.max(rx, ry) * (0.55 + 0.35 * C.rand('C-st0', i, f)), len = 120 + 360 * C.rand('C-st1', i, f) * sa;
            sg.strokeStyle = `rgba(255,236,205,${(0.1 + 0.16 * sa * C.rand('C-sta', i, f)).toFixed(3)})`;
            sg.lineWidth = 1.5 + 3 * C.rand('C-stw', i);
            sg.beginPath(); sg.moveTo(c.x + Math.cos(ang) * r0, c.y + Math.sin(ang) * r0 * 0.7); sg.lineTo(c.x + Math.cos(ang) * (r0 + len), c.y + Math.sin(ang) * (r0 + len) * 0.7); sg.stroke();
          }
          sg.restore();
        }
      }

      // ------------------------------------------------------------ sheet + typing
      // carriage: paper creeps left 3 px per keystroke (1-frame kick), line feed at glyph 5, return on the bell
      let n = 0; for (const tf of this.typeF) if (f >= tf) n++;
      const lineN = n <= 4 ? n : n - 4;
      let carriage = -3 * lineN;
      const lastT = n > 0 ? this.typeF[n - 1] : -99;
      if (f === lastT) carriage -= 2;
      if (f >= this.bell) carriage = lerp(-3 * 11 - 2, 0, E.outBack(prog(f, this.bell, 5), 2.2));
      const sj = C.jitter('C-sheet', f, 1.2, 0.18);
      C.place(this.sheet, { x: carriage, rotate: -0.6 }, { x: sj.x, y: sj.y, rotate: sj.r }, bump(f, this.bell, 0.012));
      this.glyphs.forEach((e, i) => {
        const tf = this.typeF[i];
        if (f < tf) { e.style.visibility = 'hidden'; return; }
        const k = f - tf;
        const sc = k === 0 ? 1.16 : k === 1 ? 0.97 : 1;
        const b = e.base;
        e.style.visibility = 'visible';
        e.style.opacity = (k === 0 ? 1 : b.op).toFixed(3);
        e.style.transform = `translate(${px(b.x)},${px(b.y + (k === 0 ? -3 : 0))}) rotate(${b.r.toFixed(2)}deg) scale(${sc})`;
      });
      // caret after the last typed glyph (solid while typing, blinking after the bell)
      {
        const last = n > 0 ? this.glyphs[n - 1] : null;
        const cxp = last ? last.cx + last.w + 8 : this.glyphs[0].cx;
        const line = last ? last : this.glyphs[0];
        const blinkOn = f < this.bell + 2 || Math.floor((f - this.bell - 2) / 5) % 2 === 1;
        show(this.caret, blinkOn);
        Object.assign(this.caret.style, { left: px(cxp), top: px(line.top + line.size * 0.08), width: '9px', height: px(line.size * 0.92) });
      }
      // highlighter on 台灣人 (on the bell), pulses with the heart
      const hg = this.hlg; hg.clearRect(0, 0, S.w, S.h);
      if (f >= this.bell) {
        const hb = this.hlBox;
        C.marker.highlight(hg, { x: hb.x, y: hb.y, w: hb.w, h: hb.h, passes: 1, seed: 'C-hl', color: YEL, progress: E.outCubic(prog(f, this.bell, 6)), alpha: 1.62 + 0.2 * Math.min(1, pl) });
      }
      const mg = this.mkg; mg.clearRect(0, 0, S.w, S.h);
      if (f >= K6.ring) {
        const hb = this.hlBox;
        const jj = C.jitter('C-ringj', f, 1.2);
        mg.save(); mg.translate(jj.x, jj.y);
        C.marker.circle(mg, { cx: hb.x + hb.w / 2, cy: hb.y + hb.h / 2 - 4, rx: hb.w / 2 + 38, ry: hb.h / 2 + 30, rotation: -3, seed: 'C-ring', width: 9, color: RED, progress: E.outCubic(prog(f, K6.ring, 7)), frame: f, boil: 0.8 });
        mg.restore();
      }

      // ------------------------------------------------------------ boarding pass
      if (f >= K6.pass) {
        const t = prog(f, K6.pass, 6);
        const y = lerp(560, 0, E.outBack(t, 1.4));
        const pj = C.jitter('C-pass', f, 1.6);
        showBox(this.pass, true);
        C.place(this.pass, { rotate: -3.2, y }, { x: pj.x, y: pj.y, rotate: pj.r + 6 * (1 - E.outCubic(t)) }, bump(f, K6.stamp, 0.012));
        this.passTapes.forEach((tp, i) => C.place(tp, { rotate: i ? 38 : -34 }, C.snapInAt(f, K6.passTape + i, { dur: 3, from: 1.25, seed: 'C-pt' + i })));
        const g = this.psg; g.clearRect(0, 0, this.passStamp.width, this.passStamp.height);
        const sp = (f - (K6.stamp - 2)) / 5.6;
        if (sp >= 0) C.drawStamp(g, this.stampC, this.stampPos.x, this.stampPos.y, sp, { rot: -14, scale: 0.6 });
      } else showBox(this.pass, false);

      // ------------------------------------------------------------ globe callback print + flight arc
      if (f >= K6.print) {
        const pj = C.jitter('C-print', f, 1.6);
        showBox(this.print, true);
        const tp = prog(f, K6.print, 5);
        C.place(this.print, { rotate: 4.5, y: lerp(460, 0, E.outBack(tp, 1.5)), x: lerp(120, 0, E.outCubic(tp)) }, C.snapInAt(f, K6.print, { dur: 4, from: 1.08, rot0: 9 }), { x: pj.x, y: pj.y, rotate: pj.r });
        C.place(this.printTape, { rotate: -4 }, C.snapInAt(f, K6.printTape, { dur: 3, from: 1.25, seed: 'C-ptp' }));
        this.drawArc(C, f);
      } else showBox(this.print, false);
    },

    drawArc(C, f) {
      const g = this.arcG, cw = this.arcCv.width, ch = this.arcCv.height;
      g.clearRect(0, 0, cw, ch);
      if (!this.arc.length) return;
      g.save();
      C.polyPath(g, this.printInner, this.pad, this.pad); g.clip();
      const p = E.inOutCubic(prog(f, K6.arcA, K6.arcB - K6.arcA));
      const n = Math.max(1, Math.round(p * (this.arc.length - 1)));
      const pts = this.arc.slice(0, n + 1);
      // soft glow + red arc + white dashes (thick enough to read on a small print at YouTube size)
      g.lineCap = 'round'; g.lineJoin = 'round';
      const path = () => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y))); };
      path(); g.strokeStyle = 'rgba(255,255,255,0.38)'; g.lineWidth = 16; g.stroke();
      path(); g.strokeStyle = RED; g.lineWidth = 8; g.stroke();
      path(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.setLineDash([8, 12]); g.lineDashOffset = -f * 1.8; g.stroke(); g.setLineDash([]);
      // endpoints
      const dotAt = (q, on) => { if (!q || !on) return; g.fillStyle = '#fff'; g.beginPath(); g.arc(q.x, q.y, 9, 0, TAU); g.fill(); g.fillStyle = RED; g.beginPath(); g.arc(q.x, q.y, 5, 0, TAU); g.fill(); };
      dotAt(this.pTPE, true); dotAt(this.pOSL, p >= 1);
      // plane at the head
      if (p > 0 && p < 1) {
        const a = pts[pts.length - 1], b = pts[Math.max(0, pts.length - 3)];
        const hd = Math.atan2(a.x - b.x, -(a.y - b.y)) * 180 / Math.PI;
        C.drawPlane(g, a.x, a.y, hd, 46, '#fff', { outline: 3, outlineColor: RED });
      }
      // code labels
      const label = (q, text, dx, dy, bg) => {
        if (!q) return;
        g.font = C.font('mono', 24); const tw = g.measureText(text).width;
        const x = q.x + dx, y = q.y + dy;
        g.fillStyle = bg; C.roundRect(g, x, y, tw + 20, 36, 5); g.fill();
        g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillText(text, x + 10, y + 19);
      };
      label(this.pTPE, this.codes[0], 12, 10, RED);
      if (p >= 1 || f >= K6.arcB - 4) label(this.pOSL, this.codes[1], -84, 12, NAVY);
      g.restore();
    },
  });

  // ======================================================================================= S7 TW_REVEAL
  COMP.section({
    id: 's7-tw-reveal', start: 672, end: 783, z: 30,

    async init(root, X) {
      const C = X.C;
      const fx = X.facts.onscreen;
      const tw = fx.taiwanese, ratio = fx.taiwanese_ratio, punch = fx.taiwanese_punchline;
      this.countTo = tw.count_to;                                  // 400
      const ticks = X.cues.sfx.filter(s => s.name === 'count_ticks').map(s => s.frame);
      this.tickA = ticks.length ? Math.min(...ticks) : 672;
      this.tickB = ticks.length ? Math.max(...ticks) : 699;
      const ding = X.cues.sfx.find(s => s.name === 'ding' && s.frame > 672);
      this.ding = ding ? ding.frame : K7.ding;
      this.pops = X.cues.sfx.filter(s => s.name === 'bubbly_pops').map(s => s.frame).sort((a, b) => a - b);
      // hundreds crossings of the count (ROC sticker bumps)
      this.hundreds = [];
      for (let f = this.tickA + 1; f <= this.tickB; f++) if (Math.floor(this.count(f) / 100) > Math.floor(this.count(f - 1) / 100)) this.hundreds.push(f);

      root.style.background = NAVY;
      // ---------------------------------------------------------------- background: navy duotone of real Oslo (Sentinel-2)
      this.shaker = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px' });
      this.bgWrap = div(this.shaker, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', overflow: 'hidden' });
      let osloImg = null;
      try { osloImg = await X.image('../assets/geo/crops/oslo.jpg'); } catch (e) { osloImg = null; }
      if (osloImg) {
        const d = C.duotone(osloImg, { dark: '#000a26', light: '#5b82c9', contrast: 1.35, width: 2112, height: 1188, grain: 0.05 });
        this.bgImg = d; Object.assign(d.style, { position: 'absolute', left: '-96px', top: '-54px', transformOrigin: '50% 50%', opacity: 0.85 });
        this.bgWrap.appendChild(d);
      }
      div(this.bgWrap, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: `radial-gradient(ellipse 72% 72% at 50% 46%, rgba(0,32,91,0.05) 0%, rgba(0,20,60,0.32) 68%, rgba(0,10,34,0.72) 100%)` });
      this.fx = cv(this.shaker, W, H);
      this.g = this.fx.getContext('2d');

      // ---------------------------------------------------------------- camera (everything that flies away in the zoom)
      this.cam = div(this.shaker, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', transformOrigin: '0 0' });

      // dot sheet: torn newsprint, exactly 14,000 printed dots (1 dot = 1 resident), under the plates
      const DSW = 1600, DSH = 512, DSX = 160, DSY = 424;
      this.DS = { x: DSX, y: DSY, w: DSW, h: DSH };
      this.dsheet = tornDiv(C, this.cam, { x: DSX, y: DSY, w: DSW, h: DSH, seed: 'C-dsheet', edges: 'all', rim: 7, rough: 0.9, cls: 'paper--newsprint crumple crumple--light' });
      this.dotCv = cv(this.dsheet.inner, DSW, DSH);
      this.dotG = this.dotCv.getContext('2d');
      const NC = 200, NR = 70, PX_ = 7.62, PY_ = 6.6;
      this.nDots = NC * NR;                                         // 14,000 = onscreen.taiwanese_ratio.value
      const gx0 = (DSW - (NC - 0.5) * PX_) / 2 + 2, gy0 = (DSH - (NR - 1) * PY_) / 2;
      const popF = this.pops.filter(p => p > K7.ratio && p < K7.lit);   // 712..722 (6 pops)
      this.dotPops = popF.length ? popF : [712, 714, 716, 718, 720, 722];
      const NP = this.dotPops.length;
      this.dots = new Float32Array(this.nDots * 4);                // x, y, r, popIndex (sheet-local)
      this.litCol = 152; this.litRow = 37;
      for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
        const i = r * NC + c, o = i * 4;
        const front = c + 6 * C.noise1(C.hash('C-front'), r * 0.21) + 3.2 * C.srand('C-dp', i);
        let pi = Math.floor(front / (NC / NP));
        pi = Math.max(0, Math.min(NP - 1, pi));
        this.dots[o] = gx0 + c * PX_ + (r % 2 ? PX_ / 2 : 0);
        this.dots[o + 1] = gy0 + r * PY_;
        this.dots[o + 2] = 2.2 * (0.88 + 0.22 * C.rand('C-dr', i));
        this.dots[o + 3] = pi;
      }
      this.litI = this.litRow * NC + this.litCol;
      this.Dl = { x: this.dots[this.litI * 4], y: this.dots[this.litI * 4 + 1] };   // lit dot, sheet-local
      this.dots[this.litI * 4 + 3] = NP - 1;
      this.settled = [];                                            // cached canvases: dots with popIndex < k at rest

      // number plate 「約 400 人」: 約 / 3-slot odometer / 人, CJK bottoms on the numeral baseline
      const PW = 1240, PH = 480, PX = 340, PY = 250;
      this.P = { x: PX, y: PY, w: PW, h: PH, cx: PX + PW / 2, cy: PY + PH / 2 };
      this.plateG = div(this.cam, '', { left: PX + 'px', top: PY + 'px', width: PW + 'px', height: PH + 'px', transformOrigin: '50% 50%' });
      this.plate = tornDiv(C, this.plateG, { x: 0, y: 0, w: PW, h: PH, seed: 'C-num', edges: 'all', rim: 9, rough: 1, cls: 'crumple' });
      const inner = this.plate.inner;
      {
        const NS = 420, CS = 150;
        let slotW = 0; for (let d = 0; d <= 9; d++) slotW = Math.max(slotW, measure(C, 'anton', NS, String(d)));
        slotW = Math.ceil(slotW) + 8;
        const mN = metrics(C, 'anton', NS, '0');
        const capH = mN.actualBoundingBoxAscent;
        const baseTopN = (NS - (mN.fontBoundingBoxAscent + mN.fontBoundingBoxDescent)) / 2 + mN.fontBoundingBoxAscent;
        const mY = metrics(C, 'sans', CS, tw.prefix), mR = metrics(C, 'sans', CS, tw.unit_zh);
        const baseTopC = (CS - (mY.fontBoundingBoxAscent + mY.fontBoundingBoxDescent)) / 2 + mY.fontBoundingBoxAscent;
        const gap = 30, wY = mY.width, wR = mR.width;
        const total = wY + gap + 3 * slotW + gap + wR;
        let x = (PW - total) / 2 - 6;
        const yB = Math.round(PH / 2 + capH / 2 + 4);                // numeral baseline (optically centred)
        // 約/人: bottom of the ink sits on the numeral baseline
        div(inner, 'f-sans c-ink', { left: px(x), top: px(yB - mY.actualBoundingBoxDescent - baseTopC), fontSize: CS + 'px', lineHeight: '1', whiteSpace: 'nowrap' }, tw.prefix);
        x += wY + gap;
        this.slots = [0, 1, 2].map(i => div(inner, 'f-anton c-red', { left: px(x + i * slotW), top: px(yB - baseTopN), width: slotW + 'px', textAlign: 'center', fontSize: NS + 'px', lineHeight: '1', whiteSpace: 'nowrap' }, '0'));
        x += 3 * slotW + gap;
        div(inner, 'f-sans c-ink', { left: px(x), top: px(yB - mR.actualBoundingBoxDescent - baseTopC), fontSize: CS + 'px', lineHeight: '1', whiteSpace: 'nowrap' }, tw.unit_zh);
        this.slotW = slotW;
      }
      // ROC flag sticker (kit SVG, exact 784×564 geometry) on the top-right corner
      this.roc = img(this.plateG, C.asset('svg/sticker_flag_roc.svg'), { left: (PW - 250) + 'px', top: '-150px', width: '330px', height: Math.round(330 * 564 / 784) + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      // 估計 tag (tape label) bottom-left
      this.tag = div(this.plateG, 'tape-label', { left: '-120px', top: (PH - 58) + 'px', fontSize: '46px', height: '92px', padding: '0 46px', transformOrigin: '50% 50%', visibility: 'hidden' }, tw.tag_zh);
      this.tag.style.color = RED;

      // ratio clipping 「平均每 1.4 萬位挪威居民才 1 位台灣人」 (split into two lines at 才)
      const rz = ratio.zh;
      const m = rz.match(/^(.*?)([\d.]+)\s*萬(.*?)才\s*(\d+)\s*(.*)$/);
      const RW = 812, RH = 250, RX = 1010, RY = 106;
      this.R = { x: RX, y: RY, w: RW, h: RH };
      this.ratio = tornDiv(C, this.cam, { x: RX, y: RY, w: RW, h: RH, seed: 'C-ratio', edges: 'tb', rim: 7, cls: 'paper--newsprint crumple crumple--light' });
      const ri = this.ratio.inner;
      const l1 = div(ri, 'f-sans c-ink', { left: '44px', top: '26px', fontSize: '62px', lineHeight: '1.2', whiteSpace: 'nowrap' });
      const l2 = div(ri, 'f-sans c-ink', { left: '44px', top: '118px', fontSize: '62px', lineHeight: '1.2', whiteSpace: 'nowrap' });
      if (m) {
        l1.innerHTML = `${m[1].trim()} <span class="f-anton c-red" style="font-size:96px;line-height:0.9">${m[2]}</span><span class="c-red"> 萬</span>${m[3].trim()}`;
        l2.innerHTML = `才 <span class="f-anton c-red" style="display:inline-block;font-size:104px;line-height:0.9;transform-origin:50% 70%">${m[4]}</span> ${m[5].trim()}`;
        this.oneEl = l2.querySelector('span');
      } else { l1.textContent = rz; }
      div(ri, 'f-mono', { right: '30px', bottom: '20px', fontSize: '17px', color: 'rgba(20,20,20,.72)', letterSpacing: '.02em' }, footHtml(ratio.footnote));

      // camera-space overlay: starbursts on the plate, the arrow from the clipping to the lit dot
      this.camFx = cv(this.cam, W, H);
      this.cg = this.camFx.getContext('2d');

      // ---------------------------------------------------------------- screen-space top layer (zoom dots, badge)
      this.top = cv(this.shaker, W, H);
      this.tg = this.top.getContext('2d');

      // ---------------------------------------------------------------- punchline layer
      this.punchL = div(this.shaker, '', { left: '0', top: '0', width: W + 'px', height: H + 'px' });
      const pz = punch.zh;                                          // 在挪威遇到台灣人 → 稀有度 ★★★★★
      const [pa, pbRaw] = pz.split(/\s*→\s*/);
      const pb = pbRaw.replace(/★+/, '').trim();
      const nStars = (pbRaw.match(/★/g) || []).length;
      const AW = 1100, AH = 210, AX = 130, AY = 296;
      this.A = tornDiv(C, this.punchL, { x: AX, y: AY, w: AW, h: AH, seed: 'C-pa', edges: 'all', rim: 8, cls: 'crumple center' });
      const aHtml = pa.replace('台灣人', '<span class="c-red" style="position:relative">台灣人<canvas class="C-ul" width="420" height="70" style="position:absolute;left:-26px;top:86%;width:420px;height:70px"></canvas></span>');
      div(this.A.inner, 'f-sans c-ink', { position: 'relative', fontSize: '118px', lineHeight: '1', letterSpacing: '.01em', marginTop: '-6px' }, aHtml);
      this.ulCv = this.A.inner.querySelector('canvas.C-ul');
      this.ulG = this.ulCv.getContext('2d');
      const BW = 1030, BH = 172, BX = 200, BY = 540;
      this.B = tornDiv(C, this.punchL, { x: BX, y: BY, w: BW, h: BH, seed: 'C-pb', edges: 'tb', rim: 7, cls: 'paper--ink crumple' });
      const bi = this.B.inner;
      Object.assign(bi.style, { display: 'flex', alignItems: 'center', gap: '22px', paddingLeft: '52px' });
      div(bi, 'f-sans', { position: 'relative', fontSize: '92px', lineHeight: '1', color: YEL, marginTop: '-8px' }, '→');
      div(bi, 'f-sans c-white', { position: 'relative', fontSize: '96px', lineHeight: '1', marginTop: '-6px' }, pb);
      const starRow = div(bi, '', { position: 'relative', display: 'flex', gap: '12px', marginLeft: '26px' });
      this.starEls = [];
      for (let i = 0; i < nStars; i++) this.starEls.push(div(starRow, 'f-sans', { position: 'relative', fontSize: '80px', lineHeight: '1', color: YEL, textShadow: '0 4px 0 rgba(0,0,0,.55), 0 0 18px rgba(255,225,77,.35)', transformOrigin: '50% 55%', visibility: 'hidden' }, '★'));
      // badge: the lit dot becomes a gold die-cut badge ("the one"), ROC mini flag stuck on its rim, SSR stamp
      this.Bend = { x: 1536, y: 566 }; this.badgeR = 210;
      this.badgeCv = this.makeBadge(C, this.badgeR);
      this.rocMini = img(this.punchL, C.asset('svg/sticker_flag_roc.svg'), { left: (this.Bend.x + this.badgeR * 0.74 - 88) + 'px', top: (this.Bend.y - this.badgeR * 0.74 - 63) + 'px', width: '176px', height: Math.round(176 * 564 / 784) + 'px', transformOrigin: '50% 50%', visibility: 'hidden' });
      this.ssr = C.makeStamp('ssr');
      this.ssrScale = (this.badgeR * 1.56) / this.ssr.width;
      this.ssrOff = { x: 4, y: this.badgeR * 0.47 };
      this.badgeDone = null;                                        // cache: badge + settled SSR stamp

      // flashes: the reveal flash is radial (edges blow out, the number + flag stay readable); the rest are flat.
      // They sit UNDER the HUD so the source footnote is never washed out.
      this.flashR = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: 'radial-gradient(ellipse 60% 62% at 50% 47%, rgba(255,248,234,0.16) 0%, rgba(255,248,234,0.45) 55%, rgba(255,248,234,0.92) 100%)', opacity: 0, pointerEvents: 'none' });
      this.flash = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px', background: '#FFF8EA', opacity: 0, pointerEvents: 'none' });
      // ---------------------------------------------------------------- HUD (never shakes)
      this.hud = div(root, '', { left: '0', top: '0', width: W + 'px', height: H + 'px' });
      this.dymo = div(this.hud, 'dymo dymo--red', { left: '112px', top: '70px', fontSize: '30px', transformOrigin: '0 50%', visibility: 'hidden' }, 'BONUS / TAIWANESE');
      this.foot = div(this.hud, 'footnote', { lineHeight: '1.3' }, `${footHtml(tw.footnote)}<br><span style="font-size:16px;font-weight:400;opacity:.85">${footHtml(tw.footnote_2)}</span>`);
    },

    // 12 on the hit (never 「約 0 人」), eased, changes on every tick, 399 on the last tick, 400 on the ding
    count(f) {
      if (f >= this.ding) return this.countTo;
      if (f < this.tickA) return 0;
      const n = Math.max(1, this.tickB - this.tickA), k = Math.min(n, f - this.tickA);
      const v0 = Math.round(this.countTo * 0.03), v1 = this.countTo - 1;
      return Math.floor(v0 + (v1 - v0) * (1 - Math.pow(1 - k / n, 2)) + 1e-9);
    },

    // gold die-cut badge (cached once): white border, gold face, halftone rim, halftone "the one" silhouette, gloss
    makeBadge(C, R) {
      const Bd = Math.max(6, R * 0.055), pad = 56, S = Math.ceil(2 * (R + Bd + pad));
      const c = C.canvas(S, S), g = c.getContext('2d'), o = S / 2;
      g.save(); g.shadowColor = 'rgba(0,0,0,0.42)'; g.shadowBlur = 30; g.shadowOffsetY = 14;
      g.fillStyle = '#FBF8F0'; g.beginPath(); g.arc(o, o, R + Bd, 0, TAU); g.fill(); g.restore();
      const lg = g.createLinearGradient(o - R, o - R, o + R, o + R);
      lg.addColorStop(0, '#FFEC80'); lg.addColorStop(0.55, '#FFE14D'); lg.addColorStop(1, '#F2C530');
      g.fillStyle = lg; g.beginPath(); g.arc(o, o, R, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.arc(o, o, R, 0, TAU); g.clip();
      // halftone rim (print texture)
      g.fillStyle = 'rgba(190,120,0,0.22)';
      const step = Math.max(9, R / 13);
      g.beginPath();
      for (let yy = -R; yy <= R; yy += step) for (let xx = -R; xx <= R; xx += step) {
        const d = Math.hypot(xx, yy) / R;
        if (d < 0.72 || d > 1.02) continue;
        const rr = step * 0.42 * cl01((d - 0.72) / 0.28);
        g.moveTo(o + xx + rr, o + yy); g.arc(o + xx, o + yy, rr, 0, TAU);
      }
      g.fill();
      // "the one": navy person silhouette printed as a halftone (kit person path), head + shoulders
      const ph = R * 0.8, pw = ph * 40 / 52, pxl = o - pw / 2, pyl = o - R * 0.77;
      const sil = C.canvas(S, S), sg = sil.getContext('2d');
      sg.save(); sg.translate(pxl, pyl); sg.scale(ph / 52, ph / 52); sg.fillStyle = '#000'; sg.fill(new Path2D(C.PATHS.person)); sg.restore();
      sg.globalCompositeOperation = 'source-in';
      const ht = C.canvas(S, S), hg = ht.getContext('2d');
      hg.fillStyle = NAVY; hg.beginPath();
      const hs = 7.2;
      for (let yy = 0; yy < S; yy += hs) for (let xx = (Math.round(yy / hs) % 2) * hs / 2; xx < S; xx += hs) {
        const t = cl01((yy - pyl) / ph);                            // denser towards the shoulders
        const rr = hs * (0.36 + 0.2 * t);
        hg.moveTo(xx + rr, yy); hg.arc(xx, yy, rr, 0, TAU);
      }
      hg.fill();
      sg.drawImage(ht, 0, 0);
      g.globalAlpha = 0.92; g.drawImage(sil, 0, 0); g.globalAlpha = 1;
      g.restore();
      g.strokeStyle = 'rgba(186,12,47,0.55)'; g.lineWidth = Math.max(2, R * 0.012);
      g.beginPath(); g.arc(o, o, R * 0.9, 0, TAU); g.stroke();
      // gloss
      g.save(); g.beginPath(); g.arc(o, o, R, 0, TAU); g.clip();
      const gg = g.createLinearGradient(o - R, o - R, o + R * 0.2, o + R * 0.2);
      gg.addColorStop(0, 'rgba(255,255,255,0.35)'); gg.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gg.addColorStop(0.51, 'rgba(255,255,255,0)');
      g.fillStyle = gg; g.fillRect(o - R, o - R, 2 * R, 2 * R); g.restore();
      c.o = o;
      return c;
    },

    // sheet transform (jitter on twos + slow drift, frozen from the zoom on)
    sheetT(C, f) {
      const fj = Math.min(f, K7.zoomA - 1);
      const t = prog(f, K7.sheetIn, 5);
      const j = C.jitter('C-ds', fj, 1.3, 0.12), w = C.wander('C-dsw', fj, 3, 0.05);
      return combine({ rotate: -0.8, y: lerp(620, 0, E.outBack(t, 1.3)) }, { x: j.x + w.x, y: j.y + w.y, rotate: j.r + w.r }, f < K7.zoomA ? bump(f, K7.lit, 0.006) : null);
    },

    // camera for the crash zoom into the lit dot: screen = Bpos + R(rot)·(p − D)·Z  (identity before the zoom)
    camAt(D, f) {
      if (f < K7.zoomA) return { Z: 1, bx: D.x, by: D.y, rot: 0 };
      const t = prog(f, K7.zoomA, K7.zoomB - K7.zoomA);
      const Z = Math.exp(Math.log(60) * E.inQuad(t));
      const e = E.outCubic(prog(f, K7.zoomA, 6));
      return { Z, bx: lerp(D.x, this.Bend.x, e), by: lerp(D.y, this.Bend.y, e), rot: -4 * E.inOutCubic(t) };
    },

    settledCanvas(C, k) {
      if (this.settled[k]) return this.settled[k];
      const c = C.canvas(this.DS.w, this.DS.h), g = c.getContext('2d');
      g.fillStyle = DOTINK;
      g.beginPath();
      for (let i = 0; i < this.nDots; i++) {
        const o = i * 4;
        if (this.dots[o + 3] >= k || i === this.litI) continue;
        g.moveTo(this.dots[o] + this.dots[o + 2], this.dots[o + 1]);
        g.arc(this.dots[o], this.dots[o + 1], this.dots[o + 2], 0, TAU);
      }
      g.globalAlpha = 0.9; g.fill();
      this.settled[k] = c;
      return c;
    },

    async render(f, root, X) {
      const C = X.C, g = this.g;
      const k0 = f - K7.hit;
      // ------------------------------------------------------------ shake + flash
      const sh1 = C.shake('C-hit', f, K7.hit, { amp: 30, decay: 6 });
      const sh2 = C.shake('C-ding', f, this.ding, { amp: 9, decay: 4 });
      const sh3 = C.shake('C-ssr', f, K7.ssr, { amp: 16, decay: 5 });
      const sh4 = C.shake('C-pun', f, K7.punch, { amp: 14, decay: 4 });
      const sx = sh1.x + sh2.x + sh3.x + sh4.x, sy = sh1.y + sh2.y + sh3.y + sh4.y, sr = sh1.r + sh2.r + sh3.r + sh4.r;
      this.shaker.style.transform = `translate(${px(sx)},${px(sy)}) rotate(${sr.toFixed(3)}deg)`;
      this.flashR.style.opacity = flashAt(f, K7.hit, [1, 0.5, 0.2, 0.06]).toFixed(3);
      const fl = Math.max(flashAt(f, this.ding, [0.3, 0.1]), flashAt(f, K7.ssr, [0.24, 0.07]), flashAt(f, K7.punch, [0.16, 0.05]));
      this.flash.style.opacity = fl.toFixed(3);

      // background drift (smooth)
      if (this.bgImg) {
        const bz = 1.02 + 0.0009 * k0, w = C.wander('C-bg7', f, 6, 0.03);
        this.bgImg.style.transform = `translate(${px(w.x)},${px(w.y)}) scale(${bz.toFixed(4)})`;
      }

      // ------------------------------------------------------------ dot sheet + camera
      const sT = this.sheetT(C, f);
      const D = mapPt(this.DS, sT, this.Dl.x, this.Dl.y);           // lit dot in camera space
      const cam = this.camAt(D, f);
      const pon = f >= K7.punch;
      const camOn = !pon;
      showBox(this.cam, camOn);
      this.cam.style.transform = `translate(${px(cam.bx)},${px(cam.by)}) rotate(${cam.rot.toFixed(3)}deg) scale(${cam.Z.toFixed(4)}) translate(${px(-D.x)},${px(-D.y)})`;
      const sheetOn = f >= K7.sheetIn && camOn && cam.Z < 40;
      showBox(this.dsheet, sheetOn);
      if (sheetOn) {
        this.dsheet.style.transform = `translate(${px(sT.x)},${px(sT.y)}) rotate(${sT.r.toFixed(3)}deg) scale(${sT.s.toFixed(4)})`;
        this.dsheet.style.visibility = 'visible'; this.dsheet.style.opacity = 1;
      }
      const platesOn = camOn && cam.Z < 5;
      showBox(this.plateG, platesOn); showBox(this.ratio, platesOn && f >= K7.ratio); showBox(this.camFx, platesOn);

      // ------------------------------------------------------------ number plate (odometer)
      const v = this.count(f);
      const digs = String(v).padStart(3, '0'), nLead = 3 - String(v).length;
      const speed = f < this.ding ? 1 - prog(f, this.tickA, this.ding - this.tickA) : 0;
      const nearT = f < this.ding ? prog(f, this.tickA, this.ding - this.tickA) : 1;
      const lift = 6 + 8 * nearT;
      for (let i = 0; i < 3; i++) {
        const el = this.slots[i];
        if (el.textContent !== digs[i]) el.textContent = digs[i];
        const ghost = i < nLead;
        el.style.opacity = ghost ? '0.14' : '1';
        const sm = ghost ? 0 : speed * [0.25, 0.7, 1][i];
        el.style.textShadow = sm > 0.05
          ? `0 ${px(-22 * sm)} 0 rgba(186,12,47,${(0.2 * sm).toFixed(3)}), 0 ${px(22 * sm)} 0 rgba(186,12,47,${(0.12 * sm).toFixed(3)}), 0 ${px(lift)} 0 rgba(0,0,0,${(0.1 + 0.05 * nearT).toFixed(3)})`
          : (ghost ? 'none' : `0 ${px(lift)} 0 rgba(0,0,0,${(0.1 + 0.05 * nearT).toFixed(3)})`);
        const kick = !ghost && f > this.tickA && f < this.ding ? (C.rand('C-tk', f, i) - 0.5) * (2 + 7 * nearT) * [0.5, 0.8, 1][i] : 0;
        el.style.transform = `translateY(${px(kick)})`;
      }
      // push through the count (accelerating), hero hold f700–707 with a slow push, glide f708–712 to the top-left
      const push = f < this.ding ? 1 + 0.08 * E.inQuad(prog(f, this.tickA, this.ding - this.tickA)) : 1.08 + 0.035 * E.outCubic(prog(f, this.ding, K7.glideA - this.ding));
      const gl = E.outBack(prog(f, K7.glideA, K7.glideB - K7.glideA), 1.2);
      const tgt = { x: 560, y: 272, s: 0.62 };
      const gxy = { x: lerp(0, tgt.x - this.P.cx, gl), y: lerp(0, tgt.y - this.P.cy, gl), s: lerp(push, tgt.s, gl) };
      const pj = C.jitter('C-plate', f, 2, 0.35);
      const hundredBump = this.hundreds.map(h => bump(f, h, 0.022)).find(b => b) || null;
      const plateMods = [hitAt(f, K7.hit, { seq: [1.18, 0.95, 1.03, 0.99, 1] }), { x: pj.x, y: pj.y, rotate: pj.r }, bump(f, this.ding, 0.07), hundredBump];
      C.place(this.plateG, { x: gxy.x, y: gxy.y, scale: gxy.s, rotate: -1.2 }, ...plateMods);
      const PT = combine({ x: gxy.x, y: gxy.y, scale: gxy.s, rotate: -1.2 }, ...plateMods);
      show(this.plate, true);
      const rj = C.jitter('C-roc', f, 1.8);
      const rocB = [...this.hundreds, this.ding, K7.rocBump].map(h => bump(f, h, h === K7.rocBump ? 0.09 : 0.07)).find(b => b) || null;
      C.place(this.roc, { rotate: 11 }, hitAt(f, K7.hit, { seq: [1.38, 0.9, 1.05, 0.99, 1], rot0: 20, dx: 44, dy: -34 }), { x: rj.x, y: rj.y, rotate: rj.r }, rocB);
      const tj = C.jitter('C-tag', f, 1.3);
      C.place(this.tag, { rotate: -5 }, C.snapInAt(f, K7.tag, { dur: 4, from: 1.35, seed: 'C-tag' }), { x: tj.x, y: tj.y, rotate: tj.r });

      // ratio clipping (snaps in on pop 710; bumps on the lit dot and on the 「1」)
      const rjj = C.jitter('C-ratio', f, 1.5, 0.3);
      C.place(this.ratio, { rotate: 1.4 }, C.snapInAt(f, K7.ratio, { dur: 4, from: 1.12, rot0: -4 }), { x: rjj.x, y: rjj.y, rotate: rjj.r }, bump(f, K7.lit, 0.03));
      if (this.oneEl) { const b = bump(f, K7.one, 0.3); this.oneEl.style.transform = `scale(${(b ? b.scale : 1).toFixed(3)})`; }

      // ------------------------------------------------------------ fx canvas (screen, under the camera): rays, bubbles, badge rays
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, W, H);
      const rayA = f < K7.glideA ? 1 : 1 - prog(f, K7.glideA, 6);
      if (rayA > 0 && camOn) {
        const cx = this.P.cx + gxy.x, cy = this.P.cy + gxy.y;
        this.rays(g, cx, cy, 1500, 20, f * 0.35 + 5, [[0, `rgba(241,233,216,${(0.07 * rayA).toFixed(3)})`], [1, `rgba(241,233,216,${(0.015 * rayA).toFixed(3)})`]]);
        const gr = g.createRadialGradient(cx, cy, 50, cx, cy, 720 * gxy.s + 200);
        gr.addColorStop(0, `rgba(255,236,190,${(0.2 * rayA).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      if (camOn) this.drawBubbles(C, g, f);
      if (pon) {
        const a = prog(f, K7.punch, 5), B0 = this.badgePos(C, f);
        this.rays(g, B0.x, B0.y, 1500, 18, -f * 0.55, [[0, `rgba(241,233,216,${(0.16 * a).toFixed(3)})`], [0.45, `rgba(241,233,216,${(0.07 * a).toFixed(3)})`], [1, 'rgba(241,233,216,0.015)']]);
        const gw = g.createRadialGradient(B0.x, B0.y, 120, B0.x, B0.y, 560);
        gw.addColorStop(0, `rgba(255,240,190,${(0.24 * a).toFixed(3)})`); gw.addColorStop(1, 'rgba(255,240,190,0)');
        g.fillStyle = gw; g.fillRect(B0.x - 560, B0.y - 560, 1120, 1120);
      }

      // ------------------------------------------------------------ dots (in the sheet), camera-space marks, zoom
      this.drawSheetDots(C, f, cam);
      const cg = this.cg; cg.setTransform(1, 0, 0, 1, 0, 0); cg.clearRect(0, 0, W, H);
      if (platesOn) {
        // emphasis starbursts on the landed number (ding); they travel with the plate
        if (f >= this.ding) {
          const plBox = { x: this.P.x, y: this.P.y, w: this.P.w, h: this.P.h };
          const q1 = mapPt(plBox, PT, 40, 52), q2 = mapPt(plBox, PT, this.P.w - 22, this.P.h - 62);
          const p = E.outCubic(prog(f, this.ding, 4)), sc = PT.s;
          const wd = 10 * Math.max(0.7, sc);
          C.marker.starburst(cg, { cx: q1.x, cy: q1.y, r1: 58 * sc, r2: 128 * sc, rays: 4, from: -172, to: -98, seed: 'C-sb1', width: wd, color: YEL, progress: p });
          C.marker.starburst(cg, { cx: q2.x, cy: q2.y, r1: 58 * sc, r2: 118 * sc, rays: 3, from: 8, to: 72, seed: 'C-sb2', width: wd, color: YEL, progress: p });
        }
        // arrow from the clipping's 「1 位台灣人」 onto the lit dot
        if (f >= K7.arrowA) {
          const Rb = this.R;
          C.marker.arrow(cg, { x1: Rb.x + 250, y1: Rb.y + Rb.h + 4, x2: D.x - 30, y2: D.y - 40, bend: -0.28, seed: 'C-darr', width: 7, color: RED, progress: E.outCubic(prog(f, K7.arrowA, 6)), head: 26, frame: f, boil: 0.5 });
        }
      }
      // screen-space top layer: crash zoom (vector dots, the lit dot, speed lines) and the punchline badge
      const tg = this.tg; tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, W, H);
      if (f >= K7.zoomA && !pon) this.drawZoom(C, tg, f, cam, sT, D);
      if (pon) this.drawBadge(C, tg, f);

      // ------------------------------------------------------------ punchline
      showBox(this.punchL, pon);
      if (pon) {
        const aj = C.jitter('C-pa', f, 1.8, 0.3), bj = C.jitter('C-pb', f, 1.8, 0.3);
        C.place(this.A, { rotate: -1.8 }, hitAt(f, K7.punch, { seq: [1.08, 0.97, 1.01, 1], rot0: -4, dx: 0 }), { x: aj.x, y: aj.y, rotate: aj.r }, bump(f, K7.ssr, 0.02), bump(f, K7.bump2, 0.02));
        C.place(this.B, { rotate: 1.2 }, hitAt(f, K7.stripB, { seq: [1.04, 0.985, 1.008, 1], rot0: 3, dx: -80 }), { x: bj.x, y: bj.y, rotate: bj.r }, bump(f, K7.ssr, 0.025), bump(f, K7.bump2, 0.02));
        this.starEls.forEach((st, i) => {
          const t0 = K7.stars[i] ?? (K7.stars[0] + 2 * i);
          const k = f - t0;
          if (k < 0) { show(st, false); return; }
          const sc = [1.45, 0.9, 1.06, 1][Math.min(k, 3)];
          const tw = f >= K7.ssr ? 1 + 0.06 * Math.max(0, Math.sin((f - K7.ssr) * 0.9 + i * 1.3)) : 1;
          show(st, true);
          st.style.transform = `rotate(${(k < 3 ? (i % 2 ? 12 : -12) * (1 - k / 3) : 0).toFixed(2)}deg) scale(${(sc * tw).toFixed(3)})`;
        });
        const bo = this.badgeOff(C, f);
        const mj = C.jitter('C-rocm', f, 1.6);
        C.place(this.rocMini, { rotate: 13, x: bo.x, y: bo.y }, hitAt(f, K7.rocMini, { seq: [1.3, 0.92, 1.04, 1], rot0: 18, dx: -30, dy: 24 }), { x: mj.x, y: mj.y, rotate: mj.r }, bump(f, K7.ssr, 0.05));
        // underline under 台灣人 on the 8th after the SSR thunk
        const ug = this.ulG; ug.clearRect(0, 0, this.ulCv.width, this.ulCv.height);
        if (f >= K7.underline) C.marker.underline(ug, { x1: 22, x2: 396, y: 30, color: YEL, width: 13, progress: E.outCubic(prog(f, K7.underline, 5)), seed: 'C-ul', frame: f, boil: 0.6, slope: -0.02 });
      }

      // ------------------------------------------------------------ HUD
      const dyOut = f >= K7.dymoOut && f < K7.dymoIn ? C.popOutAt(f, K7.dymoOut, { dur: 3 }) : null;
      const dyIn = f >= K7.dymoIn ? C.snapInAt(f, K7.dymoIn, { dur: 4, seed: 'C-dy2' }) : C.snapInAt(f, K7.dymo, { dur: 4, seed: 'C-dy' });
      C.place(this.dymo, { rotate: -2 }, dyIn, dyOut, C.jitter('C-dy', f, 1));
      show(this.foot, true);
      this.foot.style.opacity = 1;
    },

    // badge centre in screen space (lands on the punch with a drift afterwards)
    badgeOff(C, f) {
      const w = C.wander('C-bdg', f, 7, 0.03), j = C.jitter('C-bdgj', f, 1.4);
      return { x: w.x + j.x, y: w.y + j.y };
    },
    badgePos(C, f) { const o = this.badgeOff(C, f); return { x: this.Bend.x + o.x, y: this.Bend.y + o.y }; },

    // bubbly pops f700–706: bubbles pop out from behind the landed number, then drift away and fade
    drawBubbles(C, g, f) {
      const cols = [CREAM, YEL, RED, '#FFFFFF'];
      for (let pi = 0; pi < K7.bubbles.length; pi++) {
        const t0 = K7.bubbles[pi], k = f - t0;
        if (k < 0 || k > 11) continue;
        for (let j = 0; j < 5; j++) {
          const ang = (C.rand('C-bb', pi, j) * 0.9 + j / 5) * TAU;
          const R0 = 1.12 + 0.16 * C.rand('C-bbr', pi, j);
          const bx = this.P.cx + Math.cos(ang) * (this.P.w * 0.55 * R0 + 40 + k * 12), by = this.P.cy + Math.sin(ang) * (this.P.h * 0.62 * R0 + 40 + k * 8) - k * 3;
          const r = (12 + 22 * C.rand('C-bbs', pi, j)) * ([1.4, 1.1, 1.0][k] ?? 1) * (k > 5 ? 1 - (k - 5) / 6 : 1);
          if (r <= 0.5) continue;
          if ((bx < 720 && by < 170) || (bx < 640 && by > 900)) continue;   // keep clear of the dymo + footnote
          g.fillStyle = cols[(pi + j) % cols.length];
          g.globalAlpha = k > 5 ? 1 - (k - 5) / 6 : 1;
          g.beginPath(); g.arc(bx, by, r, 0, TAU); g.fill();
          if (k <= 1) { g.globalAlpha = 0.8; g.strokeStyle = '#FFFFFF'; g.lineWidth = 3; g.beginPath(); g.arc(bx, by, r * 1.6, 0, TAU); g.stroke(); }
        }
      }
      g.globalAlpha = 1;
    },

    // dots inside the sheet (sheet-local): settled bands (cached), the band being printed, the lit dot + marks
    drawSheetDots(C, f, cam) {
      const g = this.dotG, DS = this.DS;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, DS.w, DS.h);
      const zooming = f >= K7.zoomA;
      showBox(this.dotCv, !zooming);
      if (zooming || f < K7.sheetIn) return;
      const P = this.dotPops, NP = P.length;
      let settledK = 0; for (let k = 0; k < NP; k++) if (f >= P[k] + 3) settledK = k + 1;
      const dimA = f >= K7.lit ? 1 - 0.65 * prog(f, K7.lit, 3) : 1;
      if (settledK > 0) { g.globalAlpha = dimA; g.drawImage(this.settledCanvas(C, settledK), 0, 0); g.globalAlpha = 1; }
      // the band being printed: red on the pop frame, oversize navy, then settles
      for (let k = settledK; k < NP; k++) {
        const kk = f - P[k];
        if (kk < 0) break;
        const sc = [1.45, 1.15, 1.04][kk] ?? 1;
        g.fillStyle = kk === 0 ? '#3d6fe0' : DOTINK;
        g.globalAlpha = 0.92;
        g.beginPath();
        for (let i = 0; i < this.nDots; i++) {
          const o = i * 4;
          if (this.dots[o + 3] !== k || i === this.litI) continue;
          const r = this.dots[o + 2] * sc;
          g.moveTo(this.dots[o] + r, this.dots[o + 1]); g.arc(this.dots[o], this.dots[o + 1], r, 0, TAU);
        }
        g.fill();
      }
      g.globalAlpha = 1;
      const Dl = this.Dl, litPop = P[this.dots[this.litI * 4 + 3]];
      // the future Taiwanese dot is an ordinary dot until it lights up
      if (f >= litPop + 3 && f < K7.lit) {
        const o = this.litI * 4;
        g.globalAlpha = 0.9; g.fillStyle = DOTINK; g.beginPath(); g.arc(Dl.x, Dl.y, this.dots[o + 2], 0, TAU); g.fill(); g.globalAlpha = 1;
      }
      if (f >= K7.lit) this.drawLitDot(C, g, f, Dl.x, Dl.y, 1);
      // marker ring around it
      if (f >= K7.markRing) C.marker.circle(g, { cx: Dl.x, cy: Dl.y, rx: 46, ry: 40, rotation: -8, seed: 'C-dring', width: 6, color: RED, progress: E.outCubic(prog(f, K7.markRing, 5)), frame: f, boil: 0.6 });
    },

    // the one lit dot: highlighter halo, soft glow, gold bead with a red rim, ring pulses on 724/728/732, glint 738
    drawLitDot(C, g, f, x, y, Z) {
      const k = f - K7.lit;
      const pop = [1.9, 1.3, 1.06][k] ?? 1;
      const r0 = 7.5 * pop * Z;
      const GR = 74 * Z;
      const gl = g.createRadialGradient(x, y, 0, x, y, GR);
      gl.addColorStop(0, 'rgba(255,225,77,0.95)'); gl.addColorStop(0.3, 'rgba(255,225,77,0.55)'); gl.addColorStop(1, 'rgba(255,225,77,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x, y, GR, 0, TAU); g.fill();
      for (const t0 of K7.rings) {
        const kk = f - t0;
        if (kk < 0 || kk > 9) continue;
        g.strokeStyle = `rgba(186,12,47,${(0.85 * (1 - kk / 9)).toFixed(3)})`; g.lineWidth = 3.5 * Z;
        g.beginPath(); g.arc(x, y, (10 + kk * 8) * Z, 0, TAU); g.stroke();
      }
      g.save();
      g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = Math.min(24, 5 * Z); g.shadowOffsetY = Math.min(10, 2 * Z);
      g.fillStyle = RED; g.beginPath(); g.arc(x, y, r0 + Math.min(12, 2.2 * Z), 0, TAU); g.fill();
      g.restore();
      const gg = g.createLinearGradient(x - r0, y - r0, x + r0, y + r0);
      gg.addColorStop(0, '#FFF1A0'); gg.addColorStop(0.55, YEL); gg.addColorStop(1, '#F2C530');
      g.fillStyle = gg; g.beginPath(); g.arc(x, y, r0, 0, TAU); g.fill();
      const hla = 0.85 * cl01(1 - (Z - 2) / 10);
      if (hla > 0.01) { g.fillStyle = `rgba(255,255,255,${hla.toFixed(3)})`; g.beginPath(); g.arc(x - r0 * 0.35, y - r0 * 0.35, r0 * 0.28, 0, TAU); g.fill(); }
      const kg = f - K7.glint;
      if (kg >= 0 && kg < 3) sparkle(g, x + 16 * Z, y - 14 * Z, [30, 20, 10][kg] * Math.max(1, Z * 0.5), 1, '#FFFFFF');
    },

    // crash zoom: dots as vectors in screen space (the sheet DOM zooms underneath), speed lines, the lit dot on top
    drawZoom(C, g, f, cam, sT, D) {
      const DS = this.DS;
      g.save();
      this.applyCam(g, cam, D);
      // sheet-local frame (frozen jitter)
      const a = sT.r * Math.PI / 180;
      g.translate(DS.x + DS.w / 2 + sT.x, DS.y + DS.h / 2 + sT.y); g.rotate(a); g.scale(sT.s, sT.s); g.translate(-DS.w / 2, -DS.h / 2);
      if (cam.Z >= 40) {                                             // sheet DOM hidden: the paper is all there is
        g.fillStyle = '#E2DDCF'; g.fillRect(-DS.w, -DS.h, DS.w * 3, DS.h * 3);
      }
      const inv = 1 / (cam.Z * sT.s), Dl = this.Dl;
      const hw = 1300 * inv + 8, hh = 1300 * inv + 8;
      const cxw = Dl.x + (960 - cam.bx) * inv, cyw = Dl.y + (540 - cam.by) * inv;
      g.fillStyle = DOTINK; g.globalAlpha = 0.9 * 0.35;
      g.beginPath();
      for (let i = 0; i < this.nDots; i++) {
        if (i === this.litI) continue;
        const o = i * 4, x = this.dots[o], y = this.dots[o + 1];
        if (Math.abs(x - cxw) > hw || Math.abs(y - cyw) > hh) continue;
        const r = this.dots[o + 2];
        g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU);
      }
      g.fill(); g.globalAlpha = 1;
      g.restore();
      // speed lines (ink on paper)
      const t = prog(f, K7.zoomA, K7.zoomB - K7.zoomA);
      if (f >= K7.zoomA + 2) this.speedLines(C, g, cam.bx, cam.by, f, Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.5 + (f === 736 ? 0.2 : 0));
      // the lit dot, crisp at any zoom
      this.drawLitDot(C, g, f, cam.bx, cam.by, cam.Z * sT.s);
    },

    applyCam(g, cam, D) {
      g.translate(cam.bx, cam.by); g.rotate(cam.rot * Math.PI / 180); g.scale(cam.Z, cam.Z); g.translate(-D.x, -D.y);
    },

    // sunburst wedges filled with a radial gradient (stops: [[offset, colour], ...] over 0..R)
    rays(g, cx, cy, R, n, rotDeg, stops) {
      g.save(); g.translate(cx, cy); g.rotate(rotDeg * Math.PI / 180);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
      stops.forEach(([o, c]) => gr.addColorStop(o, c));
      g.fillStyle = gr;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = a0 + Math.PI / n;
        g.moveTo(0, 0); g.lineTo(Math.cos(a0) * R, Math.sin(a0) * R); g.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); g.closePath();
      }
      g.fill(); g.restore();
    },

    speedLines(C, g, cx, cy, f, a) {
      if (a <= 0.01) return;
      g.save(); g.strokeStyle = `rgba(16,39,92,${a.toFixed(3)})`; g.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const ang = C.rand('C-sl', i) * TAU;
        const r0 = 300 + C.rand('C-sl0', i, f) * 380, len = 160 + C.rand('C-sl1', i, f) * 420;
        g.lineWidth = 1.5 + C.rand('C-slw', i) * 3.5;
        g.beginPath(); g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); g.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len)); g.stroke();
      }
      g.restore();
    },

    // punchline badge: cached die-cut badge, contracts out of the full-frame gold on the punch, SSR thunk on 756
    drawBadge(C, g, f) {
      const B0 = this.badgePos(C, f), R = this.badgeR;
      const k = f - K7.punch;
      const sc = ([1.28, 0.95, 1.03, 0.995][k] ?? 1) * (bump(f, K7.ssr, 0.05)?.scale ?? 1) * (bump(f, K7.bump2, 0.03)?.scale ?? 1);
      const rot = -3 + 2 * C.fbm1(C.hash('C-brot'), f * 0.03, 2) + (k < 3 ? 8 * (1 - k / 3) : 0);
      const pS = (f - (K7.ssr - 2)) / 5.6;
      const settledStamp = pS >= 1;
      g.save(); g.translate(B0.x, B0.y); g.rotate(rot * Math.PI / 180); g.scale(sc, sc);
      if (settledStamp) {
        if (!this.badgeDone) {                                      // badge + settled stamp, rendered once
          const bc = this.badgeCv, c = C.canvas(bc.width, bc.height), cg = c.getContext('2d');
          cg.drawImage(bc, 0, 0);
          C.drawStamp(cg, this.ssr, bc.o + this.ssrOff.x, bc.o + this.ssrOff.y, 1, { rot: -10, scale: this.ssrScale, composite: 'source-over' });
          c.o = bc.o; this.badgeDone = c;
        }
        g.drawImage(this.badgeDone, -this.badgeDone.o, -this.badgeDone.o);
      } else {
        g.drawImage(this.badgeCv, -this.badgeCv.o, -this.badgeCv.o);
        if (pS >= 0) C.drawStamp(g, this.ssr, this.ssrOff.x, this.ssrOff.y, pS, { rot: -10, scale: this.ssrScale, composite: 'source-over' });
      }
      g.restore();
      // glints
      for (let i = 0; i < 7; i++) {
        const ph = (f * 0.23 + i * 1.7) % TAU;
        const a = Math.max(0, Math.sin(ph)) * prog(f, K7.punch + 4, 6);
        const ang = i * 0.9 + 0.4, rr = R * sc * (1.12 + 0.3 * C.rand('C-gl', i));
        sparkle(g, B0.x + Math.cos(ang) * rr, B0.y + Math.sin(ang) * rr, 12 + 18 * C.rand('C-gls', i), a, i % 2 ? '#FFFFFF' : YEL);
      }
    },
  });
})();
