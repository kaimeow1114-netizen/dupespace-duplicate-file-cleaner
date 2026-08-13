from __future__ import annotations

import ctypes
import os
import stat
from collections.abc import Iterable
from pathlib import Path


class UnsafePathError(ValueError):
    """Raised when a requested path falls outside DUPESWEEP's safe user-data boundary."""


_MANAGED_FILE_NAMES = {
    "bootmgr",
    "bootnxt",
    "hiberfil.sys",
    "memory.dmp",
    "pagefile.sys",
    "swapfile.sys",
}

_DRIVE_PROTECTED_NAMES = {
    "$recycle.bin",
    "boot",
    "efi",
    "recovery",
    "system volume information",
}

_WINDOWS_PROTECTED_RELATIVE = {
    "installer",
    "servicing",
    "softwaredistribution",
    "system32",
    "syswow64",
    "winsxs",
}


def _windows_directory(api_name: str) -> Path | None:
    if os.name != "nt":
        return None
    buffer = ctypes.create_unicode_buffer(32768)
    function = getattr(ctypes.windll.kernel32, api_name, None)
    if function is None:
        return None
    length = function(buffer, len(buffer))
    return Path(buffer.value) if 0 < length < len(buffer) else None


def _logical_drive_roots() -> tuple[Path, ...]:
    if os.name != "nt":
        return ()
    mask = ctypes.windll.kernel32.GetLogicalDrives()
    return tuple(Path(f"{chr(65 + index)}:\\") for index in range(26) if mask & (1 << index))


def _volume_label(root: Path) -> str:
    if os.name != "nt":
        return ""
    label = ctypes.create_unicode_buffer(261)
    filesystem = ctypes.create_unicode_buffer(261)
    serial = ctypes.c_ulong()
    maximum_component = ctypes.c_ulong()
    flags = ctypes.c_ulong()
    success = ctypes.windll.kernel32.GetVolumeInformationW(
        str(root),
        label,
        len(label),
        ctypes.byref(serial),
        ctypes.byref(maximum_component),
        ctypes.byref(flags),
        filesystem,
        len(filesystem),
    )
    return label.value.casefold() if success else ""


def _expand_windows_long_path(path: Path) -> Path:
    if os.name != "nt":
        return path
    buffer = ctypes.create_unicode_buffer(32768)
    length = ctypes.windll.kernel32.GetLongPathNameW(str(path), buffer, len(buffer))
    return Path(buffer.value) if 0 < length < len(buffer) else path


def _case_key(path: Path) -> str:
    value = os.path.normcase(os.path.abspath(str(path)))
    return value.rstrip("\\/") or value


def _attributes(path: Path) -> int:
    try:
        return int(getattr(path.lstat(), "st_file_attributes", 0))
    except OSError:
        return 0


def is_reparse_point(path: Path) -> bool:
    try:
        if path.is_symlink():
            return True
    except OSError:
        return True
    reparse = int(getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))
    return bool(_attributes(path) & reparse)


def _existing_components(path: Path) -> Iterable[Path]:
    absolute = Path(os.path.abspath(path))
    current = Path(absolute.anchor)
    for part in absolute.parts[1:]:
        current /= part
        if current.exists() or current.is_symlink():
            yield current


def _assert_no_link_components(path: Path) -> None:
    for component in _existing_components(path):
        if is_reparse_point(component):
            raise UnsafePathError(f"為保護資料，不能使用符號連結或重新解析點：{component}")


def canonical_path(path: str | os.PathLike[str], *, strict: bool = True) -> Path:
    """Return a long, absolute physical path after rejecting link-based traversal."""

    candidate = Path(path).expanduser()
    _assert_no_link_components(candidate)
    resolved = candidate.resolve(strict=strict)
    resolved = _expand_windows_long_path(resolved)
    _assert_no_link_components(resolved)
    return resolved


def default_protected_roots() -> tuple[Path, ...]:
    roots: set[Path] = set()
    windows = _windows_directory("GetWindowsDirectoryW")
    system = _windows_directory("GetSystemDirectoryW")
    wow64 = _windows_directory("GetSystemWow64DirectoryW")
    for candidate in (windows, system, wow64):
        if candidate:
            roots.add(candidate)

    for variable in (
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramW6432",
        "ProgramData",
        "SystemRoot",
        "windir",
    ):
        value = os.environ.get(variable)
        if value:
            roots.add(Path(value))

    if windows:
        roots.update(windows / relative for relative in _WINDOWS_PROTECTED_RELATIVE)

    for drive in _logical_drive_roots():
        roots.update(drive / name for name in _DRIVE_PROTECTED_NAMES)
        label = _volume_label(drive)
        if any(word in label for word in ("efi", "system reserved", "recovery", "復原", "保留")):
            roots.add(drive)

    normalized: dict[str, Path] = {}
    for root in roots:
        try:
            expanded = _expand_windows_long_path(root.resolve(strict=False))
        except OSError:
            expanded = root.absolute()
        normalized[_case_key(expanded)] = expanded
    return tuple(normalized.values())


class WindowsSafetyPolicy:
    """Deny protected Windows locations and non-regular filesystem objects."""

    def __init__(self, protected_roots: Iterable[str | os.PathLike[str]] | None = None) -> None:
        roots = (
            default_protected_roots()
            if protected_roots is None
            else tuple(Path(p) for p in protected_roots)
        )
        self.protected_roots = tuple(
            _expand_windows_long_path(Path(p).resolve(strict=False)) for p in roots
        )
        self._protected_keys = tuple(_case_key(path) for path in self.protected_roots)

    def is_protected(self, path: str | os.PathLike[str]) -> bool:
        try:
            candidate = canonical_path(path, strict=False)
        except (OSError, UnsafePathError):
            candidate = Path(os.path.abspath(os.path.expanduser(str(path))))
        key = _case_key(candidate)
        return any(key == root or key.startswith(root + os.sep) for root in self._protected_keys)

    def validate_scan_root(self, path: str | os.PathLike[str]) -> Path:
        candidate = canonical_path(path)
        if not candidate.is_dir():
            raise UnsafePathError(f"掃描位置不是資料夾：{candidate}")
        if self.is_protected(candidate):
            raise UnsafePathError("這是 Windows 或電腦製造商管理的重要位置，DUPESWEEP 不會掃描它。")
        if self.has_protected_attributes(candidate):
            raise UnsafePathError("這個位置具有系統或隱藏屬性，DUPESWEEP 不會掃描它。")
        return candidate

    def has_protected_attributes(self, path: Path) -> bool:
        attributes = _attributes(path)
        hidden = int(getattr(stat, "FILE_ATTRIBUTE_HIDDEN", 0x2))
        system = int(getattr(stat, "FILE_ATTRIBUTE_SYSTEM", 0x4))
        reparse = int(getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400))
        return bool(attributes & (hidden | system | reparse))

    def validate_regular_file(self, path: str | os.PathLike[str]) -> Path:
        candidate = canonical_path(path)
        if self.is_protected(candidate):
            raise UnsafePathError("受保護的系統位置不可清理。")
        if candidate.name.casefold() in _MANAGED_FILE_NAMES:
            raise UnsafePathError("作業系統管理的檔案不可清理。")
        if is_reparse_point(candidate):
            raise UnsafePathError("符號連結、junction 或重新解析點不可清理。")
        mode = candidate.lstat().st_mode
        if not stat.S_ISREG(mode):
            raise UnsafePathError("永久刪除只允許一般檔案。")
        if self.has_protected_attributes(candidate):
            raise UnsafePathError("系統、隱藏或重新解析檔案不可清理。")
        return candidate


DEFAULT_WINDOWS_SAFETY_POLICY = WindowsSafetyPolicy()
