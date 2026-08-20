from __future__ import annotations

import os
from pathlib import Path


def app_data_dir() -> Path:
    """Return DUPESPACE's current-user application data directory."""

    value = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
    base = Path(value) if value else Path.home()
    return base / "DupeSpace"
