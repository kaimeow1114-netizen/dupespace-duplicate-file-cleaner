export type BlogLocale = "zh-TW" | "en";

export type BlogSection = {
  title: string;
  paragraphs: string[];
  checklist?: string[];
};

export type BlogArticle = {
  slug: string;
  category: string;
  kicker: string;
  title: string;
  description: string;
  published: string;
  updated: string;
  readMinutes: number;
  featured?: boolean;
  sections: BlogSection[];
  relatedTool?: "merge" | "local" | "download";
};

export const blogArticles: Record<BlogLocale, BlogArticle[]> = {
  "zh-TW": [
    {
      slug: "find-renamed-duplicate-files",
      category: "檔案與儲存",
      kicker: "FILE IDENTITY",
      title: "檔案改名後還是同一份嗎？用內容比對找出真正重複檔案",
      description: "檔名只能描述檔案，不能證明內容。了解大小、抽樣與完整內容指紋的差異，以及為什麼找到相同內容後仍不能直接刪除。",
      published: "2026-09-04",
      updated: "2026-09-10",
      readMinutes: 7,
      featured: true,
      relatedTool: "merge",
      sections: [
        { title: "檔名不是檔案身分證", paragraphs: ["把照片從手機匯出、下載通訊軟體附件，或把專案複製到新資料夾後，同一份內容可能出現完全不同的名稱。只按檔名搜尋，會漏掉這些改名副本；只看名稱相同，也可能把兩個不同版本誤認成同一份。", "比較工具應先把名稱當作線索，而不是結論。真正要回答的是：兩個位置所保存的位元內容是否完全一致，以及它們在各自資料夾中是否仍有用途。"] },
        { title: "從容量篩選到完整內容確認", paragraphs: ["實務上不需要一開始就讀取所有檔案的全部內容。先按容量分組，可以快速排除不可能相同的檔案；接著讀取少量內容作為候選篩選，最後只對可能相同的檔案進行完整內容比對。", "這種分階段流程可以減少磁碟讀取，但最後的判定仍必須依完整內容。兩個檔案大小相同、開頭和結尾相同，中間仍可能不同；抽樣適合加速，不能取代最終驗證。"] },
        { title: "內容相同，也不代表其中一份沒有用途", paragraphs: ["不同程式碼專案可能各自需要一份相同設定檔，兩個備份世代也可能刻意保存相同內容。若工具只因內容一致就自動移除其中一份，原本獨立的資料夾可能因此失去完整性。", "安全流程應先辨識專案、應用程式、同步與備份情境，再讓使用者查看完整路徑。內容指紋只能證明內容相同，無法證明另一個路徑不再被使用。"], checklist: ["先確認資料夾用途", "保護專案、同步與備份位置", "每個群組至少保留一份", "刪除前再次確認檔案沒有變更"] },
        { title: "合併資料夾時，還要分辨同名衝突", paragraphs: ["把兩個資料夾合併時，最危險的情況不是重複，而是相同相對路徑下存在不同內容。作業系統通常只會詢問是否覆蓋，卻不會解釋兩份檔案的關係。", "先建立左右核對結果，可以把改名後的相同內容、只存在單側的檔案，以及同路徑不同版本分開。看清楚關係後再複製，比事後從回收筒或備份中猜測安全得多。"] },
      ],
    },
    {
      slug: "cloud-sync-is-not-backup",
      category: "備份與同步",
      kicker: "BACKUP BASICS",
      title: "雲端同步不是備份：刪除檔案前先確認的五件事",
      description: "同步服務會快速複製變更，也可能同步刪除。從版本紀錄、離線副本、共用權限到還原演練，建立真正可復原的檔案策略。",
      published: "2026-09-04",
      updated: "2026-09-10",
      readMinutes: 8,
      sections: [
        { title: "同步解決一致性，備份解決復原", paragraphs: ["同步工具的主要工作，是讓多台裝置看到接近一致的檔案狀態。你在一端重新命名、修改或刪除，變更通常會傳到其他裝置。這很方便，卻不等於保留了一份不受影響的歷史副本。", "備份的核心則是能在誤刪、損壞、勒索軟體或帳號問題發生後，從另一個時間點還原。同步資料夾可以是備份來源，但不應是唯一備份。"] },
        { title: "先查版本與垃圾桶的保留規則", paragraphs: ["不同服務、帳號方案與組織政策，可能有不同的版本保留時間和垃圾桶規則。不要把介面上看得到的版本紀錄，直接當成永久保存承諾。", "整理前應先確認能否還原單一檔案、整個資料夾與大量刪除，並記錄保留期限。如果檔案很重要，先做一次小規模還原測試，而不是等事故發生才第一次使用復原功能。"] },
        { title: "辨識線上檔案、離線副本與捷徑", paragraphs: ["節省空間模式可能只在本機保存檔名與預覽，真正內容需要使用時才下載。掃描工具若為了計算內容而觸發大量下載，可能突然占用頻寬與磁碟空間。", "捷徑也不是獨立副本。刪除捷徑和刪除目標檔案的結果不同；共用資料夾中的項目還可能牽涉其他人的工作流程。整理前先辨識物件類型與擁有者。"], checklist: ["確認檔案是否完整下載", "分清捷徑與真正副本", "檢查擁有者與共用成員", "避免在同步進行中大量整理"] },
        { title: "採用至少兩種不同故障來源的副本", paragraphs: ["實用的備份策略不只計算副本數量，也要考慮副本是否會一起失效。放在同一帳號、同一同步資料夾或長期連接同一台電腦的副本，可能受到同一個錯誤影響。", "可以保留一份日常同步資料，再加上一份具有版本歷史或離線特性的備份。完成後定期抽查還原，確認備份不是只有檔案數量看起來正確。"] },
      ],
    },
    {
      slug: "how-to-choose-a-file-cleaner",
      category: "工具實測方法",
      kicker: "BUYER'S CHECKLIST",
      title: "檔案清理工具怎麼選？先看這六個安全條件",
      description: "速度與可清容量很醒目，但真正重要的是掃描邊界、保留規則、可復原處理、執行前複驗、隱私與稽核紀錄。",
      published: "2026-09-04",
      updated: "2026-09-10",
      readMinutes: 9,
      relatedTool: "download",
      sections: [
        { title: "一、掃描範圍必須由使用者看得見", paragraphs: ["好的工具會清楚列出目前掃描位置，並拒絕系統、程式與其他高風險目錄。若畫面只顯示正在掃描，卻不說明目前處理哪個資料夾，使用者很難判斷它是否越界。", "第一次使用時，應能從一個用途明確的資料夾開始。掃描整顆磁碟並不代表更完整，反而會混合專案、備份、應用程式與個人檔案等不同情境。"] },
        { title: "二、保留規則要明確，而且無法被批次選取覆蓋", paragraphs: ["每個重複群組至少要有一份不可刪除的保留檔案。使用者按下全選時，保留狀態仍然必須有效；切換到永久刪除等高風險模式時，原先的自動選取也應清空。", "建立時間較早或路徑較短只能作為建議，不是原檔證明。資料夾用途與使用者設定的保護規則，應永遠優先於時間排序。"] },
        { title: "三到五、可復原、重新驗證與完整紀錄", paragraphs: ["預設處理方式應該是移至資源回收筒，而不是永久刪除。更重要的是，回收筒操作失敗時不能偷偷改成永久刪除；兩條執行路徑必須分開。", "掃描與執行之間可能隔了幾分鐘。工具需要在操作前重新檢查路徑、大小、時間與內容狀態，遇到變更就跳過。每筆成功、失敗與原因也應寫入可複查的報告。"], checklist: ["垃圾桶是預設選項", "永久刪除需要獨立警告", "檔案變更時停止處理", "每筆結果都有稽核紀錄"] },
        { title: "六、隱私說明要能從技術上驗證", paragraphs: ["如果工具宣稱在本機分析，應清楚說明哪些資料會離開裝置、是否載入第三方程式，以及網頁是否具備寫入權限。模糊的安全口號不能取代實際邊界。", "開放原始碼有助於檢查主張，但不會自動保證安全。仍要看實際版本、建置來源、更新機制與權限設計。選工具時，先用可捨棄的測試資料驗證整個流程。"] },
      ],
    },
  ],
  en: [
    {
      slug: "find-renamed-duplicate-files",
      category: "Files and storage",
      kicker: "FILE IDENTITY",
      title: "Are renamed files still duplicates? Compare content, not filenames",
      description: "A filename describes a file but cannot prove its identity. Learn how size, sampling and complete content fingerprints differ, and why a match is not permission to delete.",
      published: "2026-09-04",
      updated: "2026-09-10",
      readMinutes: 7,
      featured: true,
      relatedTool: "merge",
      sections: [
        { title: "A filename is not a file identity", paragraphs: ["Phone exports, downloaded attachments and copied project folders can leave identical content under completely different names. Searching by filename misses those copies, while matching names can conceal two genuinely different versions.", "A comparison tool should treat names as clues rather than conclusions. The useful questions are whether the bytes match and whether each location still serves a purpose."] },
        { title: "From size filtering to complete verification", paragraphs: ["A tool does not need to read every byte immediately. Grouping by size removes impossible matches, and a small sample can narrow the candidate set before complete content comparison.", "The final decision still requires complete verification. Two files can share a size, beginning and ending while differing in the middle. Sampling is an accelerator, not proof."] },
        { title: "Identical content can still serve different purposes", paragraphs: ["Separate software projects may each require an identical configuration file, and multiple backup generations may intentionally contain the same item. Removing one copy solely because its bytes match can make an otherwise independent folder incomplete.", "A safe workflow identifies project, application, sync and backup contexts before showing complete paths for review. A fingerprint proves equal content; it cannot prove another path is unused."], checklist: ["Confirm the purpose of each folder", "Protect project, sync and backup locations", "Keep at least one item in every group", "Revalidate files immediately before an action"] },
        { title: "Folder merges also need same-path conflict detection", paragraphs: ["The most dangerous merge case is not duplication but different content at the same relative path. An operating system may ask whether to overwrite without explaining how the two versions relate.", "A side-by-side map can separate renamed matches, one-sided files and same-path version conflicts. Understanding those relationships before copying is safer than reconstructing them afterward."] },
      ],
    },
    {
      slug: "cloud-sync-is-not-backup",
      category: "Backup and sync",
      kicker: "BACKUP BASICS",
      title: "Cloud sync is not a backup: five checks before deleting files",
      description: "Sync copies changes quickly, including deletions. Build a recoverable file strategy around version history, offline copies, shared permissions and restore tests.",
      published: "2026-09-04",
      updated: "2026-09-10",
      readMinutes: 8,
      sections: [
        { title: "Sync solves consistency; backup solves recovery", paragraphs: ["A sync service keeps files on several devices in a similar state. Renames, edits and deletions usually propagate, which is convenient but does not create an independent historical copy.", "A backup is designed to recover from accidental deletion, corruption, ransomware or account problems. A synced folder can be a source for backup, but it should not be the only backup."] },
        { title: "Check version and trash retention rules", paragraphs: ["Retention varies by service, account plan and organization policy. A visible version-history interface should not be treated as a promise of permanent retention.", "Before cleanup, confirm whether you can restore one file, an entire folder and a large batch. Record the retention window and test a small restore before an incident forces you to use it for the first time."] },
        { title: "Recognize online-only files, local copies and shortcuts", paragraphs: ["Space-saving modes may store only names and previews locally. A scanner that needs complete content can trigger large downloads, unexpectedly consuming bandwidth and disk capacity.", "A shortcut is not an independent copy, and a shared folder may affect another person's workflow. Identify the object type and owner before reorganizing it."], checklist: ["Confirm that content is available offline", "Separate shortcuts from real copies", "Check ownership and collaborators", "Avoid bulk cleanup while sync is active"] },
        { title: "Keep copies with different failure modes", paragraphs: ["Copy count alone is not enough. Copies in the same account, sync folder or permanently connected device can fail together.", "Keep a convenient synchronized set and another backup with version history or offline isolation. Test restores periodically so the backup is more than a reassuring file count."] },
      ],
    },
    {
      slug: "how-to-choose-a-file-cleaner",
      category: "Tool evaluation",
      kicker: "BUYER'S CHECKLIST",
      title: "How to choose a file cleaner: six safety requirements",
      description: "Speed and reclaimed capacity attract attention. Scan boundaries, keeper rules, recoverability, last-moment validation, privacy and audit records determine whether cleanup is trustworthy.",
      published: "2026-09-04",
      updated: "2026-09-10",
      readMinutes: 9,
      relatedTool: "download",
      sections: [
        { title: "1. The scan boundary must be visible", paragraphs: ["A good tool shows the current scan locations and refuses system, application and other high-risk directories. A generic scanning message does not let the user recognize when scope has expanded unexpectedly.", "Start with one folder whose purpose is clear. Scanning an entire drive mixes personal data with projects, backups and application resources; wider is not automatically safer or more complete."] },
        { title: "2. Keeper rules must survive bulk selection", paragraphs: ["Every duplicate group needs at least one protected item that bulk selection cannot override. Switching to an irreversible mode should also clear automatic selections.", "An earlier creation time or shorter path can be a suggestion, not proof of origin. Folder purpose and explicit protection rules must take priority over timestamp ordering."] },
        { title: "3–5. Recovery, revalidation and complete records", paragraphs: ["The default action should use the Recycle Bin. A failed trash operation must never silently fall back to permanent deletion; the two execution paths need separate consent and code paths.", "Files can change between scanning and action. Recheck path, size, time and content state immediately beforehand, skip changed items, and record every success or failure with its reason."], checklist: ["Recycle Bin is the default", "Permanent deletion has a separate warning", "Changed files are skipped", "Every result has an audit record"] },
        { title: "6. Privacy claims need technical boundaries", paragraphs: ["A local-analysis claim should explain what leaves the device, whether third-party scripts load and whether the page has write access. A broad security slogan is not a substitute for a verifiable boundary.", "Open source makes inspection possible but does not automatically guarantee safety. Check the exact release, build source, updater and permissions, then test the complete workflow with disposable data."] },
      ],
    },
  ],
};

export function findBlogArticle(slug: string, locale: BlogLocale): BlogArticle | undefined {
  return blogArticles[locale].find((article) => article.slug === slug);
}
