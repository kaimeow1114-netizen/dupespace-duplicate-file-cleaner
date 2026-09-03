from __future__ import annotations

import os
import sys
from contextlib import ExitStack
from tempfile import TemporaryDirectory


def main() -> None:
    import multiprocessing

    multiprocessing.freeze_support()

    from PySide6.QtCore import QTimer
    from PySide6.QtGui import QFont
    from PySide6.QtWidgets import QApplication

    from .desktop.window import MainWindow

    if "--revoke-and-clean" in sys.argv[1:]:
        from .retirement import revoke_legacy_tokens

        if not revoke_legacy_tokens():
            sys.exit(1)
        return
    smoke_test = "--smoke-test" in sys.argv[1:]
    with ExitStack() as stack:
        if smoke_test:
            temporary = stack.enter_context(TemporaryDirectory(prefix="dupespace-smoke-"))
            os.environ["LOCALAPPDATA"] = temporary
            os.environ["QT_QPA_PLATFORM"] = "offscreen"
        application = QApplication(sys.argv)
        application.setApplicationName("DUPESPACE")
        application.setOrganizationName("DUPESPACE")
        application.setFont(
            QFont("Microsoft JhengHei UI" if sys.platform == "win32" else "sans-serif", 10)
        )
        window = MainWindow(restore_session=not smoke_test)
        window.show()
        if smoke_test:
            QTimer.singleShot(250, application.quit)
        result = application.exec()
    sys.exit(result)


if __name__ == "__main__":
    main()
