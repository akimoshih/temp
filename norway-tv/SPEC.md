# NORWAY in 30s: production spec (single source of truth)

A 30-second, broadcast-grade motion-graphics intro for a Taiwanese travel vlog (YouTube).
Language on screen: Traditional Chinese (primary) + English/Norwegian accents.
Style: **editorial cut-out collage** (torn paper, halftone photo prints, tape, stamps, marker
annotations, stop-motion jitter) layered over **real satellite / terrain imagery**,
and a signature **real-imagery globe → Norway zoom**. Fast-paced, cut on the beat.

## 1. Technical format

| item | value |
|---|---|
| resolution | 1920×1080, square pixels |
| frame rate | 30 fps, **900 frames** total (0–899), exactly 30.000 s |
| tempo | **14 frames per beat** → BPM = 900/7 ≈ 128.571; bar = 4 beats = **56 frames** |
| audio | 48 kHz, stereo, 24-bit WAV master, exactly 1,440,000 samples; −14 LUFS integrated, true peak ≤ −1.0 dBTP |
| delivery | H.264 High, yuv420p, CRF ≤ 18 + AAC 320 kbps, `+faststart` |

Frame → seconds: `t = f / 30`. Beat n (0-based) starts at frame `14·n`. Bar k starts at frame `56·k`.
Bar start frames: 0, 56, 112, 168, 224, 280, 336, 392, 448, 504, 560, 616, 672, 728, 784, 840, (896).

## 2. Edit decision list (EDL): frame-accurate

| sect | frames | content (picture) | sound |
|---|---|---|---|
| S1 INTRO_TAIWAN | 0–111 | Fade from black (0–10). Deep space + stars, real Blue-Marble Earth with clouds, slowly rotating, **centered on Taiwan** (lon 121°E, lat 23.5°N). Pin pops on Taiwan at f28 with collage label “台灣 TAIWAN”. Tape label kicker “30 秒認識一個國家” at f56. | Atmospheric pad + sub drone, ticking/pluck motif, low-passed beat hint. Whoosh-in at f0, pin pop at f28, paper/tape SFX at f56. |
| S2 FLIGHT_ZOOM | 112–223 | f112–167: globe whips/rotates from Taiwan to Norway while a **great-circle flight arc** draws Taipei → Oslo; counter “8,694 km” (≈8,700 km). f168–223: camera **pushes in** from globe to Norway: globe texture crossfades into the high-res Sentinel-2 Scandinavia mosaic (≈f188–206); **Norway border stroke draws** f200–223. | Drums enter (filtered, opening up), rising arp. Jet-whoosh pan L→R f112–167, counter ticks. Zoom riser + reverse cymbal f168–223, accelerating snare roll in the last bar. **Dropout silence f220–223.** |
| S3 TITLE_DROP | 224–279 | **DROP on f224.** Collage title slam “挪威 NORWAY” (torn-paper plates, flag, stamp “KONGERIKET NORGE”) over frozen/slow-drifting satellite Norway. Stop-motion jitter on twos. | **Big impact** (boom + crash) f224; full beat: punchy kick, clap on 2&4, sidechained bass, Nordic-flavoured hook. |
| S4 FACTS F1 | 280–335 | **首都：奧斯陸 Oslo.** Sentinel-2 10 m crop of Oslo/Oslofjord, push-in, pin + marker circle. | Paper-rip whoosh f280, camera shutter at f294. |
| S4 FACTS F2 | 336–391 | **人口：約 563 萬** (count-up f336–364), halftone people cut-outs / dot grid; small source “SSB 2026.1.1”. | Rip f336, rapid counter ticks f336–364, “ding” f364. |
| S4 FACTS F3 | 392–447 | **面積：約 38.5 萬 km²**, Taiwan silhouettes stacking next to Norway outline: “≈ 10 個台灣大” (exact ratio from facts.json). | Rip f392, 10 pops, one per stacked Taiwan (f400–440). |
| S4 FACTS F4 | 448–503 | **峽灣 FJORDS**: real 3D flyover of Geirangerfjord (Copernicus DEM + Sentinel-2 texture), stamp “世界遺產” thunks in at f476. | Whoosh f448, stamp thunk f476. |
| S5 QUICKFIRE | 504–559 | 4 collage cards, one per beat, each slams in: f504 **貨幣 挪威克朗 NOK**, f518 **語言 挪威語**, f532 **冬季 極光** (aurora over real Lofoten terrain), f546 **夏季 午夜太陽**. | Stab + paper slap on f504, 518, 532, 546. |
| S6 TW_BUILD | 560–671 | Breakdown. Question types on: “那麼……在挪威的**台灣人**有多少？” (f560–600). Boarding-pass collage **TPE → OSL** (generic, no airline brand) f600–650, globe/arc callback. | Drums out, filtered pad + heartbeat kick, typewriter clicks f560–600, riser f616–663, **dead silence f664–671**. |
| S7 TW_REVEAL | 672–783 | **REVEAL IMPACT f672.** Giant number “約 N 人” count-up f672–700 with ROC-flag sticker; ratio line “平均每 X 位挪威居民才 1 位台灣人” f700–740 with dot-matrix visual; punchline f740–783 (e.g. “在挪威遇到台灣人 → 稀有度 ★★★★★”). Source footnote always visible. | **Biggest impact** f672 + second drop; count ticks f672–700 ending in a “ding”; bubbly pops f700–740. |
| S8 OUTRO | 784–899 | f784–839: recap montage, 8 cuts, one every 7 frames (fjord 3D, Oslo, aurora, Lofoten, globe, etc.) with collage frames. **f840 final hit**: end card “Velkommen til Norge · 歡迎來到挪威”, “下一站，出發！”, credits line (data attributions). Fade to black f885–899. | Stutter fills f784–839, **final hit f840**, ring-out tail, music ends by f899. |

## 3. Facts
All numbers on screen come from `facts/facts.json` (produced by research). Nothing on screen may be
un-sourced. Taiwanese-population figures must be shown as an estimate, with the source and year on screen.

## 4. Visual style guide

**Palette**
- Paper cream `#F1E9D8`, newsprint `#E4E0D6`, kraft `#C8A27A`, ink black `#141414`
- Norway red `#BA0C2F`, Norway navy `#00205B`, white `#FFFFFF`
- Accent aurora green `#3CF2B0`, highlighter yellow `#FFE14D`
- ROC flag red `#FE0000`, ROC blue `#000095` (for the Taiwan sticker only)

**Type** (Google Fonts, downloaded locally to `assets/kit/fonts/`)
- CJK headline: Noto Sans TC 900; CJK editorial: Noto Serif TC 900
- Latin display: Anton (condensed caps); data/labels: Space Mono 700
- Handwritten notes: LXGW WenKai TC (CJK) and Permanent Marker (Latin)

**Collage vocabulary**: torn-paper edges (irregular, with white fibre rim + soft drop shadow), paper
grain, halftone dots on photo prints, masking tape strips, rubber stamps (slightly misregistered),
marker circles/arrows/underlines (rough, hand-drawn stroke), stickers with white die-cut border,
newspaper clippings, film grain over everything, subtle gate weave. Cut-out elements animate
**on twos (15 fps)** with 1–3 px positional/rotational jitter; camera moves and the globe
run smooth at 30 fps. Elements enter with overshoot (snap in 3–5 frames), never slow fades.
Safe area: keep text inside the 90% title-safe region (96 px / 54 px margins).

## 5. Directory contract (all paths relative to `norway-tv/`)

```
SPEC.md                 this file
facts/facts.json        verified facts + sources
assets/raw/             downloads (three-globe textures in assets/raw/package/example/img/)
assets/geo/             satellite + DEM products (see assets/geo/README.md, written by producer)
assets/kit/             fonts/, textures/, svg/, kit.css, preview.html
renders/globe/          f0000.jpg … (full-frame 1920×1080 background plates for S1–S2)
renders/terrain/        3D terrain plates (fjord flyover, aurora)
audio/                  stems + master mix.wav + cues.json
comp/                   compositor (HTML + JS render(frame)) + recorder
out/                    final deliverable(s)
```

## 6. Environment facts (verified)
- 4 CPU cores, 15 GB RAM, no GPU. Python 3.11 with numpy/scipy/pillow/rasterio/mgrs installed; `pip install` works (PyPI reachable).
- Node 22 with Playwright + Chromium (`NODE_PATH=/opt/node22/lib/node_modules`). npm registry reachable.
- Full ffmpeg: `/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2`.
- **Reachable**: `sentinel-cogs.s3.us-west-2.amazonaws.com` (Sentinel-2 L2A COGs; TCI.tif has overviews 2/4/8/16; per-scene STAC JSON has `eo:cloud_cover`); `copernicus-dem-30m.s3.amazonaws.com`; `elevation-tiles-prod.s3.amazonaws.com` (terrarium tiles); `fonts.googleapis.com` / `fonts.gstatic.com` (send a desktop Chrome User-Agent to get woff2); registry.npmjs.org; pypi.org.
- **Blocked**: wikimedia, unsplash/pexels/pixabay, NASA sites, arcgis/google/osm tiles, SSB website, cdnjs/unpkg/jsdelivr.
- Do not use copyrighted media. All imagery must be open data (Sentinel-2, Copernicus DEM, NASA Blue Marble via three-globe npm) or generated.

## 7. Attributions (must appear in end-card credit line and README)
- Contains modified Copernicus Sentinel data [year].
- Copernicus DEM GLO-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the EU and ESA.
- Earth imagery: NASA Blue Marble (via three-globe).
