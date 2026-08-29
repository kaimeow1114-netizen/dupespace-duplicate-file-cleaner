import type { Metadata } from "next";
import { CleanerClient } from "../components/cleaner-client";
import { SiteFooter, SiteHeader } from "../components/site-shell";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Google Drive 重複檔案清理器",
  description: "免下載，直接搜尋與清理 Google Drive 重複檔案與鏡像資料夾。預設移至垃圾桶，永久刪除只適用一般檔案。",
  alternates: { canonical: "/cleaner" },
};

export default function CleanerPage() {
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首頁", item: "https://dupespace.app/" }, { "@type": "ListItem", position: 2, name: "Google Drive 重複檔案清理器", item: "https://dupespace.app/cleaner" }] };
  return <main className="cleaner-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} /><SiteHeader /><section className="cleaner-hero"><div className="shell"><span className="eyebrow light"><ShieldCheck size={16} aria-hidden="true" /> GOOGLE DRIVE 安全工作區</span><h1><span className="heading-phrase">重複檔案，</span><wbr /><span className="heading-phrase">清楚分組、安心處理。</span></h1><p>按一次開始掃描，再按一次移至垃圾桶。DUPESPACE 依影片、圖片、PDF 與重要文件排序，每組只載入一張代表預覽；完整路徑和副本狀態仍清楚可查。每組至少保留一份，專案與非本人擁有項目硬性排除，垃圾桶操作可在 10 秒內快速復原。</p></div></section><section className="cleaner-wrap"><CleanerClient /></section><SiteFooter /></main>;
}
