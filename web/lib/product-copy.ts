export const productFaq = {
  "zh-TW": [
    { question: "DUPESPACE 的用途是什麼？", answer: "DUPESPACE 是免費開源的資料夾合併核對與重複檔案工具。網頁可比較待合併與目的資料夾，找出改名後的相同內容、單邊缺漏與版本衝突；Windows 版則提供可復原的重複副本清理。" },
    { question: "檔案改名或移到其他子資料夾，還能找到嗎？", answer: "可以。合併前核對以完整檔案內容確認，不依賴檔名或相對路徑。內容完全相同但名稱或位置不同時，會列為已存在內容；相同路徑但內容不同時，會列為版本衝突。" },
    { question: "照片看起來一樣，就算重複嗎？", answer: "不一定。DUPESPACE 比對完整檔案內容，不是用畫面相似度判定。裁切、壓縮、轉檔或中繼資料不同的照片，可能不會出現在同一組；目前不提供相似照片搜尋。" },
    { question: "不同專案中的相同設定檔會被處理嗎？", answer: "網頁版不刪除任何檔案，並提示常見專案情境。Windows 版會排除偵測到的專案與套件目錄；規則無法辨識所有自訂工作流程，請把重要工作子資料夾加入保護，並核對每份副本的用途。" },
    { question: "網頁分析會上傳我的檔案嗎？", answer: "不會。檔名、路徑、檔案內容與比對結果都在你的瀏覽器處理，不會上傳到 DUPESPACE。網頁也沒有移動或刪除本機檔案的權限。" },
    { question: "移至資源回收筒後，空間會立刻增加嗎？", answer: "不一定。檔案仍可能占用原磁碟空間，通常要清空資源回收筒才會釋放。請先檢查檔案確實不再需要；NAS、網路磁碟或部分外接裝置的回收筒支援可能不同，失敗不會改用永久刪除。" },
  ],
  en: [
    { question: "What does DUPESPACE do?", answer: "DUPESPACE is a free, open-source folder merge preview and duplicate file tool. The web app compares incoming and destination folders for renamed exact matches, one-sided files and version conflicts. The Windows app provides recoverable duplicate cleanup." },
    { question: "Can it find a file after it has been renamed or moved?", answer: "Yes. Folder merge preview verifies complete content rather than relying on a filename or relative path. Exact content at a different name or location is marked as already present; different content at the same path is marked as a version conflict." },
    { question: "Are similar-looking photos duplicates?", answer: "Not necessarily. DUPESPACE compares complete file content, not visual similarity. Cropping, compression, conversion or metadata changes can produce different files. Similar-photo search is not currently included." },
    { question: "What about identical files in separate software projects?", answer: "The browser never deletes files and flags common project contexts. Windows excludes detected projects and package folders. Rules cannot identify every custom workflow: protect important working subfolders and review each copy’s purpose." },
    { question: "Does browser analysis upload my files?", answer: "No. Filenames, paths, contents and comparison results are processed inside your browser, not uploaded to DUPESPACE. The web app has no permission to move or delete local files." },
    { question: "Does the Recycle Bin immediately free disk space?", answer: "Not necessarily. Trashed files may still occupy the original disk until its Recycle Bin is emptied. Review them first. NAS, network drives and some external devices may have different Recycle Bin support; a failure never triggers permanent deletion." },
  ],
} as const;
