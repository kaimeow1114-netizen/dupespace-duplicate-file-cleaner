# DUPESPACE v1.6.0 — 本機優先，免帳號整理

這次更新將 DUPESPACE 的重心轉向 Windows 安心清理與瀏覽器本機檔案分析。

## 重要變更

- **停止 Google Drive 登入、掃描與清理。** 新版桌面程式不再包含 Google OAuth 用戶端或 Drive SDK，也不會在啟動時嘗試登入。網站的舊雲端檔案 API 已停用。
- **Windows 清理仍可使用，無需帳號。** 保留受保護檔案、執行前複驗、分批處理與 CSV 稽核報告。
- **網頁提供免上傳的唯讀分析。** 選取資料夾即可比對精確重複內容；網頁不取得寫入或刪除權限。結果只是整理線索，不代表每個副本都沒有用途。
- 舊版已安裝程式必須更新後才會套用這些變更；舊 Google 授權也可由使用者在 Google 帳戶的第三方存取權設定中撤銷。

## 操作與網站

- 簡化桌面側邊欄與資料夾選擇文案，移除不再適用的帳號操作。
- 保留首頁滿版青綠品牌風格與動畫。
- 新增繁體中文與英文的重複照片、安全整理指南，補齊對應語言切換與搜尋引擎資訊。
- 瀏覽器分析使用大小篩選、片段預篩及完整內容的分塊 SHA-256 指紋；限制讀取與預覽負載，支援停止及分頁結果。

## 安全提醒

預設移至 Windows 資源回收筒。永久刪除仍是獨立高風險選項，無法復原；回收筒失敗不會自動改成永久刪除。移至回收筒不代表已立即釋放磁碟空間。

請勿僅因內容相同就清理不同專案、備份或應用程式需要的副本。保護規則降低風險，但無法替使用者判斷所有檔案用途。

## 驗證

- 網頁 TypeScript、lint、正式 build 與 39 項測試通過。
- Windows CI：177 項測試通過、1 項預設略過；另行啟用的實際回收筒測試通過。
- 打包程式啟動、v0.6.0 原地升級、桌面捷徑、解除安裝後保留設定及報告皆通過。
- 安裝檔附 `SHA256SUMS.txt`，下載後可驗證完整性。

## English

DUPESPACE is now local-first. Version 1.6.0 retires Google Drive sign-in and cleanup. Windows file cleanup remains available without an account, while the website offers private, read-only analysis of files you explicitly select. File contents are not uploaded by the analyzer, and it has no deletion permission.

This release retains the teal visual identity and motion, adds bilingual practical guides, and improves the local desktop experience. Browser results are paginated with bounded file reads and previews. Identical content does not mean a copy is unnecessary: always review projects, backups and file paths before cleanup.

Windows defaults to the Recycle Bin. Permanent deletion is a separate, irreversible action and is never a fallback for a failed recycle operation. Existing installations need to update; old Google access can also be revoked in the user's Google Account settings.

## Links

- [DUPESPACE](https://dupespace.app/)
- [Browser analysis](https://dupespace.app/en/local/)
- [Windows download and instructions](https://dupespace.app/download)
