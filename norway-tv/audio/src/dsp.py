"""
dsp.py - DSP primitives for the NORWAY-in-30s soundtrack.

Everything is synthesised from scratch (numpy / scipy / numba). No samples.
Conventions: mono signals are 1-D float64 arrays, stereo signals are (n, 2).
"""
import os
os.environ.setdefault("NUMBA_CACHE_DIR",
                      os.path.join(os.path.dirname(__file__), "..", "..", "tmp", "audio", "numba_cache"))
import numpy as np
from numba import njit
from scipy import signal

FS = 48000
TWO_PI = 2.0 * np.pi


# ----------------------------------------------------------------------------- utils
def undb(d):
    return 10.0 ** (np.asarray(d, dtype=np.float64) / 20.0)


def todb(x):
    return 20.0 * np.log10(np.maximum(np.abs(x), 1e-12))


def mtof(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def as_stereo(x):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        return np.stack([x, x], axis=1)
    return x


def pan(mono, p):
    """Constant-power pan. p in [-1, 1] (scalar or per-sample array). Centre = -3 dB each side."""
    mono = np.asarray(mono, dtype=np.float64)
    p = np.clip(np.broadcast_to(np.asarray(p, dtype=np.float64), mono.shape), -1, 1)
    th = (p + 1.0) * np.pi / 4.0
    return np.stack([mono * np.cos(th), mono * np.sin(th)], axis=1)


def width(st, w):
    """M/S width control (w=0 mono, 1 unchanged, >1 wider)."""
    m = 0.5 * (st[:, 0] + st[:, 1])
    s = 0.5 * (st[:, 0] - st[:, 1]) * w
    return np.stack([m + s, m - s], axis=1)


def place(bus, sig, start, gain=1.0):
    """Mix sig into bus starting at sample `start` (clipped to bus bounds)."""
    sig = np.asarray(sig, dtype=np.float64)
    if bus.ndim == 2 and sig.ndim == 1:
        sig = as_stereo(sig)
    n = sig.shape[0]
    s0 = int(start)
    a = max(0, s0)
    b = min(bus.shape[0], s0 + n)
    if b <= a:
        return bus
    bus[a:b] += gain * sig[a - s0:b - s0]
    return bus


def fade_edges(x, fin=64, fout=64):
    """Raised-cosine fade in/out (samples) - prevents clicks at note/event boundaries."""
    x = np.array(x, dtype=np.float64, copy=True)
    n = x.shape[0]
    fin = int(min(fin, n // 2))
    fout = int(min(fout, n // 2))
    if fin > 0:
        w = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fin))
        x[:fin] *= w if x.ndim == 1 else w[:, None]
    if fout > 0:
        w = 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fout))
        x[n - fout:] *= w if x.ndim == 1 else w[:, None]
    return x


def smoothstep(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def env_ar(n, a, r_tau, fs=FS, hold=0.0):
    """Attack (s, raised-cos) then optional hold then exponential decay (tau s)."""
    t = np.arange(n) / fs
    e = np.ones(n)
    na = max(1, int(a * fs))
    e[:na] = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, na))
    td = np.maximum(t - a - hold, 0)
    e *= np.exp(-td / max(r_tau, 1e-6))
    return e


def env_adsr(n, a, d, s, r, gate_len, fs=FS):
    """ADSR envelope, total length n samples, release starts at gate_len samples."""
    e = np.zeros(n)
    na = max(1, int(a * fs)); nd = max(1, int(d * fs)); nr = max(1, int(r * fs))
    g = int(gate_len)
    idx = np.arange(n)
    # attack
    m = idx < na
    e[m] = 0.5 - 0.5 * np.cos(np.pi * idx[m] / na)
    m = (idx >= na) & (idx < na + nd)
    e[m] = 1.0 + (s - 1.0) * smoothstep((idx[m] - na) / nd)
    m = idx >= na + nd
    e[m] = s
    # value at gate
    gv = e[min(g, n - 1)] if g < n else e[-1]
    m = idx >= g
    rel = np.clip((idx[m] - g) / nr, 0, 1)
    e[m] = gv * (0.5 + 0.5 * np.cos(np.pi * rel))
    return e


def lin_interp_env(points, n, fs=FS):
    """points: list of (time_s, value); piecewise-linear envelope of n samples."""
    t = np.arange(n) / fs
    pts = np.array(points, dtype=np.float64)
    return np.interp(t, pts[:, 0], pts[:, 1])


# ----------------------------------------------------------------------------- oscillators
def phase_acc(freq, fs=FS, phase0=0.0):
    """Cycle-phase accumulator (in cycles). freq: array per sample."""
    inc = np.asarray(freq, dtype=np.float64) / fs
    ph = np.cumsum(inc) - inc[0] + phase0
    return ph


def _polyblep(t, dt):
    y = np.zeros_like(t)
    m = t < dt
    x = t[m] / dt[m]
    y[m] = x + x - x * x - 1.0
    m2 = t > 1.0 - dt
    x = (t[m2] - 1.0) / dt[m2]
    y[m2] = x * x + x + x + 1.0
    return y


def saw(freq, n=None, fs=FS, phase0=0.0):
    """PolyBLEP band-limited sawtooth. freq scalar (needs n) or array."""
    if np.isscalar(freq):
        freq = np.full(int(n), float(freq))
    freq = np.asarray(freq, dtype=np.float64)
    ph = phase_acc(freq, fs, phase0)
    t = ph - np.floor(ph)
    dt = np.clip(freq / fs, 1e-9, 0.5)
    return 2.0 * t - 1.0 - _polyblep(t, dt)


def square(freq, n=None, fs=FS, phase0=0.0, pw=0.5):
    if np.isscalar(freq):
        freq = np.full(int(n), float(freq))
    freq = np.asarray(freq, dtype=np.float64)
    ph = phase_acc(freq, fs, phase0)
    t = ph - np.floor(ph)
    dt = np.clip(freq / fs, 1e-9, 0.5)
    y = np.where(t < pw, 1.0, -1.0)
    y += _polyblep(t, dt)
    t2 = t - pw
    t2 -= np.floor(t2)
    y -= _polyblep(t2, dt)
    return y


def sine(freq, n=None, fs=FS, phase0=0.0):
    if np.isscalar(freq):
        freq = np.full(int(n), float(freq))
    ph = phase_acc(freq, fs, phase0)
    return np.sin(TWO_PI * ph)


def additive(partials, n, fs=FS, rng=None):
    """partials: list of (freq, amp, decay_tau_s or None). Returns mono."""
    t = np.arange(n) / fs
    out = np.zeros(n)
    rng = rng or np.random.default_rng(0)
    for f, a, tau in partials:
        if f >= fs * 0.45:
            continue
        ph = rng.uniform(0, TWO_PI)
        env = np.exp(-t / tau) if tau else 1.0
        out += a * env * np.sin(TWO_PI * f * t + ph)
    return out


def oversampled(fn, os_factor=2):
    """Run fn(fs) at fs*os_factor and decimate back (anti-aliased)."""
    y = fn(FS * os_factor)
    return signal.resample_poly(y, 1, os_factor, axis=0)


# ----------------------------------------------------------------------------- filters (numba)
@njit(cache=True, fastmath=True)
def _svf(x, fc, q, fs):
    n = x.shape[0]
    lp = np.empty(n)
    bp = np.empty(n)
    hp = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    nyq_lim = 0.49 * fs
    for i in range(n):
        f = fc[i]
        if f > nyq_lim:
            f = nyq_lim
        if f < 5.0:
            f = 5.0
        g = np.tan(np.pi * f / fs)
        k = 1.0 / q[i]
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v0 = x[i]
        v3 = v0 - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        lp[i] = v2
        bp[i] = v1
        hp[i] = v0 - k * v1 - v2
    return lp, bp, hp


def svf(x, fc, q=0.707, mode="lp", fs=FS):
    """Zavalishin TPT state-variable filter with per-sample cutoff/Q (time-varying safe).
    mode: lp | bp (unity-peak) | hp | notch. Works on mono or stereo."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 2:
        return np.stack([svf(x[:, c], fc, q, mode, fs) for c in range(x.shape[1])], axis=1)
    n = x.shape[0]
    fca = np.ascontiguousarray(np.broadcast_to(np.asarray(fc, dtype=np.float64), (n,)))
    qa = np.ascontiguousarray(np.broadcast_to(np.asarray(q, dtype=np.float64), (n,)))
    lp, bp, hp = _svf(np.ascontiguousarray(x), fca, qa, float(fs))
    if mode == "lp":
        return lp
    if mode == "bp":
        return bp / qa
    if mode == "hp":
        return hp
    if mode == "notch":
        return lp + hp
    raise ValueError(mode)


def svf4(x, fc, q=0.707, mode="lp", fs=FS):
    """24 dB/oct (two cascaded SVFs)."""
    return svf(svf(x, fc, q, mode, fs), fc, 0.707 if mode != "bp" else q, mode, fs)


def _sos_apply(sos, x):
    return signal.sosfilt(sos, x, axis=0)


def hpf(x, fc, order=2, fs=FS):
    return _sos_apply(signal.butter(order, fc, "highpass", fs=fs, output="sos"), x)


def lpf(x, fc, order=2, fs=FS):
    return _sos_apply(signal.butter(order, fc, "lowpass", fs=fs, output="sos"), x)


def bpf(x, lo, hi, order=2, fs=FS):
    return _sos_apply(signal.butter(order, [lo, hi], "bandpass", fs=fs, output="sos"), x)


def _rbj(kind, f0, gain_db, q, fs=FS):
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * np.pi * f0 / fs
    alpha = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    if kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == "lowshelf":
        sA = np.sqrt(A)
        b = [A * ((A + 1) - (A - 1) * cw + 2 * sA * alpha), 2 * A * ((A - 1) - (A + 1) * cw),
             A * ((A + 1) - (A - 1) * cw - 2 * sA * alpha)]
        a = [(A + 1) + (A - 1) * cw + 2 * sA * alpha, -2 * ((A - 1) + (A + 1) * cw),
             (A + 1) + (A - 1) * cw - 2 * sA * alpha]
    elif kind == "highshelf":
        sA = np.sqrt(A)
        b = [A * ((A + 1) + (A - 1) * cw + 2 * sA * alpha), -2 * A * ((A - 1) + (A + 1) * cw),
             A * ((A + 1) + (A - 1) * cw - 2 * sA * alpha)]
        a = [(A + 1) - (A - 1) * cw + 2 * sA * alpha, 2 * ((A - 1) - (A + 1) * cw),
             (A + 1) - (A - 1) * cw - 2 * sA * alpha]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return np.concatenate([b, a])[None, :]


def peq(x, f0, gain_db, q=1.0, fs=FS):
    return _sos_apply(_rbj("peak", f0, gain_db, q, fs), x)


def lowshelf(x, f0, gain_db, q=0.707, fs=FS):
    return _sos_apply(_rbj("lowshelf", f0, gain_db, q, fs), x)


def highshelf(x, f0, gain_db, q=0.707, fs=FS):
    return _sos_apply(_rbj("highshelf", f0, gain_db, q, fs), x)


def dc_block(x, fc=12.0, fs=FS):
    return hpf(x, fc, order=1, fs=fs)


# ----------------------------------------------------------------------------- nonlinear
def softclip(x, drive=1.0):
    """tanh saturation normalised so small signals keep unity gain."""
    return np.tanh(drive * x) / drive


def soft_knee_clip(x, ceiling, knee=0.6, os_factor=2):
    """Transparent below knee*ceiling, smooth tanh shoulder up to `ceiling` (never exceeded).
    Runs oversampled to avoid aliasing from the shoulder."""
    up = signal.resample_poly(x, os_factor, 1, axis=0)
    k = knee * ceiling
    a = np.abs(up)
    over = a > k
    y = up.copy()
    y[over] = np.sign(up[over]) * (k + (ceiling - k) * np.tanh((a[over] - k) / (ceiling - k)))
    return signal.resample_poly(y, 1, os_factor, axis=0)


def asym_sat(x, drive=1.5, bias=0.15):
    """Asymmetric (even-harmonic) tube-ish saturation; DC removed afterwards by caller."""
    y = np.tanh(drive * (x + bias)) - np.tanh(drive * bias)
    return y / drive


# ----------------------------------------------------------------------------- noise
def white(n, rng):
    return rng.standard_normal(n)


def pink(n, rng):
    """Voss-McCartney-ish pink via FFT shaping (1/f power)."""
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / FS)
    f[0] = f[1]
    X /= np.sqrt(f / 1000.0)
    y = np.fft.irfft(X, n)
    return y / (np.std(y) + 1e-12)


def brown(n, rng):
    X = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / FS)
    f[0] = f[1]
    X /= (f / 100.0)
    y = np.fft.irfft(X, n)
    y = hpf(y, 15)
    return y / (np.std(y) + 1e-12)


# ----------------------------------------------------------------------------- Karplus-Strong
@njit(cache=True, fastmath=True)
def _ks(exc, n, period, loss, bright):
    # period: fractional delay length in samples; loss: feedback gain per period;
    # bright in (0,1]: loop filter y = b*x + (1-b)*x_prev (b=0.5 -> classic average)
    buflen = int(period) + 4
    buf = np.zeros(buflen)
    out = np.zeros(n)
    w = 0
    prev = 0.0
    ne = exc.shape[0]
    for i in range(n):
        # read fractional delay
        rd = w - period
        while rd < 0:
            rd += buflen
        i0 = int(rd)
        fr = rd - i0
        i1 = i0 + 1
        if i1 >= buflen:
            i1 -= buflen
        d = buf[i0] * (1.0 - fr) + buf[i1] * fr
        filt = bright * d + (1.0 - bright) * prev
        prev = d
        x = exc[i] if i < ne else 0.0
        y = x + loss * filt
        buf[w] = y
        out[i] = y
        w += 1
        if w >= buflen:
            w = 0
    return out


def ks_pluck(freq, dur, fs=FS, t60=1.2, bright=0.5, exc_bright=6000.0, rng=None, pick_pos=0.2):
    """Karplus-Strong string. Returns mono of length dur seconds."""
    rng = rng or np.random.default_rng(1)
    n = int(dur * fs)
    # loop filter delay compensation: two-tap filter adds (1-bright) samples of delay
    period = fs / freq - (1.0 - bright)
    P = int(period)
    exc = rng.uniform(-1, 1, max(P, 8))
    exc = lpf(exc, min(exc_bright, fs * 0.45), order=1, fs=fs)
    # pick position comb (removes harmonics -> less 'synthy')
    d = max(1, int(pick_pos * P))
    exc = exc - np.concatenate([np.zeros(d), exc[:-d]])
    exc -= exc.mean()
    loss = 10 ** (-3.0 * (fs / freq) / (t60 * fs))
    y = _ks(exc, n, period, loss, bright)
    return y


# ----------------------------------------------------------------------------- comb resonator bank (sympathetic strings)
@njit(cache=True, fastmath=True)
def _comb_bank(x, periods, gains, damp):
    n = x.shape[0]
    m = periods.shape[0]
    maxd = 0
    for j in range(m):
        if int(periods[j]) + 3 > maxd:
            maxd = int(periods[j]) + 3
    bufs = np.zeros((m, maxd))
    lps = np.zeros(m)
    out = np.zeros(n)
    w = 0
    for i in range(n):
        acc = 0.0
        for j in range(m):
            rd = w - periods[j]
            while rd < 0:
                rd += maxd
            i0 = int(rd)
            fr = rd - i0
            i1 = i0 + 1
            if i1 >= maxd:
                i1 -= maxd
            d = bufs[j, i0] * (1 - fr) + bufs[j, i1] * fr
            lps[j] = (1 - damp) * d + damp * lps[j]
            y = x[i] + gains[j] * lps[j]
            bufs[j, w] = y
            acc += lps[j]
        out[i] = acc
        w += 1
        if w >= maxd:
            w = 0
    return out


def sympathetic(x, freqs, t60=2.5, damp=0.3, fs=FS):
    periods = np.array([fs / f for f in freqs], dtype=np.float64)
    gains = np.array([10 ** (-3.0 * p / (t60 * fs)) for p in periods], dtype=np.float64)
    return _comb_bank(np.ascontiguousarray(x, dtype=np.float64), periods, gains, damp)


# ----------------------------------------------------------------------------- delay
@njit(cache=True, fastmath=True)
def _pingpong(xl, xr, dl, dr, fb, lpc):
    n = xl.shape[0]
    L = max(dl, dr) + 2
    bl = np.zeros(L)
    br = np.zeros(L)
    ol = np.zeros(n)
    orr = np.zeros(n)
    w = 0
    sl = 0.0
    sr = 0.0
    for i in range(n):
        rl = w - dl
        if rl < 0:
            rl += L
        rr = w - dr
        if rr < 0:
            rr += L
        yl = bl[rl]
        yr = br[rr]
        sl = (1 - lpc) * yl + lpc * sl
        sr = (1 - lpc) * yr + lpc * sr
        # ping-pong: left feeds right and vice versa; input enters mid into left line
        bl[w] = 0.5 * (xl[i] + xr[i]) + fb * sr
        br[w] = fb * sl
        ol[i] = yl
        orr[i] = yr
        w += 1
        if w >= L:
            w = 0
    return ol, orr


def pingpong(x, delay_samps, fb=0.35, lp_coef=0.35, delay_r=None):
    x = as_stereo(x)
    dl = int(delay_samps)
    dr = int(delay_r if delay_r is not None else delay_samps)
    ol, orr = _pingpong(np.ascontiguousarray(x[:, 0]), np.ascontiguousarray(x[:, 1]), dl, dr, fb, lp_coef)
    return np.stack([ol, orr], axis=1)


# ----------------------------------------------------------------------------- reverb (synthetic IR convolution)
_IR_CACHE = {}


def make_ir(t60=2.0, predelay=0.012, length=None, hf_ratio=0.35, lf_ratio=1.15, seed=0,
            er_count=14, er_time=0.07, er_gain=0.5, diffusion=0.006, bright_hz=None, fs=FS):
    """Stereo synthetic reverb IR: decorrelated noise, frequency-dependent decay (bands),
    early reflections, smooth diffusion onset. Energy normalised to 1 per channel."""
    key = (t60, predelay, length, hf_ratio, lf_ratio, seed, er_count, er_time, er_gain, diffusion, bright_hz)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    rng = np.random.default_rng(seed)
    L = int((length or t60 * 1.25) * fs)
    t = np.arange(L) / fs
    noise = rng.standard_normal((L, 2))
    edges = [20, 150, 400, 1000, 2500, 5000, 9000, 16000, 23500]
    ir = np.zeros((L, 2))
    for lo, hi in zip(edges[:-1], edges[1:]):
        fc = np.sqrt(lo * hi)
        # decay-time multiplier: lf_ratio at 100 Hz, 1 at 1 kHz, hf_ratio at 10 kHz (log interp)
        lf = np.log10(fc)
        if lf <= 3:
            mult = np.interp(lf, [2, 3], [lf_ratio, 1.0])
        else:
            mult = np.interp(lf, [3, 4], [1.0, hf_ratio])
        t60b = max(t60 * mult, 0.05)
        sos = signal.butter(3, [lo, min(hi, fs * 0.49)], "bandpass", fs=fs, output="sos")
        band = signal.sosfiltfilt(sos, noise, axis=0)
        ir += band * (10 ** (-3.0 * t / t60b))[:, None]
    # diffusion build-up
    ir *= (1 - np.exp(-t / max(diffusion, 1e-4)))[:, None]
    # early reflections
    for k in range(er_count):
        tt = rng.uniform(0.004, er_time)
        g = er_gain * (1 - tt / (er_time * 1.2)) * rng.uniform(0.4, 1.0)
        idx = int(tt * fs)
        ch = rng.integers(0, 2)
        ir[idx, ch] += g * rng.choice([-1, 1]) * 3.0
        ir[min(L - 1, idx + rng.integers(3, 40)), 1 - ch] += 0.6 * g * rng.choice([-1, 1]) * 3.0
    if bright_hz:
        ir = lpf(ir, bright_hz, order=2)
    ir = hpf(ir, 60, order=2)
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
    pd = int(predelay * fs)
    ir = np.concatenate([np.zeros((pd, 2)), ir], axis=0)
    # smooth tail end
    ir = fade_edges(ir, 0, int(0.25 * fs))
    _IR_CACHE[key] = ir
    return ir


def convolve_reverb(x, ir):
    """True-stereo-ish: L->irL, R->irR (decorrelated IR channels give width)."""
    x = as_stereo(x)
    n = x.shape[0]
    out = np.zeros((n, 2))
    for c in range(2):
        y = signal.fftconvolve(x[:, c], ir[:, c], mode="full")[:n]
        out[:, c] = y
    return out


# ----------------------------------------------------------------------------- dynamics
@njit(cache=True, fastmath=True)
def _env_follow(x, att, rel):
    n = x.shape[0]
    y = np.empty(n)
    e = 0.0
    for i in range(n):
        v = x[i]
        if v > e:
            e = att * e + (1 - att) * v
        else:
            e = rel * e + (1 - rel) * v
        y[i] = e
    return y


def env_follow(x, attack=0.005, release=0.1, fs=FS):
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 2:
        x = np.max(np.abs(x), axis=1)
    else:
        x = np.abs(x)
    a = np.exp(-1.0 / (attack * fs))
    r = np.exp(-1.0 / (release * fs))
    return _env_follow(np.ascontiguousarray(x), a, r)


@njit(cache=True, fastmath=True)
def _release_smooth(g, rel):
    n = g.shape[0]
    y = np.empty(n)
    s = 1.0
    for i in range(n):
        target = g[i]
        if target < s:
            s = target
        else:
            s = 1.0 - (1.0 - s) * rel
            if s > target:
                s = target
        y[i] = s
    return y


def compressor(x, thresh_db=-18, ratio=2.0, attack=0.01, release=0.15, knee_db=6.0, makeup_db=0.0,
               key=None, rms_win=0.005, fs=FS):
    """Feed-forward stereo-linked compressor (RMS-ish detector, soft knee)."""
    x = as_stereo(x)
    k = x if key is None else as_stereo(key)
    p = np.max(k ** 2, axis=1)
    w = max(1, int(rms_win * fs))
    p = np.convolve(p, np.ones(w) / w, mode="same")
    lvl = 10 * np.log10(p + 1e-12)
    over = lvl - thresh_db
    gr = np.zeros_like(over)
    kh = knee_db / 2
    m1 = over > kh
    gr[m1] = over[m1] * (1 - 1 / ratio)
    m2 = (over > -kh) & ~m1
    gr[m2] = (1 - 1 / ratio) * (over[m2] + kh) ** 2 / (2 * knee_db)
    # smooth gain reduction (attack/release on dB)
    a = np.exp(-1.0 / (attack * fs))
    r = np.exp(-1.0 / (release * fs))
    grs = _env_follow(np.ascontiguousarray(gr), a, r)
    g = 10 ** ((-grs + makeup_db) / 20)
    return x * g[:, None], grs


def true_peak(x, os_factor=4):
    """Estimated true peak (dBTP) via polyphase 4x oversampling."""
    x = as_stereo(x)
    y = signal.resample_poly(x, os_factor, 1, axis=0)
    return 20 * np.log10(np.max(np.abs(y)) + 1e-12)


def tp_limiter(x, ceiling_db=-1.2, lookahead=0.004, release=0.08, os_factor=4, fs=FS):
    """Look-ahead true-peak limiter. Gain computed from 4x-oversampled peaks, sliding-min
    look-ahead + moving-average attack (guarantees gain <= required at every peak), smooth release."""
    x = as_stereo(x)
    n = x.shape[0]
    up = signal.resample_poly(x, os_factor, 1, axis=0)
    pk = np.max(np.abs(up), axis=1)
    pk = pk[: (len(pk) // os_factor) * os_factor].reshape(-1, os_factor).max(axis=1)
    if len(pk) < n:
        pk = np.concatenate([pk, np.zeros(n - len(pk))])
    pk = pk[:n]
    ceil = 10 ** (ceiling_db / 20)
    greq = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
    L = max(1, int(lookahead * fs))
    from numpy.lib.stride_tricks import sliding_window_view
    # g1[i] = min(greq[i : i+L])
    padded = np.concatenate([greq, np.ones(L)])
    g1 = sliding_window_view(padded, L).min(axis=1)[:n]
    rel = np.exp(-1.0 / (release * fs))
    g2 = _release_smooth(np.ascontiguousarray(g1), rel)
    # moving average over the previous L samples  -> g3[i] = mean(g2[i-L+1 .. i]) <= greq[i]
    c = np.cumsum(np.concatenate([np.full(L, g2[0]), g2]))
    g3 = (c[L:] - c[:-L]) / L
    g3 = np.minimum(g3, 1.0)
    return x * g3[:, None], g3
