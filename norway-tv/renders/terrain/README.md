# Terrain plates: Geirangerfjord flyover + Lofoten aurora

Photoreal aerial plates rendered from real open data: Copernicus DEM GLO-30 heights and a
Sentinel-2 texture, with no stock imagery. All frames are 1920×1080 JPEG q95 (4:4:4), 30 fps.

| plate | frames | EDL use |
|---|---|---|
| `geiranger/f0000–f0069.jpg` | 70 | f0000–f0055 → S4 FACTS F4 (f448–503). f0056–f0069 continue the motion, for the recap cut. |
| `aurora/f0000–f0047.jpg` | 48 | S5 QUICKFIRE card “冬季 極光” (f532–545, any 14 consecutive frames) + recap. |

`geiranger_contact.jpg` and `aurora_contact.jpg` are the contact sheets (frame numbers in yellow).

## 1. Geirangerfjord flyover (midday)

**Shot.** The camera flies up the NE-running reach of Geirangerfjord toward the Seven Sisters wall,
about 1.3 km above the water. The walls on either side are 1000–1300 m high. It starts looking down
into the fjord, then pushes forward with a slow **tilt-up reveal** of the snow-capped peaks and sky
behind Geiranger. The Ørnevegen hairpins are visible top right.

| frame | lat, lon | alt | yaw (° from N) | pitch | roll |
|---|---|---|---|---|---|
| 0  | 62.0855 N, 7.0714 E | 1320 m | 28.0 | −19.0 | 0.0 |
| 55 | 62.0939 N, 7.0815 E | 1379 m | 39.1 | −13.2 | +3.4 |
| 69 | 62.0952 N, 7.0831 E | 1390 m | 40.0 | −12.5 | +3.5 |

- The path is a quadratic Bézier, 1.24 km in total.
- The push decelerates smoothly, from about 780 m/s at f0 to about 300 m/s at f69, using `ease(u) = 1.45u − 0.45u²`. It never stops, so the cut in at f448 lands on motion.
- Yaw pans 28° → 40°, pitch tilts up −19° → −12.5° (smoothstep), and the camera banks slowly to +3.5°.
- HFOV is 62°.
- The motion blur is physically sampled: a 0.4 shutter, with the 6 sub-samples spread across it.
- Continuity check: the mean absolute difference between consecutive frames runs 3.0–7.7 and changes smoothly (max/median 1.12). There are no jumps and no flicker.

**Look.**
- Key light matches the baked texture sun (az 166.85°, el 48.71°, from the json).
- Cast shadows are ray-traced from that sun.
- Aerial perspective uses height-dependent haze: β₀ = 5e-5 /m, scale height 2 km, tinted warmer toward the sun.
- Sky is a gradient with a sun-side horizon glow and a sparse, drifting fair-weather cloud layer.
- Water is dark navy, using the median of the Sentinel-2 open-water pixels. It has Fresnel reflections of the terrain and sky, ray-traced; gravity-dispersion waves that fade out below the pixel footprint; and a sun glint, shadow-masked.
- Grade: the Sentinel-2 grade is kept, as identity up to a soft shoulder. On top of that: a gentle S-curve, warm highlights, cool shadows, a light unsharp mask, bloom and a vignette.
- There is **no grain**, so add it in comp.
- Vertical exaggeration is **1.10**.

## 2. Lofoten aurora (winter night)

**Shot.**
- Camera sits on the water about 1.5 km SE of Reine, 48 → 54 m above the sea, looking NNW over the moonlit snowy peaks of Moskenesøya.
- f0 at 67.9087 N, 13.0888 E; f47 at 67.9094 N, 13.0926 E.
- It drifts slowly sideways by 160 m while panning 341.5° → 338.5° and tilting 7.5° → 8.1°.
- HFOV is 78°, like a 22 mm aurora lens.
- Shutter is 0.5.

**Look.**
- **Terrain** uses the snow texture `lofoten_tex_winter.jpg` (2023-04-10). It is lit by a low moon behind the camera (az 168°, el 22°, near the baked sun azimuth so the baked shadows agree), with ray-traced moon shadows. The light is desaturated to a cool long-exposure white balance, plus green bounce light from the aurora on the snow.
- **Sea** is glassy (long exposure), with ray-traced mirror reflections of the peaks, aurora and stars.
- **Stars**: about 9000 stars on the celestial sphere, with a realistic magnitude distribution and colour tints. They are splatted as Gaussian PSFs, hidden behind terrain, and also reflected, dimmed by Fresnel and slightly blurred.
- **Aurora**: four procedural curtains at 215–690 km distance, with bottoms at about 100 km altitude and a spherical Earth. Each is a thin vertical sheet hanging over a folding curve.
  - For every view direction, the ground track of the ray is intersected with each curve. The sheet's Gaussian cross-section is integrated analytically (erf) along each segment, so folds seen edge-on brighten naturally with no hard edges.
  - Emission depends on the altitude of the ray: a sharp, bright green base band (#3CF2B0-ish), fading streaky rays above it, violet/magenta tops, and a faint pink lower fringe.
  - The folds travel and the rays drift slowly along the curtains.
  - The aurora is baked each frame into a 0.06° direction map, softened slightly to mimic a long exposure, and used for both the sky and the reflections.
- **Grade**: exposure, a soft glow, a filmic shoulder, slightly lifted blacks and a vignette. There is no grain.
- Vertical exaggeration is **1.20**.

## 3. Technique (CPU only, numba)

- **Height field.** The 20 m DEM is upsampled **bicubically** to 10 m. Sea is kept at exactly 0 m and lakes stay flat. Shorelines are smoothed, sub-pixel, from a blurred cubic-upsampled water mask.
  - Subtle **fall-line rock relief** is added on steep land only: anisotropic ridged noise oriented down the slope, up to about ±7 m. It breaks up the "melted" look of 30 m source data.
  - The field is mirror-padded by 5–6 km so that no terrain edge or hole is ever visible.
- **Ray casting.** Hierarchical **max-mip traversal** with an **exact ray / bilinear-patch intersection** (a quadratic solve) at the finest level. This gives a continuous surface, with no voxels, stair-steps or holes, and it was verified against brute-force marching. Beyond the padded domain there is a sea plane, which gives a stable horizon.
- **Texturing.**
  - The 10 m Sentinel-2 texture is Lanczos-upsampled to 5 m, lightly sharpened, linearised and **mip-mapped**.
  - Lookups are **trilinear**. The LOD comes from a ray-differential footprint projected onto the texture plane, and noise octaves are faded against the footprint.
  - Detail is self-similar: a high-pass of the texture's own luminance at 1/4 and 1/16 scale, in world space, fading as the footprint approaches the texel size.
  - All of this is stable in world space, so nothing swims or shimmers.
- **Cliffs.** Steep faces, where the nadir texture only carries smeared pixels, switch smoothly to a lit rock material. It keeps the regional tint of the real texture, adds triplanar vertical stain/gully structure, and is lit by the same sun with the ray-traced cast shadows.
- **Anti-aliasing.** 6 samples per pixel on a fixed 6-rook pattern, the same every frame so the result is temporally stable, with the shutter time decorrelated from the sample position.
- **Timing.** On 2 threads: Geiranger took about 14 s per frame (70 frames in about 17 min); the aurora took about 27 s per frame on 3 threads.

### Files

| file | job |
|---|---|
| `terrain_core.py` | data prep and cache (bicubic DEM, relief, masks, normals, max-mip, texture mips, shadow maps) and the core kernels (traversal, texture sampling, noise) |
| `day_kernel.py` | midday shading: terrain / cliff / detail, water, sky, clouds, haze |
| `night_kernel.py` | analytic aurora direction map, moonlit terrain, night sea and sky |
| `render_geiranger.py` | Geiranger camera path, parameters, frame loop |
| `render_aurora.py` | Lofoten camera, aurora curtain set, stars, night grade, frame loop |
| `post.py` | tone mapping and grade |
| `contact_sheet.py` | contact sheet and consecutive-frame continuity metric |

### Reproduce

The cache goes to `tmp/terrain/cache/`; building it takes about 1 min per scene.

```
NUMBA_NUM_THREADS=2 python3 render_geiranger.py --frames 0-69     # --scale 0.5 --spp 1 for previews
NUMBA_NUM_THREADS=2 python3 render_aurora.py   --frames 0-47
python3 contact_sheet.py geiranger geiranger_contact.jpg 10
python3 contact_sheet.py aurora aurora_contact.jpg 8
```

## Attributions

- Contains modified Copernicus Sentinel data 2024–2025. The Geiranger texture is S2A 2025-07-18. The Lofoten winter texture is S2B **2023-04-10**, so for this plate alone the credit could read 2023–2025.
- Copernicus DEM GLO-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the EU and ESA.
- The aurora, stars, clouds, waves and fine rock detail are procedurally generated. There is no third-party imagery.
