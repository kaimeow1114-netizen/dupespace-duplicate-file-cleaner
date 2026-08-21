from __future__ import annotations

PROJECT_ROOT_MARKERS = frozenset(
    {
        ".git",
        ".svn",
        ".hg",
        ".idea",
        ".vscode",
        "pyproject.toml",
        "package.json",
        "cargo.toml",
        "go.mod",
        "composer.json",
        "gemfile",
        "pom.xml",
        "build.gradle",
        "build.gradle.kts",
        "settings.gradle",
        "settings.gradle.kts",
    }
)
PROJECT_MARKER_SUFFIXES = (
    ".sln",
    ".csproj",
    ".fsproj",
    ".vbproj",
    ".vcxproj",
    ".xcodeproj",
)
PACKAGE_DIRECTORY_NAMES = frozenset(
    {".venv", "venv", "env", "node_modules", "site-packages", "__pycache__", "vendor"}
)


def is_project_marker_name(name: str) -> bool:
    folded = name.casefold()
    return folded in PROJECT_ROOT_MARKERS or folded.endswith(PROJECT_MARKER_SUFFIXES)


def is_package_directory_name(name: str) -> bool:
    return name.casefold() in PACKAGE_DIRECTORY_NAMES
