# NORWAY in 30s: delivery

| file | use |
|---|---|
| `norway_30s_1080p.mp4` | **Upload master**: 1920×1080, 30 fps, H.264 High ~16 Mbps, AAC 320 kbps, 30.00 s, −14.0 LUFS / −1.1 dBTP |
| `norway_30s_preview.mp4` | Light preview for phones / messaging (~6 Mbps) |

## Structure (frame-accurate, 14 frames per beat ≈ 128.6 BPM)
| time | section |
|---|---|
| 0:00–0:03.7 | Real Blue-Marble Earth, pin on Taiwan, kicker 「30 秒認識一個國家」 |
| 0:03.7–0:07.5 | Flight arc Taipei → Oslo (約 8,700 km), dive from space into a real Sentinel-2 view of Norway, border draws on |
| 0:07.5–0:09.3 | DROP: title slam 「挪威 NORWAY」 |
| 0:09.3–0:16.8 | FACT 01–04: capital Oslo (10 m satellite), population 約 563 萬, area 約 38.5 萬 km² (超過 10 個台灣大), 3D Geirangerfjord flyover (real DEM) + 世界遺產 stamp |
| 0:16.8–0:18.7 | Quickfire FACT 05–08: NOK, Norwegian, northern lights (Lofoten night), midnight sun |
| 0:18.7–0:26.1 | Taiwanese in Norway: typewriter question → boarding pass → silence → **約 400 人** (estimate, with source) → 1 in 14,000 → 「稀有度 ★★★★★」 |
| 0:26.1–0:30 | Recap montage → end card 「Velkommen til Norge · 歡迎來到挪威」 + credits |

## Before publishing: fact check (please do this)
Primary sources could not be opened from the production environment (egress blocked), so the figures rest on search-engine excerpts plus independent arithmetic checks. See `../facts/SOURCES.md`.
1. **約 400 名台灣人**: Stortinget, Dok. 8:166 S (2023–2024): "de rundt 400 taiwanerne som oppholder seg i Norge".
   <https://www.stortinget.no/globalassets/pdf/representantforslag/2023-2024/dok8-202324-166s.pdf>
   Norway registers Taiwanese as Chinese nationals, so there is no separate official count; the video labels the figure 估計值 with the source.
2. **人口 5,627,400 (2026-01-01)**: SSB <https://www.ssb.no/en/befolkning/folketall/statistikk/befolkning>
If either changes, edit `facts/`, then re-render (`comp/record.js` → `comp/encode.sh`); the ratio line is asserted by `tmp/facts-edit/build_facts.py`.

## Credits / attribution (also on the end card)
- Contains modified Copernicus Sentinel data 2023–2025.
- Copernicus DEM GLO-30 © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the European Union and ESA.
- Earth imagery: NASA Blue Marble (via three-globe). Borders: Natural Earth.
- Fonts: Noto Sans/Serif TC, LXGW WenKai TC, Anton, Space Mono (SIL OFL 1.1); Permanent Marker (Apache 2.0).
- Music and all sound effects: original, synthesized for this project (no samples).
