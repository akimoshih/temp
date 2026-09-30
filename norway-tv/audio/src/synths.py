"""
synths.py - instrument voices for the NORWAY-in-30s score (all synthesised).

Drums: kick, clap, snare, hats (additive metallic), toms, crash/reverse cymbal, shaker.
Tonal: sub/mid bass, supersaw chords/stabs, choir pad (formant), open-fifth drone,
hardingfele-like bowed lead (band-limited saw + body resonances + sympathetic strings),
Karplus-Strong plucks, glass bells, arp pluck, tonal riser.
"""
import numpy as np
from dsp import (FS, TWO_PI, mtof, pan, saw, square, sine, svf, svf4, hpf, lpf, bpf, peq, highshelf,
                 lowshelf, softclip, asym_sat, fade_edges, env_ar, env_adsr, ks_pluck, sympathetic,
                 additive, oversampled, pink, dc_block, smoothstep, as_stereo)
from scipy import signal


# ============================================================================ DRUMS
def kick(f_end=55.0, f_start=300.0, p_tau=0.026, hold=0.045, amp_tau=0.08, dur=0.40, click=0.35,
         drive=2.0, seed=0, fs=FS):
    """Punchy tuned kick: pitch-enveloped sine (tail tuned to f_end) + chirp knock + noise click."""
    rng = np.random.default_rng(seed)
    n = int(dur * fs)
    t = np.arange(n) / fs
    f = f_end + (f_start - f_end) * np.exp(-t / p_tau) + 1400.0 * np.exp(-t / 0.0018)
    ph = np.cumsum(f) / fs - f[0] / fs
    body = np.sin(TWO_PI * ph)
    amp = np.where(t < hold, 1.0, np.exp(-(t - hold) / amp_tau))
    amp = signal.lfilter([0.02], [1, -0.98], amp) / (0.02 / (1 - 0.98))  # tiny smoothing of knee
    amp[: int(0.0004 * fs)] *= np.linspace(0, 1, int(0.0004 * fs))
    body *= amp
    body = np.tanh(drive * body) / np.tanh(drive)
    nz = rng.standard_normal(n) * np.exp(-t / 0.0025)
    nz = svf(nz, 4500, 0.8, "bp")
    y = body + click * nz
    y = hpf(y, 28, order=2)
    return fade_edges(y, 0, int(0.03 * fs))


def clap(seed=0, tail_tau=0.075, tone=1250, dur=0.4, fs=FS):
    """Classic multi-burst clap (4 transients) + tail; returns stereo (slightly decorrelated)."""
    rng = np.random.default_rng(seed)
    n = int(dur * fs)
    t = np.arange(n) / fs
    offs = [0.0, 0.0095, 0.0185, 0.0275]
    gains = [0.75, 0.85, 0.7, 1.0]
    env = np.zeros(n)
    for i, (o, g) in enumerate(zip(offs, gains)):
        tt = t - o
        m = tt >= 0
        tau = 0.0038 if i < 3 else tail_tau
        e = np.zeros(n)
        e[m] = g * np.exp(-tt[m] / tau) * (1 - np.exp(-tt[m] / 0.0004))
        env = np.maximum(env, e)
    out = []
    for c in range(2):
        nz = rng.standard_normal(n)
        x = nz * env
        a = svf(x, tone, 1.1, "bp")
        b = svf(x, tone * 2.6, 1.4, "bp") * 0.45
        hp = svf(x, 900, 0.7, "hp") * 0.25
        out.append(a + b + hp)
    st = np.stack(out, axis=1)
    m = st.mean(axis=1, keepdims=True)
    st = 0.75 * m + 0.25 * st  # mostly mono, a bit of spread
    st = peq(st, 3200, -2.0, 1.2)
    st = lpf(st, 9500, order=2)
    st = highshelf(st, 7000, -2.5)
    return fade_edges(st, 0, 256)


def snare(seed=0, tone=195, dur=0.38, snappy=0.8, fs=FS):
    rng = np.random.default_rng(seed + 100)
    n = int(dur * fs)
    t = np.arange(n) / fs
    f = tone * (1 + 0.55 * np.exp(-t / 0.012))
    ph = np.cumsum(f) / fs
    body = np.sin(TWO_PI * ph) * np.exp(-t / 0.075) + 0.45 * np.sin(TWO_PI * ph * 1.63) * np.exp(-t / 0.035)
    body[: 20] *= np.linspace(0, 1, 20)
    nz = rng.standard_normal(n) * (np.exp(-t / 0.11) * (1 - np.exp(-t / 0.0005)))
    nz = svf(nz, 1700, 0.6, "hp") + 0.5 * svf(nz, 5200, 0.9, "bp")
    nz = lpf(nz, 9000, order=2)
    y = 0.9 * np.tanh(1.4 * body) + snappy * 0.55 * nz
    y = hpf(y, 110)
    y = peq(y, 3600, -2.5, 1.0)
    return fade_edges(y, 0, 256)


_HAT_BASE = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]


def _metallic(n, mult, rng, fmin=4000, fmax=19000, fs=FS):
    parts = []
    for b in _HAT_BASE:
        k = 1
        while b * mult * k < fmax:
            f = b * mult * k * rng.uniform(0.997, 1.003)
            if f > fmin * 0.5:
                parts.append((f, 1.0 / k, None))
            k += 2
    return additive(parts, n, fs, rng)


def hat(decay=0.035, vel=1.0, seed=0, open_=False, fs=FS):
    """Additive-metallic + noise hat (band-limited: partials <19 kHz). Mono."""
    rng = np.random.default_rng(seed + 300)
    dur = (decay * 6 + 0.01) if not open_ else decay * 4
    n = int(dur * fs)
    t = np.arange(n) / fs
    met = _metallic(n, rng.uniform(0.985, 1.015), rng)
    met /= np.std(met) + 1e-9
    nz = rng.standard_normal(n)
    x = 0.55 * met + 0.45 * nz
    x = svf4(x, 7200, 0.7, "hp")
    x = x + 0.5 * svf(x, 10500, 1.2, "bp")
    env = np.exp(-t / decay) * (1 - np.exp(-t / 0.00035))
    if open_:
        env = env * (1 - 0.35 * np.exp(-t / 0.01))
    y = x * env
    # lower velocity = slightly darker
    if vel < 0.8:
        y = lpf(y, 9000 + 9000 * vel, order=1)
    y = highshelf(y, 11000, -4)
    y = lpf(y, 14500, order=2)
    return fade_edges(y * vel, 0, 128)


def shaker(vel=1.0, seed=0, fs=FS):
    rng = np.random.default_rng(seed + 500)
    n = int(0.09 * fs)
    t = np.arange(n) / fs
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.022)
    x = rng.standard_normal(n) * env
    x = svf(x, 7200, 1.3, "bp") + 0.2 * svf(x, 10000, 1.0, "bp")
    return fade_edges(x * vel, 0, 128)


def tambourine(vel=1.0, seed=0, fs=FS):
    rng = np.random.default_rng(seed + 600)
    n = int(0.22 * fs)
    t = np.arange(n) / fs
    parts = [(f, rng.uniform(0.4, 1.0), rng.uniform(0.04, 0.11)) for f in rng.uniform(5200, 12500, 40)]
    j = additive(parts, n, fs, rng)
    j /= np.std(j) + 1e-9
    nz = rng.standard_normal(n) * np.exp(-t / 0.03)
    x = (0.7 * j + 0.5 * nz) * (1 - np.exp(-t / 0.0008))
    x = svf(x, 5000, 0.7, "hp")
    return fade_edges(x * vel * 0.5, 0, 128)


def tom(f0=110, dur=0.5, seed=0, fs=FS):
    rng = np.random.default_rng(seed + 700)
    n = int(dur * fs)
    t = np.arange(n) / fs
    f = f0 * (1 + 0.7 * np.exp(-t / 0.03))
    ph = np.cumsum(f) / fs
    body = np.sin(TWO_PI * ph) * np.exp(-t / 0.22) + 0.3 * np.sin(TWO_PI * ph * 1.5) * np.exp(-t / 0.08)
    body[:20] *= np.linspace(0, 1, 20)
    nz = svf(rng.standard_normal(n) * np.exp(-t / 0.012), 2500, 0.8, "bp")
    y = np.tanh(1.6 * body) + 0.35 * nz
    y = hpf(y, 50)
    return fade_edges(y, 0, 512)


def crash(dur=3.2, seed=0, bright=1.0, fs=FS):
    """Additive shimmer (300 inharmonic partials) + noise + metallic cluster; stereo decorrelated."""
    n = int(dur * fs)
    t = np.arange(n) / fs
    out = np.zeros((n, 2))
    for c in range(2):
        rng = np.random.default_rng(seed * 10 + c + 900)
        acc = np.zeros(n)
        fs_list = np.exp(rng.uniform(np.log(420), np.log(15500), 300))
        for f in fs_list:
            tau = 1.5 * (1000.0 / f) ** 0.33 * rng.uniform(0.6, 1.3) * dur / 3.2
            a = (f / 1000.0) ** -0.15 * rng.uniform(0.3, 1.0)
            acc += a * np.exp(-t / tau) * np.sin(TWO_PI * f * t + rng.uniform(0, TWO_PI))
        acc /= np.std(acc[: int(0.3 * fs)]) + 1e-9
        nz = rng.standard_normal(n)
        nz = svf(nz, 2800, 0.6, "hp")
        nz_env = 0.7 * np.exp(-t / (0.85 * dur / 3.2)) + 0.6 * np.exp(-t / 0.09)
        met = _metallic(n, rng.uniform(1.4, 1.6), rng, fmin=2500)
        met = svf(met / (np.std(met) + 1e-9), 3400, 2.0, "bp") + svf(met, 8200, 2.0, "bp")
        x = 0.55 * acc + 0.55 * nz * nz_env + 0.25 * met * np.exp(-t / 0.35)
        x *= (1 - np.exp(-t / 0.0007))
        # strike transient
        x += 0.8 * svf(rng.standard_normal(n) * np.exp(-t / 0.004), 5000, 0.7, "hp")
        out[:, c] = x
    out = hpf(out, 380, order=2)
    out = peq(out, 3500, -3.0, 0.9)
    out = highshelf(out, 9000, -5.0)
    if bright < 1:
        out = lpf(out, 6000 + 10000 * bright, order=1)
    out /= np.max(np.abs(out)) + 1e-9
    return fade_edges(out, 0, int(0.3 * fs))


def reverse_cymbal(dur=1.8, seed=0, fs=FS):
    c = crash(dur=dur * 1.3, seed=seed + 40, fs=fs)
    n = int(dur * fs)
    r = c[:n][::-1].copy()
    t = np.arange(n) / fs
    r *= (t / dur)[:, None] ** 1.5
    return fade_edges(r, int(0.05 * fs), 96)


# ============================================================================ BASS
def sub_track(freq, amp, drive=1.6):
    """Continuous-phase sub sine from per-sample freq & amp tracks (mono). Adds 2nd/3rd harmonic
    via gentle saturation so it translates on small speakers."""
    ph = np.cumsum(freq) / FS
    x = np.sin(TWO_PI * ph) * amp
    y = np.tanh(drive * x) / np.tanh(drive)
    y = lpf(y, 220, order=2)
    return dc_block(y)


def midbass_note(freq, dur, cut_base=260, cut_peak=1900, cut_tau=0.085, q=1.3, drive=2.2, seed=0):
    """Saw-ish mid bass with filter envelope. Oscillators, filter and saturation all run at 2x and are
    decimated (no aliasing from the drive stage). Mono."""
    rng = np.random.default_rng(seed)
    ph = rng.uniform(size=3)

    def render(fs):
        n = int(dur * fs) + int(0.02 * fs)
        t = np.arange(n) / fs
        x = 0.55 * saw(freq * 2 ** (-6 / 1200), n, fs=fs, phase0=ph[0]) + \
            0.55 * saw(freq * 2 ** (6 / 1200), n, fs=fs, phase0=ph[1])
        x += 0.35 * square(freq / 2, n, fs=fs, phase0=ph[2])
        fc = cut_base + (cut_peak - cut_base) * np.exp(-t / cut_tau)
        y = svf4(x, fc, q, "lp", fs=fs)
        env = env_adsr(n, 0.003, 0.08, 0.8, 0.018, int(dur * fs), fs=fs)
        return np.tanh(drive * y * env) / drive

    return oversampled(render, 2)


# ============================================================================ SUPERSAW (chords, stabs, leads)
_SS_DET = np.array([-19, -12, -6, 0, 6, 12, 19]) / 1200.0
_SS_PAN = np.array([-0.85, -0.55, -0.25, 0.0, 0.25, 0.55, 0.85])
_SS_AMP = np.array([0.6, 0.75, 0.9, 1.0, 0.9, 0.75, 0.6])


def supersaw_note(freq, dur, cut_env=None, q=0.9, detune=1.0, width_=1.0, seed=0, release=0.08, attack=0.004,
                  sustain=1.0, decay=0.2):
    """7-voice supersaw, rendered 2x oversampled. cut_env: function(t)->cutoff Hz. Returns stereo."""
    rng = np.random.default_rng(seed)
    total = dur + release

    def render(fs):
        n = int(total * fs)
        acc = np.zeros((n, 2))
        for d, p, a in zip(_SS_DET, _SS_PAN, _SS_AMP):
            s = saw(freq * 2 ** (d * detune), n, fs=fs, phase0=rng.uniform())
            th = (p * width_ + 1) * np.pi / 4
            acc[:, 0] += a * s * np.cos(th)
            acc[:, 1] += a * s * np.sin(th)
        return acc / 3.2

    x = oversampled(render, 2)
    n = x.shape[0]
    t = np.arange(n) / FS
    if cut_env is not None:
        x = svf4(x, cut_env(t), q, "lp")
    env = env_adsr(n, attack, decay, sustain, release, int(dur * FS))
    return x * env[:, None]


def chord_hit(midis, dur, cut_peak=7000, cut_sus=2200, cut_tau=0.12, seed=0, detune=1.0, width_=1.0,
              sustain=0.85, decay=0.18, release=0.06, attack=0.004):
    out = None
    for i, m in enumerate(midis):
        f = mtof(m)
        ce = lambda t, cp=cut_peak, cs=cut_sus: cs + (cp - cs) * np.exp(-t / cut_tau)
        y = supersaw_note(f, dur, ce, q=0.8, detune=detune, width_=width_, seed=seed * 31 + i, release=release,
                          sustain=sustain, decay=decay, attack=attack)
        out = y if out is None else out[: min(len(out), len(y))] + y[: min(len(out), len(y))]
    return out / np.sqrt(len(midis))


# ============================================================================ CHOIR PAD
VOWELS = {
    "a": [(800, 0.72, 7.0), (1150, 0.55, 9.0), (2800, 0.24, 14.0), (3500, 0.11, 16.0)],
    "o": [(560, 0.72, 7.0), (880, 0.45, 9.0), (2600, 0.13, 14.0), (3300, 0.05, 16.0)],
    "u": [(330, 1.0, 6.0), (800, 0.30, 9.0), (2300, 0.06, 14.0), (3100, 0.03, 16.0)],
}


def choir_pad(voice_tracks, amp, vowel_mix, lp_track, seed=0, breath=0.05):
    """voice_tracks: list of per-sample freq arrays (continuous voice-leading, no retrigger).
    amp: per-sample gain. vowel_mix: per-sample 0..1 morph 'o'->'a'. lp_track: per-sample LPF cutoff.
    Returns stereo."""
    rng = np.random.default_rng(seed)
    n = len(amp)
    t = np.arange(n) / FS
    L = np.zeros(n)
    R = np.zeros(n)
    nv = len(voice_tracks)
    for i, fr in enumerate(voice_tracks):
        p = -0.7 + 1.4 * i / max(1, nv - 1)
        for j, det in enumerate([-8, 0, 8]):
            vib_rate = rng.uniform(4.6, 5.6)
            drift = np.interp(t, np.linspace(0, t[-1], 40), rng.normal(0, 3.5, 40))  # slow pitch drift (cents)
            cents = det + drift + 7 * np.sin(TWO_PI * vib_rate * t + rng.uniform(0, TWO_PI))
            s = saw(fr * 2 ** (cents / 1200), phase0=rng.uniform())
            pp = np.clip(p + (j - 1) * 0.18, -1, 1)
            th = (pp + 1) * np.pi / 4
            L += s * np.cos(th)
            R += s * np.sin(th)
    src = np.stack([L, R], axis=1) / (nv * 1.7)
    nz = np.stack([pink(n, rng), pink(n, rng)], axis=1) * breath
    src = src + nz
    out = np.zeros_like(src)
    va, vo = VOWELS["a"], VOWELS["o"]
    for (fa, ga, qa), (fo, go, qo) in zip(va, vo):
        fc = fo + (fa - fo) * vowel_mix
        g = go + (ga - go) * vowel_mix
        out += svf(src, fc, qa, "bp") * g[:, None]
    out = 1.6 * out + 0.18 * svf(src, 1200, 0.6, "lp")
    out = svf(out, lp_track, 0.6, "lp")
    out = hpf(out, 170, order=2)
    return out * amp[:, None]


# ============================================================================ DRONE (open fifths)
def drone(midis, amp, lp_base=650, seed=0):
    rng = np.random.default_rng(seed + 50)
    n = len(amp)
    t = np.arange(n) / FS
    L = np.zeros(n)
    R = np.zeros(n)
    for i, m in enumerate(midis):
        f0 = mtof(m)
        for j, det in enumerate([-5, 5]):
            cents = det + 3 * np.sin(TWO_PI * rng.uniform(0.07, 0.15) * t + rng.uniform(0, 6.28))
            s = saw(f0 * 2 ** (cents / 1200), phase0=rng.uniform())
            if j == 0:
                L += s
            else:
                R += s
    x = np.stack([L, R], axis=1) / (len(midis) * 1.5)
    lfo = lp_base * (1 + 0.45 * np.sin(TWO_PI * 0.11 * t) + 0.25 * np.sin(TWO_PI * 0.043 * t + 1))
    x = svf(x, lfo, 1.0, "lp")
    # bow hiss
    nz = np.stack([pink(n, rng), pink(n, rng)], axis=1)
    nz = svf(nz, 2600, 1.5, "bp") * 0.02
    x = x + nz
    x = hpf(x, 55)
    return x * amp[:, None]


# ============================================================================ HARDINGFELE-LIKE LEAD
BODY_RES = [(285, 4.0, 0.9), (470, 3.5, 0.75), (720, 3.0, 0.3), (1080, 2.8, 0.6), (2350, 2.2, 0.75),
            (3050, 2.8, 0.5), (4400, 2.2, 0.3)]
SYMPATHETIC = [293.66, 329.63, 349.23, 440.0, 587.33]  # D4 E4 F4 A4 D5 (D-minor understrings)


def _fiddle_tracks(notes, n, fs, grace=None, vib_depth=22, vib_rate=5.6, seed=0):
    """notes: list of (start_s, dur_s, midi, accent). Build freq & amp tracks at fs."""
    rng = np.random.default_rng(seed)
    t = np.arange(n) / fs
    freq = np.full(n, mtof(notes[0][2]))
    amp = np.zeros(n)
    vibd = np.zeros(n)
    for k, (st, du, m, acc) in enumerate(notes):
        a = int(st * fs)
        b = min(n, int((st + du) * fs))
        if b <= a:
            continue
        f = mtof(m)
        seg_t = (np.arange(b - a)) / fs
        # scoop into the note (-35 cents -> 0 in 35 ms) - fiddle-like attack
        cents = -35 * np.exp(-seg_t / 0.018)
        fr = f * 2 ** (cents / 1200)
        # grace note (ornament: quick upper neighbour) for accented notes
        if grace is not None and acc >= 2 and du > 0.12:
            gm = m + (2 if (m % 12) not in (4, 9) else 1)
            gl = int(0.038 * fs)
            fr[:gl] = mtof(gm)
            fr[gl:gl + int(0.012 * fs)] = np.linspace(mtof(gm), f, len(fr[gl:gl + int(0.012 * fs)]))
        freq[a:b] = fr
        # bow envelope: quick bite, slight swell, legato dip at bow change
        e = np.ones(b - a)
        na = int(0.012 * fs)
        e[:na] = np.linspace(0.35, 1.0, na)
        e *= (0.85 + 0.15 * smoothstep(seg_t / max(du, 1e-3)))
        e *= (1.0 + 0.25 * np.exp(-seg_t / 0.03)) * (0.9 + 0.1 * acc)
        nr = min(int(0.02 * fs), (b - a) // 3)
        e[-nr:] *= np.linspace(1.0, 0.55, nr)
        amp[a:b] = np.maximum(amp[a:b], e)
        # delayed vibrato for longer notes
        vd = vib_depth * smoothstep((seg_t - 0.14) / 0.25) if du > 0.2 else np.zeros(b - a)
        vibd[a:b] = vd
    # fill gaps: hold previous freq (avoid phase jumps), amp 0
    last = freq[0]
    mask = amp > 0
    idx = np.where(mask, np.arange(n), 0)
    np.maximum.accumulate(idx, out=idx)
    freq = freq[idx]
    vib = vibd * np.sin(TWO_PI * vib_rate * t + 0.3 * np.sin(TWO_PI * 0.7 * t))
    freq = freq * 2 ** (vib / 1200)
    # smooth amplitude (bow can't jump) - 4 ms one-pole
    a1 = np.exp(-1 / (0.004 * fs))
    amp = signal.lfilter([1 - a1], [1, -a1], amp)
    return freq, amp


def fiddle(notes, total_dur, seed=0, drone_midi=62, drone_level=0.2, symp_level=0.16, bright=1.0):
    """Bowed hardingfele-like line. notes: (start_s, dur_s, midi, accent[0..2]) relative to 0.
    Returns stereo of length total_dur+tail."""
    tail = 1.2
    n_out = int((total_dur + tail) * FS)
    rng = np.random.default_rng(seed)

    def render(fs):
        n = int((total_dur + tail) * fs)
        freq, amp = _fiddle_tracks(notes, n, fs, grace=True, seed=seed)
        s = saw(freq, fs=fs, phase0=0.1) * 0.8 + 0.2 * saw(freq * 2 ** (4 / 1200), fs=fs, phase0=0.6)
        s *= amp
        # open-string double stop drone (bowed with the same bow)
        if drone_level > 0:
            d = saw(np.full(n, mtof(drone_midi)) * 2 ** (1.5 / 1200), fs=fs, phase0=0.3)
            s = s + drone_level * d * amp
        return s

    x = oversampled(render, 2)[:n_out]
    # bow noise (rosin) follows amplitude
    freq, amp = _fiddle_tracks(notes, n_out, FS, grace=True, seed=seed)
    bow = svf(rng.standard_normal(n_out), 3200, 0.9, "bp") * amp * 0.06
    x = x + bow
    body = 0.3 * x
    for f, q, g in BODY_RES:
        body += g * svf(x, f, q, "bp")
    body = lpf(body, 7500 * bright, order=2)
    body = peq(body, 1500, -2.0, 0.8)
    body = hpf(body, 200, order=2)
    symp = sympathetic(body * 0.15, SYMPATHETIC, t60=2.2, damp=0.35)
    symp = hpf(symp, 250)
    L = body + symp_level * np.concatenate([symp[37:], np.zeros(37)])
    R = body + symp_level * symp
    st = np.stack([L, R], axis=1)
    return st / (np.max(np.abs(st)) + 1e-9)


def pluck(freq, dur=0.9, t60=0.9, bright=0.55, seed=0, body=True):
    """Plucked (pizzicato hardingfele-ish) Karplus-Strong + body resonance. Mono."""
    rng = np.random.default_rng(seed)
    y = ks_pluck(freq, dur, t60=t60, bright=bright, exc_bright=7000, rng=rng, pick_pos=0.18)
    if body:
        b = 0.4 * y
        for f, q, g in BODY_RES[:5]:
            b += 0.6 * g * svf(y, f, q, "bp")
        y = b
    y = hpf(y, 180)
    return fade_edges(y / (np.max(np.abs(y)) + 1e-9), 16, 480)


def saw_pluck(freq, dur=0.25, cut_peak=5000, cut_base=500, cut_tau=0.06, seed=0):
    """Bright synth pluck (future-bass style) - 2x oversampled saw pair + env LPF. Mono."""
    rng = np.random.default_rng(seed)

    def render(fs):
        n = int((dur + 0.05) * fs)
        return 0.5 * saw(freq * 2 ** (-7 / 1200), n, fs=fs, phase0=rng.uniform()) + \
            0.5 * saw(freq * 2 ** (7 / 1200), n, fs=fs, phase0=rng.uniform())

    x = oversampled(render, 2)
    n = len(x)
    t = np.arange(n) / FS
    x = svf(x, cut_base + (cut_peak - cut_base) * np.exp(-t / cut_tau), 1.1, "lp")
    env = np.exp(-t / (dur * 0.45)) * (1 - np.exp(-t / 0.0015))
    return fade_edges(x * env, 0, 480)


# ============================================================================ BELLS
def glass_bell(freq, dur=2.6, seed=0, bright=1.0):
    """Glassy inharmonic bell (additive) with shimmer beating; mono."""
    rng = np.random.default_rng(seed)
    n = int(dur * FS)
    t = np.arange(n) / FS
    ratios = [1.0, 1.0016, 2.0, 2.76, 4.07, 5.40, 6.80, 8.93]
    amps = [1.0, 0.35, 0.28, 0.45, 0.16, 0.2 * bright, 0.08 * bright, 0.06 * bright]
    taus = [1.5, 1.7, 0.8, 0.6, 0.38, 0.28, 0.2, 0.12]
    parts = [(freq * r, a, tau * dur / 2.6) for r, a, tau in zip(ratios, amps, taus)]
    y = additive(parts, n, FS, rng)
    tink = svf(rng.standard_normal(n) * np.exp(-t / 0.0025) * (1 - np.exp(-t / 0.0004)), 6000, 0.9, "bp") * 0.1 * bright
    y = (y + tink) * (1 - np.exp(-t / 0.0012))
    y = hpf(y, 300)
    return fade_edges(y / (np.max(np.abs(y)) + 1e-9), 0, int(0.2 * FS))


# ============================================================================ RISER (tonal)
def tonal_riser(dur, m_start=50, m_end=86, seed=0):
    """Exponential pitch-rise supersaw + opening LPF, crescendo. Stereo."""
    rng = np.random.default_rng(seed)
    n = int(dur * FS)
    t = np.arange(n) / FS
    x = t / dur
    midi = m_start + (m_end - m_start) * x ** 1.6
    f = mtof(midi)

    def render(fs):
        nn = int(dur * fs)
        ff = np.interp(np.arange(nn) / fs, t, f)
        acc = np.zeros((nn, 2))
        for d, p in zip([-15, -5, 5, 15], [-0.8, -0.3, 0.3, 0.8]):
            s = saw(ff * 2 ** (d / 1200), fs=fs, phase0=rng.uniform())
            s += 0.5 * saw(ff * 2 * 2 ** (d / 1200), fs=fs, phase0=rng.uniform())
            th = (p + 1) * np.pi / 4
            acc[:, 0] += s * np.cos(th)
            acc[:, 1] += s * np.sin(th)
        return acc / 4

    y = oversampled(render, 2)[:n]
    y = svf(y, 300 + 9000 * x ** 2.2, 1.2, "lp")
    y = hpf(y, 200)
    y *= (x ** 2.0)[:, None]
    return fade_edges(y, 256, 96)
