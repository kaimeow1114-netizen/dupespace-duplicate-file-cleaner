import type { Metadata } from "next";
import { AdPanel } from "../components/ad-panel";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = {
  title: "重複檔案與 Windows 儲存空間整理指南",
  description: "了解如何安全清理 Windows 與 Google Drive 重複檔案，以及何時應改用 Windows 儲存空間感知與清理建議。",
  alternates: { canonical: "/support" },
};

export default function SupportPage() {
  return (
    <main>
      <SiteHeader />
      <section className="guide-hero"><div className="shell"><span className="eyebrow"><i /> 免費整理指南</span><h1>先判斷用途，再決定是否清理。</h1><p>「檔案內容相同」只能證明它們是重複候選，不能證明另一個路徑的副本沒有用途。DUPESPACE 只處理精確重複檔，不猜測 Windows 暫存或垃圾檔。</p></div></section>
      <section className="shell guide-grid">
        <article><span>01</span><h2>重要來源放進保留區</h2><p>把照片原始檔、工作文件、正式匯出檔或主要資料庫備份所在位置指定為保留區。保留區的每一份檔案永遠不可勾選或刪除。</p></article>
        <article><span>02</span><h2>只把候選位置放進清理區</h2><p>下載資料夾、手動複製的暫存整理區或已確認可減少副本的位置才適合當清理區。兩種根目錄不可相同、巢狀或重疊。</p></article>
        <article><span>03</span><h2>看內容，不只看檔名</h2><p>相同檔名可能是不同版本；不同檔名也可能內容完全一致。Windows 版使用完整 SHA-256，但仍應查看完整路徑與用途。</p></article>
        <article><span>04</span><h2>程式、專案與備份預設鎖定</h2><p>Git／SVN、套件、虛擬環境、執行檔、安裝資源、備份、快照與同步資料夾中的副本可能各有用途，因此不會自動選取。</p></article>
        <article><span>05</span><h2>預設使用垃圾桶</h2><p>先用少量測試副本確認流程。垃圾桶失敗只會記錄失敗，不會自動改用永久刪除；永久刪除永遠要重新手動選取。</p></article>
        <article><span>06</span><h2>暫存與系統垃圾交給 Windows</h2><p>DUPESPACE 不碰系統管理資料。請改用 Windows 的「設定 → 系統 → 儲存體 → 清理建議」或儲存空間感知，並逐項查看建議。</p><a href="https://support.microsoft.com/en-us/windows/free-up-drive-space-in-windows-85529ccb-c365-490d-b548-831022bc9b32">查看 Microsoft 官方釋放空間指南 →</a></article>
      </section>
      <section className="shell official-cleanup"><h2>一般安全的 Windows 空間整理順序</h2><ol><li>先查看「清理建議」中的暫存檔、大型或未使用檔案與未使用 App。</li><li>設定「儲存空間感知」前，先確認資源回收筒、下載與雲端內容的保留天數。</li><li>個人檔案重複時，再用 DUPESPACE 的保留區／清理區流程。</li><li>不要手動刪除 Windows、Program Files、ProgramData、AppData、還原、更新或開機位置。</li></ol><a className="button secondary" href="https://support.microsoft.com/en-US/Windows/Experience/Storage-FileManagement/manage-drive-space-with-storage-sense">查看 Microsoft 儲存空間感知說明</a></section>
      <AdPanel />
      <SiteFooter />
    </main>
  );
}
