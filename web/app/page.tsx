import { AdPanel } from "./components/ad-panel";
import { SiteFooter, SiteHeader } from "./components/site-shell";
import Image from "next/image";

const repo = "https://github.com/kaimeow1114-netizen/dupesweep-duplicate-file-cleaner";
const download = `${repo}/releases/latest/download/DupeSweep-Setup.exe`;

export default function Home() {
  const structuredData = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "DUPESWEEP", url: "https://dupesweep.app", inLanguage: ["zh-Hant-TW", "en"] },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DUPESWEEP", applicationCategory: "UtilitiesApplication", operatingSystem: "Windows 10, Windows 11, Web", url: "https://dupesweep.app", downloadUrl: download, offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" }, featureList: "重複檔案搜尋、Google Drive 重複檔案清理、Windows 資源回收筒、CSV 稽核報告" },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: "DUPESWEEP 會直接永久刪除檔案嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。預設永遠是移至垃圾桶。永久刪除是獨立的高風險進階功能，必須主動選擇並再次確認。" } },
      { "@type": "Question", name: "可以處理超過 5,000 個重複檔案嗎？", acceptedAnswer: { "@type": "Answer", text: "可以。DUPESWEEP 採漸進載入與分批處理，避免一次渲染或送出所有項目。" } },
      { "@type": "Question", name: "Google Drive 檔案內容會上傳到 DUPESWEEP 嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。服務只使用 Google Drive 提供的必要中繼資料與校驗碼，檔案內容不會上傳到 DUPESWEEP 伺服器。" } },
    ] },
  ];
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow"><i /> 免費・透明・可復原</span>
          <h1><span className="headline-line">把重複檔案掃乾淨，</span><em className="headline-line">空間拿回來。</em></h1>
          <p>
            DUPESWEEP 精準比對檔案內容，保留一份原檔，再把多餘副本移到垃圾桶。
            需要時也可主動選擇永久刪除，但會經過不可略過的高風險確認。
          </p>
          <div className="hero-actions">
            <a className="button primary" href="/cleaner">線上清理 Google Drive <span>→</span></a>
            <a className="button secondary" href={download}>免費下載 Windows 版</a>
          </div>
          <div className="trust-row">
            <span>✓ SHA-256 精準比對</span>
            <span>✓ 支援 5,000+ 檔案</span>
            <span>✓ 預設移至垃圾桶</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="DupeSweep 空間回收示意">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <Image src="/dupesweep-icon.png" alt="DupeSweep 圖示" width={520} height={520} priority />
          <div className="space-card">
            <span>預計節省</span>
            <strong>18.6 GB</strong>
            <div className="mini-meter"><i /></div>
            <small>重複空間已選 82%</small>
          </div>
          <div className="safe-chip">保留最舊副本</div>
        </div>
      </section>

      <section className="stats-strip">
        <div className="shell stats-grid">
          <div><strong>2</strong><span>種清理方式</span></div>
          <div><strong>100</strong><span>個一批安全處理</span></div>
          <div><strong>1+</strong><span>每組至少保留一份</span></div>
          <div><strong>∞</strong><span>免費使用</span></div>
        </div>
      </section>

      <section className="section shell" id="features">
        <div className="section-heading">
          <span className="eyebrow"><i /> 安全第一</span>
          <h2>你看得懂，也控制得住的清理流程</h2>
          <p>每一步都顯示檔案數量、可回收容量與百分比；大量處理還會要求輸入確認文字。</p>
        </div>
        <div className="feature-grid">
          <article><b>01</b><h3>內容級比對</h3><p>不是只看檔名。Windows 使用完整 SHA-256，Drive 使用 Google 提供的內容校驗碼。</p></article>
          <article><b>02</b><h3>一份永遠保留</h3><p>每組自動保護最舊副本，保留檔無法勾選；檔案在掃描後改變也會中止移除。</p></article>
          <article><b>03</b><h3>動畫量化空間</h3><p>掃描與清理進度持續動態呈現，同時顯示節省容量、可回收比例及總容量占比。</p></article>
        </div>
      </section>

      <section className="section alternate">
        <div className="shell split">
          <div>
            <span className="eyebrow light"><i /> 不想安裝？</span>
            <h2>登入 Google，直接在瀏覽器完成。</h2>
            <p>OAuth 權杖存放於加密的 HttpOnly Cookie，檔案內容不經過 DUPESWEEP 伺服器。掃描證明 30 分鐘後自動失效。</p>
            <a className="button mint" href="/cleaner">開啟線上清理器</a>
          </div>
          <ol className="steps">
            <li><span>1</span><div><b>Google 授權</b><small>只在你確認後連接 Drive</small></div></li>
            <li><span>2</span><div><b>掃描與預覽</b><small>先看群組、檔案與可回收容量</small></div></li>
            <li><span>3</span><div><b>移至垃圾桶</b><small>仍可從 Google Drive 垃圾桶復原</small></div></li>
          </ol>
        </div>
      </section>

      <section className="section shell faq-section" id="faq">
        <div className="section-heading"><span className="eyebrow"><i /> 常見問題</span><h2>刪除之前，先把安全規則說清楚</h2></div>
        <details><summary>DUPESWEEP 會直接永久刪除檔案嗎？</summary><p>不會。預設永遠是移至垃圾桶。永久刪除是獨立的高風險選項，必須主動選擇，且警告無法停用。</p></details>
        <details><summary>可以處理超過 5,000 個重複檔案嗎？</summary><p>可以。介面採漸進載入，操作以小批次執行並可安全停止，不會一次把 5,000 筆全部渲染或送出。</p></details>
        <details><summary>Google Drive 檔案內容會上傳嗎？</summary><p>不會。比對使用 Google 提供的校驗碼；檔案內容不會上傳到 DUPESWEEP 伺服器。</p></details>
      </section>

      <section className="section shell download-section" id="download">
        <div className="download-card">
          <Image src="/dupesweep-icon.png" alt="" width={140} height={140} />
          <div><span className="eyebrow"><i /> Windows 10 / 11</span><h2>本機檔案交給桌面版</h2><p>安裝時可選擇建立桌面捷徑；主程式、Google Drive 與 CSV 稽核報告一次備妥。</p></div>
          <a className="button primary" href={download}>下載安裝程式</a>
        </div>
      </section>

      <div className="shell"><AdPanel /></div>
      <SiteFooter />
    </main>
  );
}
