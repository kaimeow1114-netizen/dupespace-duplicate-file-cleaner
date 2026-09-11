import { FileCheck2, FileWarning, FolderSync, ScanSearch, ShieldCheck } from "lucide-react";
import { chineseMetadata } from "../../lib/seo";
import { MergeAnalyzer } from "../components/merge-analyzer";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata = chineseMetadata("merge", "安全合併資料夾｜找出改名、缺漏與版本衝突", "合併兩個資料夾前，在瀏覽器本機核對相同內容、重新命名、缺漏與同名版本衝突。唯讀分析，不上傳也不改動檔案。");

export default function MergePage() {
  return <main className="merge-page"><SiteHeader pagePath="merge" privateWorkspace /><section className="merge-intro"><div className="shell"><span className="eyebrow light"><FolderSync size={16} aria-hidden="true" /> SAFE MERGE PREVIEW</span><h1>合併資料夾前，<span className="gradient-text">先看清楚。</span></h1><p>找出改過名稱的相同內容、尚未匯入的檔案與版本衝突。所有核對都在這個裝置完成。</p><span className="merge-intro-trust"><ShieldCheck size={16} aria-hidden="true" />唯讀預演，只讀取你主動選擇的兩個資料夾</span></div></section><div className="shell merge-wrap"><MergeAnalyzer /></div><section className="shell merge-explainer"><div><span className="eyebrow">WHY COMPARE FIRST</span><h2>資料夾合併最容易忽略的三件事</h2><p>直接拖曳覆蓋只能看見檔名衝突；內容核對則能在動手前揭露真正的關係。</p></div><div className="merge-explainer-grid"><article><ScanSearch aria-hidden="true" /><h3>改名後仍是同一份內容</h3><p>照片、影片或文件換了名稱、搬到其他子資料夾，仍能透過完整內容指紋辨識。</p></article><article><FileWarning aria-hidden="true" /><h3>同名不代表同版本</h3><p>相同相對路徑卻有不同內容時，會列為版本衝突，不會用日期或檔名替你猜測。</p></article><article><FileCheck2 aria-hidden="true" /><h3>唯讀結果可以帶走</h3><p>頁面不執行複製或刪除。你可以先檢查左右路徑，再匯出 CSV 保存核對結果。</p></article></div></section><SiteFooter /></main>;
}
