import { headers } from "next/headers";
import { ArrowRight, Check, Code2, FileSearch2, GitBranch, ShieldCheck, TestTube2 } from "lucide-react";
import { AdPanel } from "./ad-panel";
import { SiteFooter, SiteHeader } from "./site-shell";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";

export async function AboutPage({ locale }: { locale: "zh-TW" | "en" }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const canonical = en ? "https://dupespace.app/en/about/" : "https://dupespace.app/about";
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const principles = en ? [
    ["Explain before acting", "A result should tell you what matched, what remains uncertain and what the next action would change."],
    ["Protect purpose, not just content", "Identical bytes can still belong to separate projects, backups or workflows. Location and intent remain part of the decision."],
    ["Keep risky paths separate", "Recycle Bin cleanup and permanent deletion have separate consent and code paths. One never silently falls back to the other."],
    ["Leave an audit trail", "Actions produce reviewable outcomes instead of only reporting a reclaimed-space total."],
  ] : [
    ["先解釋，再操作", "結果應說清楚哪些內容相同、哪些仍無法判斷，以及下一步會改變什麼。"],
    ["保護用途，不只比對內容", "位元相同的檔案仍可能分屬不同專案、備份或工作流程；路徑與用途也是判斷的一部分。"],
    ["把高風險路徑徹底分開", "資源回收筒與永久刪除使用不同確認和程式路徑，前者失敗時不會偷偷改成後者。"],
    ["留下可複查紀錄", "執行結果要能逐筆查看，而不是只顯示一個看似漂亮的節省容量。"],
  ];
  return <main className="about-page" lang={locale}>
    <SiteHeader locale={locale} pagePath="about" />
    <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: en ? "About DUPESPACE" : "關於 DUPESPACE",
      description: en ? "Why DUPESPACE exists, how its guidance is tested and where its safety boundaries are." : "DUPESPACE 為什麼存在、內容如何驗證，以及產品刻意保留的安全界線。",
      url: canonical,
      inLanguage: locale,
      mainEntity: { "@type": "SoftwareApplication", name: "DUPESPACE", applicationCategory: "UtilitiesApplication", operatingSystem: "Windows, Web", codeRepository: repo, license: "https://opensource.org/license/mit" },
    }).replace(/</g, "\\u003c") }} />
    <section className="about-hero"><div className="shell about-hero-grid"><div><span className="eyebrow light"><ShieldCheck size={16} aria-hidden="true" />{en ? "ABOUT DUPESPACE" : "關於 DUPESPACE"}</span><h1>{en ? <>File cleanup should begin with <span className="gradient-text">understanding.</span></> : <>整理檔案之前，<span className="gradient-text">先把關係看清楚。</span></>}</h1><p>{en ? "DUPESPACE is a free, open-source project for comparing folders, finding exact duplicate content and reviewing safer Windows cleanup. It is built to explain uncertainty instead of turning every match into a delete button." : "DUPESPACE 是免費開源的檔案工具，協助你比較兩個資料夾、找出內容完全相同的檔案，並在 Windows 上複查整理結果。我們不把每一個相同內容都直接包裝成可以刪除。"}</p></div><aside><Code2 aria-hidden="true" /><strong>{en ? "Open source, local first" : "開放原始碼，本機優先"}</strong><p>{en ? "Browser analysis stays on your device. Source code, release history and issue reporting are public on GitHub." : "瀏覽器分析留在你的裝置；原始碼、版本紀錄與問題回報都公開在 GitHub。"}</p><a href={repo}>{en ? "Review the source" : "查看原始碼"}<ArrowRight size={17} aria-hidden="true" /></a></aside></div></section>
    <section className="about-purpose shell"><div className="about-heading"><span className="eyebrow">{en ? "WHY THIS PROJECT EXISTS" : "為什麼製作 DUPESPACE"}</span><h2>{en ? "Duplicate content is easy to detect. Redundancy is a human decision." : "找出相同內容不難；判斷是否多餘，才是關鍵。"}</h2></div><div className="about-purpose-grid"><article><FileSearch2 aria-hidden="true" /><h3>{en ? "The problem" : "我們看見的問題"}</h3><p>{en ? "Most file tools can show matches. Far fewer explain that an identical configuration, backup or dependency may still be required in every location." : "許多工具都能列出相同內容，卻不一定提醒你：相同的設定檔、備份或相依套件，可能在每個位置都不能少。"}</p></article><article><GitBranch aria-hidden="true" /><h3>{en ? "The approach" : "我們採取的方法"}</h3><p>{en ? "Separate read-only analysis from file actions, preserve at least one item, protect explicit folders and revalidate candidates immediately before cleanup." : "把唯讀分析和檔案操作分開；每組至少保留一份、尊重使用者保護的資料夾，並在執行前重新驗證候選檔案。"}</p></article><article><ShieldCheck aria-hidden="true" /><h3>{en ? "The boundary" : "我們刻意不做的事"}</h3><p>{en ? "DUPESPACE does not clean the registry, guess which system files are disposable, certify backups or claim that matching content is automatically safe to remove." : "DUPESPACE 不清理登錄檔、不猜測哪些系統檔可以移除、不替備份品質背書，也不宣稱內容相同就一定可以刪除。"}</p></article></div></section>
    <section className="about-principles"><div className="shell"><div className="about-heading inverse"><span className="eyebrow light">{en ? "PRODUCT PRINCIPLES" : "產品原則"}</span><h2>{en ? "Safety claims should be visible in the workflow." : "安全不只寫在文案裡，也要出現在操作流程中。"}</h2></div><div className="about-principle-grid">{principles.map(([title, copy], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></div></section>
    <section className="about-method shell"><div><span className="eyebrow">{en ? "HOW CONTENT IS REVIEWED" : "內容如何製作與驗證"}</span><h2>{en ? "Test evidence comes before confident wording." : "先有測試證據，再寫肯定語句。"}</h2><p>{en ? "Guides and solution pages are checked against the current product behavior. Tested articles record the release, environment and limitations that matter to the result. Screenshots and reports are redacted before publication." : "指南與解決方案會依目前正式版本的實際行為複查。涉及實測的文章必須記錄版本、環境與會影響結果的限制；截圖和報告發布前會移除私人路徑與資訊。"}</p><ul><li><Check aria-hidden="true" />{en ? "No invented users, ratings, savings or benchmark results" : "不捏造使用者、評分、節省容量或效能數字"}</li><li><Check aria-hidden="true" />{en ? "Visible publish and review dates" : "標示發布與複查日期"}</li><li><Check aria-hidden="true" />{en ? "Corrections update the page instead of hiding a limitation" : "發現限制時更新文章，不掩飾問題"}</li></ul></div><aside><TestTube2 aria-hidden="true" /><h3>{en ? "AI assistance disclosure" : "AI 協作說明"}</h3><p>{en ? "AI may assist with drafting, translation, code review and test planning. Published technical claims are reviewed against source code, current product behavior or cited primary documentation. AI output is not treated as evidence by itself." : "AI 可能協助草稿、翻譯、程式碼檢查與測試規劃。正式發布的技術主張仍需依原始碼、目前產品行為或引用的一手文件複查；AI 輸出本身不會被當成證據。"}</p><a href={`${prefix}/blog/editorial-policy${end}`}>{en ? "Read the editorial policy" : "閱讀完整編輯政策"}<ArrowRight size={17} aria-hidden="true" /></a></aside></section>
    <section className="about-contact"><div className="shell"><div><span className="eyebrow light">{en ? "CONTACT AND ACCOUNTABILITY" : "聯絡與問題回報"}</span><h2>{en ? "Found a bug, unsafe edge case or unclear claim?" : "發現錯誤、安全邊界或說明不清楚？"}</h2><p>{en ? "Open a GitHub issue with the app version, reproduction steps and redacted errors. Never publish private filenames, full paths, reports, tokens or account information." : "請在 GitHub Issues 提供版本、重現步驟與去識別化錯誤。不要公開私人檔名、完整路徑、未遮蔽報告、權杖或帳號資料。"}</p></div><div><a className="button primary" href={`${repo}/issues`}>{en ? "Report an issue" : "回報問題"}<ArrowRight size={17} aria-hidden="true" /></a><a className="button secondary inverse-button" href={repo}>{en ? "GitHub repository" : "GitHub 專案"}</a></div></div></section>
    <AdPanel /><SiteFooter locale={locale} />
  </main>;
}
