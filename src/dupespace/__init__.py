"""DupeSpace: local-first exact duplicate analysis and protected Windows cleanup."""

from .models import ActionOutcome, ActionReport, DuplicateGroup, FileRecord, ScanReport

__all__ = [
    "ActionOutcome",
    "ActionReport",
    "DuplicateGroup",
    "FileRecord",
    "ScanReport",
]

__version__ = "1.7.1"
