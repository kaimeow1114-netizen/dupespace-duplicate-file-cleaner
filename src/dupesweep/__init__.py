"""One-release compatibility shim for migrating DupeSweep preferences to DupeSpace."""

from dupespace.migration import migrate_legacy_preferences

__all__ = ["migrate_legacy_preferences"]
__version__ = "0.4.0"
