// Render preview boards to PNG.   NODE_PATH=/opt/node22/lib/node_modules node assets/kit/tools/render_preview.js [outDir] [board:f1,f2 ...]
// default: title:0,2,5,10,40 fact:2,20,40 reveal:3,40 kit:40 type:0   -> tmp/kit/preview/<board>_<frame>.png
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const args = process.argv.slice(2);
const outDir = path.resolve(args[0] && !args[0].includes(':') ? args.shift() : path.join(__dirname, '../../../tmp/kit/preview'));
const jobs = (args.length ? args : ['title:0,2,5,10,40', 'fact:2,20,40', 'reveal:3,40', 'kit:40', 'type:0']).map((j) => { const [b, fr] = j.split(':'); return [b, (fr || '40').split(',').map(Number)]; });
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  for (const [board, frames] of jobs) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error('[pageerror]', board, e.message));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', board, m.text()); });
    const t0 = Date.now();
    await page.goto('file://' + path.join(__dirname, '..', 'preview.html') + '?board=' + board);
    await page.waitForFunction(() => window.kitReady === true, null, { timeout: 120000 });
    console.log(board, 'ready in', Date.now() - t0, 'ms');
    for (const f of frames) {
      const t1 = Date.now();
      await page.evaluate((f) => window.render(f), f);
      const file = path.join(outDir, `${board}_${String(f).padStart(3, '0')}.png`);
      await page.screenshot({ path: file });
      console.log('  frame', f, (Date.now() - t1) + 'ms', '->', path.relative(process.cwd(), file));
    }
    await page.close();
  }
  await browser.close();
})();
