// Frame-accurate recorder: node comp/record.js [first] [last] [workers]
// Each worker opens comp/index.html?record, calls `await window.renderFrame(f)` and screenshots.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const first = +(process.argv[2] ?? 0), last = +(process.argv[3] ?? 899), workers = +(process.argv[4] ?? 3);
const outDir = path.join(__dirname, 'frames');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const frames = [];
  for (let f = first; f <= last; f++) frames.push(f);
  let next = 0, done = 0;
  const t0 = Date.now();
  async function worker() {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    await page.goto('file://' + path.join(__dirname, 'index.html') + '?record');
    await page.waitForFunction(() => window.compReady === true, null, { timeout: 120000 });
    while (next < frames.length) {
      const f = frames[next++];
      await page.evaluate(f => window.renderFrame(f), f);
      await page.screenshot({ path: path.join(outDir, `f${String(f).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 95 });
      if (++done % 50 === 0) console.log(`${done}/${frames.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    await page.close();
  }
  await Promise.all(Array.from({ length: workers }, worker));
  await browser.close();
  console.log('done', frames.length, 'frames');
})();
