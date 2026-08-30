"""Windows thumbnail extraction in a time-bounded child process, never the UI thread."""

from __future__ import annotations

import ctypes
import multiprocessing
import os
from ctypes import wintypes as w
from uuid import UUID

MAX_BYTES = 320 * 200 * 4


def _extract(path):
    from ..windows_safety import DEFAULT_WINDOWS_SAFETY_POLICY, is_cloud_placeholder

    path = DEFAULT_WINDOWS_SAFETY_POLICY.validate_regular_file(path)
    if is_cloud_placeholder(path):
        return None
    ole = ctypes.OleDLL("ole32")
    shell = ctypes.WinDLL("shell32")
    gdi = ctypes.WinDLL("gdi32")
    user = ctypes.WinDLL("user32")
    pointer = ctypes.c_void_p

    class Size(ctypes.Structure):
        _fields_ = [("cx", w.LONG), ("cy", w.LONG)]

    class Bitmap(ctypes.Structure):
        _fields_ = [
            ("type", w.LONG),
            ("width", w.LONG),
            ("height", w.LONG),
            ("stride", w.LONG),
            ("planes", w.WORD),
            ("bits", w.WORD),
            ("data", pointer),
        ]

    class Header(ctypes.Structure):
        _fields_ = [
            ("size", w.DWORD),
            ("width", w.LONG),
            ("height", w.LONG),
            ("planes", w.WORD),
            ("bits", w.WORD),
            ("compression", w.DWORD),
            ("image_size", w.DWORD),
            ("x", w.LONG),
            ("y", w.LONG),
            ("used", w.DWORD),
            ("important", w.DWORD),
        ]

    shell.SHCreateItemFromParsingName.argtypes = [
        w.LPCWSTR,
        pointer,
        pointer,
        ctypes.POINTER(pointer),
    ]
    shell.SHCreateItemFromParsingName.restype = ctypes.c_long
    gdi.GetObjectW.argtypes = [pointer, ctypes.c_int, pointer]
    gdi.GetDIBits.argtypes = [pointer, pointer, w.UINT, w.UINT, pointer, pointer, w.UINT]
    gdi.DeleteObject.argtypes = [pointer]
    user.GetDC.argtypes = [pointer]
    user.GetDC.restype = pointer
    user.ReleaseDC.argtypes = [pointer, pointer]
    ole.CoInitializeEx(None, 2)
    instance, bitmap, dc = pointer(), pointer(), None
    try:
        iid = (ctypes.c_ubyte * 16).from_buffer_copy(
            UUID("bcc18b79-ba16-442f-80c4-8a59c30c463b").bytes_le
        )
        if shell.SHCreateItemFromParsingName(str(path), None, iid, ctypes.byref(instance)) < 0:
            return None
        table = ctypes.cast(instance, ctypes.POINTER(ctypes.POINTER(pointer))).contents
        get_image = ctypes.WINFUNCTYPE(
            ctypes.c_long, pointer, Size, w.UINT, ctypes.POINTER(pointer)
        )(table[3])
        # Ask the existing Shell cache first, then extract an actual thumbnail (not an icon).
        result = get_image(instance, Size(320, 200), 0x18, ctypes.byref(bitmap))
        if result < 0:
            result = get_image(instance, Size(320, 200), 0x08, ctypes.byref(bitmap))
        if result < 0 or not bitmap:
            return None
        info = Bitmap()
        if not gdi.GetObjectW(bitmap, ctypes.sizeof(info), ctypes.byref(info)):
            return None
        width, height = info.width, abs(info.height)
        if not (0 < width <= 320 and 0 < height <= 200):
            return None
        header = Header(size=ctypes.sizeof(Header), width=width, height=-height, planes=1, bits=32)
        pixels = ctypes.create_string_buffer(width * height * 4)
        dc = user.GetDC(None)
        if (
            not dc
            or gdi.GetDIBits(dc, bitmap, 0, height, pixels, ctypes.byref(header), 0) != height
        ):
            return None
        return width.to_bytes(4, "little") + height.to_bytes(4, "little") + pixels.raw
    finally:
        if dc:
            user.ReleaseDC(None, dc)
        if bitmap:
            gdi.DeleteObject(bitmap)
        if instance:
            table = ctypes.cast(instance, ctypes.POINTER(ctypes.POINTER(pointer))).contents
            ctypes.WINFUNCTYPE(w.ULONG, pointer)(table[2])(instance)
        ole.CoUninitialize()


def _worker(path, connection):
    try:
        connection.send_bytes(_extract(path) or b"")
    except (OSError, ValueError):
        connection.send_bytes(b"")
    finally:
        connection.close()


def shell_thumbnail(path, timeout=6):
    """Return a bounded QImage; unsupported codecs, provider crashes and timeouts fail closed."""
    from PySide6.QtGui import QImage

    if os.name != "nt":
        return QImage()
    context = multiprocessing.get_context("spawn")
    receive, send = context.Pipe(duplex=False)
    process = context.Process(target=_worker, args=(str(path), send), daemon=True)
    try:
        process.start()
        send.close()
        if not receive.poll(timeout):
            return QImage()
        payload = receive.recv_bytes(MAX_BYTES + 8)
        if len(payload) < 8:
            return QImage()
        width, height = (
            int.from_bytes(payload[:4], "little"),
            int.from_bytes(payload[4:8], "little"),
        )
        if not (0 < width <= 320 and 0 < height <= 200 and len(payload) == 8 + width * height * 4):
            return QImage()
        return QImage(payload[8:], width, height, width * 4, QImage.Format.Format_RGB32).copy()
    except (OSError, EOFError, ValueError):
        return QImage()
    finally:
        receive.close()
        send.close()
        if process.pid is not None:
            process.join(0.1)
            if process.is_alive():
                process.terminate()
                process.join(1)
            process.close()
