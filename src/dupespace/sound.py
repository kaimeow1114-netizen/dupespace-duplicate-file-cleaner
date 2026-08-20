from __future__ import annotations

import json
import struct
import sys
import threading
import wave
from contextlib import suppress
from importlib.resources import as_file, files
from pathlib import Path
from typing import Literal

from .paths import app_data_dir

SoundEvent = Literal[
    "confirm",
    "trash",
    "permanent_warning",
    "permanent_done",
    "success",
    "error",
]


def _settings_path() -> Path:
    return app_data_dir() / "settings.json"


class SoundPlayer:
    """Play original DUPESPACE sounds once per UI event at a user-controlled volume."""

    def __init__(self) -> None:
        self.muted = False
        self.volume = 0.25
        self._load()

    def _load(self) -> None:
        try:
            settings = json.loads(_settings_path().read_text(encoding="utf-8"))
            self.muted = bool(settings.get("sound_muted", False))
            self.volume = max(0.0, min(1.0, float(settings.get("sound_volume", 0.25))))
        except (OSError, ValueError, TypeError, json.JSONDecodeError):
            return

    def save(self) -> None:
        path = _settings_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        current: dict[str, object] = {}
        with suppress(OSError, json.JSONDecodeError):
            current = json.loads(path.read_text(encoding="utf-8"))
        current.update({"sound_muted": self.muted, "sound_volume": round(self.volume, 2)})
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(path)

    def configure(self, *, muted: bool | None = None, volume: float | None = None) -> None:
        if muted is not None:
            self.muted = muted
        if volume is not None:
            self.volume = max(0.0, min(1.0, volume))
        self.save()

    def play(self, event: SoundEvent) -> None:
        if self.muted or self.volume <= 0 or sys.platform != "win32":
            return
        threading.Thread(target=self._play_windows, args=(event,), daemon=True).start()

    def _play_windows(self, event: SoundEvent) -> None:
        try:
            import winsound

            resource = files("dupespace.assets").joinpath(f"{event}.wav")
            with as_file(resource) as source:
                rendered = self._render_volume(source, event)
                winsound.PlaySound(
                    str(rendered),
                    winsound.SND_FILENAME | winsound.SND_ASYNC | winsound.SND_NODEFAULT,
                )
        except (ImportError, OSError, ValueError):
            return

    def _render_volume(self, source: Path, event: str) -> Path:
        cache_root = _settings_path().parent / "sound-cache"
        cache_root.mkdir(parents=True, exist_ok=True)
        level = int(round(self.volume * 20))
        destination = cache_root / f"{event}-{level}.wav"
        if destination.exists():
            return destination
        with wave.open(str(source), "rb") as input_wave:
            parameters = input_wave.getparams()
            frames = input_wave.readframes(parameters.nframes)
        samples = struct.unpack(f"<{len(frames) // 2}h", frames)
        scaled = struct.pack(
            f"<{len(samples)}h",
            *(max(-32768, min(32767, int(sample * self.volume))) for sample in samples),
        )
        with wave.open(str(destination), "wb") as output_wave:
            output_wave.setparams(parameters)
            output_wave.writeframes(scaled)
        return destination
