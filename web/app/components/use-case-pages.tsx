import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowRight, Check, Download, FileDiff, FlaskConical, FolderGit2, Images, ShieldCheck } from "lucide-react";
import { type UseCase, type UseCaseLocale, useCases } from "../../lib/use-cases";
import { AdPanel } from "./ad-panel";
import { SiteFooter, SiteHeader } from "./site-shell";

function caseUrls(slug = "") {
  const suffix = slug ? `/${slug}` : "";
  return { zh: `https://dupespace.app/use-cases${suffix}`, en: `https://dupespace.app/en/use-cases${suffix}/` };
}

export function casesMetadata(locale: UseCaseLocale): Metadata {
  const en = locale === "en";
  const urls = caseUrls();
  const title = en ? "Tested duplicate-file use cases" : "重複檔案實際案例｜看懂工具如何判斷";
  const description = en
    ? "Reproducible examples for renamed photos and project files, with visible test boundaries, expected result classes and redacted CSV samples."
    : "以可重現的測試資料說明改名照片與程式專案檔案如何分類，公開測試界線、預期結果與去識別化 CSV 範例。";
  const canonical = en ? urls.en : urls.zh;
  return {
    title, description,
    alternates: { canonical, languages: { "zh-TW": urls.zh, en: urls.en, "x-default": urls.zh } },
    openGraph: { title: `${title} | DUPESPACE`, description, url: canonical, type: "website", locale: en ? "en_US" : "zh_TW", siteName: "DUPESPACE", images: [] },
    twitter: { card: "summary", title, description, images: [] },
  };
}

export function caseMetadata(item: UseCase, locale: UseCaseLocale): Metadata {
  const en = locale === "en";
  const urls = caseUrls(item.slug);
  const canonical = en ? urls.en : urls.zh;
  return {
    title: item.title, description: item.description,
    alternates: { canonical, languages: { "zh-TW": urls.zh, en: urls.en, "x-default": urls.zh } },
    openGraph: { title: `${item.title} | DUPESPACE`, description: item.description, url: canonical, type: "article", locale: en ? "en_US" : "zh_TW", siteName: "DUPESPACE", images: [] },
    twitter: { card: "summary", title: item.title, description: item.description, images: [] },
  };
}

function CaseIcon({ slug }: { slug: string }) {
  return slug === "renamed-photo-merge" ? <Images aria-hidden="true" /> : <FolderGit2 aria-hidden="true" />;
}

export async function UseCasesHome({ locale }: { locale: UseCaseLocale }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const canonical = en ? "https://dupespace.app/en/use-cases/" : "https://dupespace.app/use-cases";
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const items = useCases[locale];
  return <main className="case-page" lang={locale}>
    <SiteHeader locale={locale} pagePath="use-cases" />
    <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org", "@type": "CollectionPage", name: en ? "DUPESPACE tested use cases" : "DUPESPACE 實際案例", url: canonical, inLanguage: locale,
      hasPart: items.map((item) => ({ "@type": "Article", name: item.title, url: `${canonical}${en ? "" : "/"}${item.slug}${end}` })),
    }).replace(/</g, "\\u003c") }} />
    <section className="case-hub-hero"><div className="shell case-hub-grid"><div><span className="eyebrow light"><FlaskConical size={16} aria-hidden="true" />{en ? "REPRODUCIBLE EXAMPLES" : "可重現的檔案案例"}</span><h1>{en ? <>See the result, <span className="gradient-text">not just the claim.</span></> : <>不只說明功能，<span className="gradient-text">也公開判斷過程。</span></>}</h1><p>{en ? "Each case defines disposable inputs, expected classifications, limitations and the next safe decision. No invented users, savings or benchmark numbers." : "每個案例都列出可捨棄的測試資料、預期分類、限制與下一個安全決定，不捏造使用者、節省容量或效能數字。"}</p></div><aside><ShieldCheck aria-hidden="true" /><strong>{en ? "Evidence has a boundary" : "證據必須說明界線"}</strong><p>{en ? "A synthetic result can verify classification logic. It cannot prove every device, file format or custom workflow behaves the same way." : "合成測試能驗證分類邏輯，不能代表所有裝置、檔案格式與自訂工作流程都會完全相同。"}</p></aside></div></section>
    <section className="case-hub-list shell"><div className="solution-heading"><span className="eyebrow">{en ? "CHOOSE A CASE" : "選擇一個實際情況"}</span><h2>{en ? "Reproduce the example before trusting the workflow." : "先重現小範例，再相信大型整理流程。"}</h2><p>{en ? "Every case uses disposable paths and explains which conclusions the result does not support." : "所有案例都使用可捨棄路徑，也會說明結果不能證明哪些事情。"}</p></div><div className="case-card-grid">{items.map((item) => <a className="case-card" href={`${prefix}/use-cases/${item.slug}${end}`} key={item.slug}><span><CaseIcon slug={item.slug} /></span><small>{item.kicker}</small><h2>{item.title}</h2><p>{item.answer}</p><b>{en ? "Read the test case" : "查看測試案例"}<ArrowRight size={18} aria-hidden="true" /></b></a>)}</div></section>
    <section className="case-standard"><div className="shell"><div><span className="eyebrow light">{en ? "OUR PUBLICATION RULE" : "案例發布規則"}</span><h2>{en ? "If we did not measure it, we do not publish a number." : "沒有實測，就不寫成數字。"}</h2></div><ul><li><Check aria-hidden="true" />{en ? "Version and scope are visible" : "標示版本與測試範圍"}</li><li><Check aria-hidden="true" />{en ? "Paths and reports are redacted" : "路徑與報告去識別化"}</li><li><Check aria-hidden="true" />{en ? "Limitations appear beside the result" : "限制和結果放在一起"}</li><li><Check aria-hidden="true" />{en ? "No result becomes automatic deletion advice" : "不把結果包裝成自動刪除建議"}</li></ul></div></section>
    <AdPanel /><SiteFooter locale={locale} />
  </main>;
}

export async function UseCaseArticlePage({ item, locale }: { item: UseCase; locale: UseCaseLocale }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const urls = caseUrls(item.slug);
  const canonical = en ? urls.en : urls.zh;
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const crumbs = [{ name: "DUPESPACE", item: `https://dupespace.app${prefix}/` }, { name: en ? "Use cases" : "實際案例", item: `https://dupespace.app${prefix}/use-cases${end}` }, { name: item.title, item: canonical }];
  return <main className="case-page" lang={locale}>
    <SiteHeader locale={locale} pagePath={`use-cases/${item.slug}`} />
    <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
      { "@context": "https://schema.org", "@type": "Article", headline: item.title, description: item.description, mainEntityOfPage: canonical, inLanguage: locale, datePublished: "2026-09-28", dateModified: "2026-09-28", author: { "@type": "Organization", name: "DUPESPACE", url: "https://dupespace.app/about" } },
      { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: item.faq.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } })) },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })) },
    ]).replace(/</g, "\\u003c") }} />
    <section className="case-article-hero"><div className="shell"><nav className="solution-breadcrumbs" aria-label={en ? "Breadcrumb" : "麵包屑導覽"}><a href={`${prefix}/`}>DUPESPACE</a><span>/</span><a href={`${prefix}/use-cases${end}`}>{en ? "Use cases" : "實際案例"}</a></nav><div className="case-hero-grid"><div><span className="eyebrow light"><CaseIcon slug={item.slug} />{item.kicker}</span><h1>{item.title}</h1><p>{item.description}</p></div><aside><FlaskConical aria-hidden="true" /><small>{en ? "TEST BOUNDARY" : "測試界線"}</small><strong>{item.version}</strong><p>{item.scope}</p></aside></div></div></section>
    <section className="case-answer shell"><ShieldCheck aria-hidden="true" /><div><span className="eyebrow">{en ? "ANSWER" : "先說結論"}</span><p>{item.answer}</p></div></section>
    <section className="case-setup shell"><div><span className="eyebrow">{en ? "REPRODUCE THE INPUT" : "重現測試資料"}</span><h2>{en ? "A small setup you can inspect by hand." : "用肉眼也能核對的小型測試。"}</h2></div><ol>{item.setup.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>)}</ol></section>
    <section className="case-results"><div className="shell"><div className="solution-heading"><span className="eyebrow light">{en ? "EXPECTED CLASSIFICATION" : "預期分類結果"}</span><h2>{en ? "Each relationship leads to a different decision." : "不同檔案關係，下一步也不同。"}</h2></div><div className="case-result-grid">{item.findings.map((finding) => <article key={finding.label}><header><FileDiff aria-hidden="true" /><h3>{finding.label}</h3></header><div className="case-paths">{finding.paths.map((path) => <code key={path}>{path}</code>)}</div><p>{finding.result}</p><b>{en ? "Next:" : "下一步："} {finding.next}</b></article>)}</div></div></section>
    <div className="case-reading-layout shell"><aside><b>{en ? "VERIFICATION CHECKS" : "複查重點"}</b>{item.checks.map((check) => <span key={check}><Check size={16} aria-hidden="true" />{check}</span>)}<a href={item.sampleCsv} download><Download size={17} aria-hidden="true" />{en ? "Download redacted CSV" : "下載去識別化 CSV"}</a></aside><article>{item.sections.map((section, index) => <section key={section.title}><span>{String(index + 1).padStart(2, "0")}</span><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}</article></div>
    <section className="solution-faq shell"><div className="solution-heading"><span className="eyebrow">FAQ</span><h2>{en ? "What this case can and cannot tell you" : "這個案例能證明什麼、不能證明什麼"}</h2></div><div>{item.faq.map((faq) => <details key={faq.question}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></section>
    <section className="case-next"><div className="shell"><div><span className="eyebrow light">{en ? "TRY THE SAME WORKFLOW" : "用自己的測試資料重做一次"}</span><h2>{en ? "Start read-only and keep the first test disposable." : "先做唯讀分析，第一次只用可捨棄資料。"}</h2></div><div><a className="button primary" href={`${prefix}/${item.slug === "renamed-photo-merge" ? "merge" : "local"}${end}`}>{en ? "Open the browser tool" : "開啟線上工具"}<ArrowRight size={17} aria-hidden="true" /></a><a className="button secondary inverse-button" href={`${prefix}/solutions${end}`}>{en ? "Browse solutions" : "查看整理情境"}</a></div></div></section>
    <AdPanel /><SiteFooter locale={locale} />
  </main>;
}
