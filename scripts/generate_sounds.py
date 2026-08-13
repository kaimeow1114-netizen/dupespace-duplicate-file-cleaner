from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

RATE = 44_100
TARGET = Path(__file__).resolve().parents[1] / "src" / "dupespace" / "assets"


def tone(
    frequency: float, duration: float, amplitude: float = 0.5, decay: float = 3.5
) -> list[float]:
    length = int(RATE * duration)
    return [
        amplitude
        * math.sin(2 * math.pi * frequency * index / RATE)
        * math.exp(-decay * index / max(1, length))
        for index in range(length)
    ]


def silence(duration: float) -> list[float]:
    return [0.0] * int(RATE * duration)


def mix(*tracks: list[float]) -> list[float]:
    length = max(map(len, tracks), default=0)
    return [
        sum(track[index] if index < len(track) else 0.0 for track in tracks)
        for index in range(length)
    ]


def sequence(*tracks: list[float]) -> list[float]:
    output: list[float] = []
    for track in tracks:
        output.extend(track)
    return output


def paper_slide() -> list[float]:
    rng = random.Random(0xD0A5E)
    length = int(RATE * 0.22)
    slide = []
    previous = 0.0
    for index in range(length):
        envelope = math.sin(math.pi * index / length) ** 1.6
        noise = rng.uniform(-1, 1)
        high_pass = noise - 0.82 * previous
        previous = noise
        slide.append(0.12 * envelope * high_pass)
    return sequence(slide, tone(960, 0.11, 0.32, 5.5))


SOUNDS = {
    "confirm": sequence(tone(620, 0.11, 0.32), silence(0.035), tone(820, 0.14, 0.3)),
    "trash": paper_slide(),
    "permanent_warning": sequence(
        mix(tone(180, 0.16, 0.35), tone(270, 0.16, 0.12)),
        silence(0.07),
        mix(tone(170, 0.19, 0.38), tone(255, 0.19, 0.11)),
    ),
    "permanent_done": sequence(tone(330, 0.09, 0.28), tone(247, 0.15, 0.25)),
    "success": sequence(
        mix(tone(660, 0.09, 0.24), tone(990, 0.09, 0.12)),
        tone(880, 0.11, 0.28),
        mix(tone(1175, 0.2, 0.24), tone(1762, 0.2, 0.08)),
    ),
    "error": mix(tone(196, 0.22, 0.28), tone(147, 0.22, 0.11)),
}


def write_sound(name: str, samples: list[float]) -> None:
    TARGET.mkdir(parents=True, exist_ok=True)
    peak = max((abs(sample) for sample in samples), default=1.0)
    scale = 0.84 / max(1.0, peak)
    frames = b"".join(
        struct.pack("<h", int(max(-1.0, min(1.0, sample * scale)) * 32767)) for sample in samples
    )
    with wave.open(str(TARGET / f"{name}.wav"), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(RATE)
        handle.writeframes(frames)


def main() -> None:
    for name, samples in SOUNDS.items():
        write_sound(name, samples)


if __name__ == "__main__":
    main()
