/* Compositor core: section registry, plates, globe projection, shared data.
 * Every section file calls COMP.section({...}). renderFrame(f) is a pure function of f.
 *
 * Section contract:
 *   COMP.section({
 *     id: 's4-facts', start: 280, end: 503,       // inclusive frame range where the section is visible
 *     z: 10,                                      // stacking order (higher = on top)
 *     async init(root, COMP) { ... build DOM once, preload images ... },
 *     async render(f, root, COMP) { ... pure function of f ... },
 *   })
 */
(function () {
  const W = 1920, H = 1080;
  const C = window.Collage;
  const sections = [];
  const COMP = {
    W, H, C, sections,
    facts: null, cues: null, cam: null, geo: {},
    section(def) { sections.push(def); },
  };

  // ---------------------------------------------------------------- data
  // fetch() refuses file://, XHR works with --allow-file-access-from-files
  function json(url) {
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open('GET', url);
      x.onload = () => { try { res(JSON.parse(x.responseText)); } catch (e) { rej(new Error(url + ': ' + e.message)); } };
      x.onerror = () => rej(new Error('load failed: ' + url));
      x.send();
    });
  }
  COMP.json = json;
  // synchronous existence check for optional assets (e.g. terrain plates still rendering)
  COMP.exists = function (url) {
    try { const x = new XMLHttpRequest(); x.open('GET', url, false); x.send(); return x.status === 0 || x.status === 200 ? x.responseText.length > 0 || x.response != null : false; }
    catch (e) { return false; }
  };

  // ---------------------------------------------------------------- globe projection
  // Projects lat/lon (deg) at altitude alt (Earth radii above surface) for globe frame gf.
  // Returns {x, y, visible, depth}. Uses renders/globe/camera.json (same camera as the plates).
  function unit(lat, lon) {
    const la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  }
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  COMP.project = function (gf, lat, lon, alt = 0) {
    const cam = COMP.cam[String(Math.max(0, Math.min(899, Math.round(gf))))];
    const u = unit(lat, lon), r = 1 + alt;
    const P = [u[0] * r, u[1] * r, u[2] * r];
    const v = [P[0] - cam.C[0], P[1] - cam.C[1], P[2] - cam.C[2]];
    const z = dot(v, cam.fwd);
    if (z <= 1e-6) return { x: 0, y: 0, visible: false, depth: z };
    const xn = dot(v, cam.right) / (z * cam.tanx), yn = dot(v, cam.up) / (z * cam.tany);
    // occlusion by the sphere
    const len = Math.hypot(v[0], v[1], v[2]);
    const d = [v[0] / len, v[1] / len, v[2] / len];
    const b = dot(cam.C, d), c = dot(cam.C, cam.C) - 1, disc = b * b - c;
    let visible = true;
    if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > 0 && t < len - 1e-4) visible = false; }
    return { x: (xn + 1) / 2 * W, y: (1 - yn) / 2 * H, visible, depth: z };
  };
  // great-circle interpolation (for flight arcs): returns [lat, lon] at t in 0..1
  COMP.gcPoint = function (lat1, lon1, lat2, lon2, t) {
    const a = unit(lat1, lon1), b = unit(lat2, lon2);
    const om = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    const s = Math.sin(om);
    const k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
    const p = [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
    return [Math.asin(p[2]) * 180 / Math.PI, Math.atan2(p[1], p[0]) * 180 / Math.PI];
  };
  // flat rings [[lon,lat],...] from a GeoJSON (Polygon / MultiPolygon / LineString), optional filter by properties
  COMP.rings = function (gj, filter) {
    const out = [];
    const feats = gj.type === 'FeatureCollection' ? gj.features : [gj];
    for (const ft of feats) {
      if (filter && !filter(ft.properties || {})) continue;
      const g = ft.geometry || ft;
      if (g.type === 'Polygon') out.push(...g.coordinates);
      else if (g.type === 'MultiPolygon') g.coordinates.forEach(p => out.push(...p));
      else if (g.type === 'LineString') out.push(g.coordinates);
      else if (g.type === 'MultiLineString') out.push(...g.coordinates);
    }
    return out;
  };

  // ---------------------------------------------------------------- image sequences (plates)
  // A Plate is an <img> that shows one frame of a pre-rendered sequence. setFrame() awaits decode,
  // so the screenshot taken after renderFrame() resolves always contains the right image.
  COMP.SEQ = {
    globe: i => `../renders/globe/f${String(i).padStart(4, '0')}.jpg`,
    geiranger: i => `../renders/terrain/geiranger/f${String(i).padStart(4, '0')}.jpg`,
    aurora: i => `../renders/terrain/aurora/f${String(i).padStart(4, '0')}.jpg`,
  };
  COMP.plate = function (parent, { z = 0, cls = '' } = {}) {
    const img = document.createElement('img');
    img.className = 'plate ' + cls;
    Object.assign(img.style, { position: 'absolute', left: '0', top: '0', width: W + 'px', height: H + 'px', objectFit: 'cover', zIndex: z });
    parent.appendChild(img);
    let cur = null;
    img.setSrc = async (url) => {
      if (url === cur) return;
      cur = url;
      img.src = url;
      try { await img.decode(); } catch (e) { console.error('plate decode failed', url); }
    };
    img.setFrame = (seq, i) => img.setSrc(COMP.SEQ[seq](i));
    return img;
  };
  // preload + decode a still image once
  COMP.image = async function (url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  };

  // ---------------------------------------------------------------- helpers
  COMP.el = function (parent, tag = 'div', props = {}, style = {}) {
    const e = document.createElement(tag);
    Object.assign(e, props);
    Object.assign(e.style, { position: 'absolute' }, style);
    parent.appendChild(e);
    return e;
  };
  COMP.canvasLayer = function (parent, z = 0) {
    const cv = C.canvas(W, H);
    Object.assign(cv.style, { position: 'absolute', left: '0', top: '0', zIndex: z });
    parent.appendChild(cv);
    return cv;
  };
  COMP.on = (f, a, b) => f >= a && f <= b;
  COMP.fact = key => COMP.facts.onscreen[key];

  // ---------------------------------------------------------------- boot + frame loop
  let film = null;
  const stage = document.getElementById('stage');
  COMP.stage = stage;

  async function boot() {
    const [facts, cues, cam, norway, norwaySimple, taiwan, taiwanSimple] = await Promise.all([
      json('../facts/facts.json'), json('../audio/cues.json'), json('../renders/globe/camera.json'),
      json('../assets/geo/norway_outline.geojson'), json('../assets/geo/norway_outline_simplified.geojson'),
      json('../assets/geo/taiwan_outline.geojson'), json('../assets/geo/taiwan_outline_simplified.geojson'),
    ]);
    Object.assign(COMP, { facts, cues, cam });
    Object.assign(COMP.geo, { norway, norwaySimple, taiwan, taiwanSimple });
    await C.ready({});
    sections.sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const s of sections) {
      s.root = COMP.el(stage, 'div', { className: 'section section-' + s.id }, { left: '0', top: '0', width: W + 'px', height: H + 'px', zIndex: s.z || 0, overflow: 'hidden' });
      s.root.style.display = 'none';
      if (s.init) await s.init(s.root, COMP);
    }
    film = await C.createFilmLayer(stage, { grain: 0.16, dust: 0.55, vignette: true, zIndex: 1000 });
    const q = new URLSearchParams(location.search);
    if (q.has('f')) await window.renderFrame(+q.get('f'));
    window.compReady = true;
  }

  window.renderFrame = async function (f) {
    const jobs = [];
    for (const s of sections) {
      const on = f >= s.start && f <= s.end;
      s.root.style.display = on ? '' : 'none';
      if (on) jobs.push(Promise.resolve(s.render(f, s.root, COMP)));
    }
    await Promise.all(jobs);
    if (film) film.render(f, COMP.filmOverride ? COMP.filmOverride(f) : undefined);
    // fade from black / to black (EDL: in 0-10, out 885-899)
    const fade = f <= 10 ? 1 - f / 10 : f >= 885 ? (f - 885) / 14 : 0;
    COMP.black.style.opacity = Math.max(0, Math.min(1, fade));
    await new Promise(r => requestAnimationFrame(() => r()));
  };

  COMP.black = document.createElement('div');
  Object.assign(COMP.black.style, { position: 'absolute', inset: '0', background: '#000', zIndex: 2000, opacity: 0, pointerEvents: 'none' });
  stage.appendChild(COMP.black);

  window.COMP = COMP;
  window.addEventListener('load', () => boot().catch(e => { console.error('BOOT FAILED', e && e.stack || e); }));
})();
