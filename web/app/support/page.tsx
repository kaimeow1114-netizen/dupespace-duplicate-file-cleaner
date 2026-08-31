import type { Metadata } from "next";
import { localizedAlternates } from "../../lib/seo";
import { AdPanel } from "../components/ad-panel";
import { SiteFooter, SiteHeader } from "../components/site-shell";
import { BookOpenCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "重複檔案與 Windows 儲存空間整理指南",
  description: "了解如何安全清理 Windows 與 Google Drive 重複檔案，以及何時應改用 Windows 儲存空間感知與清理建議。",
  alternates: localizedAlternates("support"),
};

export default function SupportPage() {
  return (
    <main>
      <SiteHeader />
      <section className="guide-hero"><div className="shell"><span className="eyebrow"><BookOpenCheck size={15} aria-hidden="true" /> 免費整理指南</span><h1>先判斷用途，再決定是否清理。</h1><p>「檔案內容相同」只能證明它們是重複候選，不能證明另一個路徑的副本沒有用途。DUPESPACE 只處理精確重複檔，不猜測 Windows 暫存或垃圾檔。</p></div></section>
      <section className="shell guide-grid">
        <article><span>01</span><h2>只加入想整理的位置</h2><p>選擇或拖入下載、照片匯入與手動備份等資料夾。DUPESPACE 只遞迴掃描畫面列出的資料夾，不會搜尋整台電腦。</p></article>
        <article><span>02</span><h2>需要時再保護子資料夾</h2><p>每組精確重複檔會自動鎖定最舊的一份。若原始照片或工作文件集中在特定子資料夾，也能把它設為永遠不可勾選的保護資料夾。</p></article>
        <article><span>03</span><h2>看內容，不只看檔名</h2><p>相同檔名可能是不同版本；不同檔名也可能內容完全一致。Windows 版使用完整 SHA-256，但仍應查看完整路徑與用途。</p></article>
        <article><span>04</span><h2>程式碼專案一律硬性保護</h2><p>Git／SVN、常見建置專案、套件目錄與虛擬環境中的設定、依賴或外掛可能被不同專案各自需要，因此不雜湊、不列為候選，也不能解鎖。執行檔、備份與同步資料夾則維持預設鎖定。</p></article>
        <article><span>05</span><h2>預設使用垃圾桶</h2><p>先用少量測試副本確認流程。垃圾桶失敗只會記錄失敗，不會自動改用永久刪除；永久刪除永遠要重新手動選取。</p></article>
        <article><span>06</span><h2>暫存與系統垃圾交給 Windows</h2><p>DUPESPACE 不碰系統管理資料。請依序開啟 Windows「設定」中的「系統」、「儲存體」和「清理建議」，或使用儲存空間感知，並逐項查看建議。</p><a href="https://support.microsoft.com/en-us/windows/free-up-drive-space-in-windows-85529ccb-c365-490d-b548-831022bc9b32">查看 Microsoft 官方釋放空間指南</a></article>
      </section>
      <section className="shell official-cleanup"><h2>一般安全的 Windows 空間整理順序</h2><ol><li>先查看「清理建議」中的暫存檔、大型或未使用檔案與未使用 App。</li><li>設定「儲存空間感知」前，先確認資源回收筒、下載與雲端內容的保留天數。</li><li>個人檔案重複時，再把明確的資料夾加入 DUPESPACE；需要時保護重要子資料夾。</li><li>不要手動刪除 Windows、Program Files、ProgramData、AppData、還原、更新或開機位置。</li></ol><a className="button secondary" href="https://support.microsoft.com/en-US/Windows/Experience/Storage-FileManagement/manage-drive-space-with-storage-sense">查看 Microsoft 儲存空間感知說明</a></section>
      <AdPanel />
      <SiteFooter />
    </main>
  );
}
