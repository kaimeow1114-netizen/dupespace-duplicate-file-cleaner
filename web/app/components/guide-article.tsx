import type { Metadata } from "next";
import { headers } from "next/headers";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import type { Guide } from "../../lib/guides";
import { AdPanel } from "./ad-panel";
import { SiteFooter, SiteHeader } from "./site-shell";

export function guideMetadata(guide: Guide, locale: "zh-TW" | "en"): Metadata {
  const path = `guides/${guide.slug}`;
  const zh = `https://dupespace.app/${path}`;
  const en = `https://dupespace.app/en/${path}/`;
  const canonical = locale === "en" ? en : zh;
  return {
    title: guide.title, description: guide.description,
    alternates: { canonical, languages: { "zh-TW": zh, en, "x-default": zh } },
    openGraph: { title: `${guide.title} | DUPESPACE`, description: guide.description, type: "article", url: canonical, locale: locale === "en" ? "en_US" : "zh_TW", siteName: "DUPESPACE", images: [] },
    twitter: { card: "summary", title: guide.title, description: guide.description, images: [] },
  };
}

export async function GuideArticle({ guide, locale }: { guide: Guide; locale: "zh-TW" | "en" }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const url = `https://dupespace.app${prefix}/guides/${guide.slug}${end}`;
  const crumbs = [
    { name: "DUPESPACE", item: `https://dupespace.app${prefix}/` },
    { name: en ? "Safety guide" : "安全整理指南", item: `https://dupespace.app${prefix}/support${end}` },
    { name: guide.title, item: url },
  ];
  return <main lang={locale}>
    <SiteHeader locale={locale} pagePath={`guides/${guide.slug}`} />
    <script suppressHydrationWarning nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
      { "@context": "https://schema.org", "@type": "Article", headline: guide.title, description: guide.description, inLanguage: locale, mainEntityOfPage: url, author: { "@type": "Organization", name: "DUPESPACE", url: "https://dupespace.app/" }, dateModified: "2026-09-03" },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: crumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })) },
    ]).replace(/</g, "\\u003c") }} />
    <section className="guide-hero"><div className="shell"><nav className="guide-breadcrumbs" aria-label={en ? "Breadcrumb" : "麵包屑導覽"}><a href={`${prefix}/`}>DUPESPACE</a><span aria-hidden="true">/</span><a href={`${prefix}/support${end}`}>{en ? "Safety guide" : "安全整理指南"}</a></nav><span className="eyebrow"><BookOpenCheck size={16} aria-hidden="true" />{en ? "PRACTICAL FILE GUIDES" : "實用檔案整理指南"}</span><h1>{guide.title}</h1><p>{guide.description}</p><a className="text-link" href={en ? `/guides/${guide.slug}` : `/en/guides/${guide.slug}/`} hrefLang={en ? "zh-TW" : "en"}>{en ? "繁體中文" : "Read in English"}</a></div></section>
    <article className="guide-reading">
      <nav className="guide-contents" aria-label={en ? "In this guide" : "本文內容"}><b>{en ? "In this guide" : "本文內容"}</b>{guide.sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}>{String(index + 1).padStart(2, "0")} {section.title}</a>)}</nav>
      {guide.sections.map((section, index) => <section key={section.title} id={`section-${index + 1}`}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
      <aside className="guide-next"><h2>{en ? "Put the guide into practice" : "先分析，再決定"}</h2><p>{en ? "Start with a read-only report, or learn about protected Windows cleanup. No account is required." : "先用唯讀報告了解重複情況，或查看 Windows 版的保護與清理方式。兩者都不需要帳號。"}</p><div className="hero-actions"><a className="button primary" href={`${prefix}/local${end}`}>{en ? "Analyze a folder" : "分析本機資料夾"}<ArrowRight size={17} aria-hidden="true" /></a><a className="button secondary" href={`${prefix}/download${end}`}>{en ? "Windows cleanup" : "了解 Windows 清理"}</a></div></aside>
    </article>
    <AdPanel /><SiteFooter locale={locale} />
  </main>;
}
