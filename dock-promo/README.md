# Dock 產品介紹影片（30 秒 · 16:9）

| 版本 | 成品 | 頁面原始碼 | 分鏡與文案 |
|---|---|---|---|
| 台灣版（中英字幕，中文較大） | `dock-promo-30s.mp4` | `index.html` | [`STORYBOARD.md`](STORYBOARD.md) |
| 國際版（全英文、美元預算） | `dock-promo-30s-en.mp4` | `index-en.html` | [`STORYBOARD-en.md`](STORYBOARD-en.md) |

兩個版本的規格都是 1920×1080、30fps、H.264 + AAC，時間軸和配樂結構相同。

## 結構

- `index.html` / `index-en.html`：整支影片就是一個 1920×1080 的 HTML 舞台。GSAP 時間軸搭配逐格的程序化更新（蒼蠅、抖動、打字、op log、建構進度），可以用 `window.seek(t)` 跳到任意秒數。
- `render.mjs`：用 Playwright（Chromium）逐格截圖，再透過 pipe 送給 ffmpeg。`PAGE=index-en.html TAG=en` 會改成輸出國際版，輸出檔名加上 `-en`。
- `audio.py`：用 numpy 程序化合成配樂與音效，時間點從頁面輸出的 `out/meta*.json` 對齊。
- `assets/`：Dock logo（原檔、白字版、字標裁切）。

## 重新輸出

```bash
npm install
npm run build          # 台灣版 → dock-promo-30s.mp4
npm run build:en       # 國際版 → dock-promo-30s-en.mp4
npm run preview -- 3.2 18.9 27       # 只截特定秒數到 out/preview/
npm run preview:en -- 3.2 18.9 27    # 國際版 → out/preview-en/
```

改文案或時間點：在對應的 HTML 裡修改 `SUBS`（字幕）、`SL`（簡報內容）和 `T`（各段起點），再重跑 build。
