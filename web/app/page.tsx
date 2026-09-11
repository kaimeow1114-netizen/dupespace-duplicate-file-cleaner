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
          <h1><span className="headline-line">合併資料夾前，</span><span className="headline-line gradient-text">先把差異看清楚。</span></h1>
          <p className="hero-english" lang="en">Find renamed duplicates. Prevent merge mistakes.</p>
          <p className="purpose-statement"><strong>DUPESPACE 幫你比較兩個資料夾，</strong>找出改過名稱的重複檔案、缺少的內容和版本衝突。全程在瀏覽器完成，不用登入，也不會上傳或更動檔案。</p>
          <MotionHeroActions />
          <div className="trust-row"><span><CheckCircle2 size={14} aria-hidden="true" />辨識改名重複</span><span><CheckCircle2 size={14} aria-hidden="true" />標出版本衝突</span><span><CheckCircle2 size={14} aria-hidden="true" />不上傳到伺服器</span><a href="/privacy">隱私權政策</a></div>
          </div>
          <div className="hero-dashboard-wrap"><HeroDashboard /></div>
        </div>
      </section>

      <section className="stats-strip"><div className="shell stats-grid"><div><strong>2</strong><span>兩個資料夾一起比較</span></div><div><strong>5</strong><span>5 種差異一次整理</span></div><div><strong>0</strong><span>檔案不上傳</span></div><div><strong>0</strong><span>網頁不會更動檔案</span></div></div></section>

      <section className="section feature-band" id="features"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> SAFE BY DESIGN</span><h2><span className="heading-phrase">先看清楚哪些相同、哪些缺少，</span><wbr /><span className="heading-phrase">再決定怎麼合併。</span></h2><p>即使檔案改過名稱或搬到其他資料夾，DUPESPACE 仍能透過內容找出相同檔案。遇到同名但內容不同的版本，也會另外標示，不替你冒險決定。</p></div><SafetyMotionGrid /></div></section>

      <section className="section alternate"><div className="shell split"><div><span className="eyebrow light"><Layers3 size={15} aria-hidden="true" /> HOW IT WORKS</span><h2><span className="heading-phrase">比對真正內容，</span><wbr /><span className="heading-phrase">不被檔名騙過。</span></h2><p>先快速找出可能相同的檔案，再完整確認內容，避免只靠檔名判斷。比較完成後，你會清楚看見哪些已經存在、哪些可以新增，以及哪些版本需要自己決定。</p><details className="technical-details"><summary>了解比對方式</summary><p>系統先以檔案大小和抽樣內容排除不可能相同的項目，最後逐段讀取完整檔案並計算 SHA-256 內容指紋；快速篩選不會直接決定兩個檔案相同。</p></details><a className="button mint" href="/merge">比較兩個資料夾</a></div><HowItWorksMotion /></div></section>

      <section className="section retention-band" id="insights"><div className="shell retention-section"><div className="section-heading"><span className="eyebrow"><TrendingUp size={15} aria-hidden="true" /> FILE INTELLIGENCE</span><h2><span className="heading-phrase">不只列出重複，</span><wbr /><span className="heading-phrase">還告訴你該先看哪裡。</span></h2><p>內容相同，不代表其中一份一定沒用。DUPESPACE 會把版本衝突、需要人工確認的項目，以及改名後仍相同的檔案分開整理，讓你更快做出安全決定。</p></div><StorageIntelligenceMotion /></div></section>

      <section className="section privacy-band"><div className="shell privacy-feature"><div><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> LOCAL-FIRST PRIVACY</span><h2><span className="heading-phrase">你選的檔案，</span><wbr /><span className="heading-phrase">只留在你的裝置。</span></h2><p>檔案只會在目前的瀏覽器分頁中分析。內容、名稱和路徑都不會上傳；關閉分頁後，未匯出的結果也會消失。</p><div className="privacy-actions"><a className="button primary" href="/merge">比較兩個資料夾</a><a className="text-link" href="/privacy">閱讀隱私權政策</a></div></div><PrivacyFlowMotion /></div></section>

      <section className="section trust-section"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> WHY TRUST DUPESPACE</span><h2><span className="heading-phrase">不只說安全，</span><wbr /><span className="heading-phrase">做法也公開給你看。</span></h2><p>DUPESPACE 完全開源。你可以查看原始碼、確認檔案如何被分析，也可以自行建置執行。</p></div><TrustMatrixMotion repository={repo} /></div></section>

      <section className="section faq-band" id="faq"><div className="shell faq-section"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> 常見問題</span><h2><span className="heading-phrase">開始之前，</span><wbr /><span className="heading-phrase">先把安全規則說清楚。</span></h2></div><FaqMotion /></div></section>

      <section className="section download-band" id="download"><div className="shell download-section"><div className="download-card"><div className="download-mark"><HardDriveDownload size={48} aria-hidden="true" /></div><div><span className="eyebrow"><HardDriveDownload size={15} aria-hidden="true" /> WINDOWS 10 / 11</span><h2><span className="heading-phrase">需要真正清理檔案？</span><wbr /><span className="heading-phrase">Windows 版免費開源。</span></h2><p>拖入資料夾，查看重複群組與完整路徑，再整理確認不需要的副本。常用位置、子資料夾保護與 CSV 報告，讓下一次整理更順手。</p></div><a className="button secondary" href="/download">下載 Windows 清理工具</a></div></div></section>
      <GuideLinks />
      <AdPanel />
      <SiteFooter />
    </main>
  );
}
