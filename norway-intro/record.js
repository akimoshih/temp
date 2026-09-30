// 逐格截圖並用 ffmpeg 合成 MP4：node record.js [ffmpeg路徑]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const FPS = 30, DURATION = 30;
const ffmpegBin = process.argv[2] || 'ffmpeg';
const out = path.join(__dirname, 'norway-intro.mp4');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?record');
  await page.waitForTimeout(500);
  const ff = spawn(ffmpegBin, ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-movflags', '+faststart', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = 0; f < FPS * DURATION; f++) {
    await page.evaluate(t => window.render(t), f / FPS);
    ff.stdin.write(await page.screenshot({ type: 'png' }));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('done:', out);
})();
