import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  ArrowRight,
  Check,
  Download,
  FileCheck2,
  FolderSearch,
  HardDriveDownload,
  Images,
  SearchCheck,
  ShieldCheck,
  X,
} from "lucide-react";
import { solutions, type Solution, type SolutionLocale } from "../../lib/solutions";
import { AdPanel } from "./ad-panel";
import { SiteFooter, SiteHeader } from "./site-shell";

function solutionUrls(slug = "") {
  const suffix = slug ? `/${slug}` : "";
  return {
    zh: `https://dupespace.app/solutions${suffix}`,
    en: `https://dupespace.app/en/solutions${suffix}/`,
  };
}

export function solutionsMetadata(locale: SolutionLocale): Metadata {
  const en = locale === "en";
  const urls = solutionUrls();
  const title = en ? "File cleanup solutions for real folders" : "檔案整理情境｜從實際問題找到正確做法";
  const description = en
    ? "Practical, local-first workflows for photo libraries, Downloads folders and safer Windows duplicate cleanup. Understand the decision before changing files."
    : "從照片資料庫、下載資料夾到 Windows 重複檔案，以具體情境選擇唯讀分析、資料夾核對或安全清理流程。";
  const canonical = en ? urls.en : urls.zh;
  return {
    title,
    description,
    alternates: { canonical, languages: { "zh-TW": urls.zh, en: urls.en, "x-default": urls.zh } },
    openGraph: { title: `${title} | DUPESPACE`, description, url: canonical, type: "website", locale: en ? "en_US" : "zh_TW", siteName: "DUPESPACE", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export function solutionMetadata(solution: Solution, locale: SolutionLocale): Metadata {
  const en = locale === "en";
  const urls = solutionUrls(solution.slug);
  const canonical = en ? urls.en : urls.zh;
  return {
    title: solution.title,
    description: solution.description,
    alternates: { canonical, languages: { "zh-TW": urls.zh, en: urls.en, "x-default": urls.zh } },
    openGraph: { title: `${solution.title} | DUPESPACE`, description: solution.description, url: canonical, type: "article", locale: en ? "en_US" : "zh_TW", alternateLocale: [en ? "zh_TW" : "en_US"], siteName: "DUPESPACE", images: [] },
    twitter: { card: "summary", title: solution.title, description: solution.description, images: [] },
  };
}

function CardIcon({ slug }: { slug: string }) {
  if (slug === "photo-library-cleanup") return <Images aria-hidden="true" />;
  if (slug === "old-pc-file-migration") return <HardDriveDownload aria-hidden="true" />;
  return <Download aria-hidden="true" />;
}

export async function SolutionsHome({ locale }: { locale: SolutionLocale }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const items = solutions[locale];
  const canonical = en ? "https://dupespace.app/en/solutions/" : "https://dupespace.app/solutions";
  return <main className="solution-page" lang={locale}>
    <SiteHeader locale={locale} pagePath="solutions" />
    <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: en ? "DUPESPACE file cleanup solutions" : "DUPESPACE 檔案整理情境",
      description: en ? "Practical workflows for understanding duplicate files before cleanup." : "從實際資料夾情境了解重複檔案，再選擇合適的分析與整理流程。",
      url: canonical,
      inLanguage: locale,
      hasPart: items.map((item) => ({ "@type": "WebPage", name: item.title, url: `${canonical}${en ? "" : "/"}${item.slug}${end}` })),
    }).replace(/</g, "\\u003c") }} />
    <section className="solution-hub-hero"><div className="shell solution-hub-grid">
      <div><span className="eyebrow light"><FolderSearch size={16} aria-hidden="true" />{en ? "REAL FOLDER PROBLEMS" : "從實際資料夾問題開始"}</span><h1>{en ? <>Choose a workflow that <span className="gradient-text">fits the folder.</span></> : <>不是每個重複檔案，<span className="gradient-text">都適合同一種整理方式。</span></>}</h1><p>{en ? "Start with the situation you recognize. Each solution explains what the tool can confirm, what still needs your judgment and the safest next step." : "先找到和你相似的情境。每個方案都會說清楚工具能確認什麼、哪些仍需要你判斷，以及下一步怎麼做比較穩妥。"}</p></div>
      <aside><SearchCheck aria-hidden="true" /><strong>{en ? "Answer first, tool second" : "先解決問題，再推薦工具"}</strong><p>{en ? "These pages remain useful even if you never install DUPESPACE. Product links appear only where they complete the workflow." : "即使不安裝 DUPESPACE，內容也必須能幫你完成判斷；只有在工具能接續流程時才提供入口。"}</p></aside>
    </div></section>
    <section className="solution-hub-list shell"><div className="solution-heading"><span className="eyebrow">{en ? "CHOOSE A SITUATION" : "選擇目前遇到的情況"}</span><h2>{en ? "Begin with a folder you understand." : "先從用途最清楚的資料夾開始。"}</h2><p>{en ? "A smaller, well-defined scope is easier to review than an entire drive." : "範圍清楚的小資料夾，比直接掃描整顆磁碟更容易確認結果。"}</p></div><div className="solution-card-grid">{items.map((item, index) => <a className="solution-card" href={`${prefix}/solutions/${item.slug}${end}`} key={item.slug}><span className={`solution-card-icon tone-${index}`}><CardIcon slug={item.slug} /></span><small>{item.kicker}</small><h2>{item.title}</h2><p>{item.answer}</p><b>{en ? "Open the solution" : "查看完整做法"}<ArrowRight size={18} aria-hidden="true" /></b></a>)}</div><a className="solution-evidence-link" href={`${prefix}/use-cases${end}`}><SearchCheck aria-hidden="true" /><span><b>{en ? "Prefer a reproducible example?" : "想先看可重現的實際案例？"}</b><em>{en ? "Review the inputs, expected classifications, limitations and redacted CSV samples." : "查看測試資料、預期分類、限制與去識別化 CSV 範例。"}</em></span><ArrowRight aria-hidden="true" /></a></section>
    <section className="solution-method"><div className="shell solution-method-grid"><div><span className="eyebrow light">{en ? "THE SAME SAFETY BOUNDARY" : "所有情境共用的安全界線"}</span><h2>{en ? "Matching content is evidence, not a cleanup decision." : "內容相同是證據，不是清理決定。"}</h2></div><div><article><span>01</span><h3>{en ? "Understand the folder" : "先了解資料夾用途"}</h3><p>{en ? "Projects, backups and synchronized locations can need identical copies." : "專案、備份與同步位置可能都需要內容相同的副本。"}</p></article><article><span>02</span><h3>{en ? "Create a read-only view" : "先建立唯讀結果"}</h3><p>{en ? "See names, paths, sizes and relationships before changing anything." : "先看名稱、路徑、容量與檔案關係，不立即更動內容。"}</p></article><article><span>03</span><h3>{en ? "Revalidate before action" : "執行前重新確認"}</h3><p>{en ? "Changed or unreadable files are skipped instead of being forced through." : "檔案若被修改或無法讀取，就跳過而不是強制處理。"}</p></article></div></div></section>
    <AdPanel /><SiteFooter locale={locale} />
  </main>;
}

export async function SolutionArticlePage({ solution, locale }: { solution: Solution; locale: SolutionLocale }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const urls = solutionUrls(solution.slug);
  const canonical = en ? urls.en : urls.zh;
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const crumbs = [
    { name: "DUPESPACE", item: `https://dupespace.app${prefix}/` },
    { name: en ? "Solutions" : "整理情境", item: `https://dupespace.app${prefix}/solutions${end}` },
    { name: solution.title, item: canonical },
  ];
  return <main className="solution-page" lang={locale}>
    <SiteHeader locale={locale} pagePath={`solutions/${solution.slug}`} />
    <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
      { "@context": "https://schema.org", "@type": "WebPage", name: solution.title, description: solution.description, url: canonical, inLanguage: locale, dateModified: "2026-09-28", reviewedBy: { "@type": "Organization", name: "DUPESPACE", url: "https://dupespace.app/about" } },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: solution.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })) },
    ]).replace(/</g, "\\u003c") }} />
    <section className="solution-article-hero"><div className="shell"><nav className="solution-breadcrumbs" aria-label={en ? "Breadcrumb" : "麵包屑導覽"}><a href={`${prefix}/`}>DUPESPACE</a><span>/</span><a href={`${prefix}/solutions${end}`}>{en ? "Solutions" : "整理情境"}</a></nav><div className="solution-hero-grid"><div><span className="eyebrow light"><CardIcon slug={solution.slug} />{solution.kicker}</span><h1>{solution.title}</h1><p>{solution.description}</p><div className="hero-actions"><a className="button primary" href={`${prefix}/local${end}`}>{en ? "Analyze one folder" : "分析一個資料夾"}<ArrowRight size={17} aria-hidden="true" /></a><a className="button secondary inverse-button" href={`${prefix}/merge${end}`}>{en ? "Compare two folders" : "比較兩個資料夾"}</a></div></div><aside className="solution-answer"><ShieldCheck aria-hidden="true" /><small>{en ? "THE SHORT ANSWER" : "先說結論"}</small><p>{solution.answer}</p></aside></div></div></section>
    <section className="solution-fit shell"><article><header><Check aria-hidden="true" /><h2>{en ? "This workflow fits when" : "適合這樣使用"}</h2></header><ul>{solution.suitable.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="solution-avoid"><header><X aria-hidden="true" /><h2>{en ? "Pause and choose another approach when" : "遇到這些情況先不要開始"}</h2></header><ul>{solution.avoid.map((item) => <li key={item}>{item}</li>)}</ul></article></section>
    <section className="solution-scenario"><div className="shell"><div className="solution-heading"><span className="eyebrow light">{en ? "A CONCRETE EXAMPLE" : "用一個具體例子看差別"}</span><h2>{solution.scenario.title}</h2><p>{solution.scenario.introduction}</p></div><div className="scenario-grid">{solution.scenario.steps.map((step, index) => <article key={step.label}><span>{String(index + 1).padStart(2, "0")}</span><h3>{step.label}</h3><p>{step.detail}</p></article>)}</div></div></section>
    <div className="solution-reading-layout shell"><aside className="solution-toc"><b>{en ? "In this solution" : "本文內容"}</b>{solution.sections.map((section, index) => <a href={`#section-${index + 1}`} key={section.title}><span>{String(index + 1).padStart(2, "0")}</span>{section.title}</a>)}</aside><article className="solution-reading">{solution.sections.map((section, index) => <section id={`section-${index + 1}`} key={section.title}><span className="solution-section-number">{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.checklist ? <ul className="solution-checklist">{section.checklist.map((item) => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul> : null}</section>)}</article></div>
    <section className="solution-faq shell"><div className="solution-heading"><span className="eyebrow">FAQ</span><h2>{en ? "Questions to answer before you act" : "動手前，先把常見疑問說清楚"}</h2></div><div>{solution.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>
    <section className="solution-next"><div className="shell"><FileCheck2 aria-hidden="true" /><div><span className="eyebrow light">{en ? "NEXT STEP" : "下一步"}</span><h2>{en ? "Start with a report. Change files only after review." : "先看報告，再決定是否整理檔案。"}</h2><p>{en ? "Browser tools are read-only. The Windows app revalidates reviewed candidates before moving them to the Recycle Bin." : "網頁工具只產生唯讀結果；需要實際整理時，Windows 版會重新確認候選檔案，再移至資源回收筒。"}</p></div><div><a className="button primary" href={`${prefix}/local${end}`}>{en ? "Analyze locally" : "開始本機分析"}<ArrowRight size={17} aria-hidden="true" /></a><a className="button secondary inverse-button" href={`${prefix}/download${end}`}>{en ? "Windows workflow" : "了解 Windows 版"}</a></div></div></section>
    <AdPanel /><SiteFooter locale={locale} />
  </main>;
}
