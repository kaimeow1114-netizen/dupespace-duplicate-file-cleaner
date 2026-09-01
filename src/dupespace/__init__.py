"""DupeSpace: exact duplicate cleanup for local files and Google Drive."""

from .models import ActionOutcome, ActionReport, DuplicateGroup, FileRecord, ScanReport

__all__ = [
    "ActionOutcome",
    "ActionReport",
    "DuplicateGroup",
    "FileRecord",
    "ScanReport",
]

__version__ = "1.5.3"
