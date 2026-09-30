// Export prerendered kit PNGs (stamps, boarding pass, torn plates, stickers) -> assets/kit/prerendered/
// NODE_PATH=/opt/node22/lib/node_modules node assets/kit/tools/export_png.js
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const out = path.join(__dirname, '..', 'prerendered');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'preview.html') + '?board=export');
  await page.waitForFunction(() => window.kitReady === true && window.exportCanvases);
  const data = await page.evaluate(() => Object.fromEntries(Object.entries(window.exportCanvases).map(([k, c]) => [k, [c.toDataURL('image/png'), c.width, c.height]])));
  for (const [k, [url, w, h]] of Object.entries(data)) {
    fs.writeFileSync(path.join(out, k + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(k + '.png', w + 'x' + h);
  }
  await browser.close();
})();
