import { CalendarDays } from "lucide-react";
import { chineseMetadata } from "../../lib/seo";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata = chineseMetadata("terms", "服務條款", "DUPESPACE 本機分析、Windows 可復原清理、永久刪除與稽核報告的使用條款及安全責任。");

export default function TermsPage() {
  return <main><SiteHeader pagePath="terms" /><article className="legal shell">
    <span className="eyebrow"><CalendarDays size={15} aria-hidden="true" /> 最後更新：2026 年 9 月 2 日</span>
    <h1>服務條款</h1>
    <p className="lead">使用 DUPESPACE 即表示你了解「內容相同」只代表重複候選，不代表其他位置的副本沒有用途。</p>
    <h2>服務內容</h2>
    <p>網頁版協助分析使用者主動選取的本機檔案並產生唯讀報告，不會移動或刪除檔案。Windows 版可在本機掃描、檢查並整理重複檔案，也能比較資料夾與備份內容。</p>
    <h2>安全規則</h2>
    <p>每個重複群組至少保留一份。保護規則優先，再依可用的建立時間與路徑選出建議保留檔；時間與路徑只用來建立一致選擇，不證明檔案用途或原創性。程式碼專案、套件目錄、虛擬環境、系統位置、指定保護子資料夾與無法驗證的項目不應成為自動清理候選。</p>
    <h2>垃圾桶與永久刪除</h2>
    <p>Windows 版預設移至資源回收筒。垃圾桶失敗只記錄失敗，不會自動改用永久刪除。永久刪除是獨立的高風險功能，只能處理符合條件的一般檔案，必須由使用者主動選擇並確認，而且無法復原。</p>
    <h2>使用者責任</h2>
    <p>大量清理前應先測試少量副本、檢查完整路徑與建議保留檔、保留獨立備份並妥善保存 CSV 稽核報告。請只分析或整理你有權管理的資料。不要把報告中的私人路徑與檔名公開張貼。</p>
    <h2>指標與估算</h2>
    <p>整理分數、可整理容量與分類統計只作為檔案整理參考，不是硬碟故障、效能、安全性或財務診斷，也不保證實際釋放容量或帳單節省。</p>
    <h2>無保證與責任限制</h2>
    <p>本專案依 MIT License 以現況提供，不附帶明示或默示保證。檔案變更、權限、檔案系統、資源回收筒、硬體或作業系統狀態都可能造成個別項目未成功處理；請檢查畫面與 CSV 中的每筆結果。</p>
    <h2>廣告</h2>
    <p>公開內容頁可能顯示第三方廣告。廣告內容由廣告供應商提供，不代表 DUPESPACE 對相關產品或服務背書；本機分析工作區不載入廣告。</p>
  </article><SiteFooter /></main>;
}
