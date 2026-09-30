#!/usr/bin/env python3
"""
render_soundtrack.py - NORWAY in 30s: complete score + SFX + mix + master, synthesised from scratch.

    python3 audio/render_soundtrack.py            # full render -> audio/mix.wav, music.wav, sfx.wav, cues.json
    python3 audio/render_soundtrack.py --quick    # skip per-bus debug stems

Everything that is locked to picture lives in the CONFIG block below (frame numbers @ 30 fps).
Shift a cue there and re-render; music structure follows CONFIG['chords'] / CONFIG['sections'].
Frame f -> sample f*1600 (48 kHz). 14 frames/beat, 56 frames/bar (BPM = 900/7).
"""
import os
import sys
import json
import time
import argparse

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "src"))
os.environ.setdefault("NUMBA_CACHE_DIR", os.path.join(ROOT, "tmp", "audio", "numba_cache"))

import numpy as np
import soundfile as sf
import pyloudnorm as pyln

import dsp
import synths
import sfx as SFX
from dsp import FS, mtof, pan, place, fade_edges, as_stereo, svf, hpf, lpf, peq, highshelf, lowshelf

# ============================================================================================ CONFIG
CONFIG = {
    "fps": 30,
    "fs": 48000,
    "n_frames": 900,
    "frames_per_beat": 14,
    "swing": 0.54,             # 16th swing (fraction of the 8th given to the first 16th)
    "seed": 2026,
    # one chord per bar (bar k starts at frame 56k). D minor, i-VI-III-VII; bar 14 = VII -> i cadence.
    "chords": ["Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C", "Dm", "Bb", "C", "Dm"],
    # sections in bars [start, end)
    "sections": {"intro": [0, 2], "build": [2, 4], "drop1": [4, 9], "quickfire": [9, 10],
                 "breakdown": [10, 12], "drop2": [12, 14], "stutter": [14, 15], "final": [15, 16]},
    # hard silences [start_frame, end_frame) - everything muted (music + sfx)
    "silences": [[220, 224], [664, 672]],
    "end_fade": [872, 900],    # cosine fade to digital zero, music tail rings out inside it
    # ---------------------------------------------------------------- SFX cue sheet (frames)
    "cues": {
        "whoosh_in": [0],
        "pin_pop": [28],
        "tape": [56],
        "jet_whoosh": [112, 168],                                  # [start, end)
        "flight_ticks": {"start": 114, "end": 166, "step": 2},     # km counter during flight arc
        "zoom_riser": [168, 220],
        "reverse_cymbal_1": [184, 220],
        "impact_big": [224],
        "paper_rip": [280, 336, 392, 448],
        "shutter": [294],
        "counter_ticks": {"start": 336, "end": 364, "step": 1},
        "ding": [364],
        "pops": {"start": 400, "count": 10, "step": 4},
        "stamp": [476],
        "paper_slap": [504, 518, 532, 546],
        "downlifter": [560],
        "typewriter": {"start": 560, "end": 600, "count": 15},    # 15 glyphs of the question
        "typewriter_bell": [600],
        "heartbeat": [[560, 6], [588, 6], [616, 6], [630, 5], [644, 4], [651, 3], [658, 3]],  # [frame, dub offset]
        "riser_2": [616, 664],
        "reverse_cymbal_2": [634, 664],
        "impact_biggest": [672],
        "count_ticks": {"start": 672, "end": 700, "step": 1},
        "ding_2": [700],
        "bubbly_pops": {"start": 700, "end": 740, "step": 2},
        "stutter_cuts": {"start": 784, "count": 8, "step": 7},    # one swish per recap cut
        "reverse_cymbal_3": [812, 840],
        "impact_final": [840],
    },
    # music stabs (quickfire cards) - music stem, listed in cues.json too
    "stabs": [504, 518, 532, 546],
    "aurora_sparkle": 532,
    # ---------------------------------------------------------------- mix (dB)
    # bus loudness targets (LUFS, measured solo over the given frame window) -> auto gain staging
    "levels": {
        "kick":    (-18.0, [224, 504]),
        "clap":    (-23.5, [224, 504]),
        "hats":    (-30.0, [224, 504]),
        "perc":    (-31.0, [672, 784]),
        "bass":    (-19.5, [224, 504]),
        "chords":  (-22.5, [224, 504]),
        "lead":    (-20.5, [224, 504]),
        "pluck":   (-28.5, [0, 112]),
        "arp":     (-26.0, [112, 220]),
        "pad":     (-29.0, [0, 112]),
        "drone":   (-34.0, [0, 112]),
        "bells":   (-31.0, [0, 112]),
        "stabs":   (-21.0, [504, 560]),
        "riser":   (-27.0, [168, 220]),
    },
    "crash_db": -13.0,
    "sfx_db": {                      # per-SFX level (dB re. -20 LUFS momentary-max normalisation)
        "whoosh_in": 2.5, "pin_pop": -3.0, "tape": -2.5, "jet_whoosh": -1.0, "flight_ticks": -11.0,
        "zoom_riser": 2.0, "reverse_cymbal": -3.0, "impact_big": 9.0, "impact_biggest": 11.5, "impact_final": 9.0,
        "paper_rip": 0.0, "shutter": 1.0, "counter_ticks": -12.0, "ding": -2.0, "pops": -6.0, "stamp": 1.0,
        "paper_slap": -0.5, "downlifter": -10.0, "typewriter": -14.0, "typewriter_bell": -10.0, "heartbeat": -3.5,
        "riser_2": 0.0, "count_ticks": -11.0, "bubbly_pops": -9.0, "stutter_cuts": -3.0,
    },
    # music fader ride (frame, dB) - section contrast: quieter intro/breakdown, drops at 0 dB
    "music_ride_db": [[0, -3.0], [100, -3.0], [112, -2.5], [200, -1.0], [219, 0.0], [224, 0.0], [559, 0.0],
                      [560, -2.0], [640, -1.5], [663, -0.5], [672, 0.0], [899, 0.0]],
    "drum_clip_db": 3.0,       # drum-bus soft clip depth (dB below drop-1 drum peak)
    "glue": {"thresh_db": -21.0, "ratio": 2.0, "attack": 0.012, "release": 0.12},
    "duck": {"max_db": 3.0, "attack": 0.012, "release": 0.25, "impact_db": 2.0},   # music ducking under dense SFX
    "master": {"target_lufs": -14.0, "tp_ceiling_db": -1.25, "comp_thresh_db": -17.0, "comp_ratio": 1.8,
               "comp_attack": 0.02, "comp_release": 0.2},
}
# ============================================================================================ /CONFIG

FPS = CONFIG["fps"]
SPF = FS // FPS                      # 1600 samples / frame
N = CONFIG["n_frames"] * SPF         # 1,440,000
FPB = CONFIG["frames_per_beat"]
BEAT = FPB * SPF                     # 22400
STEP = BEAT // 4                     # 5600 (16th)
BAR = 4 * BEAT                       # 89600
SWING_OFF = int(round((CONFIG["swing"] - 0.5) * 2 * STEP))   # 448 samples on odd 16ths
TAIL = 6 * FS
NT = N + TAIL
RNG = np.random.default_rng(CONFIG["seed"])


def F(f):
    return int(round(f * SPF))


def P(bar, step=0.0, swing=False):
    s = bar * BAR + step * STEP
    if swing and int(round(step)) % 2 == 1 and abs(step - round(step)) < 1e-9:
        s += SWING_OFF
    return int(round(s))


def bus():
    return np.zeros((NT, 2))


def secs(name):
    return CONFIG["sections"][name]


def bars_of(*names):
    out = []
    for nm in names:
        a, b = secs(nm)
        out += list(range(a, b))
    return out


def auto(points, n=NT):
    """points: [(frame, value)] -> per-sample piecewise-linear automation."""
    pts = np.array(points, dtype=np.float64)
    return np.interp(np.arange(n), pts[:, 0] * SPF, pts[:, 1])


CH = CONFIG["chords"]
BASS_ROOT = {"Dm": 38, "Bb": 34, "F": 41, "C": 36}
PAD_VOICES = {"Dm": [50, 57, 62, 65, 69], "Bb": [46, 58, 62, 65, 69], "F": [53, 57, 60, 65, 69],
              "C": [48, 55, 60, 64, 67]}
CHORD_VOICING = {"Dm": [57, 62, 65, 69, 74], "Bb": [58, 62, 65, 69, 74], "F": [57, 60, 65, 69, 72],
                 "C": [55, 60, 64, 67, 74]}
ARP_TONES = {"Dm": [62, 65, 69], "Bb": [58, 62, 65], "F": [65, 69, 72], "C": [67, 72, 76]}
# hook: (step, dur_steps, midi, accent 0..2) per chord bar
HOOK = {
    "Dm": [(0, 3, 74, 2), (3, 3, 69, 1), (6, 2, 74, 1), (8, 2, 76, 1), (10, 2, 77, 2), (12, 1, 76, 0), (13, 3, 74, 1)],
    "Bb": [(0, 3, 77, 2), (3, 3, 74, 1), (6, 2, 70, 1), (8, 2, 69, 0), (10, 2, 70, 1), (12, 4, 74, 2)],
    "F": [(0, 3, 72, 2), (3, 3, 69, 1), (6, 2, 72, 1), (8, 2, 77, 2), (10, 2, 76, 1), (12, 1, 72, 0), (13, 3, 69, 1)],
    "C": [(0, 3, 67, 1), (3, 3, 72, 2), (6, 2, 76, 1), (8, 2, 74, 1), (10, 2, 76, 1), (12, 4, 79, 2)],
    "Dm_end": [(0, 3, 74, 2), (3, 3, 69, 1), (6, 2, 74, 1), (8, 2, 76, 1), (10, 2, 77, 2), (12, 2, 79, 1), (14, 2, 81, 2)],
}
PLUCK_MOTIF = {"Dm": [74, 69, 77, 69, 76, 69, 74, 72], "Bb": [74, 70, 77, 70, 74, 70, 72, 69],
               "F": [72, 69, 77, 69, 76, 69, 72, 69], "C": [72, 67, 76, 67, 74, 67, 72, 67]}


# ============================================================================================ loudness helpers
_METER = pyln.Meter(FS)


def lufs(x, f0=None, f1=None):
    x = as_stereo(x)
    a = 0 if f0 is None else F(f0)
    b = x.shape[0] if f1 is None else F(f1)
    seg = x[a:b]
    if np.max(np.abs(seg)) < 1e-9:
        return -120.0
    try:
        return _METER.integrated_loudness(seg)
    except Exception:
        return -120.0


_KB = [np.array([1.53512485958697, -2.69169618940638, 1.19839281085285]),
       np.array([1.0, -1.69065929318241, 0.73248077421585])]
_KH = [np.array([1.0, -2.0, 1.0]), np.array([1.0, -1.99004745483398, 0.99007225036621])]


def momentary_max(x):
    """Max momentary loudness (400 ms, BS.1770 K-weighting) - used to normalise SFX."""
    from scipy.signal import lfilter
    x = as_stereo(x)
    y = lfilter(_KB[0], _KB[1], x, axis=0)
    y = lfilter(_KH[0], _KH[1], y, axis=0)
    p = np.sum(y ** 2, axis=1)
    w = int(0.4 * FS)
    if len(p) < w:
        p = np.concatenate([p, np.zeros(w - len(p))])
    c = np.cumsum(np.concatenate([[0], p]))
    ms = (c[w:] - c[:-w]) / w
    return -0.691 + 10 * np.log10(np.max(ms) + 1e-15)


def norm_sfx(x, db=0.0, ref=-20.0):
    return as_stereo(x) * 10 ** ((ref + db - momentary_max(x)) / 20)


# ============================================================================================ MUSIC
def sidechain(kick_times, depth_db, release=0.17, fall=0.004, pre=0.002, n=NT):
    """Kick-keyed ducking curve (gain array): look-ahead (pre) raised-cosine fall, quadratic recovery.
    Starting the dip 2 ms before the kick keeps the gain change click-free on sustained subs."""
    g = np.ones(n)
    depth = 1 - 10 ** (-depth_db / 20)
    nf = int(fall * FS)
    L = nf + int(release * FS)
    u = np.arange(L)
    shape = np.where(u < nf, depth * dsp.smoothstep(u / nf),
                     depth * np.clip(1 - (u - nf) / (release * FS), 0, 1) ** 2)
    off = int(pre * FS)
    for k in kick_times:
        a = int(k) - off
        b = min(n, a + L)
        if b <= a or a < 0:
            continue
        g[a:b] = np.minimum(g[a:b], 1 - shape[: b - a])
    return g


class Music:
    def __init__(self):
        self.b = {}      # dry buses
        self.kicks = []  # kick sample positions (for sidechain)
        self.log = []

    def add(self, name, sig, start, gain=1.0):
        if name not in self.b:
            self.b[name] = bus()
        place(self.b[name], sig, start, gain)

    # ------------------------------------------------------------------ drums
    def drums(self):
        kick_v = [synths.kick(seed=i) for i in range(3)]
        kick_hint = synths.kick(f_start=180, click=0.0, amp_tau=0.14, seed=7)
        clap_v = [synths.clap(seed=i) for i in range(3)]
        snr_v = [synths.snare(seed=i) for i in range(3)]
        hat_c = [synths.hat(decay=0.032 + 0.006 * (i % 3), seed=i) for i in range(8)]
        hat_o = [synths.hat(decay=0.16, seed=40 + i, open_=True) for i in range(4)]
        # ---- intro hint (bars 0-1): muffled kick every beat, clap on 2 & 4 of bar 1 -> 'hint' bus (low-passed)
        for bar in bars_of("intro"):
            for beat in range(4):
                self.add("hint", kick_hint, P(bar, beat * 4), 0.9)
            if bar == secs("intro")[1] - 1:
                for beat in (1, 3):
                    self.add("hint", clap_v[beat % 3], P(bar, beat * 4), 0.6)
        # ---- build (bars 2-3): 4-floor + clap 2&4, hats 8ths -> 16ths, snare roll; through opening filter
        b0, b1 = secs("build")
        for bar in range(b0, b1):
            last = bar == b1 - 1
            for beat in range(4):
                if last and beat == 3:
                    for s in (12, 14):
                        self.add("build", kick_v[0], P(bar, s), 0.85)
                        self.kicks.append(P(bar, s))
                    continue
                self.add("build", kick_v[beat % 3], P(bar, beat * 4), 1.0)
                self.kicks.append(P(bar, beat * 4))
            if not last:
                for beat in (1, 3):
                    self.add("build", clap_v[beat % 3], P(bar, beat * 4), 0.9)
            steps = range(2, 16, 4) if not last else range(16)
            for s in steps:
                v = 0.8 if s % 4 == 2 else 0.45 + 0.1 * RNG.random()
                self.add("build", hat_c[s % 8], P(bar, s, swing=True), v)
        # accelerating snare roll in last build bar: 8ths (beats 0-1), 16ths (beat 2), 32nds (beat 3)
        rb = b1 - 1
        roll = [s for s in range(0, 8, 2)] + [8, 9, 10, 11] + [12 + 0.5 * k for k in range(6)]
        for i, s in enumerate(roll):
            prog = i / (len(roll) - 1)
            sn = synths.snare(seed=60 + i, tone=180 + 90 * prog)
            self.add("roll", sn, P(rb, s), 0.35 + 0.65 * prog ** 1.3)
        # ---- drops
        drop_bars = bars_of("drop1", "quickfire", "drop2", "stutter")
        d2 = set(bars_of("drop2", "stutter"))
        for bar in drop_bars:
            for beat in range(4):
                self.add("kick", kick_v[beat % 3], P(bar, beat * 4), 1.0)
                self.kicks.append(P(bar, beat * 4))
            if bar in d2 and bar % 2 == 1:   # syncopated extra kick in drop 2
                self.add("kick", kick_v[1], P(bar, 14), 0.7)
                self.kicks.append(P(bar, 14))
            for beat in (1, 3):
                self.add("clap", clap_v[(bar + beat) % 3], P(bar, beat * 4), 1.0)
                self.add("clap", snr_v[(bar + beat) % 3], P(bar, beat * 4), 0.55 if bar not in d2 else 0.8)
            if bar in d2:
                self.add("clap", clap_v[2], P(bar, 15, swing=True), 0.25)   # ghost
            for s in range(16):
                if s % 4 == 2:
                    self.add("hats", hat_o[(bar + s) % 4], P(bar, s, swing=True), 0.55)
                    continue
                base = [1.0, 0.42, None, 0.62][s % 4]
                v = float(np.clip(base + RNG.normal(0, 0.07), 0.2, 1.1))
                jitter = int(RNG.normal(0, 30))
                self.add("hats", hat_c[int(RNG.integers(0, 8))], P(bar, s, swing=True) + jitter, 0.7 * v)
            if bar in d2:
                for s in range(16):
                    v = [0.9, 0.4, 0.6, 0.45][s % 4] * (0.9 + 0.2 * RNG.random())
                    self.add("perc", synths.shaker(v, seed=int(RNG.integers(0, 1e6))), P(bar, s, swing=True))
                for beat in (1, 3):
                    self.add("perc", synths.tambourine(1.0, seed=bar * 4 + beat), P(bar, beat * 4))
        # tom fills into bar 8 (second half of drop 1) and into the stutter bar
        for bar, gain in ((7, 0.8), (13, 1.0)):
            for i, (s, f) in enumerate(zip([12, 13, 14, 15], [196, 165, 131, 110])):
                self.add("perc", synths.tom(f, seed=i), P(bar, s, swing=True), gain * (0.75 + 0.08 * i))
            self.add("clap", snr_v[0], P(bar, 15, swing=True), 0.35 * gain)
        # breakdown: short snare build in the second half of the last breakdown bar (quiet, filtered later)
        bb = secs("breakdown")[1] - 1
        for i, s in enumerate([8, 9, 10, 11, 12, 12.5, 13, 13.5, 14, 14.5]):
            if P(bb, s) >= F(CONFIG["silences"][1][0]):
                break
            self.add("roll2", synths.snare(seed=80 + i, tone=200 + 8 * i), P(bb, s), 0.2 + 0.07 * i)
        # final hit kick
        fin = secs("final")[0]
        self.add("kick", kick_v[0], P(fin, 0), 1.0)
        self.kicks.append(P(fin, 0))
        # crashes
        crash_full = synths.crash(dur=3.2, seed=1)
        crash_short = synths.crash(dur=2.0, seed=2)
        for f, g, c in ((224, 1.0, crash_full), (448, 0.55, crash_short), (672, 1.0, crash_full),
                        (728, 0.45, crash_short), (840, 0.9, crash_short)):
            self.add("crash", c, F(f), g)
        # intro clock ticks (music, very soft) on off 16ths
        for bar in bars_of("intro"):
            for s in range(1, 16, 2):
                self.add("ticks", SFX.mech_tick(0.5 + 0.25 * (s % 4 == 3), seed=s, tone=3200), P(bar, s, swing=True))

    # ------------------------------------------------------------------ bass
    def bass(self):
        n = NT
        gate = np.zeros(n)
        freq = np.zeros(n)
        notes = []
        for bar in bars_of("drop1", "drop2", "stutter"):
            notes.append((P(bar, 0), P(bar + 1, 0), BASS_ROOT[CH[bar]], 1.0))
        for f in CONFIG["stabs"]:
            bar = F(f) // BAR
            notes.append((F(f), F(f) + int(0.3 * FS), BASS_ROOT[CH[bar]], 1.0))
        fin = secs("final")[0]
        notes.append((P(fin, 0), P(fin, 0) + int(1.6 * FS), BASS_ROOT[CH[fin]], 1.0))
        freq[:] = mtof(38)
        for a, b, m, g in notes:
            gate[a:b] = g
            freq[a:b] = mtof(m)
        # release shaping for the final note
        a = P(fin, 0)
        L = int(1.6 * FS)
        gate[a:a + L] *= np.exp(-np.arange(L) / FS / 0.55)
        freq = dsp.lpf(freq, 60, order=1)                 # 3 ms-ish glide, phase stays continuous
        k = np.ones(int(0.004 * FS)) / int(0.004 * FS)   # 2x 4 ms box = C1-smooth gate edges (no clicks)
        amp = np.convolve(np.convolve(gate, k, mode="same"), k, mode="same")
        sub = synths.sub_track(freq, amp, drive=1.5)
        self.add("sub", as_stereo(sub), 0, 1.0)
        # mid bass: off-beat pattern with 16th pickups
        pat = [(2, 1, 0), (3, 1, 12), (6, 2, 0), (10, 1, 0), (11, 1, 12), (14, 2, 0)]
        for bar in bars_of("drop1", "drop2", "stutter"):
            m0 = BASS_ROOT[CH[bar]] + 12
            drive = 2.2 if bar < secs("drop2")[0] else 3.0
            for s, d, o in pat:
                x = synths.midbass_note(mtof(m0 + o), d * STEP / FS * 0.92, drive=drive, seed=bar * 16 + s)
                self.add("midbass", pan(x, 0.0) * 1.414, P(bar, s, swing=True), 0.9)
        for f in CONFIG["stabs"]:
            bar = F(f) // BAR
            x = synths.midbass_note(mtof(BASS_ROOT[CH[bar]] + 12), 0.22, cut_peak=2600, seed=f)
            self.add("midbass", pan(x, 0.0) * 1.414, F(f), 1.0)

    # ------------------------------------------------------------------ chords / stabs
    def chords(self):
        rhythm = [(0, 3), (3, 3), (6, 4), (10, 2), (12, 4)]
        d2 = set(bars_of("drop2", "stutter"))
        for bar in bars_of("drop1", "drop2", "stutter"):
            v = CHORD_VOICING[CH[bar]]
            for i, (s, d) in enumerate(rhythm):
                dur = d * STEP / FS * 0.9
                x = synths.chord_hit(v, dur, cut_peak=7500 if i == 0 else 5500, cut_sus=2400, seed=bar * 8 + i)
                self.add("chords", x, P(bar, s), 1.0 if i in (0, 2) else 0.85)
                if bar in d2:   # extra octave-up layer in the second drop
                    x2 = synths.chord_hit([m + 12 for m in v[1:4]], dur, cut_peak=9000, cut_sus=3500,
                                          seed=bar * 8 + i + 400, width_=1.0)
                    self.add("chords", x2, P(bar, s), 0.4)
        # quickfire stabs: rising inversions of the bar chord
        inv = [[58, 62, 65, 70], [62, 65, 70, 74], [65, 70, 74, 77], [70, 74, 77, 82]]
        for i, f in enumerate(CONFIG["stabs"]):
            x = synths.chord_hit(inv[i % 4] + [inv[i % 4][0] - 12], 0.2, cut_peak=9000, cut_sus=1800, cut_tau=0.07,
                                 seed=900 + i, sustain=0.5, decay=0.12, release=0.12)
            self.add("stabs", x, F(f), 1.0)
            p = synths.saw_pluck(mtof(inv[i % 4][-1] + 12), 0.3, cut_peak=8000, seed=950 + i)
            self.add("stabs", pan(p, 0.0), F(f), 0.35)
        # final chord (bar 15): big sustained Dm, decays into the end fade
        fin = secs("final")[0]
        v = CHORD_VOICING["Dm"] + [50, 81]
        x = synths.chord_hit(v, 1.45, cut_peak=9000, cut_sus=3000, cut_tau=0.4, seed=999, sustain=0.6, decay=0.6,
                             release=0.35)
        L = x.shape[0]
        x *= np.exp(-np.arange(L) / FS / 0.9)[:, None]
        self.add("chords", x, P(fin, 0), 1.2)

    # ------------------------------------------------------------------ pad + drone
    def pad(self):
        n = NT
        voices = [np.zeros(n) for _ in range(5)]
        for bar in range(len(CH)):
            a = P(bar, 0)
            b = P(bar + 1, 0) if bar < len(CH) - 1 else n
            for v in range(5):
                voices[v][a:b] = mtof(PAD_VOICES[CH[bar]][v])
        voices = [dsp.lpf(v, 25, order=1) for v in voices]     # ~6 ms glide between chords
        amp = auto([(0, 0), (4, 0.25), (26, 0.85), (56, 1.0), (112, 0.95), (219, 1.0), (224, 0.62), (503, 0.62),
                    (504, 0.4), (559, 0.4), (560, 1.25), (663, 1.3), (672, 0.8), (839, 0.8), (840, 1.1),
                    (850, 0.9), (899, 0.0), (905, 0.0)])
        vowel = auto([(0, 0.15), (112, 0.3), (224, 0.85), (560, 0.25), (663, 0.6), (672, 1.0), (899, 1.0)])
        lp = auto([(0, 1600), (112, 1900), (219, 6000), (224, 8000), (559, 8000), (560, 1100), (616, 1500),
                   (663, 4500), (672, 9000), (840, 9000), (899, 3000)])
        x = synths.choir_pad(voices, amp, vowel, lp, seed=5, breath=0.05)
        self.add("pad", x, 0, 1.0)
        d_amp = auto([(0, 0), (24, 1.0), (112, 0.85), (219, 0.9), (224, 0.3), (559, 0.3), (560, 1.0), (663, 1.0),
                      (672, 0.35), (839, 0.35), (840, 0.9), (899, 0.0), (905, 0)])
        d = synths.drone([38, 45, 50], d_amp, lp_base=700, seed=3)
        # sub drone (intro/breakdown atmosphere)
        sd_amp = auto([(0, 0), (20, 0.6), (111, 0.6), (150, 0.3), (220, 0.0), (560, 0.0), (580, 0.5), (663, 0.6),
                       (664, 0.0)])
        sd = np.sin(2 * np.pi * mtof(38) * np.arange(n) / FS) * sd_amp
        self.add("drone", d, 0, 1.0)
        self.add("drone", as_stereo(sd), 0, 0.25)

    # ------------------------------------------------------------------ pluck motif, arp, bells, lead
    def pluck_motif(self):
        for bars, gain, lp_hz in ((bars_of("intro"), 1.0, 7000), (bars_of("breakdown"), 0.95, 3400)):
            for bar in bars:
                motif = PLUCK_MOTIF[CH[bar]]
                for i, m in enumerate(motif):
                    x = synths.pluck(mtof(m), 0.9, t60=0.8, bright=0.55, seed=bar * 8 + i)
                    x = dsp.lpf(x, lp_hz, order=1)
                    p = -0.2 if i % 2 == 0 else 0.25
                    self.add("pluck", pan(x, p), P(bar, 2 * i, swing=True), (1.0 if i % 2 == 0 else 0.75) * gain)

    def arp(self):
        b0, b1 = secs("build")
        k = 0
        for bar in range(b0, b1):
            tones = ARP_TONES[CH[bar]]
            for s in range(16):
                half = ((bar - b0) * 16 + s) // 8          # 0..3 half-bars -> steady octave climb
                m = tones[s % 3] + [0, 12, 12, 24][min(half, 3)]
                x = synths.saw_pluck(mtof(m), 0.22, cut_peak=2500 + 5500 * k / 32, cut_base=450, seed=k)
                self.add("arp", pan(x, 0.35 * np.sin(k * 0.9)), P(bar, s, swing=True), 0.6 + 0.4 * k / 32)
                k += 1
        # drop 2: high sparkling arp layer
        for bar in bars_of("drop2", "stutter"):
            tones = ARP_TONES[CH[bar]]
            for s in range(16):
                m = tones[s % 3] + 24
                x = synths.saw_pluck(mtof(m), 0.12, cut_peak=6000, cut_base=900, seed=5000 + bar * 16 + s)
                self.add("arp", pan(x, 0.5 * np.sin(s * 1.3)), P(bar, s, swing=True), 0.35)

    def bells(self):
        ev = [(0, 86, 0.8), (28, 81, 0.6), (56, 89, 0.7), (84, 86, 0.55),
              (560, 89, 0.6), (588, 84, 0.5), (616, 88, 0.6), (644, 91, 0.6)]
        for f, m, g in ev:
            self.add("bells", pan(synths.glass_bell(mtof(m), 2.6, seed=f), 0.3 * np.sin(f)), F(f), g)
        # aurora sparkle (quickfire f532): fast rising arpeggio
        f0 = CONFIG["aurora_sparkle"]
        for i, m in enumerate([86, 89, 93, 96, 98, 101]):
            self.add("bells", pan(synths.glass_bell(mtof(m), 1.6, seed=700 + i), -0.6 + 0.24 * i),
                     F(f0) + i * STEP // 2, 0.55)
        # drop 2: bells double the hook an octave up
        for bar in bars_of("drop2", "stutter"):
            for (s, d, m, a) in HOOK[CH[bar]]:
                self.add("bells", pan(synths.glass_bell(mtof(m + 12), 1.2, seed=bar * 16 + s, bright=0.7), 0.25),
                         P(bar, s), 0.22)
        fin = secs("final")[0]
        for m, p in ((86, -0.3), (93, 0.3)):
            self.add("bells", pan(synths.glass_bell(mtof(m), 2.2, seed=m), p), P(fin, 0), 0.6)

    def lead(self):
        def phrase(bars, names):
            notes = []
            for j, (bar, nm) in enumerate(zip(bars, names)):
                for (s, d, m, a) in HOOK[nm]:
                    notes.append((j * BAR / FS + s * STEP / FS, d * STEP / FS, m, a))
            return notes

        d1 = bars_of("drop1")
        names = [CH[b] for b in d1]
        names[-1] = "Dm_end" if CH[d1[-1]] == "Dm" else names[-1]
        x = synths.fiddle(phrase(d1, names), len(d1) * BAR / FS, seed=11, drone_midi=62)
        self.add("lead", x, P(d1[0], 0), 1.0)
        d2 = bars_of("drop2", "stutter")
        x = synths.fiddle(phrase(d2, [CH[b] for b in d2]), len(d2) * BAR / FS, seed=12, bright=1.1, drone_midi=62)
        self.add("lead", x, P(d2[0], 0), 1.0)
        # final long D5 with decaying bow
        fin = secs("final")[0]
        x = synths.fiddle([(0.0, 1.5, 74, 2)], 1.5, seed=13, drone_level=0.3, drone_midi=69)
        L = x.shape[0]
        x *= (np.exp(-np.arange(L) / FS / 0.6))[:, None]
        self.add("lead", x, P(fin, 0), 0.9)
        # pluck layer doubling the hook (rhythmic definition)
        for bars, g in ((d1, 0.5), (d2, 0.6)):
            for bar in bars:
                nm = "Dm_end" if (bar == d1[-1] and CH[bar] == "Dm") else CH[bar]
                for (s, d, m, a) in HOOK[nm]:
                    p = synths.saw_pluck(mtof(m), 0.28, cut_peak=4500, cut_base=600, cut_tau=0.07, seed=bar * 16 + s)
                    self.add("leadpluck", pan(p, 0.0), P(bar, s), g)

    def risers(self):
        # musical riser in last build bar and last breakdown bar (tonal, under the SFX risers)
        rb = secs("build")[1] - 1
        x = synths.tonal_riser((F(CONFIG["silences"][0][0]) - P(rb, 0)) / FS, 50, 86, seed=1)
        self.add("riser", x, P(rb, 0), 1.0)
        a = F(CONFIG["cues"]["riser_2"][0])
        b = F(CONFIG["silences"][1][0])
        x = synths.tonal_riser((b - a) / FS, 45, 86, seed=2)
        self.add("riser", x, a, 1.0)

    # ------------------------------------------------------------------ render all + mix music
    def render(self, debug_dir=None):
        t0 = time.time()
        for fn in (self.drums, self.bass, self.chords, self.pad, self.pluck_motif, self.arp, self.bells, self.lead,
                   self.risers):
            fn()
            print(f"  music.{fn.__name__:12s} {time.time() - t0:6.1f}s", flush=True)
        b = self.b
        # ---- filters on pre-drop drums
        b["hint"] = svf(b["hint"], auto([(0, 170), (56, 260), (111, 420)]), 0.9, "lp")
        b["build"] = dsp.svf4(b["build"], auto([(0, 300), (112, 300), (140, 700), (190, 3500), (214, 18000),
                                                 (900, 18000)]), 0.9, "lp")
        b["roll"] = svf(b["roll"], auto([(0, 200), (168, 250), (219, 2500)]), 0.7, "hp")
        b["roll2"] = svf(svf(b["roll2"], 600, 0.7, "hp"), auto([(0, 2500), (644, 2500), (663, 9000)]), 0.7, "lp")
        # ---- group buses
        G = {}
        drums_pre = b["build"]
        G["kick"] = b["kick"]
        G["clap"] = b["clap"]
        G["hats"] = b["hats"]
        G["perc"] = b["perc"]
        G["bass"] = b["sub"] + dsp.hpf(b["midbass"], 90, order=2)
        G["chords"] = dsp.hpf(b["chords"], 160, order=2)
        G["stabs"] = dsp.hpf(b["stabs"], 120, order=2)
        G["lead"] = b["lead"] + dsp.hpf(b["leadpluck"], 200) * 0.9
        G["pluck"] = b["pluck"]
        G["arp"] = dsp.hpf(b["arp"], 250)
        G["pad"] = b["pad"]
        G["drone"] = b["drone"]
        G["bells"] = b["bells"]
        G["riser"] = b["riser"]
        # ---- auto gain staging (solo loudness in reference window)
        gains = {}
        for k, (target, (f0, f1)) in CONFIG["levels"].items():
            l = lufs(G[k][:N], f0, f1)
            g = 10 ** ((target - l) / 20) if l > -100 else 1.0
            gains[k] = g
            G[k] = G[k] * g
            self.log.append(f"{k:8s} measured {l:7.2f} LUFS -> gain {20 * np.log10(g):+6.2f} dB")
        # pre-drop drum layers follow kick/clap gains
        other = gains["kick"]
        G["pre"] = drums_pre * other * 0.95 + b["hint"] * other * 0.75 + b["roll"] * gains["clap"] * 0.9 \
            + b["roll2"] * gains["clap"] * 0.8 + b["ticks"] * gains["hats"] * 0.8
        G["crash"] = b["crash"] * 10 ** (CONFIG["crash_db"] / 20)
        # ---- sidechain
        kt = sorted(set(self.kicks))
        sc_bass = sidechain(kt, 14, 0.16)
        sc_ch = sidechain(kt, 9, 0.2)
        sc_pad = sidechain(kt, 5, 0.22)
        sc_lt = sidechain(kt, 1.5, 0.12)
        G["bass"] *= sc_bass[:, None]
        G["chords"] *= sc_ch[:, None]
        G["pad"] *= sc_pad[:, None]
        G["drone"] *= sc_pad[:, None]
        G["arp"] *= sc_ch[:, None]
        G["lead"] *= sc_lt[:, None]
        # ---- inserts
        G["pad"] = dsp.peq(dsp.width(G["pad"], 1.35), 650, -2.5, 1.0)
        G["clap"] = peq(G["clap"], 220, 2.0, 1.0)
        G["lead"] = peq(G["lead"], 3200, -1.5, 1.2)
        # ---- sends / returns
        room = dsp.make_ir(t60=0.55, predelay=0.004, seed=31, hf_ratio=0.45)
        plate = dsp.make_ir(t60=1.5, predelay=0.018, seed=32, hf_ratio=0.55, er_count=6, bright_hz=11000)
        hall = dsp.make_ir(t60=3.3, predelay=0.03, seed=33, hf_ratio=0.3, lf_ratio=1.1)
        send_room = G["clap"] * 0.35 + G["perc"] * 0.25 + G["pre"] * 0.15 + G["kick"] * 0.03
        send_plate = G["lead"] * 0.28 + G["pluck"] * 0.35 + G["arp"] * 0.25 + G["stabs"] * 0.3 + G["clap"] * 0.1
        send_hall = G["pad"] * 0.45 + G["bells"] * 0.55 + G["drone"] * 0.3 + G["chords"] * 0.14 + G["lead"] * 0.1 \
            + G["stabs"] * 0.25 + G["riser"] * 0.3 + G["pluck"] * 0.2
        dly_in = G["pluck"] * 0.35 + G["arp"] * 0.35 + G["lead"] * 0.12 + G["bells"] * 0.3 + G["stabs"] * 0.2
        dly = dsp.pingpong(dly_in, 3 * STEP, fb=0.38, lp_coef=0.45)
        dly = dsp.hpf(dsp.lpf(dly, 6500), 300)
        r_room = dsp.convolve_reverb(send_room, room)
        r_plate = dsp.convolve_reverb(dsp.hpf(send_plate, 250), plate)
        r_hall = dsp.convolve_reverb(dsp.hpf(send_hall, 200), hall)
        # duck the returns a bit with the kick too (keeps the drop punchy)
        r_hall *= sc_pad[:, None]
        r_plate *= sc_pad[:, None]
        dly *= sc_ch[:, None]
        wet = r_room * 0.9 + r_plate * 0.9 + r_hall * 1.0 + dly * 0.8
        # drum bus: oversampled soft-knee clip (shaves kick/clap crest ~2-3 dB so the master limiter is left
        # for the impacts), everything else summed as is
        drum_keys = ("kick", "clap", "hats", "perc", "pre")
        drums = sum(G[k] for k in drum_keys)
        d1a, d1b = F(224), F(504)
        pk = np.max(np.abs(drums[d1a:d1b]))
        drums_c = dsp.soft_knee_clip(drums, pk * 10 ** (-CONFIG["drum_clip_db"] / 20), knee=0.55)[: drums.shape[0]]
        dry = drums_c + sum(G[k] for k in G if k not in drum_keys)
        mus = dry + wet
        mus = dsp.hpf(mus, 22, order=2)
        # music-bus glue compression (level-referenced to drop 1)
        ref = lufs(mus[:N], 224, 504)
        g = 10 ** ((-16.0 - ref) / 20)
        mus, grm = dsp.compressor(mus * g, CONFIG["glue"]["thresh_db"], CONFIG["glue"]["ratio"],
                                  CONFIG["glue"]["attack"], CONFIG["glue"]["release"], knee_db=6)
        mus /= g
        self.log.append(f"drum clip {CONFIG['drum_clip_db']} dB, glue comp max GR {grm.max():.1f} dB, "
                        f"mean GR in drops {grm[F(224):F(560)].mean():.1f} dB")
        self.G = G
        self.wet = wet
        print(f"  music.mix          {time.time() - t0:6.1f}s", flush=True)
        return mus


# ============================================================================================ STUTTER (bar 14)
def stutter(x, bar):
    """Beat-repeat on the music stem: beat0 plays, beat1 8th repeats, beat2 16th repeats, beat3 32nd repeats
    with rising pitch + high-pass sweep into the final hit."""
    y = x.copy()
    start = P(bar, 0)
    fadelen = 48

    def seg(src_a, length):
        s = x[src_a:src_a + length].copy()
        return fade_edges(s, fadelen, fadelen)

    # beat 1: 8th repeats
    for beat, div in ((1, 2), (2, 4), (3, 8)):
        a = start + beat * BEAT
        L = BEAT // div
        src = seg(a, L)
        y[a:a + BEAT] = 0
        for k in range(div):
            s = src
            if beat == 3:   # pitch up each repeat (resample shorter)
                ratio = 2 ** (k / 12 * 0.8)
                idx = np.arange(0, L, ratio)
                s = np.stack([np.interp(idx, np.arange(L), src[:, c]) for c in range(2)], axis=1)
                s = fade_edges(s, fadelen, fadelen)
            y[a + k * L:a + k * L + len(s)] += s[: min(len(s), L)]
    # high-pass sweep over beats 2-3, small swell
    a = start + 2 * BEAT
    b = start + 4 * BEAT
    seg_ = y[a:b]
    fc = np.geomspace(60, 1400, b - a)
    y[a:b] = svf(seg_, fc, 0.8, "hp") * np.linspace(0.9, 1.1, b - a)[:, None]
    return y


# ============================================================================================ SFX
class Sfx:
    def __init__(self):
        self.bus = bus()
        self.key = bus()           # duck key (dense SFX only)
        self.events = []

    def put(self, name, sig, frame, db=None, duck=True, detail=None, sync=0):
        """sync: sample index inside sig that must land on the cue frame."""
        lvl = CONFIG["sfx_db"].get(name.split("#")[0], 0.0) if db is None else db
        s = norm_sfx(sig, lvl)
        start = F(frame) - sync
        place(self.bus, s, start)
        if duck:
            place(self.key, s, start)
        ev = {"frame": int(frame), "time_s": round(frame / FPS, 4), "sample": int(F(frame)), "name": name.split("#")[0],
              "len_s": round(s.shape[0] / FS, 3)}
        if detail:
            ev.update(detail)
        self.events.append(ev)

    def render(self):
        t0 = time.time()
        C = CONFIG["cues"]
        rng = np.random.default_rng(CONFIG["seed"] + 1)
        self.put("whoosh_in", SFX.whoosh_in(), C["whoosh_in"][0], duck=False)
        self.put("pin_pop", SFX.pin_pop(), C["pin_pop"][0])
        self.put("tape", SFX.tape_rip(), C["tape"][0])
        a, b = C["jet_whoosh"]
        self.put("jet_whoosh", SFX.jet_whoosh((b - a) / FPS), a, detail={"end_frame": b, "pan": "L->R"})
        ft = C["flight_ticks"]
        frames = list(range(ft["start"], ft["end"] + 1, ft["step"]))
        for i, f in enumerate(frames):
            self.put("flight_ticks", SFX.digital_tick(2600 + 600 * (i % 2) + 8 * i, 0.8 + 0.2 * (i % 2), seed=i), f,
                     duck=False)
        a, b = C["zoom_riser"]
        self.put("zoom_riser", SFX.noise_riser((b - a) / FPS, seed=21), a, duck=False,
                 detail={"end_frame": b, "note": "hard cut at dropout"})
        a, b = C["reverse_cymbal_1"]
        self.put("reverse_cymbal", synths.reverse_cymbal((b - a) / FPS, seed=1), a, duck=False, detail={"end_frame": b})
        self.put("impact_big", SFX.impact("big", seed=41), C["impact_big"][0], duck=False)
        # facts
        for i, f in enumerate(C["paper_rip"]):
            pf, pt = ((-0.6, 0.5) if i % 2 == 0 else (0.6, -0.5))
            self.put("paper_rip", SFX.paper_rip(seed=50 + i, p_from=pf, p_to=pt), f)
        self.put("shutter", SFX.camera_shutter(), C["shutter"][0])
        ct = C["counter_ticks"]
        frames = list(range(ct["start"], ct["end"], ct["step"]))
        for i, f in enumerate(frames):
            prog = i / max(1, len(frames) - 1)
            self.put("counter_ticks", SFX.digital_tick(1800 + 900 * prog + 300 * (i % 2), 0.85 + 0.15 * prog, seed=100 + i),
                     f, db=CONFIG["sfx_db"]["counter_ticks"] + 3 * prog)
        self.put("ding", SFX.ding(mtof(86), seed=1), C["ding"][0])
        pp = C["pops"]
        scale = [74, 77, 79, 81, 84, 86, 89, 91, 93, 96]
        for i in range(pp["count"]):
            f = pp["start"] + i * pp["step"]
            self.put("pops", SFX.pop(mtof(scale[i % len(scale)] - 12), 1.0, p=-0.6 + 1.2 * i / max(1, pp["count"] - 1),
                                     seed=200 + i), f, detail={"index": i + 1})
        self.put("stamp", SFX.stamp_thunk(), C["stamp"][0])
        for i, f in enumerate(C["paper_slap"]):
            self.put("paper_slap", SFX.paper_slap(seed=300 + i, p=[-0.3, 0.3, -0.15, 0.15][i % 4]), f,
                     detail={"with": "music stab"})
        # breakdown
        self.put("downlifter", SFX.downlifter(0.9), C["downlifter"][0], duck=False)
        tw = C["typewriter"]
        frames = np.round(np.linspace(tw["start"], tw["end"], tw["count"])).astype(int)
        for i, f in enumerate(frames):
            j = int(rng.integers(-1, 2)) if 0 < i < len(frames) - 1 else 0   # human timing (+-1 frame)
            self.put("typewriter", SFX.typewriter_key(seed=400 + i, heavy=(i in (2, 3))), int(f) + j,
                     db=CONFIG["sfx_db"]["typewriter"] + rng.uniform(-1.5, 1.0), detail={"glyph": i + 1})
        self.put("typewriter_bell", SFX.typewriter_bell(), C["typewriter_bell"][0])
        for f, dub in C["heartbeat"]:
            self.put("heartbeat", SFX.heartbeat(dub / FPS, vel=1.0), f, duck=False, detail={"dub_frame": f + dub})
        a, b = C["riser_2"]
        self.put("riser_2", SFX.noise_riser((b - a) / FPS, seed=22, f0=220, f1=11000), a, duck=False,
                 detail={"end_frame": b, "note": "hard cut into dead silence"})
        a, b = C["reverse_cymbal_2"]
        self.put("reverse_cymbal", synths.reverse_cymbal((b - a) / FPS, seed=2), a, duck=False, detail={"end_frame": b})
        # reveal
        self.put("impact_biggest", SFX.impact("biggest", seed=42), C["impact_biggest"][0], duck=False)
        ct = C["count_ticks"]
        frames = list(range(ct["start"], ct["end"], ct["step"]))
        for i, f in enumerate(frames):
            prog = i / max(1, len(frames) - 1)
            self.put("count_ticks", SFX.mech_tick(0.8 + 0.2 * prog, seed=500 + i, tone=1500 + 700 * prog + 200 * (i % 2)),
                     f, db=CONFIG["sfx_db"]["count_ticks"] + 2 * prog)
        self.put("ding", SFX.ding(mtof(93), seed=2, level2=0.45), C["ding_2"][0], db=CONFIG["sfx_db"]["ding"] + 1.0)
        bp = C["bubbly_pops"]
        pent = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84]
        frames = list(range(bp["start"], bp["end"], bp["step"]))
        for i, f in enumerate(frames):
            m = pent[int(rng.integers(0, len(pent)))] + 12
            self.put("bubbly_pops", SFX.pop(mtof(m), rng.uniform(0.7, 1.0), p=rng.uniform(-0.8, 0.8), seed=600 + i,
                                            bubbly=rng.uniform(0.4, 1.0)), f, db=CONFIG["sfx_db"]["bubbly_pops"] + rng.uniform(-2, 1))
        sc = C["stutter_cuts"]
        for i in range(sc["count"]):
            f = sc["start"] + i * sc["step"]
            pf, pt = ((-0.7, 0.3) if i % 2 == 0 else (0.7, -0.3))
            self.put("stutter_cuts", SFX.cut_whoosh(seed=700 + i, p_from=pf, p_to=pt), f, detail={"cut": i + 1})
        a, b = C["reverse_cymbal_3"]
        self.put("reverse_cymbal", synths.reverse_cymbal((b - a) / FPS, seed=3), a, duck=False,
                 db=CONFIG["sfx_db"]["reverse_cymbal"] - 1, detail={"end_frame": b})
        self.put("impact_final", SFX.impact("final", seed=43), C["impact_final"][0], duck=False)
        print(f"  sfx.render         {time.time() - t0:6.1f}s  ({len(self.events)} events)", flush=True)
        return self.bus


# ============================================================================================ gates / master
def apply_silences(x):
    y = x.copy()
    for a, b in CONFIG["silences"]:
        sa, sb = F(a), F(b)
        fo = 96   # 2 ms fade-out before the hole
        fi = 24   # 0.5 ms fade-in after it (keeps the drop transient)
        y[sa - fo:sa] *= np.linspace(1, 0, fo)[:, None] ** 2
        y[sa:sb] = 0
        y[sb:sb + fi] *= np.linspace(0, 1, fi)[:, None]
    a, b = CONFIG["end_fade"]
    sa, sb = F(a), F(b)
    L = sb - sa
    w = (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, L))) ** 1.5
    y[sa:sb] *= w[:, None]
    y[sb:] = 0
    return y


def duck_curve(key):
    """Music ducking (<= max_db) driven by the dense-SFX key bus."""
    d = CONFIG["duck"]
    env = dsp.env_follow(key, d["attack"], d["release"])
    lvl = 20 * np.log10(env + 1e-9)
    ref = np.percentile(lvl[env > 1e-4], 90) if np.any(env > 1e-4) else -20
    amt = dsp.smoothstep((lvl - (ref - 24)) / 18)
    g_db = -d["max_db"] * amt
    # brief extra dip of the music under the three big impacts (lets the hit read as the loudest moment)
    for nm in ("impact_big", "impact_biggest", "impact_final"):
        a = F(CONFIG["cues"][nm][0])
        L = int(0.7 * FS)
        u = np.arange(L) / FS
        dip = -d["impact_db"] * np.where(u < 0.12, 1.0, np.clip(1 - (u - 0.12) / 0.58, 0, 1) ** 2)
        g_db[a:a + L] = np.minimum(g_db[a:a + L], dip[: len(g_db[a:a + L])])
    return 10 ** (g_db / 20), g_db


def master(pre):
    M = CONFIG["master"]
    x = dsp.hpf(pre, 20, order=2)
    x = dsp.lowshelf(x, 90, 0.5)
    x = dsp.peq(x, 620, -1.5, 1.0)           # de-box low mids
    x = dsp.peq(x, 2900, -1.2, 0.8)          # tame 2-5 kHz a touch
    x, gr = dsp.compressor(x, M["comp_thresh_db"], M["comp_ratio"], M["comp_attack"], M["comp_release"], knee_db=8)
    # iterate input gain so the limited master lands on the loudness target
    g_db = M["target_lufs"] - lufs(x)
    for it in range(6):
        y, gl = dsp.tp_limiter(x * 10 ** (g_db / 20), M["tp_ceiling_db"], lookahead=0.004, release=0.09)
        y = apply_silences(y)
        L = lufs(y)
        err = M["target_lufs"] - L
        print(f"  master iter {it}: in-gain {g_db:+.2f} dB -> {L:.2f} LUFS, TP {dsp.true_peak(y):.2f} dBTP, "
              f"max GR {20 * np.log10(gl.min()):.1f} dB", flush=True)
        if abs(err) < 0.05:
            break
        g_db += err
    return y, gr, gl


# ============================================================================================ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    t0 = time.time()
    out_dir = HERE
    dbg = os.path.join(ROOT, "tmp", "audio")
    os.makedirs(dbg, exist_ok=True)

    print("[music]", flush=True)
    m = Music()
    mus = m.render()
    for line in m.log:
        print("   ", line)
    mus = stutter(mus, secs("stutter")[0])
    mus = mus[:N]
    ride = auto(CONFIG["music_ride_db"], N)
    mus *= (10 ** (ride / 20))[:, None]

    print("[sfx]", flush=True)
    s = Sfx()
    fx = s.render()[:N]
    fx = dsp.highshelf(dsp.lpf(fx, 16000, order=2), 10000, -2.0)   # tame noise-born air on SFX bus
    fx = dsp.peq(fx, 3000, -1.5, 0.9)                                 # and a touch of 2-5 kHz bite
    key = s.key[:N]

    # mix: duck music under dense SFX
    dg, g_db = duck_curve(key)
    mus_d = mus * dg[:, None]
    mus_d = apply_silences(mus_d)
    fx = apply_silences(fx)
    pre = mus_d + fx
    # stems scaled together so music + sfx == pre-master sum, peak at -3 dBFS
    sc = 10 ** (-3 / 20) / max(np.max(np.abs(pre)), np.max(np.abs(mus_d)), np.max(np.abs(fx)))
    mus_d *= sc
    fx *= sc
    pre = mus_d + fx

    print("[master]", flush=True)
    mix, gr, gl = master(pre)
    assert mix.shape == (N, 2), mix.shape

    sf.write(os.path.join(out_dir, "mix.wav"), mix.astype(np.float32), FS, subtype="PCM_24")
    sf.write(os.path.join(out_dir, "music.wav"), mus_d.astype(np.float32), FS, subtype="PCM_24")
    sf.write(os.path.join(out_dir, "sfx.wav"), fx.astype(np.float32), FS, subtype="PCM_24")

    events = sorted(s.events, key=lambda e: (e["frame"], e["name"]))
    markers = []
    for nm, (a, b) in CONFIG["sections"].items():
        markers.append({"frame": a * 56, "time_s": round(a * 56 / FPS, 4), "name": f"section:{nm}", "bars": [a, b]})
    for a, b in CONFIG["silences"]:
        markers.append({"frame": a, "time_s": round(a / FPS, 4), "name": "silence", "end_frame": b})
    for f in CONFIG["stabs"]:
        markers.append({"frame": f, "time_s": round(f / FPS, 4), "name": "music_stab"})
    for f in (224, 672, 840):
        markers.append({"frame": f, "time_s": round(f / FPS, 4), "name": "drop/hit"})
    cues = {
        "fps": FPS, "sample_rate": FS, "samples": N, "bpm": 900 / 7, "frames_per_beat": FPB,
        "note": "frame f starts at sample f*1600. 'sample' is the sync point of each SFX.",
        "sfx": events,
        "music_markers": sorted(markers, key=lambda e: e["frame"]),
        "beats": [14 * k for k in range(65)],
    }
    with open(os.path.join(out_dir, "cues.json"), "w") as fh:
        json.dump(cues, fh, indent=1, ensure_ascii=False)
    np.save(os.path.join(dbg, "duck_db.npy"), g_db.astype(np.float32))
    np.save(os.path.join(dbg, "limiter_gain.npy"), gl.astype(np.float32))
    if not args.quick:
        for k, v in m.G.items():
            sf.write(os.path.join(dbg, f"bus_{k}.wav"), (v[:N] * sc).astype(np.float32), FS, subtype="FLOAT")
        sf.write(os.path.join(dbg, "bus_wet.wav"), (m.wet[:N] * sc).astype(np.float32), FS, subtype="FLOAT")
    print(f"done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
