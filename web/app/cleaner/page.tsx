import type { Metadata } from "next";
import { CleanerClient } from "../components/cleaner-client";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = {
  title: "Google Drive 重複檔案清理器",
  description: "免下載，直接搜尋與清理 Google Drive 重複檔案。預設移至垃圾桶，永久刪除需獨立高風險確認。",
  alternates: { canonical: "/cleaner" },
};

export default function CleanerPage() {
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首頁", item: "https://dupespace.app/" }, { "@type": "ListItem", position: 2, name: "Google Drive 重複檔案清理器", item: "https://dupespace.app/cleaner" }] };
  return <main><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} /><SiteHeader /><section className="cleaner-hero"><div className="shell"><span className="eyebrow light"><i /> 瀏覽器直接使用</span><h1>Google Drive 重複檔案清理器</h1><p>先掃描、再預覽、再選擇處理方式。預設移至垃圾桶；永久刪除是獨立高風險功能。每組至少保留一份，檔案內容不會上傳到 DUPESPACE。</p></div></section><section className="shell cleaner-wrap"><CleanerClient /></section><SiteFooter /></main>;
}
