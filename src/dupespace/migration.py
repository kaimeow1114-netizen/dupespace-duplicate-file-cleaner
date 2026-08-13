from __future__ import annotations

import os
import shutil
from pathlib import Path


def _base_data_dir() -> Path:
    value = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
    return Path(value) if value else Path.home()


def legacy_data_dir() -> Path:
    return _base_data_dir() / "DupeSweep"


def app_data_dir() -> Path:
    return _base_data_dir() / "DupeSpace"


def migrate_legacy_preferences() -> Path:
    """Atomically copy non-secret preferences; OAuth tokens are intentionally excluded."""

    destination = app_data_dir()
    destination.mkdir(parents=True, exist_ok=True)
    source = legacy_data_dir() / "settings.json"
    target = destination / "settings.json"
    if source.is_file() and not target.exists():
        temporary = destination / "settings.json.migrating"
        shutil.copy2(source, temporary)
        temporary.replace(target)
    return destination
