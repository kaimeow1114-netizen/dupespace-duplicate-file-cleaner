import { FileSearch, ShieldCheck } from "lucide-react";
import { chineseMetadata } from "../../lib/seo";
import { LocalAnalyzer } from "../components/local-analyzer";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata = chineseMetadata("local", "線上本機重複檔案分析｜零上傳、免登入", "直接在瀏覽器分析本機資料夾中的重複檔案。檔名、路徑與內容不會上傳，網頁只產生唯讀報告，不具備刪除權限。");

export default function LocalPage() {
  return <main className="local-page"><SiteHeader pagePath="local" privateWorkspace /><section className="local-hero"><div className="shell"><span className="eyebrow light"><FileSearch size={16} aria-hidden="true" /> LOCAL FILE ANALYZER</span><h1>找出本機重複檔案，<br /><span className="gradient-text">不必把檔案交給任何人。</span></h1><p>免登入、免安裝。DUPESPACE 只讀取你主動選取的資料夾，在瀏覽器中完成內容比對並產生報告；檔案不會上傳，網頁也無法刪除檔案。</p><div className="local-hero-trust"><span><ShieldCheck size={15} aria-hidden="true" />唯讀分析，不改動原始檔案</span><span><ShieldCheck size={15} aria-hidden="true" />關閉分頁即清除未匯出結果</span></div></div></section><div className="shell local-wrap"><LocalAnalyzer /></div><SiteFooter /></main>;
}
