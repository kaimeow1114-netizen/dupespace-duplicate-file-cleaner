export type UseCaseLocale = "zh-TW" | "en";

export type UseCaseSection = { title: string; paragraphs: string[] };
export type UseCaseFinding = { label: string; paths: string[]; result: string; next: string };
export type UseCase = {
  slug: string;
  kicker: string;
  title: string;
  description: string;
  answer: string;
  version: string;
  scope: string;
  setup: string[];
  findings: UseCaseFinding[];
  sections: UseCaseSection[];
  checks: string[];
  sampleCsv: string;
  faq: Array<{ question: string; answer: string }>;
};

export const useCases: Record<UseCaseLocale, UseCase[]> = {
  "zh-TW": [
    {
      slug: "renamed-photo-merge",
      kicker: "REPRODUCIBLE PHOTO MERGE",
      title: "同一張照片改了名稱，合併資料夾時會怎麼分類？",
      description: "用一組可重現的測試資料，示範兩個照片資料夾中改名副本、單邊檔案與同路徑版本衝突的差別。結果只讀，不自動複製或刪除。",
      answer: "DUPESPACE 以完整內容辨認改名後仍相同的照片，不會因名稱不同就再次複製；同一路徑但內容不同則獨立標成衝突，留給使用者決定。",
      version: "DUPESPACE v1.7.1",
      scope: "一次性的合成測試資料；不是效能基準，也不代表所有照片格式都能顯示縮圖。",
      setup: [
        "建立「手機匯入」與「目前相簿」兩個資料夾。",
        "把同一張 JPEG 放到兩邊，分別命名為 IMG_1842.JPG 與 京都車站.jpg。",
        "在兩邊建立相同相對路徑 Pictures/album-cover.jpg，但放入不同內容。",
        "各放入一張只存在單邊的照片，接著使用資料夾合併前核對。",
      ],
      findings: [
        { label: "改名或搬動", paths: ["手機匯入/DCIM/IMG_1842.JPG", "目前相簿/2024/京都車站.jpg"], result: "完整內容相同，即使名稱與路徑都不同，仍歸在同一個內容關係。", next: "目前相簿已經有這份內容，因此不必再次複製；但不代表手機匯入端可以直接刪除。" },
        { label: "同路徑版本衝突", paths: ["手機匯入/Pictures/album-cover.jpg", "目前相簿/Pictures/album-cover.jpg"], result: "相對路徑相同，完整內容不同。工具不把其中一份當成重複。", next: "分別開啟或改名保存兩版，確認用途後再手動合併。" },
        { label: "只在搬入端", paths: ["手機匯入/DCIM/IMG_1843.JPG"], result: "目前相簿找不到相同內容，也沒有相同相對路徑。", next: "這是可能需要新增到相簿的檔案，而不是重複副本。" },
        { label: "只在保留端", paths: ["目前相簿/2023/family.jpg"], result: "手機匯入端沒有這份內容。", next: "它不需要從新匯入資料覆蓋；若要更新備份，應另開一個反向核對流程。" },
      ],
      sections: [
        { title: "這個測試證明什麼？", paragraphs: ["檔名不是檔案身分。只用名稱比較會漏掉 IMG_1842.JPG 與 京都車站.jpg 這種改名副本；只看路徑則可能把不同內容的 album-cover.jpg 當成同一版。", "DUPESPACE 先比較精確容量，再用樣本排除明顯不同的候選，最後完整讀取剩餘候選的內容。快速樣本不會單獨決定兩個檔案相同。"] },
        { title: "結果為什麼不直接提供『刪除』？", paragraphs: ["手機匯入端可能是唯一尚未完成備份的來源；目前相簿也可能正在同步。內容相同只代表這次比較讀到的位元相同，不代表任何一邊已失去用途。", "網頁版刻意保持唯讀。它讓你少複製一份已存在的內容，也把版本衝突提前顯示，但不替你承擔合併與刪除決定。"] },
        { title: "如何自己重做這個測試", paragraphs: ["使用幾張可捨棄的測試圖片，保留其中一張不變但改名；再用圖片編輯器重新輸出另一張，讓縮圖看起來相似但內容不同。比較完成後核對四種分類與 CSV。", "不要用唯一的家庭照片或仍在同步的正式相簿做第一次測試。若結果和預期不同，先停止，不要依報告繼續複製或清理。"] },
      ],
      checks: ["改名副本列為 renamed_or_moved", "版本衝突不列為完全重複", "單邊檔案維持各自方向", "網頁沒有寫入或刪除權限"],
      sampleCsv: "/examples/renamed-photo-merge-redacted.csv",
      faq: [
        { question: "照片名稱完全不同也能找出來嗎？", answer: "可以，只要完整內容相同。名稱與路徑只用來顯示情境，不作為最終相同判定。" },
        { question: "重新壓縮後看起來一樣，會算完全重複嗎？", answer: "通常不會。重新壓縮、裁切或修改中繼資料會改變位元內容，應視為不同版本而不是完全相同副本。" },
        { question: "範例 CSV 可以直接拿來刪檔嗎？", answer: "不可以。它是去識別化的欄位示例，沒有你裝置上的檔案權限，也不是清理指令。" },
      ],
    },
    {
      slug: "project-files-must-stay",
      kicker: "PROJECT SAFETY CASE",
      title: "兩個程式專案有相同設定檔，為什麼兩份都不能刪？",
      description: "用兩個獨立程式專案示範：相同外掛、設定與套件檔雖然內容一致，仍可能是各自執行所需。比較網頁提示與 Windows 保護規則的差別。",
      answer: "檔案是否多餘取決於用途，不只取決於內容。兩個專案各自依賴相同設定或套件時，DUPESPACE 應標示情境風險或直接排除，而不是挑一份移除。",
      version: "DUPESPACE v1.7.1",
      scope: "合成的 Project-A 與 Project-B；驗證情境標記與保護邏輯，不宣稱能辨認所有自訂建置系統。",
      setup: [
        "建立 Project-A 與 Project-B，各放入自己的 package.json。",
        "在兩個專案的 config/theme.json 寫入完全相同內容。",
        "在兩邊的 node_modules/demo-plugin/index.js 放入相同測試檔。",
        "另外在 Downloads 放入兩份相同安裝檔，作為非專案情境的對照組。",
      ],
      findings: [
        { label: "專案設定檔", paths: ["Workspace/Project-A/config/theme.json", "Workspace/Project-B/config/theme.json"], result: "內容相同，但兩邊都位於具有專案清單檔的獨立根目錄。", next: "網頁報告要求情境確認；Windows 版不應自動選取任何一份。" },
        { label: "套件與外掛", paths: ["Workspace/Project-A/node_modules/demo-plugin/index.js", "Workspace/Project-B/node_modules/demo-plugin/index.js"], result: "兩份檔案可能由套件管理器分別維護，移除其中一份會破壞對應專案。", next: "整個套件環境排除，不把它當成可釋放空間。" },
        { label: "一般下載副本", paths: ["Downloads/setup.exe", "Downloads/setup (1).exe"], result: "內容相同且不在已辨識專案根目錄，仍只是候選副本。", next: "查看版本、簽章與離線安裝需求後，再決定是否用資源回收筒整理。" },
      ],
      sections: [
        { title: "相同內容為什麼可能缺一不可", paragraphs: ["應用程式通常依固定相對路徑尋找設定、外掛與套件。即使兩份內容完全相同，把 Project-B 的檔案刪掉也不會讓它自動改用 Project-A 的檔案。", "硬連結與符號連結是另一種關係，也不能用一般重複副本邏輯處理。Windows 版會識別並避開這些特殊物件，不追蹤 junction 或 reparse point。"] },
        { title: "DUPESPACE 如何辨認專案情境", paragraphs: ["目前規則會尋找 .git、.svn、package.json、鎖檔、pyproject.toml、requirements 檔、node_modules、虛擬環境與常見應用程式檔案。網頁報告會標示需要情境確認，Windows 版則把辨識到的專案與套件位置排除或鎖定。", "這是保守防線，不是完整的相依性分析器。自訂建置工具、可攜式應用程式與公司內部目錄可能沒有已知標記，因此使用者指定的保護子資料夾仍然必要。"] },
        { title: "正確整理方式不是跨專案刪檔", paragraphs: ["若目的是縮小專案體積，應使用套件管理器、建置工具或專案自己的清理指令移除可重建輸出。不要從另一個專案複製或刪除單一依賴檔案來節省空間。", "只有在明確的一般資料夾中，且確認副本不屬於程式、備份、同步或工作流程時，才進入一般重複檔案審查。"] },
      ],
      checks: ["專案根目錄需要情境確認", "node_modules 與虛擬環境排除", "保護資料夾優先於保留建議", "一般下載副本不會被誤當專案檔"],
      sampleCsv: "/examples/project-files-must-stay-redacted.csv",
      faq: [
        { question: "所有 package.json 底下的檔案都會被刪除清單排除嗎？", answer: "Windows 版會保守處理已辨識的專案根目錄；網頁報告則提示情境確認。自訂結構仍應手動加入保護。" },
        { question: "node_modules 很大，可以用重複檔案工具清嗎？", answer: "不建議逐檔刪除。使用套件管理器或重新建立環境，才能維持依賴關係與鎖檔一致。" },
        { question: "內容相同的設定檔一定要保留兩份嗎？", answer: "若兩個程式都從自己的路徑讀取，就必須各自保留。只有了解應用程式載入方式的人才能安全改成共用。" },
      ],
    },
  ],
  en: [
    {
      slug: "renamed-photo-merge",
      kicker: "REPRODUCIBLE PHOTO MERGE",
      title: "What happens when the same photo has a different name?",
      description: "A reproducible, read-only example showing renamed exact matches, one-sided photos and same-path version conflicts across two folders.",
      answer: "DUPESPACE identifies renamed photos by complete content instead of copying them again. A matching relative path with different bytes remains a separate conflict for a person to resolve.",
      version: "DUPESPACE v1.7.1",
      scope: "One disposable synthetic dataset. This is not a performance benchmark and not every photo format can display a thumbnail.",
      setup: ["Create Phone Import and Current Library folders.", "Place the same JPEG on both sides as IMG_1842.JPG and Kyoto Station.jpg.", "Create Pictures/album-cover.jpg on both sides with different content.", "Add one photo that exists only on each side, then run the folder comparison."],
      findings: [
        { label: "Renamed or moved", paths: ["Phone Import/DCIM/IMG_1842.JPG", "Current Library/2024/Kyoto Station.jpg"], result: "Complete content matches even though both the name and location differ.", next: "The library already has the content, so it need not be copied again. This does not make the import-side copy automatically disposable." },
        { label: "Same-path conflict", paths: ["Phone Import/Pictures/album-cover.jpg", "Current Library/Pictures/album-cover.jpg"], result: "The relative path matches while the complete bytes differ.", next: "Open or rename both versions and resolve the purpose manually before merging." },
        { label: "Incoming only", paths: ["Phone Import/DCIM/IMG_1843.JPG"], result: "The current library contains neither the same bytes nor the same relative path.", next: "This may be a file to add, not a duplicate copy." },
        { label: "Destination only", paths: ["Current Library/2023/family.jpg"], result: "The phone import does not contain this content.", next: "Do not overwrite it from the import. Use a separate reverse comparison if you are updating the backup." },
      ],
      sections: [
        { title: "What does this example prove?", paragraphs: ["A filename is not a file identity. A name-only check misses IMG_1842.JPG and Kyoto Station.jpg, while a path-only merge could treat two different album-cover files as one version.", "DUPESPACE narrows candidates by exact size, uses samples only to eliminate obvious mismatches, then reads all bytes of remaining candidates. A sample never decides equality on its own."] },
        { title: "Why does the result not contain a delete action?", paragraphs: ["The phone import may be the only source not yet backed up, and the library may be synchronized. Matching bytes describe this comparison; they do not prove either location has lost its purpose.", "The browser remains read-only. It can prevent an unnecessary second copy and reveal conflicts early without accepting the risk of automatic merge or deletion."] },
        { title: "Reproduce it yourself", paragraphs: ["Use disposable images. Keep one file unchanged but rename it, then re-export another image so the preview looks similar while the bytes differ. Verify the four result classes and exported CSV.", "Do not use your only family photographs or a live synchronized library for the first test. Stop if the result differs from what you expect."] },
      ],
      checks: ["Renamed copy is classified as renamed_or_moved", "Version conflict is not an exact duplicate", "One-sided files retain their direction", "The browser has no write or delete permission"],
      sampleCsv: "/examples/renamed-photo-merge-redacted.csv",
      faq: [
        { question: "Can it find photos with completely different names?", answer: "Yes, when the complete content matches. Names and paths provide context but do not decide equality." },
        { question: "Is a visually identical recompressed image an exact duplicate?", answer: "Usually not. Recompression, cropping or metadata edits change the bytes and should remain a separate version." },
        { question: "Can the sample CSV be used to delete files?", answer: "No. It is a redacted schema example without access to your device and is not a cleanup instruction." },
      ],
    },
    {
      slug: "project-files-must-stay",
      kicker: "PROJECT SAFETY CASE",
      title: "Two projects share a configuration file. Why must both copies stay?",
      description: "A two-project example showing why identical plug-ins, configuration and packages may be required independently, and how browser warnings differ from Windows protection.",
      answer: "Redundancy depends on purpose, not content alone. When two projects independently load matching configuration or packages, DUPESPACE should require context review or exclude them instead of removing one.",
      version: "DUPESPACE v1.7.1",
      scope: "Synthetic Project-A and Project-B folders. It verifies context marking and protection behavior, not every custom build system.",
      setup: ["Create Project-A and Project-B with their own package.json files.", "Give both projects an identical config/theme.json.", "Place the same test plug-in under each node_modules folder.", "Add matching installer copies under Downloads as a non-project comparison."],
      findings: [
        { label: "Project configuration", paths: ["Workspace/Project-A/config/theme.json", "Workspace/Project-B/config/theme.json"], result: "The bytes match, but each file belongs to an independent root containing a project manifest.", next: "The browser requires context review; the Windows app must not auto-select either copy." },
        { label: "Package or plug-in", paths: ["Workspace/Project-A/node_modules/demo-plugin/index.js", "Workspace/Project-B/node_modules/demo-plugin/index.js"], result: "Separate package managers may maintain both files, and removing one can break its project.", next: "Exclude the package environments instead of counting them as reclaimable space." },
        { label: "Ordinary download", paths: ["Downloads/setup.exe", "Downloads/setup (1).exe"], result: "The bytes match outside a recognized project root, but the pair is still only a duplicate candidate.", next: "Review the version, signature and offline-install need before using the Recycle Bin." },
      ],
      sections: [
        { title: "Why matching content can still be required", paragraphs: ["Applications normally load configuration, plug-ins and packages from fixed relative paths. Removing Project-B's copy does not make it use Project-A's file automatically.", "Hard links and symbolic links are separate relationships and do not belong in ordinary duplicate cleanup. The Windows app avoids those special objects and does not traverse junctions or reparse points."] },
        { title: "How DUPESPACE recognizes project context", paragraphs: ["Current rules look for .git, .svn, package manifests and lockfiles, pyproject.toml, requirements files, node_modules, virtual environments and common application files. The browser marks context for review; Windows excludes or locks recognized project and package locations.", "This is a conservative boundary, not a dependency analyzer. Custom build systems, portable apps and internal directory layouts may have no known marker, so explicit protected subfolders remain necessary."] },
        { title: "The correct cleanup is not cross-project file deletion", paragraphs: ["To reduce a project's size, use its package manager, build tool or documented cleanup command to remove reproducible outputs. Do not delete individual dependencies by comparing them with another project.", "Review ordinary duplicate candidates only in clearly understood personal folders and only after excluding application, backup, sync and work contexts."] },
      ],
      checks: ["Project roots require context review", "node_modules and virtual environments are excluded", "Protected folders override keeper suggestions", "Ordinary downloads remain separate from project files"],
      sampleCsv: "/examples/project-files-must-stay-redacted.csv",
      faq: [
        { question: "Does every file below package.json get excluded?", answer: "Windows handles recognized project roots conservatively, while the browser marks them for review. Add custom structures to protection explicitly." },
        { question: "Can I remove duplicate files inside node_modules?", answer: "Do not remove them file by file. Use the package manager or rebuild the environment so dependencies and lockfiles remain consistent." },
        { question: "Do identical configuration files always need two copies?", answer: "They do when separate applications read from their own paths. Only someone who understands the loading behavior can safely redesign them as shared state." },
      ],
    },
  ],
};

export function findUseCase(slug: string, locale: UseCaseLocale): UseCase | undefined {
  return useCases[locale].find((item) => item.slug === slug);
}
