from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

from dupesweep.drive import (
    GoogleDrivePermanentDeleteExecutor,
    GoogleDriveScanner,
    GoogleDriveTrashExecutor,
)
from dupesweep.models import FileRecord, OperationItem


class FakeRequest:
    def __init__(self, response: dict[str, Any]) -> None:
        self.response = response

    def execute(self, **_kwargs: Any) -> dict[str, Any]:
        return self.response


@dataclass
class ApiRequest:
    kind: str
    file_id: str


class FakeFiles:
    def __init__(self, pages: list[dict[str, Any]] | None = None) -> None:
        self.pages = pages or []
        self.metadata: dict[str, dict[str, Any]] = {}
        self.list_calls: list[dict[str, Any]] = []
        self.get_calls: list[dict[str, Any]] = []
        self.update_calls: list[dict[str, Any]] = []
        self.delete_calls: list[dict[str, Any]] = []

    def list(self, **kwargs: Any) -> FakeRequest:
        self.list_calls.append(kwargs)
        return FakeRequest(self.pages[len(self.list_calls) - 1])

    def get(self, **kwargs: Any) -> ApiRequest:
        self.get_calls.append(kwargs)
        return ApiRequest("get", kwargs["fileId"])

    def update(self, **kwargs: Any) -> ApiRequest:
        self.update_calls.append(kwargs)
        return ApiRequest("update", kwargs["fileId"])

    def delete(self, **kwargs: Any) -> ApiRequest:
        self.delete_calls.append(kwargs)
        return ApiRequest("delete", kwargs["fileId"])


class FakeBatch:
    def __init__(self, service: FakeService, callback: Any) -> None:
        self.service = service
        self.callback = callback
        self.requests: list[tuple[ApiRequest, str]] = []

    def add(self, request: ApiRequest, request_id: str) -> None:
        self.requests.append((request, request_id))

    def execute(self) -> None:
        kinds = {request.kind for request, _request_id in self.requests}
        self.service.batch_log.append((next(iter(kinds)), len(self.requests)))
        for request, request_id in self.requests:
            if request.kind == "get":
                self.callback(
                    request_id, self.service.files_resource.metadata[request.file_id], None
                )
            elif request.kind == "update":
                exception = (
                    RuntimeError("trash failed")
                    if request.file_id in self.service.fail_trash
                    else None
                )
                self.callback(request_id, {"id": request.file_id, "trashed": True}, exception)
            else:
                self.callback(request_id, {}, None)


class FakeService:
    def __init__(self, pages: list[dict[str, Any]] | None = None) -> None:
        self.files_resource = FakeFiles(pages)
        self.batch_log: list[tuple[str, int]] = []
        self.fail_trash: set[str] = set()

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
        "trashed": False,
        "capabilities": {"canTrash": True, "canDelete": True},
    }
    item.update(overrides)
    return item


def record(file_id: str) -> FileRecord:
    return FileRecord(
        key=f"drive:{file_id}",
        source="drive",
        name=f"{file_id}.bin",
        location=f"Google Drive / {file_id}.bin",
        size=12,
        checksum="md5:abc",
        modified_at=1767225600.0,
        metadata_token="1",
        can_trash=True,
        can_delete=True,
        mime_type="application/octet-stream",
    )


def test_drive_scanner_paginates_and_skips_unsafe_items() -> None:
    pages = [
        {
            "files": [
                drive_item("a"),
                drive_item("shared", driveId="shared-drive"),
                drive_item(
                    "native", mimeType="application/vnd.google-apps.document", md5Checksum=None
                ),
            ],
            "nextPageToken": "next",
        },
        {"files": [drive_item("b"), drive_item("other-owner", ownedByMe=False)]},
    ]
    service = FakeService(pages)

    report = GoogleDriveScanner().scan(service)

    assert report.examined_files == 5
    assert report.skipped_files == 3
    assert len(report.groups) == 1
    assert {item.key for item in report.groups[0].records} == {"drive:a", "drive:b"}
    assert report.groups[0].records[0].can_delete
    assert service.files_resource.list_calls[0]["pageSize"] == 1000
    assert service.files_resource.list_calls[1]["pageToken"] == "next"


def make_items(count: int, service: FakeService) -> list[OperationItem]:
    keeper = record("keeper")
    service.files_resource.metadata["keeper"] = drive_item("keeper")
    items: list[OperationItem] = []
    for index in range(count):
        target = record(f"id-{index}")
        service.files_resource.metadata[f"id-{index}"] = drive_item(f"id-{index}")
        items.append(OperationItem(target, keeper))
    return items


def test_drive_trash_never_exceeds_100_requests_per_batch() -> None:
    service = FakeService()
    items = make_items(205, service)

    report = GoogleDriveTrashExecutor(retry_count=0).trash(service, items)

    mutation_batches = [size for kind, size in service.batch_log if kind == "update"]
    assert mutation_batches == [100, 100, 5]
    assert all(size <= 100 for _kind, size in service.batch_log)
    assert len(report.trashed) == 205
    assert not service.files_resource.delete_calls


def test_drive_trash_failure_never_falls_back_to_delete() -> None:
    service = FakeService()
    items = make_items(1, service)
    service.fail_trash.add("id-0")

    report = GoogleDriveTrashExecutor(retry_count=0).trash(service, items)

    assert len(report.failed) == 1
    assert service.files_resource.update_calls
    assert service.files_resource.delete_calls == []


def test_drive_permanent_delete_uses_delete_path_and_revalidates_version() -> None:
    service = FakeService()
    items = make_items(2, service)
    service.files_resource.metadata["id-1"]["version"] = "2"

    report = GoogleDrivePermanentDeleteExecutor(retry_count=0).delete(service, items)

    assert len(report.deleted) == 1
    assert len(report.skipped) == 1
    assert [call["fileId"] for call in service.files_resource.delete_calls] == ["id-0"]
    assert service.files_resource.update_calls == []


def test_drive_large_operation_stops_safely_between_batches() -> None:
    service = FakeService()
    items = make_items(205, service)
    cancel_event = threading.Event()

    def stop_after_first_batch(_update: Any) -> None:
        cancel_event.set()

    report = GoogleDriveTrashExecutor(retry_count=0).trash(
        service,
        items,
        progress=stop_after_first_batch,
        cancel_event=cancel_event,
    )

    mutation_batches = [size for kind, size in service.batch_log if kind == "update"]
    assert mutation_batches == [100]
    assert len(report.trashed) == 100
    assert len(report.cancelled) == 105
    assert service.files_resource.delete_calls == []
