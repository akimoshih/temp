# Dock 產品介紹影片（30 秒 · 16:9）

成品：`dock-promo-30s.mp4`（1920×1080 · 30fps · H.264 + AAC）
分鏡、字幕與案例簡報內容：見 [`STORYBOARD.md`](STORYBOARD.md)

## 結構

- `index.html`：整支影片就是一個 1920×1080 的 HTML 舞台。GSAP 時間軸搭配逐格的程序化更新（蒼蠅、抖動、打字、op log、建構進度），可以用 `window.seek(t)` 跳到任意秒數。
- `render.mjs`：用 Playwright（Chromium）逐格截圖，再透過 pipe 送給 ffmpeg。
- `audio.py`：用 numpy 程序化合成配樂與音效，時間點從頁面輸出的 `out/meta.json` 對齊。
- `assets/`：Dock logo（原檔、白字版、字標裁切）。

## 重新輸出

```bash
npm install
npm run build          # meta → video → audio → mux，輸出 dock-promo-30s.mp4
npm run preview -- 3.2 18.9 27   # 只截特定秒數到 out/preview/
```

改文案或時間點：在 `index.html` 裡修改 `SUBS`（字幕）、`SL`（簡報內容）和 `T`（各段起點），再重跑 `npm run build`。
