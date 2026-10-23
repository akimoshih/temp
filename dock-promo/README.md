# Dock 產品介紹影片（30 秒 · 16:9）

| 版本 | 成品 | 頁面原始碼 | 分鏡與文案 |
|---|---|---|---|
| 台灣版（中英字幕，中文較大） | `dock-promo-30s.mp4` | `index.html` | [`STORYBOARD.md`](STORYBOARD.md) |
| 國際版（全英文、美元預算） | `dock-promo-30s-en.mp4` | `index-en.html` | [`STORYBOARD-en.md`](STORYBOARD-en.md) |
| 台灣版 9:16 直式 | `dock-promo-30s-9x16.mp4` | `index-9x16.html` | 同台灣版 |
| 國際版 9:16 直式 | `dock-promo-30s-en-9x16.mp4` | `index-en-9x16.html` | 同國際版 |

規格：16:9 為 1920×1080、9:16 為 1080×1920，都是 30fps、H.264 + AAC。四支的時間軸相同，直式版直接沿用同語言橫式版的音軌。

直式版的頁面由 `make_vertical.py` 從橫式頁面產生，主要調整：
- 大字改成多行堆疊
- Dock 介面改成上下排列
- 拆解圖的標籤改成右側一欄
- 字幕抬高到 Reels／TikTok／Shorts 底部按鈕區上方，中文字幕在逗號處換行

直式頁面不要手動修改；要改文案就改橫式頁面，再重新產生。

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
npm run build:9x16     # 台灣版直式 → dock-promo-30s-9x16.mp4（會先重跑 make_vertical.py）
npm run build:en:9x16  # 國際版直式 → dock-promo-30s-en-9x16.mp4
npm run preview -- 3.2 18.9 27       # 只截特定秒數到 out/preview/
npm run preview:en -- 3.2 18.9 27    # 國際版 → out/preview-en/
```

改文案或時間點：在橫式 HTML（`index.html` / `index-en.html`）裡修改 `SUBS`（字幕）、`SL`（簡報內容）和 `T`（各段起點），再重跑對應的 build；直式版會自動跟著更新。
