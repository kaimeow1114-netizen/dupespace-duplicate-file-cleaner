"""Build the complete DUPESWEEP favicon/PWA set from the branded source icon."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "dupesweep-icon.png"
OUTPUT = ROOT / "web" / "public"


def contain(
    source: Image.Image, size: int, padding: float = 0, background=(8, 43, 64, 255)
) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), background)
    inner = max(1, round(size * (1 - padding * 2)))
    image = source.copy()
    image.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    canvas.alpha_composite(image, ((size - image.width) // 2, (size - image.height) // 2))
    return canvas


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    transparent = Image.new("RGBA", source.size, (0, 0, 0, 0))
    transparent.alpha_composite(source)
    transparent.resize((16, 16), Image.Resampling.LANCZOS).save(OUTPUT / "favicon-16x16.png")
    transparent.resize((32, 32), Image.Resampling.LANCZOS).save(OUTPUT / "favicon-32x32.png")
    transparent.resize((180, 180), Image.Resampling.LANCZOS).save(OUTPUT / "apple-touch-icon.png")
    transparent.resize((192, 192), Image.Resampling.LANCZOS).save(OUTPUT / "pwa-192x192.png")
    transparent.resize((512, 512), Image.Resampling.LANCZOS).save(OUTPUT / "pwa-512x512.png")
    contain(source, 192, padding=0.16).save(OUTPUT / "maskable-192x192.png")
    contain(source, 512, padding=0.16).save(OUTPUT / "maskable-512x512.png")
    contain(source, 150, padding=0.10).save(OUTPUT / "mstile-150x150.png")
    transparent.save(OUTPUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    main()
