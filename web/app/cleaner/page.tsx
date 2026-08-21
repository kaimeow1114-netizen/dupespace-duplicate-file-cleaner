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
  return <main><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} /><SiteHeader /><section className="cleaner-hero"><div className="shell"><span className="eyebrow light"><ShieldCheck size={15} aria-hidden="true" /> 瀏覽器直接使用</span><h1>掃描、檢查，兩次點擊安全完成。</h1><p>已登入的使用者只需按「開始掃描」，再按「移至 Google Drive 垃圾桶」。DUPESPACE 會自動選取符合安全門檻的重複副本，並提供完整路徑、檔案預覽與資料夾雙樹鏡像比對；每組至少保留一份，專案與非本人擁有項目硬性排除。垃圾桶操作完成後可在 10 秒內快速復原。</p></div></section><section className="shell cleaner-wrap"><CleanerClient /></section><SiteFooter /></main>;
}
