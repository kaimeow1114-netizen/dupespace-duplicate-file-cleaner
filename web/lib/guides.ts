export type GuideSection = { title: string; paragraphs: string[] };
export type Guide = { slug: string; title: string; description: string; sections: GuideSection[] };

export const guides: Record<"zh-TW" | "en", Guide[]> = {
  "zh-TW": [
    {
      slug: "duplicate-photos", title: "如何找出重複照片？先分清完全相同與相似照片",
      description: "照片看起來一樣，檔案內容卻可能不同。了解精確重複搜尋、壓縮與中繼資料差異，先在瀏覽器零上傳比對，再安全整理相簿。",
      sections: [
        { title: "同一張照片，不一定是同一個檔案", paragraphs: ["手機匯出、通訊軟體下載與手動備份，很容易讓相簿裡多出幾份照片。檔名不同仍可能內容完全相同；反過來說，兩張縮圖看起來一樣，也可能有不同解析度、拍攝資訊或壓縮品質。", "DUPESPACE 目前搜尋的是內容完全相同的檔案，不會把連拍、裁切版或相似畫面當作可刪除副本。它也不會替你判斷哪張照片最好看。"] },
        { title: "先用不修改檔案的方式檢查", paragraphs: ["開啟本機分析，選擇一個照片資料夾。資料只在自己的瀏覽器中處理，不需登入或上傳；分析會先比對大小，再檢查候選檔案的完整內容指紋。大照片與大型相簿需要實際讀取資料，因此速度也受裝置與儲存媒體影響。", "結果每組只顯示一張代表性圖片，搭配副本名稱與相對路徑。部分格式只會出現類型圖示，這不影響內容比對。參考檔案依瀏覽器可取得的修改時間與路徑排序，不代表已證實那一份是最初拍攝的原檔。"] },
        { title: "整理前，確認每份副本的用途", paragraphs: ["一份照片可能屬於日常相簿，另一份是刻意保存的備份。即使內容完全相同，也可能兩份都需要。請先看所在資料夾，保留備份，再決定是否整理其他副本。", "網頁版只產生報告。需要實際整理時，使用 Windows 版選擇相同資料夾，設定要保護的工作子資料夾，重新掃描與核對後再處理。CSV 是複查紀錄，不會被當作免驗證的刪除指令。"] },
        { title: "先進資源回收筒，不急著清空", paragraphs: ["先用少量副本確認流程與結果。移至資源回收筒不一定立即增加可用空間；請確認重要照片仍在、相簿也能正常開啟，再自行決定是否清空。永久刪除沒有復原保證，不適合拿來試用工具。"] },
      ],
    },
    {
      slug: "safe-windows-cleanup", title: "Windows 重複檔案怎麼清？不誤刪專案與備份的整理順序",
      description: "重複不等於多餘。從選擇掃描資料夾、保護工作檔案到檢查 CSV，了解 Windows 重複檔案清理與系統暫存清理的差別。",
      sections: [
        { title: "重複檔案與系統垃圾，是兩件事", paragraphs: ["重複檔案搜尋找的是相同內容；系統清理則處理由 Windows 管理的暫存檔、更新資源或不再需要的應用程式。DUPESPACE 不推測哪些 Windows 系統檔可以刪除，也不提供登錄檔清理。", "若目的是整理系統暫存，請使用 Windows 設定中的儲存體、清理建議或儲存空間感知，並逐項查看內容。若目的是整理重複下載、照片或影片，才開始比對個人資料夾。"] },
        { title: "從明確的一個資料夾開始", paragraphs: ["不要第一次就把整個磁碟當成清理目標。先選擇用途清楚的下載資料夾、照片匯入目錄或手動複製的資料。DUPESPACE 遞迴掃描你加入的位置，不會主動擴大到整台電腦。", "需要保留的工作資料夾可以設為保護子資料夾。Windows 版先套用保護規則，再依可判定的建立時間與路徑提出保留建議；建立時間也可能因複製或還原而改變，仍須由你核對用途。"] },
        { title: "專案、套件與備份不能只看重複", paragraphs: ["不同程式碼專案可能各自需要同一份設定檔、外掛或依賴套件。工具會排除辨識到的專案與套件環境，但不可能知道每個自訂程式的所有相依關係。不要因為檔案內容相同，就假設另一個位置不再需要。", "同步資料夾與備份也有類似風險。刪除同步位置的檔案可能由同步軟體傳播到其他裝置；NAS 或網路磁碟未必提供 Windows 資源回收筒。確認儲存位置的行為與備份策略，再考慮整理。"] },
        { title: "核對、少量測試，再批次處理", paragraphs: ["先檢查群組的檔名、完整路徑、預覽與保留標記。使用少量測試資料驗證操作，再處理更大的批次。整理期間避免其他程式修改目標資料夾，因為變更會使原先的掃描結果失效。", "預設使用資源回收筒。若操作失敗或檔案已變更，DUPESPACE 會記錄結果，不會把垃圾桶失敗自動轉為永久刪除。完成後查看 CSV 的各筆狀態，不要只看總容量。CSV 可能含私人路徑，公開回報前請先遮蔽。"] },
      ],
    },
  ],
  en: [
    {
      slug: "duplicate-photos", title: "How to find duplicate photos: exact matches vs similar images",
      description: "Learn why identical-looking photos may be different files. Compare exact duplicates locally without uploading, review paths and organize copies without risking your backup.",
      sections: [
        { title: "The same photograph can be a different file", paragraphs: ["Phone exports, messaging downloads and manual backups can leave several versions of a photograph. Different filenames can contain identical bytes. Conversely, matching thumbnails may hide differences in resolution, capture metadata or compression quality.", "DUPESPACE currently finds exact content matches. It does not label burst shots, crops or similar-looking images as disposable duplicates, and it does not choose the best-looking photograph for you."] },
        { title: "Start with a read-only comparison", paragraphs: ["Open the local analyzer and choose a photo folder. Your browser processes the files without an account or upload. Size filtering narrows the candidates before full-content fingerprint comparison. Large files must still be read, so processing time depends on the device and storage medium.", "Results use one representative image per group, with duplicate names and relative paths. Some formats show a type icon rather than a preview; this does not prevent content comparison. Reference order uses modification time and path, not a verified original creation date."] },
        { title: "Review the purpose of every copy", paragraphs: ["One photo may belong to your working album and another to an intentional backup. Both can be necessary even when their contents match. Check each folder’s purpose before deciding what to remove.", "The browser creates a report only. For actual cleanup, select the same folder in the Windows app, protect important working subfolders, then scan and review again. A CSV is an audit aid, not an instruction to delete files without revalidation."] },
        { title: "Use the Recycle Bin before making an irreversible decision", paragraphs: ["Test the workflow with a few expendable copies first. Moving files to the Recycle Bin does not necessarily free disk space immediately. Check your retained photographs and albums before deciding whether to empty it. Permanent deletion is not a suitable way to try out a cleanup tool."] },
      ],
    },
    {
      slug: "safe-windows-cleanup", title: "How to clean duplicate files on Windows without breaking projects",
      description: "Duplicate does not mean unnecessary. Learn a safe Windows cleanup workflow: choose folders, protect projects and backups, review copies and check the audit report.",
      sections: [
        { title: "Duplicate files and system junk are different problems", paragraphs: ["Duplicate detection compares file content. System cleanup deals with Windows-managed temporary data, update resources or unused applications. DUPESPACE does not guess which operating-system files can be removed and does not clean the registry.", "For temporary system files, use Windows Storage settings, Cleanup recommendations or Storage Sense and review each category. Use duplicate analysis for personal folders containing repeated downloads, photos or videos."] },
        { title: "Begin with one clearly defined folder", paragraphs: ["Do not start by treating an entire drive as a cleanup target. Choose a download folder, photo import directory or manual copy whose purpose you understand. DUPESPACE recursively scans the locations you add; it does not expand the task to the whole computer.", "Protect important working subfolders. Windows protection rules take priority, followed by usable creation times and path-based keeper suggestions. Copying or restoring a file can change its timestamps, so you still need to verify its purpose."] },
        { title: "Projects and backups can need identical copies", paragraphs: ["Separate software projects may each require identical configuration files, plug-ins or dependencies. Detected projects and package environments are excluded, but rules cannot identify every dependency of a custom application. Matching content alone does not make another location unnecessary.", "Backups and synchronized folders need similar care. A sync client may propagate a deletion to other devices, and NAS or network storage may not provide the Windows Recycle Bin. Understand the storage behavior and your backup plan before cleanup."] },
        { title: "Review, test a small batch, then continue", paragraphs: ["Check names, full paths, previews and protected-copy markers. Validate the workflow with disposable test data before processing larger batches. Avoid modifying the target folders from other applications while cleanup runs: changes invalidate scan results.", "Use the Recycle Bin by default. Failed or changed files are recorded rather than forcibly removed, and trash failures never become permanent deletion. Read each CSV outcome instead of relying only on a capacity total. Reports can contain private paths; redact them before posting a support request."] },
      ],
    },
  ],
};

export function findGuide(slug: string, locale: "zh-TW" | "en") {
  return guides[locale].find((guide) => guide.slug === slug);
}
