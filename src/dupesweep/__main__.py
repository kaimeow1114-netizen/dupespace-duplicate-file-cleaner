from dupespace.app import main
from dupespace.migration import migrate_legacy_preferences

if __name__ == "__main__":
    migrate_legacy_preferences()
    main()
