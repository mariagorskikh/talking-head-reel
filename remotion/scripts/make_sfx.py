#!/usr/bin/env python3
"""Synthesize the small UI sound kit used by the reel (pure stdlib)."""
import math
import os
import random
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "sfx")
os.makedirs(OUT, exist_ok=True)
random.seed(7)


def write(name, samples):
    path = os.path.join(OUT, name)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
        )
        w.writeframes(frames)
    print(name, len(samples) / SR, "s")


def env_exp(n, tau):
    return [math.exp(-i / (SR * tau)) for i in range(n)]


def lowpass(samples, alpha):
    out, prev = [], 0.0
    for s in samples:
        prev = prev + alpha * (s - prev)
        out.append(prev)
    return out


def highpass(samples, alpha):
    lp = lowpass(samples, alpha)
    return [s - l for s, l in zip(samples, lp)]


# click: short bright noise transient, like a mouse button.
n = int(0.045 * SR)
e = env_exp(n, 0.006)
noise = [random.uniform(-1, 1) * e[i] for i in range(n)]
body = [0.4 * math.sin(2 * math.pi * 1400 * i / SR) * e[i] for i in range(n)]
click = highpass([0.8 * a + b for a, b in zip(noise, body)], 0.25)
write("click.wav", [0.9 * s for s in click])

# tick: quieter, shorter click for pickers and typing.
n = int(0.025 * SR)
e = env_exp(n, 0.003)
noise = [random.uniform(-1, 1) * e[i] for i in range(n)]
tick = highpass(noise, 0.35)
write("tick.wav", [0.7 * s for s in tick])

# pop: quick downward blip, like a message bubble arriving.
n = int(0.09 * SR)
e = env_exp(n, 0.022)
pop = []
phase = 0.0
for i in range(n):
    f = 620 - 340 * (i / n)
    phase += 2 * math.pi * f / SR
    pop.append(math.sin(phase) * e[i])
write("pop.wav", [0.85 * s for s in pop])

# tap: softer, higher pop for small landings.
n = int(0.06 * SR)
e = env_exp(n, 0.014)
tap = []
phase = 0.0
for i in range(n):
    f = 900 - 380 * (i / n)
    phase += 2 * math.pi * f / SR
    tap.append(math.sin(phase) * e[i])
write("tap.wav", [0.7 * s for s in tap])

# ding: two soft partials, success tone.
n = int(0.5 * SR)
e = env_exp(n, 0.13)
ding = [
    (0.7 * math.sin(2 * math.pi * 880 * i / SR) + 0.3 * math.sin(2 * math.pi * 1760 * i / SR))
    * e[i]
    for i in range(n)
]
write("ding.wav", [0.75 * s for s in ding])

# whoosh: band-limited noise swell.
n = int(0.5 * SR)
raw = [random.uniform(-1, 1) for _ in range(n)]
raw = lowpass(raw, 0.12)
raw = highpass(raw, 0.02)
sw = []
for i in range(n):
    x = i / n
    envv = math.sin(math.pi * min(1.0, x * 1.15)) ** 1.6
    sw.append(raw[i] * envv)
peak = max(abs(s) for s in sw) or 1.0
write("whoosh.wav", [0.85 * s / peak for s in sw])

# thud: low sine hit with a click transient, for the $1 landing.
n = int(0.22 * SR)
e = env_exp(n, 0.05)
thud = []
phase = 0.0
for i in range(n):
    f = 120 - 45 * (i / n)
    phase += 2 * math.pi * f / SR
    t = math.sin(phase) * e[i]
    if i < int(0.008 * SR):
        t += 0.5 * random.uniform(-1, 1) * (1 - i / (0.008 * SR))
    thud.append(t)
write("thud.wav", [0.9 * s for s in thud])
