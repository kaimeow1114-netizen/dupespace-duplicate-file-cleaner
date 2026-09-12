"""Read and remove credentials created by retired releases.

This module cannot create, refresh or replace an OAuth credential. It exists
only so the explicit retirement command can revoke a grant and erase old files.
An old plaintext grant is first moved into Windows user-bound DPAPI storage so
a failed network revocation never leaves the old plaintext file behind.
"""

from __future__ import annotations

import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path
from uuid import uuid4

from .paths import app_data_dir


class LegacyGrantError(RuntimeError):
    pass


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def _validate_grant(value: str) -> str:
    data = json.loads(value)
    if not isinstance(data, dict):
        raise ValueError("legacy grant must be a JSON object")
    return value


def protected_grant_path() -> Path:
    return app_data_dir() / "oauth-token.dpapi"


def plaintext_grant_path() -> Path:
    return app_data_dir() / "token.json"


def _unprotect(payload: bytes) -> str:
    if os.name != "nt":
        raise LegacyGrantError("舊版授權只能由原本的 Windows 使用者移除。")
    source_buffer = ctypes.create_string_buffer(payload)
    source = _DataBlob(
        len(payload), ctypes.cast(source_buffer, ctypes.POINTER(ctypes.c_byte))
    )
    result = _DataBlob()
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    try:
        if not crypt32.CryptUnprotectData(
            ctypes.byref(source), None, None, None, None, 1, ctypes.byref(result)
        ):
            raise ctypes.WinError()
        value = ctypes.string_at(result.pbData, result.cbData).decode("utf-8")
        return _validate_grant(value)
    except (OSError, UnicodeError, ValueError) as error:
        raise LegacyGrantError("舊版授權已損毀或不屬於目前的 Windows 帳號。") from error
    finally:
        if result.pbData:
            kernel32.LocalFree(result.pbData)


def _protect(value: str) -> bytes:
    if os.name != "nt":
        raise LegacyGrantError("舊版授權只能由原本的 Windows 使用者安全移除。")
    payload = value.encode("utf-8")
    source_buffer = ctypes.create_string_buffer(payload)
    source = _DataBlob(
        len(payload), ctypes.cast(source_buffer, ctypes.POINTER(ctypes.c_byte))
    )
    result = _DataBlob()
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    crypt32.CryptProtectData.argtypes = [
        ctypes.POINTER(_DataBlob),
        wintypes.LPCWSTR,
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    crypt32.CryptProtectData.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    try:
        if not crypt32.CryptProtectData(
            ctypes.byref(source),
            "DUPESPACE retired OAuth grant",
            None,
            None,
            None,
            1,
            ctypes.byref(result),
        ):
            raise ctypes.WinError()
        return ctypes.string_at(result.pbData, result.cbData)
    except OSError as error:
        raise LegacyGrantError("Windows 無法加密舊版授權，未執行撤銷。") from error
    finally:
        if result.pbData:
            kernel32.LocalFree(result.pbData)


def _read_plaintext(path: Path) -> str:
    try:
        value = path.read_text(encoding="utf-8")
        return _validate_grant(value)
    except (OSError, UnicodeError, ValueError) as error:
        raise LegacyGrantError("舊版授權檔格式錯誤。") from error


def load_legacy_grant() -> str | None:
    protected = protected_grant_path()
    plaintext = plaintext_grant_path()
    if protected.exists():
        try:
            value = _unprotect(protected.read_bytes())
        except OSError as error:
            raise LegacyGrantError("無法讀取舊版授權檔。") from error
        if plaintext.exists():
            old_value = _read_plaintext(plaintext)
            if json.loads(old_value) != json.loads(value):
                raise LegacyGrantError("發現兩份不同的舊版授權，未自動清除任何一份。")
            plaintext.unlink()
        return value
    if not plaintext.exists():
        return None
    value = _read_plaintext(plaintext)
    temporary = protected.with_name(f"oauth-retired-{uuid4().hex}.tmp")
    try:
        payload = _protect(value)
        with temporary.open("xb") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        # A hard link creates the protected name atomically without replacing a
        # credential another process may have written in the meantime.
        try:
            os.link(temporary, protected)
        except FileExistsError:
            if json.loads(_unprotect(protected.read_bytes())) != json.loads(value):
                raise LegacyGrantError("舊版授權在遷移時發生衝突，未自動覆蓋。") from None
        plaintext.unlink()
        return value
    except OSError as error:
        raise LegacyGrantError("無法安全加密舊版授權，未執行撤銷。") from error
    finally:
        temporary.unlink(missing_ok=True)


def clear_legacy_grant() -> None:
    protected_grant_path().unlink(missing_ok=True)
    plaintext_grant_path().unlink(missing_ok=True)
