export type SolutionLocale = "zh-TW" | "en";

export type SolutionSection = {
  title: string;
  paragraphs: string[];
  checklist?: string[];
};

export type Solution = {
  slug: string;
  kicker: string;
  title: string;
  description: string;
  answer: string;
  suitable: string[];
  avoid: string[];
  scenario: {
    title: string;
    introduction: string;
    steps: Array<{ label: string; detail: string }>;
  };
  sections: SolutionSection[];
  faq: Array<{ question: string; answer: string }>;
};

export const solutions: Record<SolutionLocale, Solution[]> = {
  "zh-TW": [
    {
      slug: "photo-library-cleanup",
      kicker: "PHOTO LIBRARY CLEANUP",
      title: "照片散落好幾個資料夾？先找出完全相同的副本",
      description: "整理手機匯入、通訊軟體下載與備份照片前，先分清完全相同、看起來相似和刻意保留的備份。DUPESPACE 在本機比對內容，不會只靠檔名猜測。",
      answer: "先把照片集中複製到同一處，往往會製造更多副本。比較穩妥的做法，是先確認哪些檔案內容完全相同、它們分別位於哪裡，再決定是否需要整理。",
      suitable: [
        "同一批照片曾從手機或相機匯入不只一次",
        "照片改過名稱，無法再用檔名判斷是否相同",
        "通訊軟體、下載資料夾和相簿之間出現重複副本",
        "想在合併兩個照片資料夾前先看清楚差異",
      ],
      avoid: [
        "想找構圖相近、連拍或同一張照片的裁切版本",
        "想自動挑出最好看、最高畫質或最值得保留的照片",
        "唯一的備份尚未完成或還沒有測試過還原",
        "照片仍在同步、匯入或編輯中",
      ],
      scenario: {
        title: "範例：手機照片、聊天下載與手動備份混在一起",
        introduction: "假設「手機匯入」有 1,200 張照片，「聊天下載」有 180 張，「旅行備份」有 1,050 張。檔名不同，不代表內容不同；縮圖看起來一樣，也不代表檔案完全相同。",
        steps: [
          { label: "完全相同", detail: "內容逐位元一致，只是檔名或所在資料夾不同。列為重複候選，但仍需確認每個位置的用途。" },
          { label: "看起來相似", detail: "可能是裁切、壓縮、調色或不同解析度。DUPESPACE 不會把這類照片當成完全重複。" },
          { label: "刻意備份", detail: "即使內容相同，位於獨立備份位置的副本也可能需要保留，不能只因雜湊相同就移除。" },
          { label: "只在單側", detail: "合併資料夾時，這些才是可能需要補進另一側的新內容。" },
        ],
      },
      sections: [
        {
          title: "先選對工具：一個資料夾找重複，兩個資料夾先核對",
          paragraphs: [
            "如果照片已經集中在同一個資料夾，使用線上重複檔案搜尋即可建立唯讀報告。檔案會留在你的裝置，瀏覽器只讀取你主動選擇的資料夾。",
            "如果照片分散在舊相簿、新相簿或外接硬碟，先使用兩個資料夾核對。結果會分開顯示改名後仍相同的內容、只存在一側的照片，以及相同路徑但內容不同的版本衝突。",
          ],
          checklist: ["單一資料夾：找完全相同的副本", "兩個資料夾：合併前先看差異", "需要實際整理：改用 Windows 版重新驗證"],
        },
        {
          title: "為什麼不能只看縮圖或檔名？",
          paragraphs: [
            "手機可能產生 IMG_2048.JPG，聊天軟體下載後卻變成一串編號；兩個名稱完全不同，內容仍可能相同。反過來說，兩張縮圖看起來一樣，實際上可能有不同解析度、拍攝資訊或壓縮品質。",
            "DUPESPACE 先利用容量縮小候選範圍，再完整確認檔案內容。縮圖只協助你辨認照片，不參與是否重複的最終判定。",
          ],
        },
        {
          title: "真正整理之前，先回答三個問題",
          paragraphs: [
            "第一，這份照片是否位於工作相簿、分享資料夾或離線備份？第二，其他應用程式是否依賴目前路徑？第三，若整理結果不符合預期，是否有一份已測試可還原的備份？",
            "內容完全相同只能證明兩份檔案的資料一致，不能證明其中一個位置已經沒有用途。Windows 版預設移至資源回收筒，仍應先用少量、可捨棄的測試資料確認完整流程。",
          ],
          checklist: ["先看完整路徑", "確認備份與同步狀態", "每組至少保留一份", "先處理少量副本並複查結果"],
        },
        {
          title: "目前能做什麼，以及刻意不替你做什麼",
          paragraphs: [
            "DUPESPACE 尋找內容完全相同的照片，可處理改名或搬動過的副本。部分 RAW、HEIC 或影片格式可能只顯示檔案類型，不一定能顯示縮圖；這不影響內容比對。",
            "目前不提供相似照片搜尋、人臉辨識、畫質評分或自動挑選最佳照片。這些功能需要不同的影像判斷，也不應與『完全相同』混成一個可直接清理的結果。",
          ],
        },
      ],
      faq: [
        { question: "照片會上傳到 DUPESPACE 嗎？", answer: "不會。線上分析在目前的瀏覽器分頁中執行，檔案內容、名稱、路徑與結果不會上傳到 DUPESPACE。" },
        { question: "可以找出內容相同但名稱不同的照片嗎？", answer: "可以。最終判定依完整內容，不依賴檔名；但內容相同仍只代表重複候選，不代表另一個位置一定可以移除。" },
        { question: "為什麼有些照片沒有縮圖？", answer: "瀏覽器不一定能解碼 RAW、HEIC 或部分影音格式。這只影響預覽，不影響完整內容比對。" },
        { question: "可以直接在網頁刪除照片嗎？", answer: "不可以。網頁版是唯讀分析工具。需要整理時，可在 Windows 版重新選擇位置、複驗檔案狀態後移至資源回收筒。" },
      ],
    },
    {
      slug: "downloads-folder-cleanup",
      kicker: "DOWNLOADS FOLDER CLEANUP",
      title: "下載資料夾太亂？先分清副本、安裝檔與仍在使用的文件",
      description: "從重複下載、改名附件到舊安裝檔，建立不靠猜測的下載資料夾整理流程。先在瀏覽器找出內容相同的候選，再決定哪些應保留。",
      answer: "下載資料夾不只裝著垃圾。裡面可能有報稅文件、安裝程式、壓縮包與尚未分類的工作檔案；先按用途分類，再找出內容完全相同的副本，比一次全選清理更可靠。",
      suitable: [
        "同一份附件或安裝程式曾下載多次",
        "瀏覽器在檔名後加入 (1)、(2) 或 copy",
        "想先找出占空間最大的完全相同副本",
        "整理前需要一份可匯出的唯讀結果",
      ],
      avoid: [
        "想清除 Windows 更新、快取或系統暫存檔",
        "下載仍在進行，或檔案正被同步與解壓縮",
        "不了解壓縮檔、安裝程式或工作文件的用途",
        "打算把內容相同的專案檔案一律視為多餘",
      ],
      scenario: {
        title: "範例：同一份內容，出現四種不同用途",
        introduction: "下載資料夾裡的重複，不一定都能用同一種方式處理。先辨認檔案為什麼出現在這裡，才知道下一步。",
        steps: [
          { label: "重複下載", detail: "report.pdf、report (1).pdf 的內容完全相同，而且都只是臨時下載，通常可以先保留一份再整理。" },
          { label: "安裝程式", detail: "相同版本的安裝檔可能重複；不同版本即使名稱相近也不是相同內容。先確認是否仍需要離線安裝。" },
          { label: "壓縮包與解壓內容", detail: "ZIP 與解壓後的資料夾不是重複檔案。要不要保留壓縮包取決於日後是否需要重新解壓或傳送。" },
          { label: "工作與專案檔", detail: "相同範本、設定或附件可能分屬不同工作。即使內容相同，也不能忽略路徑與用途。" },
        ],
      },
      sections: [
        {
          title: "第一步不是刪除，而是停止繼續增加混亂",
          paragraphs: [
            "先暫停仍在下載、同步或解壓縮的工作，再把目前需要使用的文件移到用途清楚的資料夾。掃描期間檔案若被修改，結果應作廢，而不是勉強沿用舊狀態。",
            "不要一開始就掃描整顆磁碟。從下載資料夾這種邊界明確的位置開始，較容易看懂結果，也能避免把程式、備份與個人檔案混在同一份清理清單。",
          ],
        },
        {
          title: "用內容找重複，不被 (1) 和 copy 誤導",
          paragraphs: [
            "瀏覽器為避免覆蓋，常在重複下載的檔名後加上數字。這是很好的線索，卻不是證據；名稱相似的兩份文件仍可能是不同修訂版本。",
            "線上分析會先快速找出可能相同的檔案，再完整確認內容。報告中的『比對基準』只是群組中的參考項目，不代表已證實那一份是原始檔。",
          ],
          checklist: ["查看完整路徑與容量", "先處理完全相同的內容", "名稱相同但內容不同時分開保留", "小於 1 MiB 的檔案仍要看用途"],
        },
        {
          title: "哪些項目需要特別保守？",
          paragraphs: [
            "憑證、報稅資料、合約、設計原稿與未完成的工作文件，不應只因另一處存在相同內容就自動處理。壓縮包也可能是交付版本或唯一保留原始目錄結構的副本。",
            "程式碼專案、套件與虛擬環境可能在不同資料夾中保存相同依賴。DUPESPACE Windows 版會排除已辨識的專案情境，但無法推斷每個自訂程式的全部依賴；使用者指定的保護資料夾永遠優先。",
          ],
        },
        {
          title: "完成分析後，怎麼把結果變成可複查的整理？",
          paragraphs: [
            "先匯出報告，從容量較大且用途最清楚的群組開始。網頁不會移動任何檔案；若使用 Windows 版，請重新選擇同一位置，確認保護規則，再以資源回收筒模式處理少量副本。",
            "整理完成後不要急著清空資源回收筒。先打開保留的文件、重新啟動依賴這些檔案的工作流程，再查看 CSV 中每一筆成功、跳過與失敗原因。",
          ],
          checklist: ["先匯出唯讀結果", "從大容量、低風險群組開始", "預設移至資源回收筒", "確認工作正常後再決定是否清空"],
        },
      ],
      faq: [
        { question: "DUPESPACE 會清除 Windows 暫存檔嗎？", answer: "不會。DUPESPACE 處理使用者選擇位置中的完全相同檔案；Windows 系統暫存與更新檔應使用系統內建的儲存空間感知或清理建議。" },
        { question: "名稱後面有 (1) 的檔案一定能移除嗎？", answer: "不一定。(1) 只表示下載時發生名稱衝突，內容可能相同，也可能是新版文件。仍需完整比對並查看用途。" },
        { question: "壓縮檔和解壓後的資料夾會被判定為重複嗎？", answer: "不會。ZIP 與解壓後的檔案具有不同位元內容與目錄結構，不是完全相同的檔案。" },
        { question: "網頁分析後能直接釋放空間嗎？", answer: "不能。網頁只建立唯讀報告。需要實際整理時，請使用 Windows 版重新驗證候選檔案並移至資源回收筒。" },
      ],
    },
  ],
  en: [
    {
      slug: "photo-library-cleanup",
      kicker: "PHOTO LIBRARY CLEANUP",
      title: "Photos scattered across folders? Find exact copies before reorganizing",
      description: "Separate exact copies from similar images and intentional backups before cleaning phone imports, messaging downloads and photo archives. DUPESPACE compares content locally instead of guessing from filenames.",
      answer: "Copying everything into one folder often creates even more duplicates. A safer first step is to identify byte-for-byte matches, see where every copy lives and then decide whether any location is no longer needed.",
      suitable: [
        "You imported the same camera or phone photos more than once",
        "Files were renamed, so filenames no longer identify copies",
        "Messaging downloads and photo folders contain repeated files",
        "You want to compare two photo folders before merging them",
      ],
      avoid: [
        "You need to find bursts, crops or visually similar photographs",
        "You want a tool to choose the best-looking or highest-quality image",
        "Your only backup is incomplete or has never been restore-tested",
        "Photos are still syncing, importing or being edited",
      ],
      scenario: {
        title: "Example: phone imports, chat downloads and a manual backup",
        introduction: "Imagine 1,200 files in Phone Import, 180 in Chat Downloads and 1,050 in Trip Backup. Different names do not prove different content, while matching thumbnails do not prove identical files.",
        steps: [
          { label: "Exact match", detail: "The complete bytes match even though the filename or folder changed. It is a duplicate candidate, but every location still needs a purpose check." },
          { label: "Looks similar", detail: "A crop, recompression, color edit or different resolution may look the same. DUPESPACE does not label it as an exact duplicate." },
          { label: "Intentional backup", detail: "A separate backup can remain necessary even when its content matches. A fingerprint alone is not permission to remove it." },
          { label: "Only on one side", detail: "During a folder comparison, these are the files that may need to be added to the other side." },
        ],
      },
      sections: [
        { title: "Choose the right starting point", paragraphs: ["If the photos already live under one folder, use the duplicate-file finder to create a read-only report. Files stay on your device and the browser reads only the folder you select.", "If they are split between an old library, a new library or an external drive, compare two folders first. The result separates renamed exact matches, one-sided files and same-path version conflicts."], checklist: ["One folder: find exact copies", "Two folders: inspect differences before merging", "Need to reorganize files: revalidate in the Windows app"] },
        { title: "Why thumbnails and filenames are not enough", paragraphs: ["A camera export may be IMG_2048.JPG while a messaging download becomes a generated number. The names differ, but the bytes may still match. Conversely, two matching thumbnails can hide different resolutions, metadata or compression.", "DUPESPACE uses size to narrow candidates and then verifies complete file content. A preview helps you recognize the photograph; it does not decide whether files are identical."] },
        { title: "Answer three questions before reorganizing", paragraphs: ["Is the copy part of a working album, shared folder or offline backup? Does another application depend on its current path? If the result is unexpected, do you have a tested backup to restore from?", "Identical bytes prove equal content, not that one location is unused. The Windows app defaults to the Recycle Bin, but you should still test the full workflow with a small set of disposable files first."], checklist: ["Review complete paths", "Check backup and sync state", "Keep at least one item in every group", "Process a small batch and verify it"] },
        { title: "What the tool does, and what it intentionally leaves to you", paragraphs: ["DUPESPACE finds byte-for-byte identical photos, including renamed or moved copies. Some RAW, HEIC and video formats may show a file-type icon instead of a preview; that does not affect content comparison.", "It does not currently provide similar-photo search, face recognition, quality scoring or automatic best-shot selection. Those require different image judgments and should not be mixed into a list presented as exact duplicates."] },
      ],
      faq: [
        { question: "Are my photos uploaded to DUPESPACE?", answer: "No. The online analysis runs in the current browser tab. File contents, names, paths and results are not uploaded to DUPESPACE." },
        { question: "Can it find identical photos with different names?", answer: "Yes. Final matching uses complete content rather than filenames. A match is still a duplicate candidate, not proof that another location is unnecessary." },
        { question: "Why do some files have no thumbnail?", answer: "Browsers cannot decode every RAW, HEIC or media format. This affects the preview only, not complete-content comparison." },
        { question: "Can the website delete photos directly?", answer: "No. The browser tool is read-only. Use the Windows app to select the location again, revalidate current files and move reviewed copies to the Recycle Bin." },
      ],
    },
    {
      slug: "downloads-folder-cleanup",
      kicker: "DOWNLOADS FOLDER CLEANUP",
      title: "A crowded Downloads folder? Separate copies from files you still need",
      description: "Build a deliberate cleanup workflow for repeated downloads, renamed attachments and old installers. Find exact-copy candidates locally before deciding what should remain.",
      answer: "Downloads is not just a junk folder. It can contain tax records, installers, archives and unfinished work. Classify the purpose first, then identify byte-for-byte copies instead of selecting everything at once.",
      suitable: ["You downloaded the same attachment or installer more than once", "The browser added (1), (2) or copy to filenames", "You want to find the largest exact-copy candidates first", "You need an exportable read-only result before reorganizing"],
      avoid: ["You want to clear Windows updates, caches or system temporary files", "Downloads, sync or archive extraction is still running", "You do not yet understand the purpose of archives, installers or work documents", "You plan to treat identical project files as automatically unnecessary"],
      scenario: {
        title: "Example: matching content with four different purposes",
        introduction: "Not every duplicate in Downloads should be handled the same way. Identify why each file is present before deciding what to do.",
        steps: [
          { label: "Repeated download", detail: "report.pdf and report (1).pdf match exactly and are both temporary downloads. Keep one only after confirming their purpose." },
          { label: "Installer", detail: "The same installer version may be repeated. Similar names can also hide different versions, and an offline installer may still be useful." },
          { label: "Archive and extracted files", detail: "A ZIP and its extracted folder are not duplicates. Keep the archive if you need the original structure or a portable copy." },
          { label: "Work or project file", detail: "The same template, configuration or attachment can belong to separate work. Location and purpose still matter." },
        ],
      },
      sections: [
        { title: "Stop adding uncertainty before you start", paragraphs: ["Pause active downloads, sync and extraction, then move current work into folders with clear purposes. A file changed during scanning should invalidate the result instead of being processed from stale information.", "Do not begin with an entire drive. A bounded Downloads folder is easier to understand and avoids mixing applications, backups and personal files into one cleanup list."] },
        { title: "Compare content without being fooled by (1) and copy", paragraphs: ["Browsers append numbers to prevent overwrites. That is a useful clue, not proof: similarly named documents may be different revisions.", "The online analyzer first narrows possible matches and then verifies complete content. The reference item in a result group is simply a comparison anchor, not a proven original."], checklist: ["Review full paths and sizes", "Start with exact content matches", "Keep same-name files when their content differs", "Review the purpose of small files too"] },
        { title: "Which items deserve extra caution?", paragraphs: ["Certificates, tax records, contracts, design sources and unfinished documents should never be processed automatically merely because another matching file exists. An archive can also be the delivery copy or the only copy that preserves an original folder structure.", "Separate code projects may contain identical dependencies, templates or configuration files. The Windows app excludes recognized project contexts, but no rule can infer every dependency of custom software. Explicitly protected folders always take priority."] },
        { title: "Turn the report into a reviewable cleanup", paragraphs: ["Export the report and begin with large groups whose purpose is clear. The website does not move files. In the Windows app, select the location again, confirm protection rules and test a small Recycle Bin batch.", "Do not empty the Recycle Bin immediately. Open retained documents, run the workflows that depend on them and review every success, skip and failure reason in the CSV audit report."] , checklist: ["Export the read-only result", "Start with large, low-risk groups", "Use the Recycle Bin by default", "Verify normal work before emptying it"] },
      ],
      faq: [
        { question: "Does DUPESPACE clear Windows temporary files?", answer: "No. DUPESPACE compares exact files in locations you select. Use Windows Storage Sense or Cleanup recommendations for operating-system temporary and update files." },
        { question: "Is every file ending in (1) removable?", answer: "No. The suffix only records a filename conflict during download. The content may match, or it may be a newer revision. Verify complete content and purpose." },
        { question: "Is a ZIP duplicate of the extracted folder?", answer: "No. An archive and extracted files have different bytes and structures, so they are not exact duplicate files." },
        { question: "Does a browser analysis immediately free space?", answer: "No. It creates a read-only report. Use the Windows app to revalidate reviewed candidates and move them to the Recycle Bin." },
      ],
    },
  ],
};

export function findSolution(slug: string, locale: SolutionLocale) {
  return solutions[locale].find((solution) => solution.slug === slug);
}
