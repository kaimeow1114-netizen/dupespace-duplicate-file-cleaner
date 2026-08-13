/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids Vinext's deployed Link interception bug. */
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "./components/site-shell";

export const metadata: Metadata = { title: "找不到頁面", robots: { index: false, follow: true } };

export default function NotFound() {
  return <main><SiteHeader /><section className="not-found shell"><span>404</span><h1>這裡沒有重複檔案，連頁面也不在。</h1><p>網址可能已變更。回到首頁，或直接開啟 Google Drive 重複檔案清理器。</p><div><a className="button primary" href="/">返回首頁</a><a className="button secondary" href="/cleaner">開啟線上清理器</a></div></section><SiteFooter /></main>;
}
