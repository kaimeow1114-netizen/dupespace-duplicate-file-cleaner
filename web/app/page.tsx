import { AdPanel } from "./components/ad-panel";
import { HeroDashboard } from "./components/hero-dashboard";
import { MotionHeroActions, SafetyMotionGrid } from "./components/motion-showcase";
import { SiteFooter, SiteHeader } from "./components/site-shell";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";

export default function Home() {
  const structuredData = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "DUPESPACE", url: "https://dupespace.app/", inLanguage: ["zh-Hant-TW", "en"] },
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DUPESPACE", applicationCategory: "UtilitiesApplication", operatingSystem: "Windows 10, Windows 11, Web", url: "https://dupespace.app/", downloadUrl: `${repo}/releases/latest`, offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" }, featureList: "內容級重複檔案與資料夾比對、Google Drive 清理、Windows 資源回收筒、CSV 稽核報告" },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [
      { "@type": "Question", name: "DUPESPACE 的用途是什麼？", acceptedAnswer: { "@type": "Answer", text: "DUPESPACE 用來找出、檢查並安全移除 Windows 與 Google Drive 中內容完全相同的重複檔案與重複資料夾。" } },
      { "@type": "Question", name: "DUPESPACE 會直接永久刪除檔案嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。預設永遠是移至垃圾桶。永久刪除只適用一般檔案，必須主動選擇並再次確認；資料夾永遠不能永久刪除。" } },
      { "@type": "Question", name: "不同程式碼專案中的相同設定檔會被刪除嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。程式碼專案、套件目錄與虛擬環境屬於硬性保護範圍，不會列為清理候選。" } },
      { "@type": "Question", name: "Google Drive 檔案內容會上傳到 DUPESPACE 嗎？", acceptedAnswer: { "@type": "Answer", text: "不會。服務只使用 Google Drive API 提供的必要中繼資料與校驗碼，檔案內容不會上傳到 DUPESPACE 伺服器。" } },
    ] },
  ];
  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      <SiteHeader />
      <section className="hero shell">
        <div className="hero-copy">
          <span className="eyebrow"><i /> FREE • OPEN SOURCE • PRIVACY-FIRST</span>
          <h1><span className="headline-line">找出重複檔案，</span><span className="headline-line gradient-text">把寶貴空間徹底拿回來。</span></h1>
          <p className="hero-english" lang="en">Find duplicate files. Free up your space.</p>
          <p className="purpose-statement"><strong>DUPESPACE 是一套免費、開源的重複檔案清理工具。</strong>協助你找出、檢查並安全移除 Windows 本機與 Google Drive 中內容相同的重複檔案與重複資料夾。預設只移至垃圾桶，每組至少保留一份；Google Drive 檔案內容不會上傳到 DUPESPACE 伺服器。</p>
          <MotionHeroActions />
          <div className="trust-row"><span>✓ 免安裝開始</span><span>✓ 預設可復原</span><span>✓ 每組保留一份</span><a href="/privacy">隱私權政策</a></div>
        </div>
        <div className="hero-dashboard-wrap"><HeroDashboard /></div>
      </section>

      <section className="stats-strip"><div className="shell stats-grid"><div><strong>100%</strong><span>內容級精確比對</span></div><div><strong>2</strong><span>檔案與資料夾</span></div><div><strong>1+</strong><span>每組至少保留一份</span></div><div><strong>0</strong><span>預設永久刪除</span></div></div></section>

      <section className="section shell" id="features"><div className="section-heading"><span className="eyebrow"><i /> SAFE BY DESIGN</span><h2><span className="heading-phrase">讓每次清理，</span><wbr /><span className="heading-phrase">都有清楚的安全邊界。</span></h2><p>內容相同只能成為候選。DUPESPACE 先保護用途、來源與目錄情境，再讓使用者決定要處理哪一份。</p></div><SafetyMotionGrid /></section>

      <section className="section alternate"><div className="shell split"><div><span className="eyebrow light"><i /> HOW IT WORKS</span><h2><span className="heading-phrase">比對檔案內容，</span><wbr /><span className="heading-phrase">不靠檔名猜測。</span></h2><p>Windows 使用完整 SHA-256；Google Drive 使用 API 提供的內容校驗碼。重複資料夾還會逐一核對相對路徑、檔案大小與校驗碼，只有 100% 鏡像一致才會顯示。</p><a className="button mint" href="/support">閱讀安全整理指南</a></div><ol className="steps"><li><span>1</span><div><b>掃描</b><small>只讀取比對需要的中繼資料與校驗碼</small></div></li><li><span>2</span><div><b>檢查</b><small>查看完整路徑、預覽與雙樹鏡像差異</small></div></li><li><span>3</span><div><b>回收空間</b><small>預設移至垃圾桶，保留復原機會</small></div></li></ol></div></section>

      <section className="section shell privacy-feature"><div><span className="eyebrow"><i /> GOOGLE DRIVE PRIVACY</span><h2><span className="heading-phrase">檔案留在你的</span><wbr /><span className="heading-phrase" lang="en">Google Drive。</span></h2><p>DUPESPACE 不下載或代理你的檔案內容。線上掃描只透過 Google Drive API 取得必要的檔案 ID、路徑、版本、大小、權限與校驗碼。</p><div className="privacy-actions"><a className="button primary" href="/cleaner">開啟線上清理器</a><a className="text-link" href="/privacy">閱讀隱私權政策</a></div></div><div className="privacy-card"><b>登入與資料安全</b><p>加密的 Secure、HttpOnly Cookie 最多維持登入 30 天，且每次使用都重新加密。掃描操作證明 30 分鐘後失效；登出時會撤銷 Google 權杖並清除工作階段。</p></div></section>

      <section className="section trust-section"><div className="shell"><div className="section-heading"><span className="eyebrow"><i /> WHY TRUST DUPESPACE</span><h2><span className="heading-phrase">安全主張，</span><wbr /><span className="heading-phrase">可以用原始碼驗證。</span></h2></div><div className="trust-table" role="table" aria-label="傳統清理工具與 DUPESPACE 比較"><div role="row"><b role="columnheader">傳統清理工具</b><b role="columnheader">DUPESPACE</b></div><div role="row"><span>可能只看檔名</span><span>比對檔案內容與目錄樹</span></div><div role="row"><span>可能直接刪除</span><span>預設移至垃圾桶</span></div><div role="row"><span>黑盒操作</span><span>完整路徑、預覽與 CSV 稽核</span></div><div role="row"><span>可能跨專案誤判</span><span>專案與套件環境硬性排除</span></div><div role="row"><span>無法驗證宣稱</span><span>免費且完全開源</span></div></div><p className="open-source-line" lang="en">Read the code. Verify the claims. Run it yourself.</p><a className="button secondary" href={repo}>在 GitHub 查看原始碼</a></div></section>

      <section className="section shell faq-section" id="faq"><div className="section-heading"><span className="eyebrow"><i /> 常見問題</span><h2><span className="heading-phrase">開始之前，</span><wbr /><span className="heading-phrase">先把安全規則說清楚。</span></h2></div><details><summary>DUPESPACE 的用途是什麼？</summary><p>用來搜尋、檢查並安全清理 Windows 與 Google Drive 中內容完全相同的重複檔案與重複資料夾，協助回收儲存空間。</p></details><details><summary>重複資料夾會怎麼處理？</summary><p>只有相對路徑、檔案大小與每個內容校驗碼都一致的完整鏡像才會列出。資料夾只能移至垃圾桶，不能永久刪除；操作前內容若有變更會立即取消。</p></details><details><summary>不同專案中的相同設定檔會被處理嗎？</summary><p>不會。Git、SVN、常見建置專案、套件目錄與虛擬環境會被硬性排除，不列為候選。</p></details><details><summary>Google Drive 檔案內容會上傳嗎？</summary><p>不會。比對只使用 Google Drive API 提供的必要中繼資料與校驗碼。</p></details></section>

      <section className="section shell download-section" id="download"><div className="download-card"><div className="download-mark">▣</div><div><span className="eyebrow"><i /> WINDOWS 10 / 11</span><h2><span className="heading-phrase">需要整理本機檔案？</span><wbr /><span className="heading-phrase">Windows 版免費開源。</span></h2><p>先閱讀保留區／清理區、安全排除與復原規則，再前往下載最新版安裝程式。</p></div><a className="button secondary" href="/download">查看 Windows 版</a></div></section>
      <AdPanel />
      <SiteFooter />
    </main>
  );
}
