export const productFaq = {
  "zh-TW": [
    { question: "DUPESPACE 可以幫我做什麼？", answer: "你可以先比較兩個資料夾，找出改過名稱的重複檔案、缺少的內容和版本衝突；也能分析單一資料夾的重複檔案。需要實際清理時，再使用免費的 Windows 版把確認不需要的副本移至資源回收筒。" },
    { question: "檔案改名或搬到其他資料夾，還找得到嗎？", answer: "可以。DUPESPACE 會確認檔案內容，不只看名稱或位置。內容相同但名稱或位置不同時，會標示為已經存在；相同位置卻有不同內容時，會提醒你處理版本衝突。" },
    { question: "照片看起來一樣，就算重複嗎？", answer: "不一定。DUPESPACE 找的是內容完全相同的檔案，不是看起來相似的照片。裁切、壓縮、轉檔或修改照片資訊後，檔案內容就可能不同；目前不提供相似照片搜尋。" },
    { question: "不同程式專案裡的相同設定檔會被清掉嗎？", answer: "網頁版不會刪除任何檔案。Windows 版會避開偵測到的程式專案與套件資料夾；如果你有特殊工作流程，也可以把重要子資料夾加入保護，並在清理前確認每份檔案的用途。" },
    { question: "網頁分析會上傳我的檔案嗎？", answer: "不會。檔案內容、名稱、路徑和比較結果都在目前的瀏覽器分頁中處理。網頁沒有移動或刪除本機檔案的權限，關閉分頁後，未匯出的結果也會消失。" },
    { question: "移至資源回收筒後，空間會立刻增加嗎？", answer: "不一定。檔案在清空資源回收筒前，通常仍會占用原本的磁碟空間。NAS、網路磁碟和部分外接裝置也可能不支援資源回收筒；操作失敗時，DUPESPACE 不會偷偷改用永久刪除。" },
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
