"""Generate disposable fixtures and measure the local scanner without deleting files.

The caller must provide a new, empty directory. This script never removes that
directory or any generated file; GitHub's disposable runner performs cleanup.
"""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import json
import os
import time
from pathlib import Path

from dupespace.local import LocalScanner
from dupespace.models import ScanRoot
from dupespace.windows_safety import WindowsSafetyPolicy

ALLOWED_COUNTS = {10_000, 100_000, 500_000}
FILES_PER_DIRECTORY = 1_000


def _arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a disposable DUPESPACE scanner stress test")
    parser.add_argument("--workspace", type=Path, required=True)
    parser.add_argument("--files", type=int, choices=sorted(ALLOWED_COUNTS), required=True)
    parser.add_argument("--report", type=Path, required=True)
    return parser.parse_args()


def _prepare_workspace(path: Path) -> Path:
    resolved = path.resolve()
    if resolved.exists():
        if not resolved.is_dir() or any(resolved.iterdir()):
            raise ValueError("stress workspace must be a new or empty directory")
    else:
        resolved.mkdir(parents=True)
    return resolved


def _payload(index: int) -> bytes:
    # Ten percent of records form exact pairs. Remaining records keep the same
    # byte length so the size filter cannot avoid hashing them.
    identity = 1_000_000_000 + index // 10 if index % 10 in {0, 1} else index
    return hashlib.sha256(f"DUPESPACE-STRESS-{identity}".encode()).digest()


def _peak_rss_bytes() -> int | None:
    if os.name == "nt":
        class ProcessMemoryCounters(ctypes.Structure):
            _fields_ = [
                ("cb", ctypes.c_ulong),
                ("PageFaultCount", ctypes.c_ulong),
                ("PeakWorkingSetSize", ctypes.c_size_t),
                ("WorkingSetSize", ctypes.c_size_t),
                ("QuotaPeakPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPagedPoolUsage", ctypes.c_size_t),
                ("QuotaPeakNonPagedPoolUsage", ctypes.c_size_t),
                ("QuotaNonPagedPoolUsage", ctypes.c_size_t),
                ("PagefileUsage", ctypes.c_size_t),
                ("PeakPagefileUsage", ctypes.c_size_t),
            ]

        counters = ProcessMemoryCounters()
        counters.cb = ctypes.sizeof(counters)
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel32.GetCurrentProcess.restype = ctypes.c_void_p
        memory_info = kernel32.K32GetProcessMemoryInfo
        memory_info.argtypes = [
            ctypes.c_void_p,
            ctypes.POINTER(ProcessMemoryCounters),
            ctypes.c_ulong,
        ]
        memory_info.restype = ctypes.c_int
        if memory_info(kernel32.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
            return int(counters.PeakWorkingSetSize)
        return None
    try:
        import resource

        peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return int(peak * (1 if os.uname().sysname == "Darwin" else 1024))
    except (AttributeError, ImportError, OSError):
        return None


def main() -> None:
    args = _arguments()
    workspace = _prepare_workspace(args.workspace)
    report_path = args.report.resolve()
    if report_path == workspace or workspace in report_path.parents:
        raise ValueError("report must be outside the generated scan tree")

    fixture_started = time.perf_counter()
    for index in range(args.files):
        folder = workspace / f"bucket-{index // FILES_PER_DIRECTORY:04d}"
        folder.mkdir(exist_ok=True)
        (folder / f"record-{index:07d}.bin").write_bytes(_payload(index))
    fixture_seconds = time.perf_counter() - fixture_started

    scan_started = time.perf_counter()
    scan = LocalScanner(safety_policy=WindowsSafetyPolicy([])).scan(
        (ScanRoot(str(workspace), "clean"),)
    )
    scan_seconds = time.perf_counter() - scan_started

    report = {
        "files_requested": args.files,
        "files_examined": scan.examined_files,
        "files_hashed": scan.hashed_files,
        "duplicate_groups": len(scan.groups),
        "duplicate_copies": scan.duplicate_copies,
        "skipped_files": scan.skipped_files,
        "fixture_seconds": round(fixture_seconds, 3),
        "scan_seconds": round(scan_seconds, 3),
        "files_per_second": round(scan.examined_files / scan_seconds, 1),
        "process_peak_rss_bytes": _peak_rss_bytes(),
        "warnings": list(scan.warnings[:20]),
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
