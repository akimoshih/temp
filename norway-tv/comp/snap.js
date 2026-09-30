// Quick look-dev snapshots: node comp/snap.js <frames: 0,28,100-110> [outDir]
// Writes JPEGs (and prints page errors). Use tools/contact.py to build a contact sheet.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const spec = process.argv[2] || '0';
const outDir = path.resolve(process.argv[3] || path.join(__dirname, '..', 'tmp', 'snap'));
const frames = [];
for (const part of spec.split(',')) {
  const [a, b] = part.split('-').map(Number);
  if (b === undefined) frames.push(a); else for (let f = a; f <= b; f++) frames.push(f);
}
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?record');
  await page.waitForFunction(() => window.compReady === true, null, { timeout: 180000 });
  for (const f of frames) {
    const t0 = Date.now();
    await page.evaluate(f => window.renderFrame(f), f);
    const out = path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
    console.log(out, (Date.now() - t0) + 'ms');
  }
  await browser.close();
})();
