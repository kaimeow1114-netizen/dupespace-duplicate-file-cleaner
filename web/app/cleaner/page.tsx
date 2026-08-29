import type { Metadata } from "next";
import { CleanerClient } from "../components/cleaner-client";
import { SiteFooter, SiteHeader } from "../components/site-shell";
import { ArrowRight, Cloud, HardDrive, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "重複檔案清理器｜Google Drive 與 Windows",
  description: "線上清理 Google Drive，或使用 Windows 桌面版安全整理本機資料夾。預設移至垃圾桶，每個重複群組至少保留一份。",
  alternates: { canonical: "/cleaner" },
};

export default function CleanerPage() {
  const breadcrumb = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "首頁", item: "https://dupespace.app/" }, { "@type": "ListItem", position: 2, name: "Google Drive 重複檔案清理器", item: "https://dupespace.app/cleaner" }] };
  return <main className="cleaner-page"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} /><SiteHeader /><section className="cleaner-hero"><div className="shell"><span className="eyebrow light"><ShieldCheck size={16} aria-hidden="true" /> GOOGLE DRIVE + WINDOWS</span><h1><span className="heading-phrase">重複檔案，</span><wbr /><span className="heading-phrase">清楚分組、安心處理。</span></h1><p>DUPESPACE 同時支援 Google Drive 與 Windows 本機資料夾。線上版免安裝，依影片、圖片、PDF 與重要文件排序；Windows 版只在電腦本機完成雜湊比對，每組鎖定最舊檔並使用資源回收筒。</p></div></section><section className="cleaner-wrap"><nav className="cleaner-source-switch" aria-label="選擇清理位置"><a className="active" href="/cleaner" aria-current="page"><span className="source-icon"><Cloud size={22} aria-hidden="true" /></span><span><b>Google Drive 線上清理</b><small>免安裝，透過 Google Drive 垃圾桶保留復原機會</small></span><em>目前使用</em></a><a href="/download"><span className="source-icon"><HardDrive size={22} aria-hidden="true" /></span><span><b>Windows 本機資料夾</b><small>拖入資料夾即可遞迴掃描，另有子資料夾保護</small></span><ArrowRight size={20} aria-hidden="true" /></a></nav><p className="local-cleanup-note"><ShieldCheck size={17} aria-hidden="true" /><span>為了讓本機清理維持可復原，DUPESPACE 不在瀏覽器中永久移除 Windows 檔案；請使用免費桌面版完成本機清理。</span></p><CleanerClient /></section><SiteFooter /></main>;
}
