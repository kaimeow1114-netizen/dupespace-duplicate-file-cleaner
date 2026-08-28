from __future__ import annotations

import ctypes
import json
import os
from ctypes import wintypes
from pathlib import Path
from uuid import uuid4

from .paths import app_data_dir


class TokenProtectionError(RuntimeError):
    """Raised when Windows cannot protect or restore an OAuth token."""


class _DataBlob(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_byte))]


def protected_token_path() -> Path:
    return app_data_dir() / "oauth-token.dpapi"


def legacy_token_path() -> Path:
    return app_data_dir() / "token.json"


def _blob(value: bytes) -> tuple[_DataBlob, ctypes.Array[ctypes.c_char]]:
    buffer = ctypes.create_string_buffer(value)
    return (
        _DataBlob(len(value), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte))),
        buffer,
    )


def _dpapi_transform(value: bytes, *, protect: bool) -> bytes:
    if os.name != "nt":
        raise TokenProtectionError("OAuth 權杖保護只支援 Windows 使用者資料保護 API。")

    source, source_buffer = _blob(value)
    result = _DataBlob()
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    description = "DUPESPACE OAuth token" if protect else None
    function = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    function.argtypes = [
        ctypes.POINTER(_DataBlob),
        wintypes.LPCWSTR if protect else ctypes.c_void_p,
        ctypes.POINTER(_DataBlob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        ctypes.POINTER(_DataBlob),
    ]
    function.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    try:
        if protect:
            ok = function(
                ctypes.byref(source),
                description,
                None,
                None,
                None,
                1,
                ctypes.byref(result),
            )
        else:
            ok = function(
                ctypes.byref(source),
                None,
                None,
                None,
                None,
                1,
                ctypes.byref(result),
            )
        if not ok:
            raise ctypes.WinError()
        return ctypes.string_at(result.pbData, result.cbData)
    except OSError as error:
        action = "加密" if protect else "解密"
        raise TokenProtectionError(f"Windows 無法{action} Google OAuth 權杖：{error}") from error
    finally:
        _ = source_buffer
        if result.pbData:
            kernel32.LocalFree(result.pbData)


def protect_token(token_json: str) -> bytes:
    json.loads(token_json)
    return _dpapi_transform(token_json.encode("utf-8"), protect=True)


def unprotect_token(payload: bytes) -> str:
    value = _dpapi_transform(payload, protect=False).decode("utf-8")
    json.loads(value)
    return value


def save_protected_token(token_json: str) -> Path:
    target = protected_token_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f"oauth-{uuid4().hex}.tmp")
    payload = protect_token(token_json)
    with temporary.open("xb") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, target)
    legacy_token_path().unlink(missing_ok=True)
    return target


def load_protected_token() -> str | None:
    target = protected_token_path()
    if target.exists():
        try:
            return unprotect_token(target.read_bytes())
        except (OSError, UnicodeError, json.JSONDecodeError) as error:
            raise TokenProtectionError(
                f"OAuth 權杖已損毀或不屬於目前 Windows 帳號：{error}"
            ) from error

    legacy = legacy_token_path()
    if not legacy.exists():
        return None
    try:
        value = legacy.read_text(encoding="utf-8")
        json.loads(value)
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise TokenProtectionError(f"舊版 OAuth 權杖無法遷移：{error}") from error
    save_protected_token(value)
    return value


def clear_tokens() -> None:
    protected_token_path().unlink(missing_ok=True)
    legacy_token_path().unlink(missing_ok=True)
