import { FileSearch, ShieldCheck } from "lucide-react";
import { chineseMetadata } from "../../lib/seo";
import { LocalAnalyzer } from "../components/local-analyzer";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata = chineseMetadata("local", "線上本機重複檔案分析｜不上傳至伺服器、免登入", "直接在瀏覽器分析本機資料夾中的重複檔案。檔名、路徑與內容不會傳送至伺服器，網頁只產生唯讀報告，不具備刪除權限。");

export default function LocalPage() {
  return <main className="local-page"><SiteHeader pagePath="local" privateWorkspace /><section className="local-hero"><div className="shell"><span className="eyebrow light"><FileSearch size={16} aria-hidden="true" /> LOCAL FILE ANALYZER</span><h1>找出本機重複檔案，<br /><span className="gradient-text">不用上傳，也不用登入。</span></h1><p>選擇一個資料夾，DUPESPACE 就會直接在目前的瀏覽器分頁中分析。檔案內容、名稱和路徑不會上傳，網頁也不會更動檔案。</p><div className="local-hero-trust"><span><ShieldCheck size={15} aria-hidden="true" />只分析，不更動檔案</span><span><ShieldCheck size={15} aria-hidden="true" />關閉分頁後清除未匯出結果</span></div></div></section><div className="shell local-wrap"><LocalAnalyzer /></div><SiteFooter /></main>;
}
