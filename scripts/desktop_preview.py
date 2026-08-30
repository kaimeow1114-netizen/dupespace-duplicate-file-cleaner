"""Render the actual native widgets with synthetic snapshots; never scan or delete user files."""

from __future__ import annotations

import os
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtGui import QFont, QFontDatabase  # noqa: E402
from PySide6.QtTest import QTest  # noqa: E402
from PySide6.QtWidgets import QApplication  # noqa: E402

from dupespace.confirmations import ConfirmationSnapshot  # noqa: E402
from dupespace.desktop.dialogs import ConfirmationDialog  # noqa: E402
from dupespace.desktop.operations import CleanupResult  # noqa: E402
from dupespace.desktop.window import MainWindow  # noqa: E402
from dupespace.models import (  # noqa: E402
    ActionOutcome,
    ActionReport,
    DuplicateGroup,
    FileRecord,
    ProgressUpdate,
    ScanReport,
    ScanRoot,
)


def sample_report() -> ScanReport:
    groups = []
    for index, (name, size) in enumerate(
        (
            ("山間旅行-2025.jpg", 12_800_000),
            ("品牌提案-final.pdf", 8_500_000),
            ("夏日紀錄-原始影片.mp4", 450_800_000),
            ("年度相片封存.zip", 850_400_000),
            ("會議摘要.docx", 85_000),
        )
    ):
        records = tuple(
            FileRecord(
                key=f"preview-{index}-{role}",
                source="local",
                name=name,
                location=(f"D:/待整理下載/{'珍藏原檔/' if role == 'keep' else '匯入副本/'}{name}"),
                size=size,
                checksum="f" * 64,
                root_role=role,
                source_root=("D:/待整理下載/珍藏原檔" if role == "keep" else "D:/待整理下載"),
                can_delete=True,
                auto_selectable=role == "clean",
            )
            for role in ("keep", "clean")
        )
        groups.append(DuplicateGroup(records[0].fingerprint, records, records[0].key))
    return ScanReport(
        "local",
        tuple(groups),
        4826,
        531,
        examined_bytes=25 * 1024**3,
        storage_capacity_bytes=1024**4,
    )


def main() -> None:
    output = Path(__file__).resolve().parents[1] / "outputs" / "desktop-v14-preview"
    output.mkdir(parents=True, exist_ok=True)
    application = QApplication([])
    # The offscreen platform has no Windows font database; load installed fonts for QA only.
    for font in ("msjh.ttc", "msjhbd.ttc", "segoeui.ttf", "segoeuib.ttf"):
        QFontDatabase.addApplicationFont(f"C:/Windows/Fonts/{font}")
    application.setStyle("Fusion")
    application.setFont(QFont("Microsoft JhengHei UI", 10))
    with TemporaryDirectory(prefix="dupespace-desktop-preview-") as temporary:
        os.environ["LOCALAPPDATA"] = temporary
        window = MainWindow(restore_session=False)
        window.reduced_motion = True
        window.sound.muted = True
        window.resize(1320, 860)
        window.show()
        QTest.qWait(230)
        application.processEvents()
        window.grab().save(str(output / "01-first-open.png"))
        window.session.roots = (
            ScanRoot("D:/待整理下載", "clean"),
            ScanRoot("D:/待整理下載/珍藏原檔", "keep"),
        )
        window._refresh_roots()
        window.preferences["profiles"] = {
            "旅行照片": [
                {"path": "D:/旅行照片/2026夏天海邊旅行紀錄", "role": "clean"},
                {"path": "E:/家族相簿", "role": "clean"},
            ],
            "工作文件與影片備份": [{"path": "D:/工作文件", "role": "clean"}],
        }
        window._refresh_profiles()
        application.processEvents()
        window.grab().save(str(output / "02-locations.png"))
        window._show_page("progress")
        window._progress(
            ProgressUpdate(
                "enumerating",
                1284,
                None,
                "正在掃描：D:/待整理下載/2026 夏季照片/海邊旅行",
            )
        )
        application.processEvents()
        window.grab().save(str(output / "02b-scanning.png"))
        report = sample_report()
        window._accept_scan(report)
        application.processEvents()
        window.grab().save(str(output / "03-review.png"))
        window._show_details(report.groups[1], report.groups[1].records[1])
        application.processEvents()
        window.grab().save(str(output / "03b-details.png"))
        window._close_details()
        window._toggle_sidebar()
        application.processEvents()
        window.grab().save(str(output / "03c-collapsed.png"))
        window._toggle_sidebar()
        window.resize(1060, 660)
        application.processEvents()
        window.grab().save(str(output / "04-compact.png"))
        confirm = ConfirmationDialog(
            window,
            ConfirmationSnapshot(27, 14, 1024**3, "permanent", "preview"),
            "整理位置：D:/待整理下載\n保護子資料夾：D:/待整理下載/珍藏原檔",
            second=True,
        )
        confirm.show()
        application.processEvents()
        confirm.grab().save(str(output / "05-confirm.png"))
        confirm.reject()
        outcomes = tuple(ActionOutcome(group.records[1], "trashed") for group in report.groups)
        window._accept_cleanup(
            CleanupResult(ActionReport("local", outcomes), None, output / "synthetic.csv")
        )
        application.processEvents()
        window.grab().save(str(output / "06-complete.png"))
        window._show_page("drive")
        application.processEvents()
        window.grab().save(str(output / "07-account.png"))
        window.close()
        application.processEvents()
    print(f"Native UI previews: {output}")


if __name__ == "__main__":
    main()
