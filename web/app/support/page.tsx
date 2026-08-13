import type { Metadata } from "next";
import { AdPanel } from "../components/ad-panel";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "檔案整理指南" };

export default function SupportPage() {
  return <main><SiteHeader /><section className="guide-hero"><div className="shell"><span className="eyebrow"><i /> 免費整理指南</span><h1>先安全，再變乾淨。</h1><p>大量刪檔不該靠猜。用這份流程，在回收空間的同時保護重要資料。</p></div></section><section className="shell guide-grid"><article><span>01</span><h2>先從小資料夾測試</h2><p>第一次使用桌面版時，先選一個包含幾份測試副本的資料夾，確認掃描、保留與資源回收筒都符合預期。</p></article><article><span>02</span><h2>看內容，不只看檔名</h2><p>相同檔名可能是不同版本；不同檔名也可能內容完全一致。DupeSweep 使用內容校驗碼分組，但你仍應查看日期與位置。</p></article><article><span>03</span><h2>垃圾桶不是永久備份</h2><p>Windows 與 Google Drive 都可能依政策自動清空垃圾桶。重要資料需要獨立備份，不能只依賴復原期限。</p></article><article><span>04</span><h2>5,000 份以上分批確認</h2><p>網頁版以每批最多 100 個項目處理，顯示動畫進度並允許在批次之間安全停止；重新掃描即可接續。</p></article></section><div className="shell"><AdPanel /></div><SiteFooter /></main>;
}
