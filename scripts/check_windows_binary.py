"""Inspect bundled Windows PE imports without loading or executing the binaries."""

from __future__ import annotations

import sys
from pathlib import Path

import pefile


def main() -> None:
    base = Path(sys.argv[1]).resolve(strict=True)
    directories = (base, base / "PySide6", base / "shiboken6")
    libraries = {}
    for directory in directories:
        for path in directory.glob("*.dll"):
            libraries.setdefault(path.name.casefold(), path)
    pending = [base / "PySide6" / "QtCore.pyd"]
    seen = set()
    exports = {}
    missing = []
    while pending:
        path = pending.pop()
        if path in seen:
            continue
        seen.add(path)
        binary = pefile.PE(str(path), max_symbol_exports=100_000)
        for dependency in getattr(binary, "DIRECTORY_ENTRY_IMPORT", ()):
            target = libraries.get(dependency.dll.decode().casefold())
            if target is None:
                continue
            if target not in exports:
                library = pefile.PE(str(target), max_symbol_exports=100_000)
                symbols = getattr(library, "DIRECTORY_ENTRY_EXPORT", None)
                exports[target] = {entry.name for entry in symbols.symbols} if symbols else set()
                library.close()
            for symbol in dependency.imports:
                if symbol.name and symbol.name not in exports[target]:
                    missing.append(
                        (
                            str(path.relative_to(base)),
                            str(target.relative_to(base)),
                            symbol.name.decode(),
                        )
                    )
            pending.append(target)
        binary.close()
    for item in missing:
        print(item)
    print(f"Inspected {len(seen)} bundled libraries; unresolved bundled imports: {len(missing)}")
    sys.exit(bool(missing))


if __name__ == "__main__":
    main()
