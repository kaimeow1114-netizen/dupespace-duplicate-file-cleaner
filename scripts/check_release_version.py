from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _match(path: Path, pattern: str) -> str:
    text = path.read_text(encoding="utf-8")
    match = re.search(pattern, text)
    if match is None:
        raise ValueError(f"Could not read version from {path.relative_to(ROOT)}")
    return match.group(1)


def main() -> int:
    versions = {
        "pyproject.toml": _match(
            ROOT / "pyproject.toml", r'(?m)^version\s*=\s*"([^"]+)"'
        ),
        "src/dupespace/__init__.py": _match(
            ROOT / "src/dupespace/__init__.py", r'__version__\s*=\s*"([^"]+)"'
        ),
        "packaging/dupespace.iss": _match(
            ROOT / "packaging/dupespace.iss", r'#define MyAppVersion\s+"([^"]+)"'
        ),
    }
    if len(set(versions.values())) != 1:
        print(f"Release version sources disagree: {versions}", file=sys.stderr)
        return 1

    version = next(iter(versions.values()))
    ref_type = os.getenv("GITHUB_REF_TYPE", "")
    ref_name = os.getenv("GITHUB_REF_NAME", "")
    if ref_type == "tag" and ref_name != f"v{version}":
        print(
            f"Release tag {ref_name!r} does not match application version v{version}.",
            file=sys.stderr,
        )
        return 1
    print(f"DUPESPACE release version verified: {version}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
