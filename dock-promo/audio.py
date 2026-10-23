"""Procedural soundtrack + SFX for the Dock promo, synced to the timeline in index.html.

    python3 audio.py                                  -> out/audio.wav (48 kHz stereo, 30 s)
    python3 audio.py out/meta-en.json out/audio-en.wav  (international cut)

Reads out/meta.json (written by `node render.mjs meta`) for scene times and element counts.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
META_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'out' / 'meta.json'
OUT_PATH = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'out' / 'audio.wav'
META = json.loads(META_PATH.read_text())
T = META['T']
SR = 48000
DUR = 30.0
N = int(SR * DUR)
L = np.zeros(N)
R = np.zeros(N)
rng = np.random.default_rng(7)


# ------------------------------------------------------------------ primitives
def tt(d):
    return np.arange(int(d * SR)) / SR


def add(sig, t0, gain=1.0, pan=0.0):
    i0 = int(round(t0 * SR))
    if i0 >= N or len(sig) == 0:
        return
    s = sig
    if i0 < 0:
        s, i0 = s[-i0:], 0
    s = s[:N - i0]
    gl, gr = gain * np.sqrt(.5 * (1 - pan)), gain * np.sqrt(.5 * (1 + pan))
    L[i0:i0 + len(s)] += s * gl
    R[i0:i0 + len(s)] += s * gr


def phase(f):
    return 2 * np.pi * np.cumsum(f) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = np.clip(np.minimum((f - lo * .8) / (lo * .2 + 1e-9), (hi * 1.2 - f) / (hi * .2)), 0, 1)
    return np.fft.irfft(X * m, n=len(x))


def lp(x, fc):
    """one-pole low-pass; fc may be a scalar or a per-sample array"""
    fc = np.broadcast_to(np.asarray(fc, float), x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    z = 0.0
    for i in range(len(x)):
        z = (1 - a[i]) * x[i] + a[i] * z
        y[i] = z
    return y


def adsr(n, a=.005, r=.05, sr=SR):
    e = np.ones(n)
    na, nr = max(1, int(a * sr)), max(1, int(r * sr))
    e[:na] = np.linspace(0, 1, na)
    if nr < n:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def norm(x, peak=1.0):
    m = np.max(np.abs(x)) + 1e-12
    return x / m * peak


def saw(f, t, harm=10, tilt=1.0):
    p = phase(np.broadcast_to(f, t.shape).astype(float))
    return sum(np.sin(k * p) / k ** tilt for k in range(1, harm + 1))


def hz(note):
    names = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3,
             'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = note[:-1], int(note[-1])
    return 440.0 * 2 ** ((names[n] + (o - 4) * 12) / 12)


# ------------------------------------------------------------------ instruments
def kick(gain=1.0):
    t = tt(.5)
    f = 44 + 120 * np.exp(-t / .028)
    s = np.sin(phase(f)) * np.exp(-t / .17)
    s[:240] += band(noise(.005), 2000, 9000)[:240] * .5
    return np.tanh(1.6 * s) * gain


def clap():
    t = tt(.3)
    n = band(noise(.3), 900, 5200)
    env = np.exp(-t / .09)
    for d in (0, .011, .022):
        env += (t >= d) * np.exp(-np.clip(t - d, 0, None) / .006) * .8
    return n * env * .35


def hat(d=.05):
    t = tt(d + .02)
    return band(noise(d + .02), 7000, 16000) * np.exp(-t / (d * .45)) * .35


def crash(d=2.2):
    t = tt(d)
    return (band(noise(d), 3500, 16000) * .7 + band(noise(d), 6000, 12000) * .3) * np.exp(-t / .7) * .45


def bass(f, d):
    t = tt(d)
    s = sum(np.sin(k * phase(np.full(t.shape, f))) / k * np.exp(-t * k * 2.5) for k in range(1, 9))
    return s * adsr(len(t), .004, .06) * .5


def pluck(f, d=.6, bright=1.0):
    t = tt(d)
    s = sum(np.sin(k * phase(np.full(t.shape, f))) / k * np.exp(-t * (5 + 4 * k / bright)) for k in range(1, 9))
    return s * adsr(len(t), .002, .05) * .45


def pad(freqs, d, a=.4, r=.8, bright=1.2):
    t = tt(d)
    s = np.zeros(len(t))
    for f in freqs:
        for det in (-.006, 0, .007):
            s += saw(f * (1 + det), t, harm=7, tilt=bright)
    s = lp(s, 2600)
    return s * adsr(len(t), a, r) / (len(freqs) * 3) * .9


def impact(boom=60, d=1.4, drive=2.0):
    t = tt(d)
    f = boom * .5 + boom * 1.5 * np.exp(-t / .05)
    s = np.sin(phase(f)) * np.exp(-t / .35)
    s += lp(noise(d), 500) * np.exp(-t / .12) * 3
    s[:300] += band(noise(.00625), 1500, 9000)[:300] * .8
    return np.tanh(drive * s) * .9


def ding(f, d=.6):
    t = tt(d)
    s = np.sin(phase(np.full(t.shape, f))) * np.exp(-t / .22) + .35 * np.sin(phase(np.full(t.shape, 2.01 * f))) * np.exp(-t / .1)
    return s * adsr(len(t), .002, .05) * .5


def bonk(f=520):
    t = tt(.18)
    s = np.sin(phase(f * (1 - .45 * t / .18))) * np.exp(-t / .045) + .5 * np.sin(phase(f * 2.71 * np.ones(len(t)))) * np.exp(-t / .02)
    return s * .7


def buzz_err(f=170, d=.13):
    t = tt(d)
    p = phase(np.full(t.shape, f))
    s = sum(np.sin(k * p) / k for k in range(1, 16, 2))
    return lp(s, 2500) * adsr(len(t), .003, .03) * .5


def boing(d=.75, f0=105):
    t = tt(d)
    f = f0 * (1 + .55 * np.sin(2 * np.pi * 13 * t) * np.exp(-t / .22)) * (1 + .4 * np.exp(-t / .08))
    return lp(saw(f, t, harm=8), 1800) * np.exp(-t / .3) * .6


def stretch(d=.45):
    t = tt(d)
    f = 150 * (2.8 ** (t / d)) * (1 + .06 * np.sin(2 * np.pi * 19 * t))
    return lp(saw(f, t, harm=6), 2200) * adsr(len(t), .05, .05) * (.4 + .6 * t / d) * .5


def pop(f=1100):
    t = tt(.06)
    return np.sin(phase(f * (1 - .5 * t / .06))) * np.exp(-t / .018) * .6


def whoosh(d=.5, f0=300, f1=5000, peak=.6):
    t = tt(d)
    u = t / d
    fc = f0 * (f1 / f0) ** np.sin(np.pi * np.clip(u / peak / 2, 0, .5)) if peak else f0 + (f1 - f0) * u
    s = lp(noise(d), fc)
    env = np.where(u < peak, (u / peak) ** 2, ((1 - u) / (1 - peak)) ** 1.5)
    return s * env * 1.6


def riser(d=1.0, f0=200, f1=9000):
    t = tt(d)
    u = t / d
    s = lp(noise(d), f0 * (f1 / f0) ** u) * 1.2 + .25 * np.sin(phase(220 * 4 ** u))
    return s * u ** 2.2 * .8


def glitch(d=.12, seed=0):
    g = np.random.default_rng(seed)
    out = []
    for _ in range(int(d / .012)):
        n = int(.012 * SR)
        f = g.uniform(80, 2400)
        sq = np.sign(np.sin(2 * np.pi * f * np.arange(n) / SR))
        hold = np.repeat(g.uniform(-1, 1, n // 24 + 1), 24)[:n]
        out.append((sq * .6 + hold * .4) * g.uniform(.4, 1))
    return np.concatenate(out) * .35


def crumple(d=.38, seed=3):
    g = np.random.default_rng(seed)
    s = np.zeros(int(d * SR))
    for _ in range(60):
        i = g.integers(0, len(s) - 600)
        L_ = g.integers(80, 500)
        s[i:i + L_] += g.standard_normal(L_) * np.exp(-np.arange(L_) / (L_ / 4)) * g.uniform(.2, 1)
    return band(s, 900, 7000) * .9


def clang(f=170, d=1.4):
    t = tt(d)
    s = sum(a * np.sin(phase(np.full(t.shape, f * r))) * np.exp(-t / (dd)) for r, a, dd in
            [(1, 1, .5), (2.32, .6, .35), (4.25, .45, .25), (6.63, .3, .18), (8.97, .2, .12)])
    return s * .45


def crt_off():
    t = tt(.3)
    s = np.sin(phase(3600 * (60 / 3600) ** (t / .25))) * np.exp(-t / .12) * .5
    s += band(noise(.3), 2000, 12000) * np.exp(-t / .05) * .5
    return s


def key_click(seed=0):
    g = np.random.default_rng(seed)
    t = tt(.03)
    s = band(g.standard_normal(len(t)), 1800, 7000) * np.exp(-t / .0035)
    s += np.sin(2 * np.pi * g.uniform(2600, 3600) * t) * np.exp(-t / .002) * .4
    return s * .55


def tick(f):
    t = tt(.03)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / .006) * .4


def glide(f0, f1, d):
    t = tt(d)
    f = f0 * (f1 / f0) ** (t / d)
    return (np.sin(phase(f)) + .3 * np.sin(2 * phase(f))) * adsr(len(t), .03, .08) * .35


def fly(d, seed=0):
    g = np.random.default_rng(seed)
    t = tt(d)
    f = 205 + 18 * np.sin(2 * np.pi * 6.5 * t + seed) + 10 * np.sin(2 * np.pi * 1.7 * t)
    s = lp(saw(f, t, harm=14, tilt=.9), 2600)
    am = .55 + .45 * np.sin(2 * np.pi * (1.1 + .3 * seed) * t + g.uniform(0, 6))
    return s * am * adsr(len(t), .08, .1) * .22


def sparkle(d=1.6, n=14, seed=11):
    g = np.random.default_rng(seed)
    s = np.zeros(int(d * SR))
    for _ in range(n):
        f = g.uniform(2600, 6200)
        i = int(g.uniform(0, d - .25) * SR)
        tl_ = tt(.25)
        s[i:i + len(tl_)] += np.sin(2 * np.pi * f * tl_) * np.exp(-tl_ / .06) * g.uniform(.3, 1)
    return s * .22


# ------------------------------------------------------------------ easing replicas (match the page)
def prog(t, a, b):
    return np.clip((t - a) / (b - a), 0, 1)


def eio(u):
    return np.where(u < .5, 4 * u ** 3, 1 - (-2 * u + 2) ** 3 / 2)


# ================================================================== SCORE
P, Rr, A, G, X, L0, K, E = T['pain'], T['turn'], T['app'], T['grid'], T['ex'], T['logo'], T['kpi'], T['end']
g0 = T['gen']

# ---- HOOK (0 – 2.9): slams, error bonks, flies
add(impact(55, 1.0, 3.0), 0.0, .7)
add(boing(.5, 140), 0.02, .35)
add(whoosh(.3, 400, 6000, .9), 0.5, .35)
add(impact(70, .8, 3.5), 0.78, .6)
for i, t0 in enumerate((.9, 1.04, 1.18)):
    add(buzz_err(190 - 18 * i), t0, .55, -.2 + .2 * i)
add(whoosh(.28, 300, 8000, .92), 1.38, .45)
add(impact(45, 1.6, 4.0), 1.64, .75)
add(crash(1.4), 1.64, .5)
for i in range(3):
    add(fly(1.15, i), 1.7, .5, [-.6, .1, .7][i])
add(glitch(.1, 1), 2.82, .9)

# ---- PAIN (2.9 – 8.1): wonky carnival loop + cartoon SFX
beat = 60 / 132
t = P
i = 0
while t < Rr - .3:
    root = 'C2' if i % 2 == 0 else 'G1'
    add(bass(hz(root), .22) * 1.2, t, .55)
    off = t + beat / 2
    if off < Rr - .3:
        det = 1 + rng.uniform(-.02, .02)
        stab = sum(pluck(hz(n) * det, .14, .6) for n in ('C4', 'F#4', 'Db5'))
        add(stab, off, .22, .3 * (-1) ** i)
    t += beat
    i += 1
add(whoosh(.35, 300, 5000, .5), P - .05, .4)
add(impact(90, .5, 2.0), P + .3, .35)
add(ding(1318.5, .5), P + .3, .45, .4)
add(ding(1760, .5), P + .38, .4, .4)
add(whoosh(.3, 500, 7000, .5), P + .55, .25)
for i, t0 in enumerate((P + .92, P + 1.1, P + 1.27, P + 1.42)):
    add(bonk(560 - 40 * i), t0, .8, -.3)
add(stretch(.48), P + 1.85, .7)
add(boing(.8, 98), P + 2.32, .8)
add(pop(1300), P + 2.47, .6, .2)
add(pop(1500), P + 2.53, .6, .35)
add(pop(900), P + 2.64, .5, .4)
add(pop(1000), P + 3.07, .6, -.4)
add(key_click(5), P + 3.32, 1.0, -.4)
for i in range(5):
    add(glitch(.11, 20 + i), P + 3.36 + i * .13, .7, rng.uniform(-.5, .5))
for i in range(12):
    add(ding(1318.5 * 2 ** (rng.integers(-3, 6) / 12), .35), P + 3.5 + i * .065, .3, rng.uniform(-.8, .8))
add(whoosh(.35, 200, 3000, .7), P + 4.25, .5)
add(impact(80, .4, 1.5), P + 4.55, .3)
add(stretch(.2) * .6, P + 4.42, .4)
add(crumple(.42), P + 4.45, .8)
add(clang(150, 1.2), P + 4.86, .7)
add(impact(50, .9, 3.0), P + 4.86, .7)
for i in range(2):
    add(fly(.6, 7 + i), P + 4.95, .35, [-.4, .5][i])
add(crt_off(), Rr - .26, .7)

# ---- TURN (8.1 – 9.55): brand motif A–C#–E, riser into the blue
add(impact(40, 1.2, 1.2) * .6, Rr + .18, .5)
for i, n in enumerate(('A4', 'C#5', 'E5')):
    add(pluck(hz(n), .9, 1.6), Rr + .18 + i * .08, .55, -.3 + .3 * i)
add(sparkle(.6, 6, 2), Rr + .45, .5)
add(riser(.95, 300, 9000), Rr + .55, .5)
add(impact(55, 1.0, 1.5), A - .05, .55)
add(crash(1.6), A - .05, .25)

# ---- APP: prompt (9.55 – 11.45): soft pad + typing
add(pad([hz(n) for n in ('A2', 'E3', 'A3', 'C#4', 'E4')], g0 - A + .2, .5, .3), A, .5)
L_txt = META['ptxtLen']
last = 0
for f in range(int(A * 30), int((A + 1.5) * 30)):
    t_ = f / 30
    n = int(round(float(eio(prog(t_, A + .25, A + 1.35))) * L_txt))
    if n > last:
        add(key_click(f), t_, .5 + .1 * min(3, n - last), rng.uniform(-.3, .3))
        last = n
add(key_click(99) * 1.4, A + 1.5, .9)
add(pluck(hz('A5'), .4, 2), A + 1.52, .35)
add(pluck(hz('E6'), .4, 2), A + 1.6, .3)
add(whoosh(.45, 300, 4000, .5), A + 1.62, .3)

# ---- APP: music bed 128 bpm (g0 – end)
bpm = 128
bt = 60 / bpm
bar = 4 * bt
CH = [('F#2', ['F#3', 'A3', 'C#4', 'E4']), ('D2', ['D3', 'F#3', 'A3', 'C#4']),
      ('A2', ['A3', 'C#4', 'E4', 'B4']), ('E2', ['E3', 'G#3', 'B3', 'D#4'])]
stop = E - .05
b = 0
t = g0
while t < stop:
    root, chord = CH[b % 4]
    add(pad([hz(n) for n in chord], min(bar + .3, stop - t + .2), .25, .35), t, .45)
    for k in range(4):
        tb = t + k * bt
        if tb >= stop:
            break
        if b >= 1:
            add(kick(), tb, .75)
        if b >= 3 and k in (1, 3):
            add(clap(), tb, .6, .1)
        add(hat(.04), tb + bt / 2, .5, .35)
        add(bass(hz(root), bt * .45), tb + bt / 2, .7)
        add(bass(hz(root), bt * .3), tb, .45)
    arp = chord + [chord[1].replace('3', '4').replace('4', '5', 1)]
    for s16 in range(16):
        ts = t + s16 * bt / 4
        if ts >= stop:
            break
        n = arp[(s16 * 3) % len(arp)]
        f = hz(n) * 2
        add(pluck(f, .25, 1.4), ts, .14 if s16 % 4 else .2, .45 * (-1) ** s16)
    t += bar
    b += 1
add(crash(2.0), X + .05, .35)
add(crash(2.0), K - .05, .3)

# build ticks: one per element as it appears (matches setBuild schedule)
cnt = META['counts']
sched = [(0, g0 + .05, g0 + 1.5, -.4), (1, g0 + 1.55, g0 + 2.3, -.2), (2, g0 + 2.35, g0 + 2.88, 0)]
for i in range(3, 8):
    a = G + .55 + (i - 3) * .2
    sched.append((i, a, a + 1.05, -.5 + .25 * (i - 3)))
for s, a, b_, pan in sched:
    lin = s < 3 and s > 0
    prev = 0
    for f in range(int(a * 120), int(b_ * 120) + 2):
        t_ = f / 120
        u = prog(t_, a, b_)
        k = cnt[s] * (u if lin else float(eio(u)))
        if int(k) > prev:
            add(tick(rng.uniform(2400, 3800)), t_, .35, pan)
            prev = int(k)
add(whoosh(.55, 300, 5000, .5), G - .05, .45)
add(pluck(hz('A5'), .6, 2), 16.25, .4)
add(pluck(hz('E6'), .8, 2), 16.33, .4)
add(sparkle(.8, 6, 4), 16.3, .4)

# ---- EXPLODE / EDIT
add(whoosh(.5, 300, 6000, .55), X, .5)
add(whoosh(.8, 200, 4000, .35), X + .55, .5)
for i in range(5):
    add(pluck(hz(['A4', 'C#5', 'E5', 'A5', 'C#6'][i]), .5, 2), X + .9 + i * .07, .3, -.4 + .2 * i)
for i in range(13):
    add(tick(3000 + 90 * i), X + 1.0 + .9 * (1 - (1 - (i + .5) / 13) ** (1 / 3)), .4, .3)
add(whoosh(.5, 5000, 300, .3), X + 2.65, .45)
add(impact(70, .4, 1.2), L0, .35)
add(ding(1174.7, .45), L0 + .05, .35, .6)
add(ding(1568, .45), L0 + .12, .3, .6)
add(key_click(42), L0 + .7, .9, -.2)
add(glide(220, 440, .62), L0 + 1.1, .5)
add(key_click(43), L0 + 1.7, .6, -.1)
add(ding(1318.5, .5), L0 + 1.95, .4, .6)
add(ding(1760, .6), L0 + 2.03, .38, .6)
add(whoosh(.45, 300, 5000, .5), K - .02, .4)
for t_ in (K + .62, K + .74):
    add(key_click(int(t_ * 100)), t_, .9)
for i, t_ in enumerate((K + 1.05, K + 1.15, K + 1.25)):
    add(key_click(200 + i), t_, .8)
add(key_click(300), K + 1.88, .9)
add(key_click(301), K + 2.52, .9, .5)
for i in range(12):
    add(pluck(hz('A4') * 2 ** ([0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26][i] / 12), .3, 2), K + 2.6 + i * .035, .16, -.5 + i / 11)
add(riser(.6, 400, 8000) * .7, E - .6, .55)
rev = crash(.7)[::-1]
add(rev, E - .7, .45)

# ---- END (26 – 30): impact + brand motif resolving to A + sparkle
add(impact(48, 2.5, 2.0), E, .9)
add(crash(3.0), E, .35)
add(pad([hz(n) for n in ('A2', 'E3', 'A3', 'C#4', 'E4', 'B4')], DUR - E, .05, 1.8, 1.4), E, .8)
add(bass(hz('A1'), 2.0) * 1.5, E, .8)
add(impact(80, .5, 1.0) * .5, E + .3, .4)
add(impact(80, .5, 1.0) * .5, E + .4, .4)
for i, n in enumerate(('A4', 'C#5', 'E5', 'A5')):
    add(pluck(hz(n), 1.6, 1.8), E + .6 + i * .08, .5, -.3 + .2 * i)
add(sparkle(1.8, 16, 9), E + .8, .6)
add(whoosh(.5, 600, 8000, .4), E + .85, .25)

# ------------------------------------------------------------------ master
mix = np.stack([L, R], 1)
fade = np.ones(N)
nf = int(.6 * SR)
fade[-nf:] = np.linspace(1, 0, nf) ** 1.5
mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix = mix / (np.max(np.abs(mix)) + 1e-9) * .89
out = OUT_PATH
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print('wrote', out)
