# NORWAY in 30s: soundtrack (music + SFX), mix & master

Everything here is **synthesised from scratch** in Python (numpy / scipy / numba). No samples, no
downloaded audio, no third-party presets, so the whole soundtrack is original and free of licensing issues.
It is locked frame-accurately to the EDL in `../SPEC.md`: frame *f* starts at sample *f × 1600* (48 kHz / 30 fps),
14 frames per beat, 56 frames per bar, BPM = 900/7 ≈ 128.571.

## Deliverables

| file | what |
|---|---|
| `mix.wav` | **master**: 48 kHz, 24-bit PCM, stereo, exactly 1,440,000 samples (30.000 s), −14 LUFS, true peak ≤ −1.0 dBTP |
| `music.wav` | music stem, unmastered, sample-aligned (post-duck, pre-master) |
| `sfx.wav` | SFX stem, unmastered, sample-aligned (pre-master) |
| `cues.json` | every SFX event (`frame`, `time_s`, `sample`, `name`, plus details such as end frame, pan, index), music markers (sections, silences, stabs, drops) and the beat grid |
| `render_soundtrack.py` | the complete score, sound design, mix and master. **All picture-locked numbers are in its `CONFIG` block** |
| `src/dsp.py` | DSP primitives: PolyBLEP oscillators, TPT state-variable filters (numba), Karplus-Strong, sympathetic-string comb bank, ping-pong delay, synthetic-IR convolution reverb, compressor, look-ahead true-peak limiter, soft-knee clipper |
| `src/synths.py` | instruments: kick, clap, snare, hats, toms, crash, shaker, tambourine, sub/mid bass, supersaw chords/stabs, choir pad, drone, hardingfele-style fiddle, plucks, glass bells, tonal riser |
| `src/sfx.py` | sound effects: whooshes, jet pass-by, pin pop, tape, paper rip/slap, shutter, ticks, dings, pops, stamp, typewriter, heartbeat, risers, impacts, downlifter |
| `analyze.py` | QC: loudness, true peak, DC, correlation, silences, hit prominence, click scan, spectral balance, plots; refreshes the table below |
| `spectrogram.png`, `waveform.png` | master spectrogram with momentary and short-term loudness, plus waveforms of master and both stems, with frame axis and EDL markers |
| `measurements.json` | the raw QC numbers |

`music.wav + sfx.wav` equals the pre-master mix (both scaled together so the sum peaks at −3 dBFS). The
music stem already contains the ducking under dense SFX, so the two stems re-sum to the mix balance.

## Re-render

```bash
pip install numpy scipy numba soundfile pyloudnorm matplotlib
python3 audio/render_soundtrack.py      # ~40 s on 4 cores -> mix.wav, music.wav, sfx.wav, cues.json
python3 audio/analyze.py                # QC + plots + refresh this README's measurement table
```

(`pedalboard` is not required: all effects, including reverb, delay, compression and limiting, are implemented in `src/dsp.py`, so the render is deterministic and portable. The first run JIT-compiles the numba kernels, which takes about 10 s.)

To move a cue, edit `CONFIG["cues"]` (frames) in `render_soundtrack.py` and re-render. Every SFX, the
silences (`CONFIG["silences"]`), stabs, aurora sparkle, end fade, section map, chord per bar, levels,
SFX gains, ducking and master targets live in that one block. The music structure follows
`CONFIG["sections"]` (bars) and `CONFIG["chords"]`. Debug buses (per-instrument pre-fader WAVs) are written to
`tmp/audio/bus_*.wav` and the numba JIT cache to `tmp/audio/numba_cache/`.

## Music

**Key / harmony**: D minor, one chord per bar, i–VI–III–VII (Dm–B♭–F–C), with the aeolian VII→i cadence into each drop:

| bar | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| chord | Dm | B♭ | F | C | Dm | B♭ | F | C | Dm | B♭ | F | C | Dm | B♭ | **C** | Dm |
| frame | 0 | 56 | 112 | 168 | 224 | 280 | 336 | 392 | 448 | 504 | 560 | 616 | 672 | 728 | 784 | 840 |

Bar 14 is C (not F) so the second drop ends on the "epic" ♭VI–♭VII–i cadence into the final hit.

**Structure**

| frames | section | what plays |
|---|---|---|
| 0–111 | intro | choir pad fading in ("oo" vowel), open-fifth drone D2-A2-D3 + sub drone, ticking **plucked-fiddle ostinato** (A-pedal "tick-tock" motif D–A–F–A–E–A–D–C that foreshadows the hook), soft clock ticks, glass bells, **low-passed kick hint** (LPF 170→420 Hz, clap hint in bar 1) |
| 112–219 | build | 4-on-the-floor drums through a 24 dB/oct LPF opening 300 Hz → 18 kHz, 16th saw-pluck **arp climbing an octave every half bar**, tonal supersaw riser, **accelerating snare roll** in bar 3 (8ths → 16ths → 32nds, pitch and level rising), kick 8ths at the end |
| 220–223 | **dropout** | digital silence |
| 224–503 | drop 1 (hook) | tuned kick 4/4, clap + snare on 2 & 4, swung 16th hats (54 %) with velocity humanisation, open hats on the off-beats, sidechained sub + off-beat mid-bass, 7-voice supersaw chords (3-3-4-2-4 sixteenth rhythm), **hardingfele-style bowed lead** hook doubled by a saw pluck, choir pad, drone, crash on f224 (and a lighter one on f448), tom fill into bar 8 |
| 504–559 | quickfire | full beat, **4 rising chord-stab inversions** on f504/518/532/546 (+ sub hits), glass-bell "aurora" sparkle arpeggio at f532 |
| 560–663 | breakdown | drums out; filtered choir pad (LPF 1.1 → 4.5 kHz, vowel "o"→"a"), drone, filtered pluck ostinato, bells, tonal riser from f616, quiet 16th → 32nd snare build in the last half bar |
| 664–671 | **dead silence** | digital silence |
| 672–783 | drop 2 (biggest) | everything from drop 1 plus an octave-up supersaw layer, bells doubling the hook an octave up, high 16th arp, shaker + tambourine, harder mid-bass drive, ghost claps, syncopated extra kick, crash f672 / f728, tom fill into bar 14 |
| 784–839 | stutter fill | beat-repeat on the music bus: beat 1 plain, beat 2 in 8th repeats, beat 3 in 16th repeats, beat 4 in 32nd repeats with rising pitch and a 60 Hz → 1.4 kHz high-pass sweep |
| 840–899 | final hit | kick + sub D + full Dm chord (supersaw + choir + drone + bells) + long bowed D5 with vibrato, all decaying into a cosine end fade (f872–899); the file ends in digital zero |

**Instrument design notes**

- **Kick**: sine with a 300 → 55 Hz pitch envelope (tail tuned to A1 = 55 Hz, the fifth of D), 1.4 kHz chirp "knock", band-passed noise click, tanh drive.
- **Clap / snare**: four-burst clap (0 / 9.5 / 18.5 / 27.5 ms) with band-passed noise tail, layered with a 195 Hz snare body and noise; short synthetic-IR room.
- **Hats**: additive 808-style metallic partials (all partials below 19 kHz, so band-limited by construction) plus filtered noise, 8 round-robin variants, velocity-dependent brightness, ±0.6 ms timing humanisation, swing 54 % (odd 16ths +448 samples).
- **Bass**: continuous-phase sine sub (never retriggered, so no phase clicks; gate edges are C¹-smooth) plus an off-beat saw/square mid-bass with filter envelope. The mid-bass oscillators, filter and drive all run at 2× oversampling. Sub stays mono; mid-bass is high-passed at 90 Hz.
- **Sidechain**: kick-keyed gain curves (bass −14 dB, chords/arp −9 dB, pad/drone/reverb returns −5 dB, lead −1.5 dB). The dip starts 2 ms before the kick (look-ahead) with a raised-cosine fall and quadratic recovery.
- **Hardingfele-style lead**: 2× oversampled band-limited saw with a bow envelope, pitch scoop into each note, ornamental upper-neighbour grace notes on accented notes, delayed vibrato, rosin noise, 7-mode violin body resonance bank, an open-D4 double-stop drone string (consonant with all four chords), and a comb bank of **sympathetic strings** tuned D4-E4-F4-A4-D5 (the Hardanger resonance strings).
- **Choir pad**: 5 continuous voice-led lines × 3 detuned saws with per-voice drift and vibrato, through a morphing formant filter bank ("oo" ↔ "ah"), breath noise, 1.35× M/S width, 3.3 s hall.
- **Glass bells**: additive inharmonic partials (1, 2, 2.76, 4.07, 5.4, 6.8, 8.93) with a beating partner partial for shimmer.
- **Space**: three synthetic stereo convolution reverbs (room 0.55 s, plate 1.5 s, hall 3.3 s; decorrelated L/R noise IRs with frequency-dependent decay and early reflections), plus a tempo-synced dotted-8th ping-pong delay (3 × 16th = 16,800 samples).

## SFX (`cues.json` has every event with frame, time and sample)

| frame(s) | SFX | design |
|---|---|---|
| 0 | whoosh-in | band-pass-swept pink/white air, right → centre with ITD panning, sub swell, glass shimmer, small hall |
| 28 | pin pop | cork-style upward sine sweep, click, pin "thock", paper crinkle |
| 56 | tape | masking-tape pull (accelerating Poisson crackle, 170 ms), then the stick-down pat at +130 ms |
| 112–167 | jet / air whoosh | pass-by panned **L → R** (−28 dB L to +24 dB R) with ITD, distance model, rumble and a Doppler turbine whine |
| 114–166 (every 2 f) | km-counter ticks | digital blips, alternating pitch, slowly rising |
| 168–219 | zoom riser | band-pass noise sweep 280 Hz → 9.5 kHz, rising sine glide, widening auto-pan; hard 3 ms cut at the dropout |
| 184–219 | reverse cymbal | reversed synthetic crash, peaks into the dropout |
| **224** | impact | sub boom (pitch-dropping to 42 Hz), trailer body + 200 Hz knock, noise crack, hall tail on mids and highs only (the sub stays dry and mono) |
| 280, 336, 392, 448 | paper-rip whooshes | fibre-tear crackle with resonant sweep plus an air whoosh, pan direction alternating per card |
| 294 | camera shutter | SLR mirror-up / curtain / mirror-return clicks (55 ms apart), small room |
| 336–363 (every f) + **364** | counter ticks + ding | 28 digital ticks rising in pitch and level; D6 ding with glass overtone |
| 400, 404 … 436 | 10 pops | bubbly water-drop pops rising through the D-minor pentatonic scale, panning L → R as the Taiwans stack |
| 476 | stamp thunk | low thud, desk-wood knock modes (190 / 430 / 960 Hz), rubber squish, room |
| 504, 518, 532, 546 | paper slap (+ music stab) | card slap burst, low "whap", paper flutter |
| 560 | downlifter | soft falling noise sweep plus sub drop into the breakdown |
| 560–600 (15 hits) + 600 | typewriter + bell | one key strike per glyph of 「那麼……在挪威的台灣人有多少？」 (slug click, key thunk, rattle; ±1 frame human timing, first and last exact), carriage bell at f600 |
| 560, 588, 616, 630, 644, 651, 658 | heartbeat | lub-dub (dub offset 6 → 3 frames), accelerating in the second bar |
| 616–663 | riser | bigger noise riser (220 Hz → 11 kHz) + reverse cymbal from f634, hard cut into dead silence |
| **672** | biggest impact | as f224 plus longer boom, metal/anvil partials, 3.4 s hall; the music dips 2 dB for 120 ms under it |
| 672–699 + **700** | count ticks + ding | 28 mechanical odometer ticks; A6 ding |
| 700, 702 … 738 | bubbly pops | 20 random-pentatonic pops, random pan and size (dot-matrix visual) |
| 784, 791 … 833 | stutter cut swishes | one short swipe per recap cut, alternating pan |
| 812–839 | reverse cymbal | swell into the final hit |
| **840** | final impact | shorter-tail version that ends inside the fade |

## Mix and master chain

1. **Gain staging**: every music bus is auto-levelled to a target solo loudness in its featured window (`CONFIG["levels"]`). Each SFX event is normalised to −20 LUFS momentary-max and then offset by `CONFIG["sfx_db"]`.
2. **Buses**: non-bass elements are high-passed (chords 160 Hz, stabs 120 Hz, lead pluck 200 Hz, arp 250 Hz, pad 170 Hz, reverb sends 200–250 Hz); the drum bus runs through an oversampled soft-knee clipper (−3 dB); the music bus has glue compression (2:1, ~2.7 dB average in drops); then a music fader ride for section contrast.
3. **Ducking**: the music ducks up to 3 dB under dense SFX (envelope follower on the "dense SFX" key: ticks, pops, rips, slaps, typewriter and so on) plus a 2 dB, 120 ms dip under the three impacts.
4. **Hard gates**: f220–223 and f664–671 are digital zero (2 ms fade into each hole, 0.5 ms fade out of it so the drop transient survives); cosine end fade f872–899.
5. **Master**: 20 Hz HPF, +0.5 dB low shelf at 90 Hz, −1.5 dB at 620 Hz, −1.2 dB at 2.9 kHz, stereo-linked bus compressor (1.8:1, soft knee), then an iterative gain + **look-ahead true-peak limiter** (4× oversampled peak detection, 4 ms look-ahead, ceiling −1.25 dBTP) until the integrated loudness is within ±0.05 LU of −14 LUFS. The limiter only exceeds 3 dB of gain reduction on the hits (f224, f448, the four stabs, f672, f840).

## Measurements (auto-generated by `analyze.py`)

<!-- QC:BEGIN -->

| measurement | value |
|---|---|
| format | 48000 Hz, 2 ch, PCM_24, 1,440,000 samples (30.000 s) |
| integrated loudness (pyloudnorm, BS.1770-4) | **-14.02 LUFS** |
| sample peak | -1.26 dBFS |
| true peak, 4x oversampled (polyphase) | **-1.25 dBTP** |
| true peak, 8x oversampled (cross-check) | -1.21 dBTP |
| max momentary / short-term | -8.8 / -11.4 LUFS |
| loudness range (approx. EBU R128 LRA) | 5.9 LU |
| PLR (TP - integrated) | 12.8 dB |
| DC offset L / R | 2.2e-05 / 2.3e-05 |
| stereo correlation (full band / < 120 Hz) | 0.88 / 0.979 |
| mono fold-down loudness change | -0.41 LU |
| clipped samples (>= 0 dBFS) | 0 |
| silence f220-223 | digital zero |
| silence f664-671 | digital zero |
| tail f890-899 peak / last sample | -54.1 dBFS / 0.0e+00 |
| hit prominence (momentary peak over median) | f224 +5.4 dB, f672 +5.1 dB, f840 +5.0 dB |
| section loudness | intro f0-111: -17.4, build f112-219: -15.2, drop1 f224-559: -13.6, breakdown f560-663: -16.6, drop2 f672-839: -12.7, final f840-899: -13.7 |
| spectral balance (dB re. total) | sub: -5.9, bass: -3.8, low-mid: -9.2, mid: -13.1, presence 2-5k: -14.4, brilliance: -17.7, air: -22.7 |
| click scan (isolated discontinuities; tonal buses solo + summed) | 1 flagged (see QC notes) |
| stems | music.wav -25.3 LUFS, sfx.wav -24.4 LUFS (pre-master, sum = pre-master mix) |

<!-- QC:END -->

## Self-review / QC notes

- **Loudness and peaks**: integrated loudness via `pyloudnorm` (BS.1770-4 gating). True peak is estimated with a 4× polyphase oversampling (`scipy.signal.resample_poly`) and cross-checked at 8×. Zero clipped samples.
- **Silences**: both holes are exact digital zero (verified sample by sample) and clearly visible in `spectrogram.png` / `waveform.png` (green and orange bands). The three hits follow them and are the most prominent events (see "hit prominence").
- **Clicks**: every note has raised-cosine or ADSR edges; the sub and pad are continuous-phase lines, and the sidechain dip is pre-triggered and smooth. `analyze.py` scans each tonal bus and the summed tonal buses for *isolated* discontinuities (a >10 kHz second-difference spike more than 12× the local band RMS and 4× any spike within ±40 ms, and no more than 50 dB below programme level). It detects a −30 dB click planted in a sine and does not flag clean band-limited saws. Limitation: a click hidden under a raw saw's own edges is masked for both the detector and, largely, the ear. The one remaining flag on the solo bass bus is the first saw edge of a note whose filter envelope then closes (a note attack, not a click), and nothing is flagged on the summed tonal buses.
- **Aliasing**: all bright oscillators (supersaws, fiddle, arp and stab plucks, risers, mid-bass including its drive stage) run PolyBLEP at 2× and are decimated with a Kaiser polyphase filter. Test tone A6 (1760 Hz): alias-to-harmonic energy below 20 kHz is **−56 dB** (−33 dB for PolyBLEP at 1×). Hats, crash and bells are additive with all partials below Nyquist. The soft clipper runs at 2×.
- **Harshness 2–5 kHz**: SFX bus −1.5 dB at 3 kHz, fiddle bridge-hill resonances trimmed, master −1.2 dB at 2.9 kHz; the 2–5 kHz band sits below the 1–2 kHz band in the balance table. Noise sources are low-passed (clap 9.5 kHz, snare noise 9 kHz, hats 14.5 kHz, crash −5 dB shelf, SFX bus 16 kHz) so the top octave falls off like a commercial master instead of hissing.
- **Low end / mono**: the sub, kick and impact booms are mono (correlation < 120 Hz ≈ 0.98); mono fold-down loses under 0.5 LU. DC offset is below 2e-5.
- **Sync**: every SFX sync point sits exactly on `frame × 1600`; the only intentional deviation is the ±1-frame human feel on the 13 inner typewriter keys (the actual frames are in `cues.json`).
