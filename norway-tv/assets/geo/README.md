# assets/geo

Satellite and vector products for *NORWAY in 30s*. Close-up crops and DEM/terrain inputs are documented
separately in [`README_crops.md`](README_crops.md). Other producers can add their sections below. Please keep the
`<!-- BEGIN mosaic -->` / `<!-- END mosaic -->` block as it is.

<!-- BEGIN mosaic -->
## mosaic: Scandinavia regional mosaic, globe texture, outlines

Used for EDL **S2 f168–223** (globe → Norway push-in; texture crossfade ≈ f188–206, border stroke f200–223) and
**S3** (frozen or slowly drifting satellite Norway behind the title).

### Files

| file | size | what |
|---|---|---|
| `scandinavia_mosaic.jpg` | 12000×4500, q92 4:4:4, 18 MB | Cloud-free true-colour summer composite, Sentinel-2 L2A, with Blue-Marble ocean |
| `scandinavia_mosaic.json` | | bounds, grid, method, grade, **per-tile scene list** (3,478 scenes, 437 MGRS tiles) |
| `scandinavia_wide_lowres.jpg` / `.json` | 5583×1542 | Same pipeline and grade at 0.012°, wider extent −9…58°E / 54…72.5°N (adds Scotland/N. Ireland and NW Russia up to the Urals). A mid-zoom LOD, also used inside the globe texture |
| `globe_texture_8k.jpg` / `.json` | 8192×4096 | Whole-world equirectangular texture: Blue Marble ×2 (Lanczos) with the two mosaics blended in so the seam doesn't show |
| `norway_outline.geojson` | | NE 1:10m Norway split into features by `part`: `mainland` (mainland + coastal islands, 97 polygons), `svalbard`, `jan_mayen`, `bouvet` |
| `norway_outline_simplified.geojson` | | for animated strokes: `mainland` at 1.5 km (islands ≥15 km²), `mainland_main_ring` (**single closed LineString, 1,993 vertices, starts at Lindesnes**), and the coarse 5 km versions `mainland` + `mainland_main_ring_coarse` (826 vertices) |
| `taiwan_outline.geojson` | | `main_island` (Polygon) and `all` (incl. Penghu, Kinmen, Green I., Orchid I.) |
| `taiwan_outline_simplified.geojson` | | `main_island` at 0.8 km and `main_island_ring` (closed LineString, 144 vertices, starts at the northern tip) |
| `sweden_outline.geojson`, `finland_outline.geojson`, `nordic_neighbours.geojson` | | NE 1:10m Sweden, Finland (+ Denmark, Estonia, and Russia clipped to 10°W–60°E) |
| `preview_scandinavia_mosaic.png` | 3000×1125 | downscaled full mosaic (as stored, plate carrée) |
| `preview_norway_1080p.png` | 1920×1080 | Norway framing: mosaic over the globe texture, aspect-corrected, NE mainland outline in Norway red |
| `preview_globe_texture.png` | 2048×1024 | globe texture thumbnail |
| `mosaic_src/` | | the pipeline scripts (Python). The working cache is in `tmp/mosaic/` |

### Grid / projection (scandinavia_mosaic.jpg)

- **EPSG:4326, plain equirectangular (plate carrée), north-up, pixel-is-area.**
- Bounds: **west −4.0°, east 44.0°, south 54.0°, north 72.0°**. Pixel **0.004° × 0.004°**. 12000 × 4500 px.
- GDAL geotransform `[-4.0, 0.004, 0, 72.0, 0, -0.004]`
- `lon = -4 + (col + 0.5) * 0.004`, `lat = 72 - (row + 0.5) * 0.004`, `u = (lon + 4) / 48`, `v = (72 - lat) / 18`.
- On the ground a pixel is 445 m N–S. E–W it is 262 m at 54°N, 193 m at 64°N and 138 m at 72°N. The source is about 160 m.
- In a flat 2D framing, scale x by cos(φ₀). At the centre of Norway, 64.5°, that factor is 0.4305. `preview_norway_1080p.png` uses lon₀ 17.6°E, lat 57.3–71.9°N,
  0.013519°/px vertical and 0.031401°/px horizontal.
- Globe texture: lon −180…180 (u = 0 at 180°W), lat 90…−90, 360/8192 °/px. This is the three-globe convention.

### How the mosaic was made

1. **Tiles.** Natural Earth 1:10m land (world-atlas@2, buffered 0.04°) was sampled every 0.04° and turned into MGRS 100 km
   squares (`mgrs` package). That gave 506 squares. 70 of them don't exist in the Sentinel-2 grid (band or zone-edge squares), and every one of their land
   points was checked to be covered by a neighbouring tile. One extra tile was added (32WPU).
2. **Scenes.** The `sentinel-cogs` bucket was listed for June–August 2023–2025. `eo:cloud_cover` and the no-data % were read
   from each scene's STAC JSON (first 2 KB, via an HTTP Range request). Months were scanned in the order Jul → Aug → Jun, stopping once a tile had enough clear coverage.
   Each tile got up to 10 scenes, lowest cloud first. The 46 snowy Scandes tiles got up to 6 extra late-July/August looks.
   In total 3,478 scenes were used, dated 2023-06-02 to 2025-08-31. Most are July (2,664) and August (721). The per-tile lists are in the JSON.
3. **Reads.** Over HTTPS with rasterio: the TCI.tif 1/16 overview (687² px, ≈160 m) and SCL.tif resampled to the same grid (nearest).
   10 threads were used, about 2.3 GB downloaded for the main mosaic (2.8 GB including the wide fringe), cached as `.npz` in `tmp/mosaic/cache/`.
4. **Per-tile composite** (on the tile's UTM grid):
   - Masked out: SCL 0/1/3/8/9/10 (no-data, saturated, cloud shadow, cloud medium/high, thin cirrus) and TCI no-data.
   - Rejected as outliers: looks brighter than 1.35×median+12 (thin haze or cloud) or darker than 0.55×median−4 (missed shadows).
   - Snow: where a clear snow-free look exists, snow-classified looks (SCL 11) are ignored. This gives a late-summer look while the
     glaciers stay.
   - Statistic: per-pixel **median**. Where a pixel has no clear look, the 25th percentile of all valid looks is used instead.
5. **Mosaic.** Each tile is reprojected to the lat/lon grid (GDAL `average`) with ~3.8 km distance feathers. Per-tile,
   per-channel gains come from a least-squares fit on 1,409 tile overlaps, with a strong prior toward 1.0.
6. **Water.** Sea is SCL-water connected to the open sea, seeded outside Natural Earth land. Sea pixels take their colour from a
   **Blue Marble ocean field**: three-globe `earth-blue-marble.jpg` with land and island pixels removed, inpainted, de-blocked (σ = 2 px) and
   cubic-upsampled. The sea therefore matches the globe exactly, including BM's shelf/deep-basin shading.
   Shorelines are anti-aliased from the SCL water fraction. Lakes and narrow inner fjords keep their Sentinel-2 texture, toned toward deep
   navy, and blend softly into the sea colour. The ocean has no tile boundaries.
7. **Grade** (natural but rich):
   - dehaze with a TCI black point of (7, 11, 6)
   - a luminance tone curve applied hue-preserving: TCI `[0,6,14,22,30,45,70,110,170,255] → [0,4,22,42,58,84,117,151,192,238]`
   - saturation ×1.12 and a soft knee above 225 (so snow and glaciers keep detail)
   - ±0.6 DN dither against banding

   Land that Sentinel-2 doesn't cover falls back to Blue Marble, colour-fitted to the grade. Within the frame this is only
   a few isolated pixels.

Checks run: no pure-black holes (358 px with max < 8 in 54 Mpx, all small lakes and steep shadows). No cloud remnants were found
over Norway in 1:1 and 1:2 inspections of the whole coast from Lindesnes to Varanger. No visible tile seams on land.

### Globe texture (globe_texture_8k.jpg)

The base is Blue Marble ×2. The wide 0.012° mosaic and then the 0.004° mosaic are inserted. Four steps hide the seam:
- a 1.6° smoothstep alpha ramp inside the inserted area, with a 5° taper at the far-east edge (58°E)
- the inserted imagery is softened progressively toward its edge to match BM's sharpness
- the low-frequency (mosaic − BM) land-colour difference is bled outward with a ~3° fade
- east of 58°E, BM's spring-snow veil over Russia is thinned and pulled toward the edge colour over 20°, so the snow line ends up
  near or beyond the Urals

Everything outside lon −30…90 / lat 30…85 is untouched Blue Marble.

### Notes for the globe / comp renderers

- **Crossfade.** Inside the mosaic area, `globe_texture_8k.jpg` already *is* the mosaic, downsampled. When you draw the high-res
  `scandinavia_mosaic.jpg` patch over the globe, feather its alpha to 0 across its outer ~1.2–1.6°. Use a smoothstep of the distance
  to the nearest edge. With that the swap can't be seen. `scandinavia_wide_lowres.jpg` can be an intermediate LOD. It fades to the
  same imagery.
- A Norway-fitted 16:9 frame (lat 57.3–71.9) spans ≈ −12.5…47.7°E. Beyond 44°E and west of 4°W the frame shows the wide
  mosaic via the globe texture, which is real Sentinel-2 at 0.012°.
- The outlines are Natural Earth 1:10m, public domain, quantised ~0.002–0.004°, and match the mosaic to within ~1 px at 0.004°.
  **NE polygon areas are for drawing only:** mainland ≈ 319,000 km², Taiwan main island ≈ 35,900 km², all of Taiwan ≈ 36,200 km².
  On-screen numbers must come from `facts/facts.json`.
- Colours are graded for sRGB display. Don't add extra saturation on top. The comp's own film grain and weave go over it.

### Attribution (for README and end card)

- **Contains modified Copernicus Sentinel data 2023–2025.** (Sentinel-2 L2A via the AWS Open Data `sentinel-cogs` bucket)
- **Earth imagery: NASA Blue Marble (via three-globe).** (ocean colour in the mosaic, and the base of the globe texture)
- Vector outlines: Natural Earth (public domain), via the world-atlas@2 npm package.

### Reproduce

The scripts are in `mosaic_src/`. Run them from `tmp/mosaic/scripts/` in this order: `enum_tiles` → `scan` → `alt_tiles` → `fetch` → `tilecomp` →
`scan_aug` + `fetch` + `tilecomp` (snowy tiles) → `warp_tiles` → `assemble` → `prep_aux` → `finish` → the fringe
(`enum_fringe`, `scan`, `fetch`, `tilecomp`, then `MOSAIC_GRID=fringe` `warp_tiles`/`assemble`/`prep_aux`/`finish`) → `globe` → `outlines` → `previews`.
Every step caches to `tmp/mosaic/`. From the cache, a full rebuild of steps 4–7 takes about 6 minutes on 3 cores.
<!-- END mosaic -->
