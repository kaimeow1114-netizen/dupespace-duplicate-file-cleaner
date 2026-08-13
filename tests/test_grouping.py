from dupesweep.grouping import (
    build_duplicate_groups,
    default_selection,
    selected_bytes,
    validate_selection,
)
from dupesweep.models import FileRecord


def record(
    key: str, created: float, *, can_trash: bool = True, can_delete: bool = True
) -> FileRecord:
    return FileRecord(
        key=key,
        source="local",
        name=f"{key}.txt",
        location=f"C:/{key}.txt",
        size=10,
        checksum="sha256:same",
        created_at=created,
        can_trash=can_trash,
        can_delete=can_delete,
    )


def test_oldest_record_is_protected_and_extras_selected() -> None:
    groups = build_duplicate_groups([record("new", 30), record("old", 10), record("mid", 20)])

    assert len(groups) == 1
    assert groups[0].keeper_key == "old"
    assert default_selection(groups) == {"mid", "new"}
    assert selected_bytes(groups, {"mid", "new"}) == 20


def test_untrashable_extra_is_not_selected() -> None:
    groups = build_duplicate_groups([record("old", 10), record("locked", 20, can_trash=False)])

    assert default_selection(groups) == set()


def test_keeper_cannot_be_selected() -> None:
    groups = build_duplicate_groups([record("old", 10), record("new", 20)])

    try:
        validate_selection(groups, {"old"})
    except ValueError as error:
        assert "keeper" in str(error)
    else:  # pragma: no cover - assertion helper
        raise AssertionError("keeper selection should fail")


def test_keeper_cannot_be_selected_for_permanent_delete() -> None:
    groups = build_duplicate_groups([record("old", 10), record("new", 20)])

    try:
        validate_selection(groups, {"old"}, "permanent")
    except ValueError as error:
        assert "keeper" in str(error)
    else:  # pragma: no cover - assertion helper
        raise AssertionError("keeper selection should fail")
