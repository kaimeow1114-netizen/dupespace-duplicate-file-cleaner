from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "dupesweep-icon.png"
ICO = ROOT / "assets" / "dupesweep.ico"
PACKAGE_ASSETS = ROOT / "src" / "dupesweep" / "assets"
WEB_ASSETS = ROOT / "web" / "public"


def main() -> None:
    PACKAGE_ASSETS.mkdir(parents=True, exist_ok=True)
    WEB_ASSETS.mkdir(parents=True, exist_ok=True)
    image = Image.open(SOURCE).convert("RGBA")
    if image.width != image.height:
        size = max(image.size)
        square = Image.new("RGBA", (size, size))
        square.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
        image = square
    image.save(
        ICO,
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    shutil.copy2(SOURCE, PACKAGE_ASSETS / "dupesweep-icon.png")
    shutil.copy2(ICO, PACKAGE_ASSETS / "dupesweep.ico")
    shutil.copy2(SOURCE, WEB_ASSETS / "dupesweep-icon.png")


if __name__ == "__main__":
    main()
