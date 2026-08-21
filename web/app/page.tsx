import Image from "next/image";
import { AdPanel } from "./components/ad-panel";
import { SiteFooter, SiteHeader } from "./components/site-shell";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";
const download = `${repo}/releases/latest/download/DupeSpace-Setup.exe`;

export default function Home() {
  const structuredData = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "DUPESPACE", url: "https://dupespace.app", inLanguage: ["zh-Hant-TW", "en"] },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DUPESPACE", applicationCategory: "UtilitiesApplication", operatingSystem: "Windows 10, Windows 11, Web", url: "https://dupespace.app", downloadUrl: download, offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" }, featureList: "保留區與清理區、內容級重複檔案比對、Google Drive 清理、Windows 資源回收筒、CSV 稽核報告" },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: "DUPESPACE 會直接永久刪除檔案嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。預設永遠是移至垃圾桶。永久刪除是獨立的高風險進階功能，必須主動選擇並再次確認。" } },
      { "@type": "Question", name: "為什麼 Windows 版要分保留區與清理區？", acceptedAnswer: { "@type": "Answer", text: "內容相同不代表另一個路徑的副本沒有用途。Windows 版只顯示同時出現在保留區與清理區的精確重複檔，保留區檔案永遠不可刪除。" } },
      { "@type": "Question", name: "不同程式碼專案中的相同設定檔會被刪除嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。程式碼專案、套件目錄與虛擬環境屬於硬性保護範圍，不會雜湊、不會顯示為重複候選，也不能手動解鎖。" } },
      { "@type": "Question", name: "Google Drive 檔案內容會上傳到 DUPESPACE 嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。服務只使用 Google Drive 提供的必要中繼資料與校驗碼，檔案內容不會上傳到 DUPESPACE 伺服器。" } },
    ] },
  ];
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow"><i /> FREE • OPEN SOURCE • PRIVACY-FIRST</span>
          <h1><span className="headline-line">找出重複檔案，</span><em className="headline-line">把空間拿回來。</em></h1>
          <p className="hero-english" lang="en">Find duplicate files. Free up your space.</p>
          <p>免費、開源的 Google Drive 與 Windows 重複檔案清理工具。直接在網頁查看重複群組，再把你選定的副本移至垃圾桶。</p>
          <div className="hero-actions">
            <a className="button primary" href="/cleaner">線上清理 Google Drive <span>→</span></a>
            <a className="button secondary" href="/download">了解 Windows 版</a>
            <a className="button secondary" href={repo}>在 GitHub 查看原始碼</a>
          </div>
          <div className="trust-row"><span>✓ 免費</span><span>✓ 完全開源</span><span>✓ 預設可復原</span><span>✓ 檔案內容不會上傳</span></div>
        </div>
        <div className="hero-visual" aria-label="DupeSpace 空間回收示意">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <Image src="/dupespace-icon.png" alt="DupeSpace 雲朵文件圖示" width={520} height={520} priority />
          <div className="space-card"><span>預計節省</span><strong>18.6 GB</strong><div className="mini-meter"><i /></div><small>先檢查，再移至垃圾桶</small></div>
          <div className="safe-chip">保留區永遠不刪</div>
        </div>
      </section>

      <section className="stats-strip"><div className="shell stats-grid"><div><strong>2</strong><span>保留區與清理區</span></div><div><strong>100</strong><span>個一批安全處理</span></div><div><strong>1+</strong><span>每組至少保留一份</span></div><div><strong>∞</strong><span>免費使用</span></div></div></section>

      <section className="section shell" id="features">
        <div className="section-heading"><span className="eyebrow"><i /> SAFE BY DESIGN • 先確認，再清理</span><h2><span className="heading-phrase">先確認每份用途，</span><wbr /><span className="heading-phrase">再放心清出空間。</span></h2><p>內容相同只代表「重複候選」，不代表另一個位置的副本沒有用途。DUPESPACE 會先保護專案、程式與重要來源。</p></div>
        <div className="safety-grid">
          <article><b>01</b><h3>預設不永久刪除</h3><p>檔案先進 Windows 資源回收筒或 Google Drive 垃圾桶；失敗時不會降級成永久刪除。</p></article>
          <article><b>02</b><h3>保留區永遠保護</h3><p>Windows 只列出跨保留區與清理區的精確重複群組，保留區內每一份檔案都不可選取。</p></article>
          <article><b>03</b><h3>程式碼專案不碰</h3><p>不同專案裡相同的設定、依賴與外掛可能各自必要；專案檔案硬性排除，不能解鎖。</p></article>
          <article><b>04</b><h3>檔案變更就中止</h3><p>操作前重新驗證路徑、大小、時間與完整校驗碼，掃描後有變化就安全跳過。</p></article>
        </div>
      </section>

      <section className="section alternate"><div className="shell split"><div><span className="eyebrow light"><i /> 內容級精確比對</span><h2><span className="heading-phrase">比對檔案內容，</span><wbr /><span className="heading-phrase">不靠檔名猜測。</span></h2><p>Windows 先按大小分組，再使用完整 SHA-256 內容雜湊。0 位元組忽略，小於 1 MiB 可查看但不會預先勾選。</p><a className="button mint" href="/support">了解安全整理方式</a></div><ol className="steps"><li><span>1</span><div><b>指定保留區</b><small>重要來源與原始資料永遠保護</small></div></li><li><span>2</span><div><b>指定清理區</b><small>只找已有保留區副本的檔案</small></div></li><li><span>3</span><div><b>檢查後移至垃圾桶</b><small>高風險永久刪除另行確認</small></div></li></ol></div></section>

      <section className="section shell privacy-feature"><div><span className="eyebrow"><i /> GOOGLE DRIVE PRIVACY</span><h2><span className="heading-phrase">你的檔案留在</span><wbr /><span className="heading-phrase" lang="en">Google Drive。</span></h2><p>DUPESPACE 不會把檔案內容下載到我們的伺服器。重複比對使用 Google Drive API 提供的校驗碼與必要中繼資料；登入權杖存放於加密的 HttpOnly Cookie。</p><a className="button primary" href="/cleaner">開啟線上清理器</a></div><div className="privacy-card"><b>技術細節</b><p>登入工作階段與掃描證明都會在 30 分鐘後失效；每次垃圾桶或永久刪除前，重新檢查檔案 ID、版本、所有權、權限、修改時間與校驗碼。</p></div></section>

      <section className="section trust-section"><div className="shell"><div className="section-heading"><span className="eyebrow"><i /> 為什麼選擇 DupeSpace？</span><h2><span className="heading-phrase">安全主張，</span><wbr /><span className="heading-phrase">可以直接看</span><wbr /><span className="heading-phrase">程式碼驗證。</span></h2></div><div className="trust-table" role="table" aria-label="傳統清理工具與 DupeSpace 比較"><div role="row"><b role="columnheader">傳統清理工具</b><b role="columnheader">DUPESPACE</b></div><div role="row"><span>可能只看檔名</span><span>比對檔案內容</span></div><div role="row"><span>可能直接刪除</span><span>預設移至垃圾桶</span></div><div role="row"><span>黑盒操作</span><span>每一步可檢查與匯出 CSV</span></div><div role="row"><span>雲端也要安裝</span><span>Google Drive 可直接使用網頁版</span></div><div role="row"><span>無法驗證宣稱</span><span>完全開源</span></div></div><p className="open-source-line" lang="en">Read the code. Verify the claims. Run it yourself.</p></div></section>

      <section className="section shell faq-section" id="faq"><div className="section-heading"><span className="eyebrow"><i /> 常見問題</span><h2><span className="heading-phrase">刪除之前，</span><wbr /><span className="heading-phrase">先把安全規則</span><wbr /><span className="heading-phrase">說清楚。</span></h2></div><details><summary>DUPESPACE 會直接永久刪除檔案嗎？</summary><p>不會。預設永遠是移至垃圾桶。永久刪除是獨立高風險選項，必須重新手動選取，且警告無法停用。</p></details><details><summary>為什麼 Windows 版要選保留區與清理區？</summary><p>因為內容相同不等於另一份沒有用途。只有清理區檔案在保留區已有相同內容時才會列出，保留區檔案永遠不能刪除。</p></details><details><summary>不同專案中的相同設定檔會被處理嗎？</summary><p>不會。Git、SVN、常見建置專案、套件目錄與虛擬環境中的檔案會被硬性排除，不雜湊、不列為候選，也不能手動解鎖。</p></details><details><summary>Google Drive 檔案內容會上傳嗎？</summary><p>不會。比對使用 Google 提供的校驗碼；檔案內容不會上傳到 DUPESPACE 伺服器。</p></details></section>

      <section className="section shell download-section" id="download"><div className="download-card"><Image src="/dupespace-icon.png" alt="" width={140} height={140} /><div><span className="eyebrow"><i /> Windows 10 / 11</span><h2><span className="heading-phrase">先了解安全規則，</span><wbr /><span className="heading-phrase">再免費下載。</span></h2><p>Windows 版採用保留區／清理區流程，程式碼專案硬性排除；下載頁會先說明適用範圍、安裝方式與復原規則。</p></div><a className="button primary" href="/download">查看下載說明</a></div></section>
      <AdPanel />
      <SiteFooter />
    </main>
  );
}
