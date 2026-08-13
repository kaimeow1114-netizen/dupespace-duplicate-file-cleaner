from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from dupesweep.drive import GoogleDriveScanner, GoogleDriveTrashExecutor
from dupesweep.models import FileRecord


class FakeRequest:
    def __init__(self, response: dict[str, Any]) -> None:
        self.response = response

    def execute(self, **_kwargs: Any) -> dict[str, Any]:
        return self.response


@dataclass
class UpdateRequest:
    file_id: str


class FakeFiles:
    def __init__(self, pages: list[dict[str, Any]] | None = None) -> None:
        self.pages = pages or []
        self.list_calls: list[dict[str, Any]] = []
        self.update_calls: list[dict[str, Any]] = []

    def list(self, **kwargs: Any) -> FakeRequest:
        self.list_calls.append(kwargs)
        return FakeRequest(self.pages[len(self.list_calls) - 1])

    def update(self, **kwargs: Any) -> UpdateRequest:
        self.update_calls.append(kwargs)
        return UpdateRequest(kwargs["fileId"])


class FakeBatch:
    def __init__(self, service: FakeService, callback: Any) -> None:
        self.service = service
        self.callback = callback
        self.requests: list[tuple[UpdateRequest, str]] = []

    def add(self, request: UpdateRequest, request_id: str) -> None:
        self.requests.append((request, request_id))

    def execute(self) -> None:
        self.service.batch_sizes.append(len(self.requests))
        for request, request_id in self.requests:
            self.callback(request_id, {"id": request.file_id, "trashed": True}, None)


class FakeService:
    def __init__(self, pages: list[dict[str, Any]] | None = None) -> None:
        self.files_resource = FakeFiles(pages)
        self.batch_sizes: list[int] = []

    def files(self) -> FakeFiles:
        return self.files_resource

    def new_batch_http_request(self, callback: Any) -> FakeBatch:
        return FakeBatch(self, callback)


def drive_item(file_id: str, checksum: str = "abc", **overrides: Any) -> dict[str, Any]:
    item = {
        "id": file_id,
        "name": f"{file_id}.bin",
        "mimeType": "application/octet-stream",
        "size": "12",
        "md5Checksum": checksum,
        "createdTime": "2026-01-01T00:00:00Z",
        "modifiedTime": "2026-01-01T00:00:00Z",
        "ownedByMe": True,
        "version": "1",
        "capabilities": {"canTrash": True},
    }
    item.update(overrides)
    return item


def test_drive_scanner_paginates_and_skips_unsafe_items() -> None:
    pages = [
        {
            "files": [
                drive_item("a"),
                drive_item("shared", driveId="shared-drive"),
                drive_item(
                    "native",
                    mimeType="application/vnd.google-apps.document",
                    md5Checksum=None,
                ),
            ],
            "nextPageToken": "next",
        },
        {
            "files": [
                drive_item("b"),
                drive_item("other-owner", ownedByMe=False),
            ]
        },
    ]
    service = FakeService(pages)

    report = GoogleDriveScanner().scan(service)

    assert report.examined_files == 5
    assert report.skipped_files == 3
    assert len(report.groups) == 1
    assert {record.key for record in report.groups[0].records} == {"drive:a", "drive:b"}
    assert len(service.files_resource.list_calls) == 2
    assert service.files_resource.list_calls[0]["pageSize"] == 1000
    assert service.files_resource.list_calls[1]["pageToken"] == "next"


def make_record(index: int) -> FileRecord:
    return FileRecord(
        key=f"drive:id-{index}",
        source="drive",
        name=f"copy-{index}.bin",
        location=f"Google Drive / copy-{index}.bin",
        size=1,
        checksum="md5:x",
    )


def test_drive_trash_never_exceeds_100_requests_per_batch() -> None:
    service = FakeService()
    records = [make_record(index) for index in range(205)]

    report = GoogleDriveTrashExecutor(retry_count=0).trash(service, records)

    assert service.batch_sizes == [100, 100, 5]
    assert len(report.trashed) == 205
    assert all(call["body"] == {"trashed": True} for call in service.files_resource.update_calls)
    assert all(call["fields"] == "id,trashed" for call in service.files_resource.update_calls)
