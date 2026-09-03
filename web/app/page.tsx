import { productFaq } from "../lib/product-copy";
import { GuideLinks } from "./components/guide-links";
import { headers } from "next/headers";
import { AdPanel } from "./components/ad-panel";
import { HeroDashboard } from "./components/hero-dashboard";
import { FaqMotion, PrivacyFlowMotion, StorageIntelligenceMotion, TrustMatrixMotion } from "./components/lower-page-motion";
import { HowItWorksMotion, MotionHeroActions, SafetyMotionGrid } from "./components/motion-showcase";
import { SiteFooter, SiteHeader } from "./components/site-shell";
import { CheckCircle2, HardDriveDownload, Layers3, ShieldCheck, TrendingUp } from "lucide-react";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";

export default async function Home() {
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const structuredData = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "DUPESPACE", url: "https://dupespace.app/", inLanguage: ["zh-TW", "en"] },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DUPESPACE", applicationCategory: "UtilitiesApplication", operatingSystem: "Windows 10, Windows 11, Web", url: "https://dupespace.app/", downloadUrl: `${repo}/releases/latest`, offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" }, featureList: "瀏覽器本機重複檔案分析、Windows 重複檔案清理、照片與影片精確重複搜尋、CSV 稽核報告" },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: productFaq["zh-TW"].map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })) },
  ];
  return (
    <main>
      <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> FREE • OPEN SOURCE • PRIVACY-FIRST</span>
          <h1><span className="headline-line">精確比對內容，</span><span className="headline-line gradient-text">主動守護您的儲存空間。</span></h1>
          <p className="hero-english" lang="en">Find duplicate files. Keep what matters.</p>
          <p className="purpose-statement"><strong>DUPESPACE 是免費、開源的重複檔案搜尋與清理工具。</strong>免登入、免上傳，在瀏覽器分析你選取的資料夾；需要整理副本時，使用 Windows 版檢查完整路徑，再移至資源回收筒。</p>
          <MotionHeroActions />
          <div className="trust-row"><span><CheckCircle2 size={14} aria-hidden="true" />零上傳分析</span><span><CheckCircle2 size={14} aria-hidden="true" />網頁不刪檔</span><span><CheckCircle2 size={14} aria-hidden="true" />每組保留一份</span><a href="/privacy">隱私權政策</a></div>
          </div>
          <div className="hero-dashboard-wrap"><HeroDashboard /></div>
        </div>
      </section>

      <section className="stats-strip"><div className="shell stats-grid"><div><strong>0</strong><span>網頁上傳檔案</span></div><div><strong>2</strong><span>瀏覽器分析／Windows 清理</span></div><div><strong>1+</strong><span>每組至少保留一份</span></div><div><strong>0</strong><span>網頁刪除權限</span></div></div></section>

      <section className="section feature-band" id="features"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> SAFE BY DESIGN</span><h2><span className="heading-phrase">讓每次清理，</span><wbr /><span className="heading-phrase">都有清楚的安全邊界。</span></h2><p>內容相同只能成為候選。DUPESPACE 先保護用途、來源與目錄情境，再讓使用者決定要處理哪一份。</p></div><SafetyMotionGrid /></div></section>

      <section className="section alternate"><div className="shell split"><div><span className="eyebrow light"><Layers3 size={15} aria-hidden="true" /> HOW IT WORKS</span><h2><span className="heading-phrase">比對檔案內容，</span><wbr /><span className="heading-phrase">不靠檔名猜測。</span></h2><p>網頁版先以大小縮小候選範圍，再於裝置端計算分塊內容指紋；Windows 版針對大量與大型檔案提供完整的本機掃描、保護規則與可復原清理。檔名相同不代表內容相同，內容相同也不代表其他路徑沒有用途。</p><a className="button mint" href="/support">閱讀安全整理指南</a></div><HowItWorksMotion /></div></section>

      <section className="section retention-band" id="insights"><div className="shell retention-section"><div className="section-heading"><span className="eyebrow"><TrendingUp size={15} aria-hidden="true" /> STORAGE INTELLIGENCE</span><h2><span className="heading-phrase">把一次整理，</span><wbr /><span className="heading-phrase">變成持續可見的成果。</span></h2><p>接下來聚焦重複整理、影音管理與備份核對。下方為功能方向示意，不是你的裝置數據；本次網頁版提供精確重複分析與 CSV 報告。</p></div><StorageIntelligenceMotion /></div></section>

      <section className="section privacy-band"><div className="shell privacy-feature"><div><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> LOCAL-FIRST PRIVACY</span><h2><span className="heading-phrase">選取你的資料夾，</span><wbr /><span className="heading-phrase">檔案仍留在你的裝置。</span></h2><p>不用建立帳號，也不用上傳檔案。你選取的內容只在自己的瀏覽器中比對；檔案清單、路徑與分析結果留在這台裝置。網頁版只產生報告，不會修改或刪除檔案。</p><div className="privacy-actions"><a className="button primary" href="/local">開始本機分析</a><a className="text-link" href="/privacy">閱讀隱私權政策</a></div></div><PrivacyFlowMotion /></div></section>

      <section className="section trust-section"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> WHY TRUST DUPESPACE</span><h2><span className="heading-phrase">安全主張，</span><wbr /><span className="heading-phrase">可以用原始碼驗證。</span></h2></div><TrustMatrixMotion repository={repo} /></div></section>

      <section className="section faq-band" id="faq"><div className="shell faq-section"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> 常見問題</span><h2><span className="heading-phrase">開始之前，</span><wbr /><span className="heading-phrase">先把安全規則說清楚。</span></h2></div><FaqMotion /></div></section>

      <section className="section download-band" id="download"><div className="shell download-section"><div className="download-card"><div className="download-mark"><HardDriveDownload size={48} aria-hidden="true" /></div><div><span className="eyebrow"><HardDriveDownload size={15} aria-hidden="true" /> WINDOWS 10 / 11</span><h2><span className="heading-phrase">需要真正清理檔案？</span><wbr /><span className="heading-phrase">Windows 版免費開源。</span></h2><p>拖入資料夾，查看重複群組與完整路徑，再整理確認不需要的副本。常用位置、子資料夾保護與 CSV 報告，讓下一次整理更順手。</p></div><a className="button secondary" href="/download">查看 Windows 版</a></div></div></section>
      <GuideLinks />
      <AdPanel />
      <SiteFooter />
    </main>
  );
}
