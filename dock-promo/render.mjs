// Renders index.html frame-by-frame with Playwright and pipes the frames into ffmpeg.
//   node render.mjs preview 0.5 3.2 ...   -> out/preview/t_<time>.png
//   node render.mjs meta                  -> out/meta.json (scene times + counts for audio.py)
//   node render.mjs video [fps]           -> out/video.mp4 (no audio)
// PAGE=index-en.html TAG=en node render.mjs ...  renders another page; outputs get a "-en" suffix
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, 'out');
const PAGE = process.env.PAGE || 'index.html';
const SUF = process.env.TAG ? `-${process.env.TAG}` : '';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/${PAGE}`;

const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(url);
await page.evaluate(() => window.ready);

const [mode, ...rest] = process.argv.slice(2);
const stage = page.locator('#stage');

if (mode === 'preview') {
  fs.mkdirSync(path.join(OUT, `preview${SUF}`), { recursive: true });
  for (const t of rest.map(Number)) {
    await page.evaluate(t => window.seek(t), t);
    await stage.screenshot({ path: path.join(OUT, `preview${SUF}`, `t_${t.toFixed(2)}.png`) });
  }
} else if (mode === 'meta') {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `meta${SUF}.json`), JSON.stringify(await page.evaluate(() => window.META), null, 2));
} else if (mode === 'video') {
  const fps = Number(rest[0] || 30);
  const total = Math.round(30 * fps);
  fs.mkdirSync(OUT, { recursive: true });
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    path.join(OUT, `video${SUF}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.seek(t), f / fps);
    const buf = await stage.screenshot({ type: 'png' });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % 60 === 0) console.log(`frame ${f}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done', ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
server.close();
