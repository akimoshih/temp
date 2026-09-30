// SKELETON (framework smoke test): replace with the real S1+S2 design.
COMP.section({
  id: 's1s2', start: 0, end: 279, z: 0,
  async init(root, X) {
    this.plate = X.plate(root);
    this.cv = X.canvasLayer(root, 5);
    this.g = this.cv.getContext('2d');
    this.norway = X.rings(X.geo.norway, p => p.part === 'mainland');
  },
  async render(f, root, X) {
    await this.plate.setFrame('globe', Math.min(f, 279));
    const g = this.g; g.clearRect(0, 0, 1920, 1080);
    g.lineWidth = 3; g.strokeStyle = '#BA0C2F';
    for (const ring of this.norway) {
      if (ring.length < 20) continue;
      g.beginPath();
      ring.forEach(([lon, lat], i) => { const p = X.project(f, lat, lon); i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); });
      g.stroke();
    }
    g.strokeStyle = '#FFE14D'; g.lineWidth = 4; g.beginPath();
    for (let i = 0; i <= 100; i++) {
      const [la, lo] = X.gcPoint(25.03, 121.56, 59.91, 10.75, i / 100);
      const p = X.project(f, la, lo, 0.08 * Math.sin(Math.PI * i / 100));
      if (p.visible) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
    }
    g.stroke();
  },
});
