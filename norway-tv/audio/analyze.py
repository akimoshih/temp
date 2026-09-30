#!/usr/bin/env python3
"""
analyze.py - QC for the NORWAY-in-30s soundtrack.

    python3 audio/analyze.py

Measures mix.wav (pyloudnorm integrated LUFS, sample peak, 4x-oversampled true peak, DC, stereo
correlation, mono fold-down), verifies the hard silences and hit prominence, scans stems for clicks,
reports spectral balance, draws spectrogram.png + waveform.png, writes measurements.json and
refreshes the measurements block in README.md (between the QC markers).
"""
import os
import sys
import json

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, "src"))
os.environ.setdefault("NUMBA_CACHE_DIR", os.path.join(ROOT, "tmp", "audio", "numba_cache"))
os.environ.setdefault("MPLCONFIGDIR", os.path.join(ROOT, "tmp", "audio", "mpl"))

import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy import signal
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

FS = 48000
SPF = 1600
N = 1_440_000


def F(f):
    return int(round(f * SPF))


def load(name):
    x, fs = sf.read(os.path.join(HERE, name), always_2d=True)
    info = sf.info(os.path.join(HERE, name))
    return x, fs, info


def true_peak(x, os_factor=4):
    y = signal.resample_poly(x, os_factor, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(y)) + 1e-12)


def short_term(x, meter_fs=FS, win=3.0, hop=0.1):
    """BS.1770 short-term loudness series (3 s window) - for LRA/plots."""
    b0 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a0 = [1.0, -1.69065929318241, 0.73248077421585]
    b1 = [1.0, -2.0, 1.0]
    a1 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, signal.lfilter(b0, a0, x, axis=0), axis=0)
    p = np.sum(y ** 2, axis=1)
    c = np.concatenate([[0], np.cumsum(p)])
    w = int(win * FS)
    h = int(hop * FS)
    out = []
    ts = []
    for s in range(0, len(p) - w + 1, h):
        out.append(-0.691 + 10 * np.log10((c[s + w] - c[s]) / w + 1e-15))
        ts.append((s + w / 2) / FS)
    return np.array(ts), np.array(out)


def momentary(x, win=0.4, hop=0.01):
    return short_term(x, win=win, hop=hop)


def lra(st):
    st = st[st > -70]
    rel = 10 * np.log10(np.mean(10 ** (st / 10))) - 20
    st = st[st > rel]
    if len(st) < 2:
        return 0.0
    return float(np.percentile(st, 95) - np.percentile(st, 10))


def click_scan(x, name, thresh=12.0):
    """Flag discontinuities: 2nd-difference spikes of a >10 kHz high-passed signal that exceed the local
    (20 ms) RMS of that band by `thresh` x while the band is otherwise quiet, and that are no more than 50 dB
    below the local full-band RMS. Returns list of (time_s, ratio)."""
    m = x.mean(axis=1)
    hp = signal.sosfilt(signal.butter(4, 10000, "highpass", fs=FS, output="sos"), m)
    d = np.abs(np.diff(hp, 2, prepend=[0, 0]))
    w = int(0.02 * FS)
    rms = np.sqrt(np.convolve(hp ** 2, np.ones(w) / w, mode="same")) + 1e-7
    full = np.sqrt(np.convolve(m ** 2, np.ones(w) / w, mode="same")) + 1e-7
    ratio = d / rms
    # isolation: spike must exceed 4x the largest 2nd-difference in the +-(1..40) ms neighbourhood
    from scipy.ndimage import maximum_filter1d
    near = int(0.001 * FS)
    far = int(0.040 * FS)   # > longest bass period (29 Hz sub-osc), so periodic edges are not "isolated"
    mx = maximum_filter1d(d, size=far - near, origin=0)
    left = np.concatenate([np.zeros(far), mx[: len(mx) - far]]) if len(mx) > far else mx * 0
    right = np.concatenate([mx[far - (far - near) // 2 + near // 2:], np.zeros(far - (far - near) // 2 + near // 2)])[: len(mx)]
    isolated = d > 4 * np.maximum(left, right)
    # only consider places where the HF band is quiet compared to the full band (sustained tonal material)
    # ... and the spike itself is within 50 dB of the local programme level (i.e. potentially audible)
    cand = np.nonzero((ratio > thresh) & isolated & (d > 10 ** (-50 / 20) * full) & (np.abs(m) > 1e-4))[0]
    hits = []
    last = -10 ** 9
    for i in cand:
        if i < int(0.005 * FS):
            continue      # filter start-up transient
        if i - last > int(0.01 * FS):
            hits.append((round(float(i) / FS, 4), round(float(ratio[i]), 1)))
            last = i
    return hits


def band_energy(x):
    f, P = signal.welch(x.mean(axis=1), FS, nperseg=8192)
    bands = [(20, 60, "sub"), (60, 250, "bass"), (250, 1000, "low-mid"), (1000, 2000, "mid"),
             (2000, 5000, "presence 2-5k"), (5000, 10000, "brilliance"), (10000, 20000, "air")]
    tot = np.trapezoid(P, f)
    out = {}
    for lo, hi, nm in bands:
        m = (f >= lo) & (f < hi)
        out[nm] = round(float(10 * np.log10(np.trapezoid(P[m], f[m]) / tot)), 2)
    return out, f, P


def third_octave(f, P):
    centers = 1000 * 2 ** (np.arange(-17, 14) / 3)
    lv = []
    for c in centers:
        m = (f >= c / 2 ** (1 / 6)) & (f < c * 2 ** (1 / 6))
        lv.append(10 * np.log10(np.sum(P[m]) + 1e-20))
    lv = np.array(lv)
    return centers, lv - lv.max()


def main():
    mix, fs, info = load("mix.wav")
    mus, _, _ = load("music.wav")
    fx, _, _ = load("sfx.wav")
    meter = pyln.Meter(FS)
    R = {}
    R["format"] = {"samplerate": info.samplerate, "channels": info.channels, "subtype": info.subtype,
                   "frames": info.frames, "duration_s": info.frames / info.samplerate}
    R["integrated_lufs"] = round(meter.integrated_loudness(mix), 2)
    R["sample_peak_dbfs"] = round(20 * np.log10(np.max(np.abs(mix))), 2)
    R["true_peak_dbtp_4x"] = round(true_peak(mix, 4), 2)
    R["true_peak_dbtp_8x"] = round(true_peak(mix, 8), 2)
    R["dc_offset"] = [float(f"{v:.2e}") for v in mix.mean(axis=0)]
    ts, st = short_term(mix)
    R["max_short_term_lufs"] = round(float(st.max()), 2)
    R["lra_lu"] = round(lra(st), 2)
    tm, mm = momentary(mix)
    R["max_momentary_lufs"] = round(float(mm.max()), 2)
    R["plr_db"] = round(R["true_peak_dbtp_4x"] - R["integrated_lufs"], 2)
    mono = mix.mean(axis=1, keepdims=True).repeat(2, axis=1)
    R["mono_fold_lufs_delta"] = round(meter.integrated_loudness(mono) - R["integrated_lufs"], 2)
    L, Rr = mix[:, 0], mix[:, 1]
    R["stereo_correlation"] = round(float(np.sum(L * Rr) / np.sqrt(np.sum(L * L) * np.sum(Rr * Rr))), 3)
    lowL = signal.sosfilt(signal.butter(4, 120, "lowpass", fs=FS, output="sos"), mix, axis=0)
    R["low_end_<120Hz_correlation"] = round(float(np.sum(lowL[:, 0] * lowL[:, 1]) /
                                                  np.sqrt(np.sum(lowL[:, 0] ** 2) * np.sum(lowL[:, 1] ** 2))), 3)
    R["clipped_samples"] = int(np.sum(np.abs(mix) >= 0.9999))
    R["stem_sum_vs_premaster_note"] = "music.wav + sfx.wav = pre-master sum (post-duck), peak -3 dBFS"
    # silences
    sil = {}
    for a, b in [(220, 224), (664, 672)]:
        seg = mix[F(a):F(b)]
        sil[f"f{a}-{b - 1}"] = "digital zero" if np.max(np.abs(seg)) == 0 else f"max {20 * np.log10(np.max(np.abs(seg))):.1f} dBFS"
    R["silences"] = sil
    R["last_sample_abs"] = float(np.max(np.abs(mix[-1])))
    tail = mix[F(890):]
    R["tail_f890_899_peak_dbfs"] = round(float(20 * np.log10(np.max(np.abs(tail)) + 1e-12)), 1)
    # hits: momentary peak within 300 ms after each hit vs the median momentary level
    hits = {}
    med = np.median(mm[mm > -70])
    for f in (224, 672, 840):
        m = (tm >= f / 30) & (tm < f / 30 + 0.45)
        hits[f"f{f}"] = round(float(mm[m].max() - med), 1)
    R["hit_prominence_db_over_median_momentary"] = hits
    # section loudness
    secs = {"intro f0-111": (0, 112), "build f112-219": (112, 220), "drop1 f224-559": (224, 560),
            "breakdown f560-663": (560, 664), "drop2 f672-839": (672, 840), "final f840-899": (840, 900)}
    R["section_lufs"] = {k: round(meter.integrated_loudness(mix[F(a):F(b)]), 2) for k, (a, b) in secs.items()}
    # clicks
    clicks = {}
    dbg = os.path.join(ROOT, "tmp", "audio")
    for nm in ["pad", "bass", "lead", "drone", "chords", "pluck", "bells", "arp", "stabs"]:
        p = os.path.join(dbg, f"bus_{nm}.wav")
        if os.path.exists(p):
            x, _ = sf.read(p, always_2d=True)
            clicks[nm] = click_scan(x, nm)
    tonal = None
    for nm in ["pad", "bass", "lead", "drone", "chords", "pluck", "bells", "arp", "stabs", "riser"]:
        p = os.path.join(dbg, f"bus_{nm}.wav")
        if os.path.exists(p):
            x, _ = sf.read(p, always_2d=True)
            tonal = x if tonal is None else tonal + x
    if tonal is not None:
        clicks["all tonal buses summed"] = click_scan(tonal, "tonal")
    R["click_scan"] = {k: (v if len(v) < 12 else v[:12] + [f"... {len(v)} total"]) for k, v in clicks.items()}
    be, f, P = band_energy(mix)
    R["band_energy_db_rel_total"] = be
    c, lv = third_octave(f, P)
    R["third_octave_db_rel_max"] = {f"{cc:.0f}": round(float(v), 1) for cc, v in zip(c, lv)}
    R["music_lufs"] = round(meter.integrated_loudness(mus), 2)
    R["sfx_lufs"] = round(meter.integrated_loudness(fx), 2)
    with open(os.path.join(HERE, "measurements.json"), "w") as fh:
        json.dump(R, fh, indent=1)
    print(json.dumps(R, indent=1))
    plots(mix, mus, fx, ts, st, tm, mm)
    update_readme(R)


def plots(mix, mus, fx, ts, st, tm, mm):
    marks = [(0, "S1 intro"), (112, "S2 flight"), (224, "DROP"), (280, "F1"), (336, "F2"), (392, "F3"),
             (448, "F4"), (504, "quick"), (560, "S6 break"), (672, "REVEAL"), (784, "S8 recap"), (840, "FINAL")]
    # ---------------- spectrogram
    m = mix.mean(axis=1)
    nper = 2048
    f, t, S = signal.stft(m, FS, nperseg=nper, noverlap=nper - 400)
    S = 20 * np.log10(np.abs(S) + 1e-9)
    S -= S.max()
    fr = t * 30
    fig, ax = plt.subplots(2, 1, figsize=(20, 9), gridspec_kw={"height_ratios": [4, 1]}, sharex=True)
    ax0 = ax[0]
    ff = np.maximum(f, 1)
    im = ax0.pcolormesh(fr, ff, S, shading="auto", cmap="magma", vmin=-95, vmax=0)
    ax0.set_yscale("log")
    ax0.set_ylim(25, 24000)
    ax0.set_ylabel("Hz (log)")
    ax0.set_title("mix.wav - spectrogram (x axis = video frame @30fps)")
    for fm, lab in marks:
        ax0.axvline(fm, color="cyan", lw=0.6, alpha=0.6)
        ax0.text(fm + 1, 18000, lab, color="cyan", fontsize=8)
    for a, b in [(220, 224), (664, 672)]:
        ax0.axvspan(a, b, color="lime", alpha=0.25)
    ax[1].plot(tm * 30, mm, lw=0.7, label="momentary LUFS")
    ax[1].plot(ts * 30, st, lw=1.2, label="short-term LUFS")
    ax[1].set_ylim(-45, -4)
    ax[1].axhline(-14, color="k", ls="--", lw=0.6)
    ax[1].set_xlabel("frame")
    ax[1].legend(loc="lower right", fontsize=8)
    ax[1].grid(alpha=0.3)
    ax[1].set_xticks(np.arange(0, 901, 56))
    plt.tight_layout()
    plt.savefig(os.path.join(HERE, "spectrogram.png"), dpi=90)
    plt.close()
    # ---------------- waveform
    fig, ax = plt.subplots(3, 1, figsize=(20, 9), sharex=True)
    fr = np.arange(len(mix)) / SPF
    for i, (x, nm) in enumerate(((mix, "mix.wav (master)"), (mus, "music.wav stem"), (fx, "sfx.wav stem"))):
        dec = 40
        xm = x[: len(x) // dec * dec].reshape(-1, dec, 2)
        mx = xm.max(axis=(1, 2))
        mn = xm.min(axis=(1, 2))
        frd = fr[: len(x) // dec * dec : dec]
        ax[i].fill_between(frd, mn, mx, color=["#1f4e79", "#2e7d32", "#b71c1c"][i], lw=0)
        ax[i].set_ylim(-1.05, 1.05)
        ax[i].set_ylabel(nm, fontsize=9)
        for fm, lab in marks:
            ax[i].axvline(fm, color="k", lw=0.5, alpha=0.4)
            if i == 0:
                ax[i].text(fm + 1, 0.9, lab, fontsize=8)
        for a, b in [(220, 224), (664, 672)]:
            ax[i].axvspan(a, b, color="orange", alpha=0.35)
        ax[i].axhline(10 ** (-1 / 20), color="r", lw=0.4, ls=":")
        ax[i].axhline(-(10 ** (-1 / 20)), color="r", lw=0.4, ls=":")
    ax[2].set_xlabel("frame (30 fps)")
    ax[2].set_xticks(np.arange(0, 901, 28))
    ax[2].tick_params(axis="x", labelsize=7)
    ax[0].set_title("waveforms - orange = hard silences f220-223 & f664-671; dotted = -1 dBFS")
    plt.tight_layout()
    plt.savefig(os.path.join(HERE, "waveform.png"), dpi=90)
    plt.close()


def update_readme(R):
    p = os.path.join(HERE, "README.md")
    if not os.path.exists(p):
        return
    s = open(p, encoding="utf-8").read()
    a = "<!-- QC:BEGIN -->"
    b = "<!-- QC:END -->"
    if a not in s or b not in s:
        return
    lines = [a, "", "| measurement | value |", "|---|---|"]
    fmt = R["format"]
    lines.append(f"| format | {fmt['samplerate']} Hz, {fmt['channels']} ch, {fmt['subtype']}, {fmt['frames']:,} samples ({fmt['duration_s']:.3f} s) |")
    lines.append(f"| integrated loudness (pyloudnorm, BS.1770-4) | **{R['integrated_lufs']:.2f} LUFS** |")
    lines.append(f"| sample peak | {R['sample_peak_dbfs']:.2f} dBFS |")
    lines.append(f"| true peak, 4x oversampled (polyphase) | **{R['true_peak_dbtp_4x']:.2f} dBTP** |")
    lines.append(f"| true peak, 8x oversampled (cross-check) | {R['true_peak_dbtp_8x']:.2f} dBTP |")
    lines.append(f"| max momentary / short-term | {R['max_momentary_lufs']:.1f} / {R['max_short_term_lufs']:.1f} LUFS |")
    lines.append(f"| loudness range (approx. EBU R128 LRA) | {R['lra_lu']:.1f} LU |")
    lines.append(f"| PLR (TP - integrated) | {R['plr_db']:.1f} dB |")
    lines.append(f"| DC offset L / R | {R['dc_offset'][0]:.1e} / {R['dc_offset'][1]:.1e} |")
    lines.append(f"| stereo correlation (full band / < 120 Hz) | {R['stereo_correlation']:.2f} / {R['low_end_<120Hz_correlation']:.3f} |")
    lines.append(f"| mono fold-down loudness change | {R['mono_fold_lufs_delta']:+.2f} LU |")
    lines.append(f"| clipped samples (>= 0 dBFS) | {R['clipped_samples']} |")
    for k, v in R["silences"].items():
        lines.append(f"| silence {k} | {v} |")
    lines.append(f"| tail f890-899 peak / last sample | {R['tail_f890_899_peak_dbfs']:.1f} dBFS / {R['last_sample_abs']:.1e} |")
    h = R["hit_prominence_db_over_median_momentary"]
    lines.append(f"| hit prominence (momentary peak over median) | f224 +{h['f224']} dB, f672 +{h['f672']} dB, f840 +{h['f840']} dB |")
    lines.append("| section loudness | " + ", ".join(f"{k}: {v:.1f}" for k, v in R["section_lufs"].items()) + " |")
    lines.append("| spectral balance (dB re. total) | " + ", ".join(f"{k}: {v:.1f}" for k, v in R["band_energy_db_rel_total"].items()) + " |")
    ncl = sum(len([c for c in v if isinstance(c, tuple) or isinstance(c, list)]) for v in R["click_scan"].values())
    lines.append(f"| click scan (isolated discontinuities; tonal buses solo + summed) | {ncl} flagged (see QC notes) |")
    lines.append(f"| stems | music.wav {R['music_lufs']:.1f} LUFS, sfx.wav {R['sfx_lufs']:.1f} LUFS (pre-master, sum = pre-master mix) |")
    lines += ["", b]
    i0 = s.index(a)
    i1 = s.index(b) + len(b)
    s = s[:i0] + "\n".join(lines) + s[i1:]
    open(p, "w", encoding="utf-8").write(s)


if __name__ == "__main__":
    main()
