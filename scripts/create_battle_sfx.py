from __future__ import annotations

import math
import random
import wave
from pathlib import Path

SAMPLE_RATE = 44100
OUTPUT = Path(__file__).resolve().parents[1] / "assets" / "audio"
OUTPUT.mkdir(parents=True, exist_ok=True)


def clamp(value: float) -> float:
    return max(-1.0, min(1.0, value))


def write_wav(filename: str, samples: list[float]) -> None:
    path = OUTPUT / filename
    frames = bytearray()
    for sample in samples:
        value = int(clamp(sample) * 32767)
        frames.extend(value.to_bytes(2, byteorder="little", signed=True))
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(frames)


def cannon_strike() -> list[float]:
    duration = 0.72
    data: list[float] = []
    random.seed(14)
    for index in range(int(SAMPLE_RATE * duration)):
        time = index / SAMPLE_RATE
        envelope = math.exp(-time * 7.2)
        boom = math.sin(2 * math.pi * (112 - time * 45) * time) * envelope * 0.56
        noise = (random.random() * 2 - 1) * envelope * 0.52
        crack = math.sin(2 * math.pi * 1320 * time) * math.exp(-time * 28) * 0.17
        data.append((boom + noise + crack) * 0.85)
    return data


def armor_hit() -> list[float]:
    duration = 0.40
    data: list[float] = []
    random.seed(77)
    for index in range(int(SAMPLE_RATE * duration)):
        time = index / SAMPLE_RATE
        envelope = math.exp(-time * 13)
        metal = math.sin(2 * math.pi * (420 + time * 290) * time) * envelope * 0.48
        static = (random.random() * 2 - 1) * envelope * 0.34
        data.append((metal + static) * 0.9)
    return data


def victory_signal() -> list[float]:
    duration = 1.12
    notes = [(523.25, 0.00), (659.25, 0.19), (783.99, 0.38), (1046.5, 0.60)]
    data: list[float] = []
    for index in range(int(SAMPLE_RATE * duration)):
        time = index / SAMPLE_RATE
        sample = 0.0
        for frequency, start in notes:
            elapsed = time - start
            if elapsed >= 0:
                envelope = math.exp(-elapsed * 4.0) * min(1.0, elapsed * 45)
                sample += math.sin(2 * math.pi * frequency * elapsed) * envelope * 0.22
                sample += math.sin(2 * math.pi * frequency * 2 * elapsed) * envelope * 0.07
        data.append(sample)
    return data


def retreat_signal() -> list[float]:
    duration = 0.95
    data: list[float] = []
    for index in range(int(SAMPLE_RATE * duration)):
        time = index / SAMPLE_RATE
        frequency = 265 - time * 130
        envelope = math.exp(-time * 2.6) * min(1.0, time * 25)
        sample = math.sin(2 * math.pi * frequency * time) * envelope * 0.38
        sample += math.sin(2 * math.pi * frequency * 0.5 * time) * envelope * 0.18
        data.append(sample)
    return data


write_wav("battle-strike.wav", cannon_strike())
write_wav("battle-hit.wav", armor_hit())
write_wav("battle-victory.wav", victory_signal())
write_wav("battle-retreat.wav", retreat_signal())
print("Created battle sound effects")
