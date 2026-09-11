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
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DUPESPACE", applicationCategory: "UtilitiesApplication", operatingSystem: "Windows 10, Windows 11, Web", url: "https://dupespace.app/", downloadUrl: `${repo}/releases/latest`, offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" }, featureList: "兩個資料夾合併前核對、改名重複檔案辨識、同路徑版本衝突偵測、瀏覽器本機重複檔案分析、Windows 可復原清理、CSV 報告" },
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
          <h1><span className="headline-line">看懂兩個資料夾，</span><span className="headline-line gradient-text">再安心合併。</span></h1>
          <p className="hero-english" lang="en">Find renamed duplicates. Prevent merge mistakes.</p>
          <p className="purpose-statement"><strong>DUPESPACE 是免費、開源的資料夾合併核對與重複檔案工具。</strong>免登入、檔案不上傳到伺服器，先找出改名後的相同檔案、單邊缺漏與版本衝突；網頁只產生唯讀結果，不會更動檔案。</p>
          <MotionHeroActions />
          <div className="trust-row"><span><CheckCircle2 size={14} aria-hidden="true" />辨識改名重複</span><span><CheckCircle2 size={14} aria-hidden="true" />標出版本衝突</span><span><CheckCircle2 size={14} aria-hidden="true" />不上傳到伺服器</span><a href="/privacy">隱私權政策</a></div>
          </div>
          <div className="hero-dashboard-wrap"><HeroDashboard /></div>
        </div>
      </section>

      <section className="stats-strip"><div className="shell stats-grid"><div><strong>2</strong><span>資料夾左右核對</span></div><div><strong>5</strong><span>合併結果分類</span></div><div><strong>0</strong><span>傳送至伺服器</span></div><div><strong>0</strong><span>網頁寫入權限</span></div></div></section>

      <section className="section feature-band" id="features"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> SAFE BY DESIGN</span><h2><span className="heading-phrase">先建立合併地圖，</span><wbr /><span className="heading-phrase">再決定下一步。</span></h2><p>檔名不同不代表內容不同，同一路徑也可能是不同版本。DUPESPACE 用完整內容核對，並把專案、程式與備份情境留給你確認。</p></div><SafetyMotionGrid /></div></section>

      <section className="section alternate"><div className="shell split"><div><span className="eyebrow light"><Layers3 size={15} aria-hidden="true" /> HOW IT WORKS</span><h2><span className="heading-phrase">比對真正內容，</span><wbr /><span className="heading-phrase">不被檔名騙過。</span></h2><p>選擇待合併與目的資料夾後，DUPESPACE 先按大小與樣本縮小範圍，再以完整內容指紋確認。結果會分開顯示已存在內容、新檔案、目的端獨有檔案與版本衝突。</p><a className="button mint" href="/merge">開啟合併前核對</a></div><HowItWorksMotion /></div></section>

      <section className="section retention-band" id="insights"><div className="shell retention-section"><div className="section-heading"><span className="eyebrow"><TrendingUp size={15} aria-hidden="true" /> FILE INTELLIGENCE</span><h2><span className="heading-phrase">不是多一張重複清單，</span><wbr /><span className="heading-phrase">而是一份能採取行動的合併地圖。</span></h2><p>內容完全相同，不代表用途相同。DUPESPACE 先縮小候選、完整確認內容，再把版本衝突、用途風險與改名後的相同內容分開呈現。</p></div><StorageIntelligenceMotion /></div></section>

      <section className="section privacy-band"><div className="shell privacy-feature"><div><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> LOCAL-FIRST PRIVACY</span><h2><span className="heading-phrase">選取兩個資料夾，</span><wbr /><span className="heading-phrase">內容仍留在你的裝置。</span></h2><p>不用建立帳號。選取資料夾只是在作業系統中授權目前分頁讀取；檔案不會傳送到 DUPESPACE 伺服器，核對結果保留在本機記憶體。</p><div className="privacy-actions"><a className="button primary" href="/merge">合併前先核對</a><a className="text-link" href="/privacy">閱讀隱私權政策</a></div></div><PrivacyFlowMotion /></div></section>

      <section className="section trust-section"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> WHY TRUST DUPESPACE</span><h2><span className="heading-phrase">安全主張，</span><wbr /><span className="heading-phrase">可以用原始碼驗證。</span></h2></div><TrustMatrixMotion repository={repo} /></div></section>

      <section className="section faq-band" id="faq"><div className="shell faq-section"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> 常見問題</span><h2><span className="heading-phrase">開始之前，</span><wbr /><span className="heading-phrase">先把安全規則說清楚。</span></h2></div><FaqMotion /></div></section>

      <section className="section download-band" id="download"><div className="shell download-section"><div className="download-card"><div className="download-mark"><HardDriveDownload size={48} aria-hidden="true" /></div><div><span className="eyebrow"><HardDriveDownload size={15} aria-hidden="true" /> WINDOWS 10 / 11</span><h2><span className="heading-phrase">需要真正清理檔案？</span><wbr /><span className="heading-phrase">Windows 版免費開源。</span></h2><p>拖入資料夾，查看重複群組與完整路徑，再整理確認不需要的副本。常用位置、子資料夾保護與 CSV 報告，讓下一次整理更順手。</p></div><a className="button secondary" href="/download">查看 Windows 版</a></div></div></section>
      <GuideLinks />
      <AdPanel />
      <SiteFooter />
    </main>
  );
}
