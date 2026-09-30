# Geo close-ups + 3D terrain inputs (satellite/terrain producer)

Real open data only: **Copernicus Sentinel-2 L2A** (sentinel-cogs, AWS Open Data) and
**Copernicus DEM GLO-30** (copernicus-dem-30m, AWS Open Data). There is no generated or stock imagery.

## Attribution (put this on the end-card credit line)

- `Contains modified Copernicus Sentinel data 2023-2025` (per file: Oslo 2024, Geiranger 2025, Lofoten 2024, Lysefjord 2025, Tromso 2024, Lofoten winter texture 2023)
- `Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA`

---

## A. Sentinel-2 10 m true-colour crops: `crops/`

All crops are exact **16:9**, north-up, at 10 m/px on the native UTM grid of the scene (no resampling).
They are graded JPEGs at quality 92 with 4:4:4 chroma. Each `<name>.json` holds the centre, the bbox in lat/lon and UTM, the corner lat/lons,
the GDAL geotransform, scene IDs and products, date, sun azimuth/elevation, grade params and **landmark pixel
positions** (for pins and marker circles, accurate to about 50 m).

| file | px | km | centre (lat, lon) | date | scene(s) | sun az/el | CRS |
|---|---|---|---|---|---|---|---|
| `oslo.jpg` | 2400×1350 | 24.0×13.5 | 59.9100, 10.7482 | 2024-08-12 | S2B_32VNM_20240812_0_L2A + S2B_32VPM_… | 170°/44° | EPSG:32632 |
| `geiranger.jpg` | 3040×1710 | 30.4×17.1 | 62.1100, 7.1000 | 2025-07-18 | S2A_32VLP_20250718_1_L2A + S2A_32VMP_… | 167°/49° | EPSG:32632 |
| `lofoten.jpg` | 4000×2250 | 40.0×22.5 | 67.9300, 13.0935 | 2024-08-05 | S2B_33WVR_20240805_0_L2A | 177°/39° | EPSG:32633 |
| `lysefjord.jpg` | 2400×1350 | 24.0×13.5 | 59.0200, 6.1899 | 2025-07-11 | S2B_32VLL_20250711_0_L2A | 167°/53° | EPSG:32632 |
| `tromso.jpg` | 2400×1350 | 24.0×13.5 | 69.6500, 18.9600 | 2024-08-14 | S2A_34WDC_20240814_0_L2A | 179°/34° | EPSG:32634 |

Landmarks included in the JSON as `landmarks.{name}.px` / `.uv`:
- **oslo**: Opera House, Central Station, Royal Palace, Akershus Fortress, Holmenkollen
- **geiranger**: Geiranger village, Hellesylt, Seven Sisters waterfall
- **lofoten**: Reine, Hamnøy, Å, Hermannsdalstinden
- **lysefjord**: Preikestolen, Jørpeland
- **tromso**: centre, Arctic Cathedral, airport, Storsteinen/Fjellheisen

`crops/previews/contact_sheet.jpg` shows every product on one sheet.

### Scene selection
For every site I scanned all June–August 2023–2025 L2A scenes over every MGRS tile touching the
box: 190–445 scenes per site, with the STAC `eo:cloud_cover` and footprint checked against the exact crop box. I ranked them by SCL
cloud, shadow and snow fractions *inside the box*, then compared TCI contact sheets and graded 100 % crops by eye.
Rejects included haze, cloud puffs, boat-wake patterns, heavy June snow (Geiranger 2023), saturated-blue shadowed cliffs
(Lysefjord 2025-08-17) and low-sun shadowed fjords (Geiranger 2025-08-25).

### Notes
- **Mosaics**: Oslo (NM+PM) and Geiranger (LP+MP) cross S2 tile edges. They are built from tiles of the **same
  datatake**, feather-blended over a 3 km overlap, with no visible seam.
- **Lofoten centre** was moved 1.8 km east (13.05 → 13.0935 E, which is Reine itself). The western neighbour tile
  33WUR is open sea and has no acquisitions, so a 40 km box centred at 13.05 E would have had a nodata strip.
- **Oslo centre** moved 110 m west to stay on the tile grid. **Geiranger** is 30.4 × 17.1 km so that it is exact 16:9.
- **Geiranger** has one small (~800 m) real cloud puff just east of Hellesylt (px ≈ 400, 1120). Its S2
  band-parallax colour fringe was neutralised (it is now a white puff). Otherwise the frame is clear.
- **Source bands**: the scenes were chosen from `TCI.tif`, but the final pixels come from the **same scene's
  16-bit B04/B03/B02 reflectance**. It has identical geometry, and TCI (8-bit, median DN 20–35) posterises in water and forest
  once brightened.

### Grade (identical recipe for every product, `tmp/geo_crops/grade.py`)
1. Per-channel dark-offset dehaze.
2. Exposure normalised on land pixels (SCL veg/non-veg) so the median land tone sits at sRGB 0.40.
3. ACES filmic curve with a soft shoulder, so snow does not clip hard.
4. Oklab chroma ×1.10 plus vibrance.
5. "Clarity" local contrast (σ = 28 px) and a fine sharpen.
6. Subtle navy tint on water only.
7. Sky-blue cast in topographic shadows (SCL "dark area") re-coloured toward the surrounding terrain.

The result is rich but natural, with deep-navy fjords and turquoise shallows.
Film grain and halftone are **not** baked in; add those in comp.

---

## B. DEM + texture pairs for 3D terrain: `dem/`

| file | what |
|---|---|
| `geiranger_dem.npy` / `.f32` | float32 heights in metres, shape **1200 × 1800** (H×W), **20 m** pixels, row 0 = north |
| `geiranger_tex.jpg` | Sentinel-2 texture **3600 × 2400**, 10 m, exactly the same extent (2 texels per DEM pixel) |
| `geiranger_water.png` | water mask on the DEM grid: 255 = sea/fjord (0 m), 128 = lake, 0 = land |
| `geiranger_hillshade.png` | hillshade preview (NW light, sea in navy) |
| `geiranger_align.jpg` | alignment check: texture × hillshade with the DEM coastline drawn in yellow |
| `geiranger_dem.json` | grid, extent (UTM + lat/lon corners), geotransforms, stats, scene IDs, baked sun, alignment metrics |
| `lofoten_*` | same set for Lofoten (Moskenesøya / Reine / Flakstadøya) |
| `lofoten_tex_winter.jpg` | **extra**: snow-covered Lofoten texture (2023-04-10, clear) on the identical grid, for the night **aurora** render |

**Geiranger**
- Grid: EPSG:32632, UTM x 379790–415790, y 6878210–6902210 (36 × 24 km).
- Lat/lon: 62.017–62.242 N, 6.687–7.391 E; centre 62.13 N 7.04 E.
- Contents: Sunnylvsfjorden (N–S) and Geirangerfjord (to Geiranger village, right third), with Hellesylt at the junction.
- Heights: 0 – 1847 m.
- Texture: S2A 2025-07-18, 4-tile same-datatake mosaic.
- Source DEM tiles: N62 E006 + N62 E007.

**Lofoten**
- Grid: EPSG:32633, UTM x 400350–436350, y 7527690–7551690 (36 × 24 km).
- Lat/lon: 67.847–68.072 N, 12.609–13.487 E.
- Heights: 0 – 1018 m. The maximum is Hermannsdalstinden, 1029 m on maps.
- The frame is 75 % sea.
- Texture: S2B 2024-08-05. The winter texture is S2B 2023-04-10, graded with the same exposure so the sea tones match.
- Source DEM tiles: N67/N68 × E012/E013.

**Water**
- WBM ocean pixels, including the fjords, are **exactly 0.0 m**.
- Land is clamped to ≥ 0 m.
- Lakes stay flat at their Copernicus level.
- Heights are relative to the EGM2008 geoid, so sea level is about 0.

**Alignment**
- Integer-pixel IoU search, Sentinel-2 SCL water vs DEM WBM water over ±4 px: the best match is at **0,0 shift** for both
  (IoU 0.79 Geiranger with narrow fjords and lakes, 0.98 Lofoten; winter sea IoU 0.986).
- Visually, the yellow DEM coastline in `*_align.jpg` follows the fjord and island shorelines in the texture at pixel level.

**Loading**
- Python: `np.load('geiranger_dem.npy')`.
- JS/three.js: `new Float32Array(await (await fetch('geiranger_dem.f32')).arrayBuffer())`, W = 1800, H = 1200, little-endian.
- UV: DEM pixel (r,c) ↔ u = (c+0.5)/1800, v = (r+0.5)/1200. Texture and DEM are both north-up and cover the same extent.
- Vertical exaggeration of 1.0–1.3 looks right. Geiranger's walls are already about 1400 m high over a 1–2 km wide fjord.

**Lighting**
- Shadows are baked into the textures from a southern sun: Geiranger az 167° / el 49°, Lofoten az 177° / el 39°,
  winter az 176° / el 30°.
- For a daylight flyover, put the key light near that direction so the baked shadows and the rendered shading agree.

---

## Reproduce
Scripts are in `tmp/geo_crops/`:

| script | job |
|---|---|
| `scan.py` | STAC scan and footprint coverage |
| `preview.py` | SCL stats and contact sheets |
| `fetch.py` | 10 m reflectance and SCL mosaic |
| `grade.py` | the grade |
| `dem.py` | GLO-30 → UTM 20 m plus WBM |
| `produce.py` | writes all deliverables |
| `landmarks.py` | landmark pixel positions |

Picks are in `produce.py` (`PICKS`, `WINTER`). All reads are HTTPS range requests through rasterio/GDAL with TLS verification on.
