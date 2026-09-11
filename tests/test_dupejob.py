from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

import pytest

from dupespace.dupejob import DUPEJOB_ALGORITHM, DUPEJOB_DOMAIN, DUPEJOB_SCHEMA, load_dupejob
from dupespace.windows_safety import WindowsSafetyPolicy

TEST_POLICY = WindowsSafetyPolicy([])


def browser_fingerprint(content: bytes) -> str:
    digest = hashlib.sha256()
    digest.update(DUPEJOB_DOMAIN)
    digest.update(len(content).to_bytes(8, "big"))
    digest.update(hashlib.sha256(content).digest())
    return digest.hexdigest()


def write_job(path: Path, fingerprint: str, files: list[dict]) -> None:
    path.write_text(
        json.dumps(
            {
                "schema": DUPEJOB_SCHEMA,
                "version": 1,
                "source": "dupespace-browser-local",
                "sourceRootName": "photos",
                "fingerprintAlgorithm": DUPEJOB_ALGORITHM,
                "groups": [
                    {
                        "fingerprint": fingerprint,
                        "category": "image",
                        "contextReview": False,
                        "files": files,
                    }
                ],
            }
        ),
        encoding="utf-8",
    )


def test_dupejob_revalidates_content_and_uses_desktop_keeper_rules(
    tmp_path: Path, monkeypatch
) -> None:
    root = tmp_path / "photos"
    root.mkdir()
    content = b"same-content"
    newer = root / "copy.jpg"
    older = root / "original.jpg"
    newer.write_bytes(content)
    older.write_bytes(content)
    os.utime(older, (1_700_000_000, 1_700_000_000))
    os.utime(newer, (1_700_000_100, 1_700_000_100))
    monkeypatch.setattr("dupespace.dupejob._creation_time", lambda value: value.st_mtime)
    job = tmp_path / "scan.dupejob"
    write_job(
        job,
        browser_fingerprint(content),
        [
            {
                "role": "reference_only",
                "relativePath": "copy.jpg",
                "size": len(content),
                "lastModified": newer.stat().st_mtime_ns // 1_000_000,
            },
            {
                "role": "duplicate_candidate",
                "relativePath": "original.jpg",
                "size": len(content),
                "lastModified": older.stat().st_mtime_ns // 1_000_000,
            },
        ],
    )

    report = load_dupejob(job, root, safety_policy=TEST_POLICY)

    assert len(report.groups) == 1
    assert report.groups[0].keeper.name == "original.jpg"
    assert all(record.checksum.startswith("sha256:") for record in report.groups[0].records)


def test_dupejob_rejects_path_escape(tmp_path: Path) -> None:
    root = tmp_path / "photos"
    root.mkdir()
    job = tmp_path / "scan.dupejob"
    write_job(
        job,
        "0" * 64,
        [
            {
                "role": "reference_only",
                "relativePath": "../outside.txt",
                "size": 1,
                "lastModified": 0,
            },
            {
                "role": "duplicate_candidate",
                "relativePath": "copy.txt",
                "size": 1,
                "lastModified": 0,
            },
        ],
    )
    with pytest.raises(ValueError, match="離開選取"):
        load_dupejob(job, root, safety_policy=TEST_POLICY)


def test_dupejob_changed_file_fails_closed(tmp_path: Path) -> None:
    root = tmp_path / "photos"
    root.mkdir()
    files = []
    content = b"same"
    for name in ("a.txt", "b.txt"):
        path = root / name
        path.write_bytes(content)
        files.append(
            {
                "role": "reference_only" if not files else "duplicate_candidate",
                "relativePath": name,
                "size": len(content),
                "lastModified": path.stat().st_mtime_ns // 1_000_000,
            }
        )
    job = tmp_path / "scan.dupejob"
    write_job(job, browser_fingerprint(content), files)
    (root / "b.txt").write_bytes(b"else")

    report = load_dupejob(job, root, safety_policy=TEST_POLICY)

    assert not report.groups
    assert report.skipped_files == 1
    assert report.warnings
