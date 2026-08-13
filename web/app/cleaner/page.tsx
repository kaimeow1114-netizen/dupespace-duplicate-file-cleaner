import type { Metadata } from "next";
import { AdPanel } from "../components/ad-panel";
import { CleanerClient } from "../components/cleaner-client";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "Google Drive 線上清理器" };

export default function CleanerPage() {
  return <main><SiteHeader /><section className="cleaner-hero"><div className="shell"><span className="eyebrow light"><i /> 瀏覽器直接使用</span><h1>Google Drive 重複檔案清理器</h1><p>先掃描、再預覽，最後才移至垃圾桶。每組至少保留一份，檔案內容不會上傳到 DupeSweep。</p></div></section><section className="shell cleaner-wrap"><CleanerClient /><AdPanel /></section><SiteFooter /></main>;
}
