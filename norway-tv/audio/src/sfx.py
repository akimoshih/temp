"""
sfx.py - designed sound effects (all synthesised). Every function returns a stereo (n, 2) array whose
sync point (the transient that must land on the cue frame) is at sample 0, unless noted.
"""
import numpy as np
from scipy import signal
from dsp import (FS, TWO_PI, pan, svf, svf4, hpf, lpf, bpf, peq, highshelf, softclip, fade_edges, pink, brown,
                 make_ir, convolve_reverb, smoothstep, as_stereo, mtof)
import synths


def _t(n):
    return np.arange(n) / FS


def _itd_pan(mono, p, max_itd=0.00045):
    """Constant-power pan + small inter-aural time difference (far ear delayed)."""
    st = pan(mono, p)
    p = np.broadcast_to(np.asarray(p, dtype=np.float64), mono.shape)
    d = max_itd * FS * p  # + => right is near => delay left
    n = len(mono)
    idx = np.arange(n, dtype=np.float64)
    L = np.interp(idx - np.maximum(d, 0), idx, st[:, 0], left=0)
    R = np.interp(idx - np.maximum(-d, 0), idx, st[:, 1], left=0)
    return np.stack([L, R], axis=1)


def _room(x, t60=0.45, wet=0.25, seed=3, predelay=0.006):
    ir = make_ir(t60=t60, predelay=predelay, seed=seed, hf_ratio=0.5, er_gain=0.6)
    x = as_stereo(x)
    pad = np.zeros((ir.shape[0], 2))
    xx = np.concatenate([x, pad])
    return xx + wet * convolve_reverb(xx, ir)


def _hall(x, t60=3.0, wet=0.5, seed=5, predelay=0.02, length=None):
    ir = make_ir(t60=t60, predelay=predelay, seed=seed, hf_ratio=0.3, lf_ratio=1.2, length=length)
    x = as_stereo(x)
    pad = np.zeros((ir.shape[0], 2))
    xx = np.concatenate([x, pad])
    return xx + wet * convolve_reverb(xx, ir)


def _trim(x, thresh=1e-5):
    a = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    nz = np.nonzero(a > thresh * (a.max() + 1e-12))[0]
    if len(nz) == 0:
        return x
    return fade_edges(x[: nz[-1] + 1], 0, 256)


# ----------------------------------------------------------------------------- whooshes
def whoosh(dur=0.6, peak=0.45, f_lo=350, f_hi=2600, p_from=-0.6, p_to=0.6, q=1.3, seed=0, tonal=0.25,
           rise_pow=2.2, fall_tau=None, body=0.5):
    """Air whoosh: band-pass sweep through pink/white noise + optional resonant whistle, panned w/ ITD."""
    rng = np.random.default_rng(seed)
    n = int(dur * FS)
    t = _t(n)
    x = t / dur
    pk = peak
    nz = 0.7 * pink(n, rng) + 0.3 * rng.standard_normal(n)
    # centre frequency sweeps up to the peak, then down a bit (doppler-ish)
    fc = np.where(x < pk, f_lo * (f_hi / f_lo) ** smoothstep(x / pk),
                  f_hi * (0.55 + 0.45 * np.exp(-(x - pk) / 0.25)))
    a = svf(nz, fc, q, "bp")
    b = svf(nz, fc * 0.5, 0.7, "lp") * body
    c = svf(nz, fc * 1.9, 7.0, "bp") * tonal
    y = a + b + c
    rise = (np.clip(x / pk, 0, 1)) ** rise_pow
    ft = fall_tau or (1 - pk) * dur / 3.5
    fall = np.exp(-np.maximum(t - pk * dur, 0) / ft)
    env = np.where(x < pk, rise, fall)
    y *= env
    p = p_from + (p_to - p_from) * smoothstep(x)
    st = _itd_pan(y, p)
    return fade_edges(st, 32, int(0.02 * FS))


def whoosh_in(seed=1):
    """f0 opener: airy reverse-swell whoosh from the right to centre + sub swell."""
    w = whoosh(dur=1.3, peak=0.3, f_lo=250, f_hi=3200, p_from=0.75, p_to=-0.1, q=1.1, seed=seed, tonal=0.3,
               rise_pow=1.6, fall_tau=0.25)
    n = w.shape[0]
    t = _t(n)
    sub = np.sin(TWO_PI * np.cumsum(38 + 22 * np.exp(-t / 0.5)) / FS)
    sub *= np.where(t < 0.38, smoothstep(t / 0.38), np.exp(-(t - 0.38) / 0.28))
    shimmer = synths.glass_bell(mtof(93), dur=1.3, seed=seed, bright=0.6)[:n] * 0.08
    y = w + as_stereo(sub * 0.35) + pan(shimmer, 0.3)
    return _hall(y, t60=1.8, wet=0.25, seed=11)


def jet_whoosh(dur, seed=2):
    """Jet / air pass-by, panning L -> R over `dur` seconds: air rush, rumble, doppler turbine whine."""
    rng = np.random.default_rng(seed)
    n = int(dur * FS)
    t = _t(n)
    x = t / dur
    tc = 0.56  # closest approach
    prox = 1.0 / (1.0 + ((x - tc) / 0.2) ** 2)  # distance model
    env = smoothstep(np.clip(x / 0.12, 0, 1)) * (0.25 + 0.75 * prox) * (1 - smoothstep((x - 0.9) / 0.1))
    nz = pink(n, rng)
    fc = 600 + 2600 * prox ** 1.5
    air = svf(nz, fc, 0.9, "bp") + 0.4 * svf(nz, 220 + 400 * prox, 0.7, "lp")
    rumble = svf(brown(n, rng), 180, 0.8, "lp") * 0.9 * prox ** 1.2
    # doppler whine: higher while approaching, lower after
    dop = 1 + 0.10 * np.tanh(-(x - tc) / 0.08)
    whine = np.sin(TWO_PI * np.cumsum(2150 * dop) / FS) + 0.5 * np.sin(TWO_PI * np.cumsum(3320 * dop) / FS)
    whine *= 0.05 * prox ** 2 * (1 + 0.3 * svf(rng.standard_normal(n), 30, 0.7, "lp"))
    y = (air + rumble + whine) * env
    y = hpf(y, 40)
    p = -0.95 + 1.9 * smoothstep(np.clip((x - 0.1) / 0.85, 0, 1))
    st = _itd_pan(y, p, max_itd=0.0006)
    return fade_edges(st, 64, 1024)


def cut_whoosh(seed=0, p_from=-0.5, p_to=0.5, dur=0.16):
    return whoosh(dur=dur, peak=0.35, f_lo=900, f_hi=5200, p_from=p_from, p_to=p_to, q=1.6, seed=seed, tonal=0.1,
                  rise_pow=1.2, fall_tau=0.03, body=0.25)


# ----------------------------------------------------------------------------- clicks / ticks / pops
def pin_pop(seed=3):
    rng = np.random.default_rng(seed)
    n = int(0.5 * FS)
    t = _t(n)
    f = 330 * (3.4 ** smoothstep(np.clip(t / 0.028, 0, 1)))
    pop = np.sin(TWO_PI * np.cumsum(f) / FS) * np.exp(-t / 0.035) * (1 - np.exp(-t / 0.0006))
    click = svf(rng.standard_normal(n) * np.exp(-t / 0.0008), 3500, 0.7, "hp") * 0.5
    thud = np.sin(TWO_PI * np.cumsum(170 * (1 + 0.8 * np.exp(-t / 0.01))) / FS) * np.exp(-t / 0.03) * 0.55
    crin = svf(rng.standard_normal(n) * (rng.random(n) < 0.02) * np.exp(-t / 0.05), 4200, 1.5, "bp") * 1.4
    y = pop * 0.9 + click + thud + crin
    y = hpf(y, 60)
    st = pan(y, 0.12)
    return _trim(_room(st, 0.4, 0.2))


def digital_tick(freq=2400.0, vel=1.0, seed=0):
    rng = np.random.default_rng(seed)
    n = int(0.03 * FS)
    t = _t(n)
    blip = np.sin(TWO_PI * freq * t) * np.exp(-t / 0.004)
    blip += 0.35 * np.sin(TWO_PI * freq * 1.5 * t) * np.exp(-t / 0.0025)
    clk = svf(rng.standard_normal(n) * np.exp(-t / 0.0006), 6000, 0.8, "bp") * 0.4
    y = (blip + clk) * (1 - np.exp(-t / 0.0002)) * vel
    return fade_edges(pan(y, 0.0), 0, 64)


def mech_tick(vel=1.0, seed=0, tone=1800.0):
    """Odometer-ish mechanical counter tick (resonant click)."""
    rng = np.random.default_rng(seed)
    n = int(0.05 * FS)
    t = _t(n)
    ex = rng.standard_normal(n) * np.exp(-t / 0.0007)
    y = svf(ex, tone, 9, "bp") * 1.2 + svf(ex, tone * 2.3, 7, "bp") * 0.7 + svf(ex, 5500, 1.2, "bp") * 0.2
    y += np.sin(TWO_PI * tone * 0.5 * t) * np.exp(-t / 0.006) * 0.25
    return fade_edges(pan(y * vel, 0.0), 0, 64)


def ding(freq=1174.66, seed=0, dur=1.4, level2=0.35):
    """Clean 'count finished' ding: bell partials + glass octave + soft transient."""
    n = int(dur * FS)
    t = _t(n)
    y = (np.sin(TWO_PI * freq * t) * np.exp(-t / 0.55)
         + 0.25 * np.sin(TWO_PI * freq * 2.0 * t) * np.exp(-t / 0.28)
         + 0.12 * np.sin(TWO_PI * freq * 3.01 * t) * np.exp(-t / 0.16)
         + 0.08 * np.sin(TWO_PI * freq * 4.2 * t) * np.exp(-t / 0.08))
    y *= (1 - np.exp(-t / 0.0007))
    g = synths.glass_bell(freq * 1.5, dur=dur, seed=seed + 7, bright=0.8)[:n] * level2
    st = pan(y, -0.05) + pan(g, 0.2)
    st = _hall(st, t60=1.6, wet=0.3, seed=21)
    return _trim(st)


def pop(freq=700.0, vel=1.0, p=0.0, seed=0, bubbly=0.6):
    """Bubbly pop: fast upward sine sweep (water-drop) + tiny click + body."""
    rng = np.random.default_rng(seed)
    n = int(0.16 * FS)
    t = _t(n)
    sweep = freq * (1 + 0.85 * smoothstep(np.clip(t / 0.022, 0, 1)))
    y = np.sin(TWO_PI * np.cumsum(sweep) / FS) * np.exp(-t / (0.028 + 0.02 * bubbly)) * (1 - np.exp(-t / 0.0005))
    y += 0.25 * np.sin(TWO_PI * np.cumsum(sweep * 2) / FS) * np.exp(-t / 0.012)
    y += svf(rng.standard_normal(n) * np.exp(-t / 0.0006), 5000, 0.8, "hp") * 0.25
    y = hpf(y, 150)
    st = pan(y * vel, p)
    return fade_edges(st, 0, 128)


def camera_shutter(seed=4):
    """Mechanical SLR: mirror-up click + shutter curtain + mirror-return (two main transients 55 ms apart)."""
    rng = np.random.default_rng(seed)
    n = int(0.35 * FS)
    t = _t(n)

    def click(offset, g, tone):
        tt = t - offset
        m = tt >= 0
        e = np.zeros(n)
        e[m] = np.exp(-tt[m] / 0.0012)
        ex = rng.standard_normal(n) * e
        c = svf(ex, tone, 8, "bp") * 1.0 + svf(ex, tone * 2.7, 6, "bp") * 0.6 + svf(ex, 6500, 0.8, "hp") * 0.35
        th = np.zeros(n)
        th[m] = np.sin(TWO_PI * 160 * tt[m]) * np.exp(-tt[m] / 0.012) * 0.5
        return g * (c + th)

    y = click(0.0, 1.0, 1900) + click(0.012, 0.35, 3100) + click(0.055, 0.8, 1500) + click(0.062, 0.3, 2600)
    whirr = svf(rng.standard_normal(n), 2200, 3, "bp") * (np.clip((t - 0.07) / 0.01, 0, 1) * np.exp(-np.maximum(t - 0.07, 0) / 0.05)) * 0.15
    y = hpf(y + whirr, 90)
    st = pan(y, 0.18)
    return _trim(_room(st, 0.35, 0.22, seed=8))


def stamp_thunk(seed=5):
    """Rubber stamp slam on a desk: low thud + wood knock + rubber squish + small room."""
    rng = np.random.default_rng(seed)
    n = int(0.6 * FS)
    t = _t(n)
    thud = np.sin(TWO_PI * np.cumsum(78 * (1 + 1.2 * np.exp(-t / 0.012))) / FS) * np.exp(-t / 0.09)
    thud = np.tanh(2.0 * thud)
    ex = rng.standard_normal(n) * np.exp(-t / 0.0025)
    knock = svf(ex, 190, 6, "bp") * 1.2 + svf(ex, 430, 7, "bp") * 1.0 + svf(ex, 960, 6, "bp") * 0.6
    squish = svf(rng.standard_normal(n) * np.exp(-t / 0.035) * (1 - np.exp(-t / 0.004)), 1300, 0.8, "lp") * 0.35
    snap = svf(rng.standard_normal(n) * np.exp(-t / 0.0015), 2500, 0.7, "hp") * 0.3
    y = 0.9 * thud + knock + squish + snap
    y = hpf(y, 35)
    st = pan(y, -0.05)
    return _trim(_room(st, 0.5, 0.28, seed=9))


def paper_slap(seed=6, p=0.0):
    """Card/paper slapped onto a table: broadband burst + low whap + paper flutter."""
    rng = np.random.default_rng(seed)
    n = int(0.4 * FS)
    t = _t(n)
    burst = rng.standard_normal(n) * np.exp(-t / 0.018) * (1 - np.exp(-t / 0.0004))
    b = svf(burst, 1600, 0.6, "bp") + 0.5 * svf(burst, 4800, 0.9, "bp") + 0.3 * svf(burst, 400, 1.0, "bp")
    whap = np.sin(TWO_PI * np.cumsum(140 * (1 + 0.6 * np.exp(-t / 0.008))) / FS) * np.exp(-t / 0.028) * 0.6
    flutter = svf(rng.standard_normal(n), 3000, 1.2, "bp") * (rng.random(n) < 0.08) * np.exp(-t / 0.06) * 0.8
    y = b + whap + flutter
    y = hpf(y, 70)
    st = pan(y, p)
    return _trim(_room(st, 0.4, 0.25, seed=10))


def _crackle(n, rate_curve, rng, amp_sigma=0.7):
    """Poisson impulse train with time-varying rate (impulses/s) and log-normal amplitudes."""
    prob = np.clip(rate_curve / FS, 0, 1)
    hits = rng.random(n) < prob
    amps = np.exp(rng.normal(0, amp_sigma, n)) * rng.choice([-1, 1], n)
    return hits * amps


def tape_rip(seed=7):
    """Masking tape pulled off the roll (zzzip ~170 ms) + tape stuck down (pat) at +130 ms."""
    rng = np.random.default_rng(seed)
    n = int(0.55 * FS)
    t = _t(n)
    dur = 0.17
    x = np.clip(t / dur, 0, 1)
    rate = np.where(t < dur, 500 + 2600 * x, 0)
    imp = _crackle(n, rate, rng, 0.5)
    kern_t = np.arange(int(0.002 * FS)) / FS
    kern = np.exp(-kern_t / 0.0004)
    cr = np.convolve(imp, kern)[:n]
    cr = svf(cr, 2600 + 1400 * x, 1.2, "bp") + 0.4 * svf(cr, 6500, 1.0, "bp")
    bed = svf(rng.standard_normal(n), 1800 + 1500 * x, 2.0, "bp") * (t < dur) * 0.35
    rip = (cr + bed) * np.where(t < dur, (1 - np.exp(-t / 0.003)) * (0.7 + 0.3 * x), np.exp(-(t - dur) / 0.006))
    # stick pat
    tt = t - 0.13
    m = tt >= 0
    pat = np.zeros(n)
    pat[m] = (np.sin(TWO_PI * 230 * tt[m]) * np.exp(-tt[m] / 0.018) * 0.6
              + svf(rng.standard_normal(n), 1400, 0.7, "lp")[m] * np.exp(-tt[m] / 0.02) * 0.5)
    y = rip + pat
    y = hpf(y, 80)
    p = np.interp(t, [0, dur], [-0.35, 0.25])
    st = pan(y, p)
    return _trim(_room(st, 0.35, 0.2, seed=12))


def paper_rip(seed=8, p_from=-0.5, p_to=0.5, dur=0.42):
    """Paper tear (fibre crackle with accelerating rate + resonant sweep) layered with an air whoosh."""
    rng = np.random.default_rng(seed)
    n = int((dur + 0.2) * FS)
    t = _t(n)
    x = np.clip(t / dur, 0, 1)
    rate = np.where(t < dur, 900 + 3800 * np.sin(np.pi * x) ** 0.6, 0)
    imp = _crackle(n, rate, rng, 0.8)
    kern = np.exp(-np.arange(int(0.003 * FS)) / FS / 0.0006)
    cr = np.convolve(imp, kern)[:n]
    fc = 1800 * (1 + 1.4 * x)
    cr = svf(cr, fc, 1.0, "bp") + 0.45 * svf(cr, 5200, 1.2, "bp") + 0.25 * svf(cr, 700, 1.0, "bp")
    bed = svf(pink(n, rng), fc * 0.8, 1.2, "bp") * 0.5
    env = np.where(t < dur, (1 - np.exp(-t / 0.004)) * (1 - 0.4 * x), 0.6 * np.exp(-(t - dur) / 0.01))
    rip = (cr + bed) * env
    rip = hpf(rip, 120)
    st = pan(rip, np.interp(t, [0, dur], [p_from, p_to]))
    w = whoosh(dur=dur + 0.15, peak=0.35, f_lo=500, f_hi=3000, p_from=p_from, p_to=p_to, q=1.2, seed=seed + 1,
               tonal=0.15, rise_pow=0.8)
    m = min(len(st), len(w))
    y = st[:m] + 0.55 * w[:m]
    return _trim(_room(y, 0.4, 0.18, seed=13))


def typewriter_key(seed=0, heavy=False):
    """Type-bar strike: metallic slug click on platen + key thunk + carriage rattle."""
    rng = np.random.default_rng(seed)
    n = int(0.12 * FS)
    t = _t(n)
    ex = rng.standard_normal(n) * np.exp(-t / 0.0008)
    slug = svf(ex, rng.uniform(2300, 2800), 10, "bp") * 1.2 + svf(ex, rng.uniform(4000, 4600), 9, "bp") * 0.8
    slug += svf(ex, 7000, 0.8, "hp") * 0.3
    tt = t - rng.uniform(0.006, 0.01)
    m = tt >= 0
    thunk = np.zeros(n)
    thunk[m] = np.sin(TWO_PI * (160 if not heavy else 110) * tt[m]) * np.exp(-tt[m] / 0.015) * (0.5 if not heavy else 0.8)
    rattle = svf(rng.standard_normal(n), 3300, 3, "bp") * np.exp(-np.maximum(t - 0.015, 0) / 0.02) * (t > 0.015) * 0.1
    y = slug + thunk + rattle
    y = hpf(y, 90)
    st = pan(y, rng.uniform(-0.25, 0.25))
    return fade_edges(st, 0, 128)


def typewriter_bell(seed=9):
    n = int(0.9 * FS)
    t = _t(n)
    f = 2350.0
    y = (np.sin(TWO_PI * f * t) * np.exp(-t / 0.3) + 0.4 * np.sin(TWO_PI * f * 2.63 * t) * np.exp(-t / 0.12)
         + 0.2 * np.sin(TWO_PI * f * 4.1 * t) * np.exp(-t / 0.06))
    y *= (1 - np.exp(-t / 0.0005))
    st = pan(y * 0.6, 0.35)
    return _trim(_room(st, 0.5, 0.25, seed=14))


def heartbeat(dub_offset=0.2, seed=10, vel=1.0):
    """Lub-dub: chest-muffled low thumps (+ 2nd harmonic for small speakers)."""
    n = int((dub_offset + 0.45) * FS)
    t = _t(n)

    def beat(off, f0, g, tau):
        tt = t - off
        m = tt >= 0
        y = np.zeros(n)
        f = f0 * (1 + 0.6 * np.exp(-tt[m] / 0.02))
        ph = np.cumsum(f) / FS
        y[m] = np.sin(TWO_PI * ph) * np.exp(-tt[m] / tau) * (1 - np.exp(-tt[m] / 0.004)) * g
        return y

    y = beat(0.0, 52, 1.0, 0.085) + beat(dub_offset, 62, 0.7, 0.07)
    y = np.tanh(2.4 * y) / 1.2
    y = lpf(y, 420, order=2)
    y = hpf(y, 30)
    return fade_edges(as_stereo(y * vel), 0, 256)


# ----------------------------------------------------------------------------- risers / impacts
def noise_riser(dur, seed=11, f0=280, f1=9500, tonal=True, end_cut=True):
    """Noise riser (band-pass sweep, crescendo) + rising sine glide; ends with a hard (3 ms) cut."""
    rng = np.random.default_rng(seed)
    n = int(dur * FS)
    t = _t(n)
    x = t / dur
    nz = 0.6 * pink(n, rng) + 0.4 * rng.standard_normal(n)
    fc = f0 * (f1 / f0) ** (x ** 1.3)
    a = svf(nz, fc, 1.6, "bp")
    b = svf(nz, fc * 0.6, 0.7, "hp") * 0.25
    y = lpf(a + b, 13000, order=2)
    if tonal:
        glide = 180 * (12 ** (x ** 1.5))
        g = np.sin(TWO_PI * np.cumsum(glide * (1 + 0.004 * np.sin(TWO_PI * 6 * t))) / FS) * 0.18
        g += 0.5 * np.sin(TWO_PI * np.cumsum(glide * 1.5) / FS) * 0.1
        y = y + g
    y *= x ** 2.3
    # stereo: slow autopan widening
    Ly = y * (1 + 0.25 * np.sin(TWO_PI * (2 + 10 * x ** 2) * t))
    Ry = y * (1 - 0.25 * np.sin(TWO_PI * (2 + 10 * x ** 2) * t))
    st = np.stack([Ly, Ry], axis=1)
    st = hpf(st, 120)
    return fade_edges(st, 256, int(0.003 * FS) if end_cut else 2048)


def impact(kind="big", seed=12):
    """Cinematic impact: sub boom + trailer body + noise crack (+ metal for 'biggest') + hall tail."""
    rng = np.random.default_rng(seed)
    cfg = {
        "big": dict(boom_tau=0.45, boom_f=42, body=1.0, crack=1.0, metal=0.0, t60=2.8, wet=0.55, dur=3.0),
        "biggest": dict(boom_tau=0.65, boom_f=40, body=1.2, crack=1.15, metal=0.6, t60=3.4, wet=0.65, dur=3.6),
        "final": dict(boom_tau=0.5, boom_f=42, body=1.1, crack=1.0, metal=0.4, t60=1.7, wet=0.55, dur=2.0),
    }[kind]
    n = int(cfg["dur"] * FS)
    t = _t(n)
    fb = cfg["boom_f"] + 70 * np.exp(-t / 0.05) + 25 * np.exp(-t / 0.4)
    boom = np.sin(TWO_PI * np.cumsum(fb) / FS) * np.exp(-t / cfg["boom_tau"]) * (1 - np.exp(-t / 0.0015))
    boom = np.tanh(1.8 * boom) / np.tanh(1.8)
    fbody = 95 * (1 + 1.0 * np.exp(-t / 0.018))
    body = np.sin(TWO_PI * np.cumsum(fbody) / FS) * np.exp(-t / 0.18)
    body += 0.5 * np.sin(TWO_PI * np.cumsum(2.1 * fbody) / FS) * np.exp(-t / 0.07)   # 200 Hz knock
    body += svf(rng.standard_normal(n) * np.exp(-t / 0.12), 900, 0.7, "lp") * 0.9
    body = np.tanh(1.5 * body) * cfg["body"]
    cr = rng.standard_normal(n) * np.exp(-t / 0.012) * (1 - np.exp(-t / 0.0003))
    crack = np.tanh(3 * (svf(cr, 1400, 0.6, "hp") + 0.6 * svf(cr, 3500, 0.8, "bp"))) * 0.6 * cfg["crack"]
    crack = lpf(crack, 10000, order=2)
    y = 0.8 * boom + 0.8 * body + crack
    if cfg["metal"] > 0:
        parts = [(f, rng.uniform(0.3, 1.0), rng.uniform(0.3, 1.1)) for f in np.exp(rng.uniform(np.log(160), np.log(3200), 28))]
        from dsp import additive
        met = additive(parts, n, FS, rng)
        met = met / (np.std(met[: int(0.3 * FS)]) + 1e-9) * (1 - np.exp(-t / 0.001))
        y += cfg["metal"] * 0.22 * met
    y = hpf(y, 26, order=2)
    st = as_stereo(y)
    # reverb only on the mid/high content (keep sub dry & mono)
    hi = hpf(st, 180)
    lo = st - hi
    out = _hall(hi, t60=cfg["t60"], wet=cfg["wet"], seed=seed + 30, predelay=0.012)  # dry hi + wet
    out[: len(lo)] += lo
    out = out[:n] if kind == "final" else out
    out = peq(out, 3000, -2.0, 0.9)
    return fade_edges(out, 0, int(0.4 * FS))


def downlifter(dur=0.9, seed=13):
    rng = np.random.default_rng(seed)
    n = int(dur * FS)
    t = _t(n)
    x = t / dur
    nz = pink(n, rng)
    y = svf(nz, 5000 * (0.05 ** x), 1.2, "bp") * (1 - x) ** 1.5
    sub = np.sin(TWO_PI * np.cumsum(90 * (0.4 ** x)) / FS) * (1 - x) ** 2 * 0.5
    st = pan(y, np.interp(x, [0, 1], [0.4, -0.4])) + as_stereo(sub)
    return fade_edges(st, 64, 1024)
