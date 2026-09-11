import type { Metadata } from "next";
import { headers } from "next/headers";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Check,
  Clock3,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { blogArticles, type BlogArticle, type BlogLocale } from "../../lib/blog";
import { AdPanel } from "./ad-panel";
import { SiteFooter, SiteHeader } from "./site-shell";

function paths(article: BlogArticle) {
  return {
    zh: "https://dupespace.app/blog/" + article.slug,
    en: "https://dupespace.app/en/blog/" + article.slug + "/",
  };
}

export function blogArticleMetadata(article: BlogArticle, locale: BlogLocale): Metadata {
  const route = paths(article);
  const canonical = locale === "en" ? route.en : route.zh;
  return {
    title: article.title,
    description: article.description,
    alternates: {
      canonical,
      languages: { "zh-TW": route.zh, en: route.en, "x-default": route.zh },
    },
    openGraph: {
      title: article.title + " | Space Notes",
      description: article.description,
      type: "article",
      url: canonical,
      locale: locale === "en" ? "en_US" : "zh_TW",
      alternateLocale: [locale === "en" ? "zh_TW" : "en_US"],
      siteName: "DUPESPACE",
      publishedTime: article.published,
      modifiedTime: article.updated,
      images: [],
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.description,
      images: [],
    },
  };
}

function formatDate(value: string, locale: BlogLocale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-TW", {
    year: "numeric",
    month: locale === "en" ? "short" : "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}

function toolLink(type: NonNullable<BlogArticle["relatedTool"]>, en: boolean) {
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  if (type === "merge") return {
    href: prefix + "/merge" + end,
    title: en ? "Compare two folders without uploading them" : "在瀏覽器核對兩個資料夾",
    copy: en ? "Find renamed matches, one-sided files and version conflicts in a read-only preview." : "唯讀找出改名後的相同內容、單側檔案與版本衝突，不把檔案傳送至伺服器。",
  };
  if (type === "local") return {
    href: prefix + "/local" + end,
    title: en ? "Analyze one folder in your browser" : "在瀏覽器分析單一資料夾",
    copy: en ? "Create a read-only duplicate report locally, without an account." : "免帳號建立本機唯讀重複報告，網頁不執行刪除。",
  };
  return {
    href: prefix + "/download" + end,
    title: en ? "Review the Windows cleanup workflow" : "了解 Windows 安全清理流程",
    copy: en ? "See protected folders, keeper rules, Recycle Bin behavior and audit reports before installing." : "安裝前先了解保護資料夾、保留規則、資源回收筒與稽核報告。",
  };
}

export async function BlogArticlePage({ article, locale }: { article: BlogArticle; locale: BlogLocale }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const route = paths(article);
  const canonical = en ? route.en : route.zh;
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const related = blogArticles[locale].filter((candidate) => candidate.slug !== article.slug).slice(0, 2);
  const linkedTool = article.relatedTool ? toolLink(article.relatedTool, en) : null;
  const crumbs = [
    { name: "DUPESPACE", item: "https://dupespace.app" + prefix + "/" },
    { name: en ? "Space Notes" : "Space Notes 數位整理誌", item: "https://dupespace.app" + prefix + "/blog" + end },
    { name: article.title, item: canonical },
  ];

  return (
    <main lang={locale} className="blog-page">
      <SiteHeader locale={locale} pagePath={"blog/" + article.slug} />
      <script
        suppressHydrationWarning
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: article.title,
              description: article.description,
              datePublished: article.published,
              dateModified: article.updated,
              inLanguage: locale,
              mainEntityOfPage: canonical,
              author: { "@type": "Organization", name: "DUPESPACE", url: "https://dupespace.app/" },
              publisher: { "@type": "Organization", name: "DUPESPACE", url: "https://dupespace.app/" },
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: crumbs.map((crumb, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: crumb.name,
                item: crumb.item,
              })),
            },
          ]).replace(/</g, "\\u003c"),
        }}
      />

      <section className="blog-article-hero">
        <div className="blog-reading">
          <nav className="blog-breadcrumbs" aria-label={en ? "Breadcrumb" : "麵包屑導覽"}>
            <a href={prefix + "/blog" + end}><ArrowLeft size={15} aria-hidden="true" />Space Notes</a>
            <span aria-hidden="true">/</span>
            <span>{article.category}</span>
          </nav>
          <span className="eyebrow light"><BookOpenText size={16} aria-hidden="true" />{article.kicker}</span>
          <h1>{article.title}</h1>
          <p>{article.description}</p>
          <div className="blog-article-meta">
            <span><CalendarDays size={16} aria-hidden="true" />{en ? "Updated " : "更新於 "}{formatDate(article.updated, locale)}</span>
            <span><Clock3 size={16} aria-hidden="true" />{article.readMinutes} {en ? "minute read" : "分鐘閱讀"}</span>
            <a href={en ? route.zh.replace("https://dupespace.app", "") : route.en.replace("https://dupespace.app", "")} hrefLang={en ? "zh-TW" : "en"}>{en ? "繁體中文" : "Read in English"}</a>
          </div>
        </div>
      </section>

      <div className="blog-article-layout shell">
        <aside className="blog-toc">
          <b>{en ? "In this article" : "本文內容"}</b>
          {article.sections.map((section, index) => (
            <a href={"#section-" + (index + 1)} key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>{section.title}
            </a>
          ))}
          <a className="blog-policy-link" href={prefix + "/blog/editorial-policy" + end}>
            <ShieldCheck size={15} aria-hidden="true" />{en ? "How this publication works" : "查看編輯與比較原則"}
          </a>
        </aside>

        <article className="blog-reading blog-article-body">
          {article.sections.map((section, index) => (
            <section id={"section-" + (index + 1)} key={section.title}>
              <span className="blog-section-number">{String(index + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.checklist ? (
                <ul className="blog-checklist">
                  {section.checklist.map((item) => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}

          {linkedTool ? (
            <aside className="blog-tool-callout">
              <span>{en ? "RELATED DUPESPACE TOOL" : "相關 DUPESPACE 工具"}</span>
              <h2>{linkedTool.title}</h2>
              <p>{linkedTool.copy}</p>
              <a className="button primary" href={linkedTool.href}>{en ? "Open the tool" : "開啟工具"}<ArrowRight size={17} aria-hidden="true" /></a>
            </aside>
          ) : null}

          <aside className="blog-disclosure">
            <ShieldCheck aria-hidden="true" />
            <div>
              <h2>{en ? "Ownership and advertising disclosure" : "網站所有權與廣告揭露"}</h2>
              <p>{en
                ? "Space Notes is published by the team behind the open-source DUPESPACE project. Public articles may contain advertising, but advertisers do not approve conclusions or buy ranking positions. Product references are included only when they are directly relevant."
                : "Space Notes 由開源專案 DUPESPACE 團隊發布。公開文章可能顯示廣告，但廣告主不能審核結論或購買排名；只有在能直接解決本文問題時，文章才會自然連結 DUPESPACE 功能。"}
              </p>
              <a href={prefix + "/blog/editorial-policy" + end}>{en ? "Read the full editorial policy" : "閱讀完整編輯政策"}<ExternalLink size={14} aria-hidden="true" /></a>
            </div>
          </aside>
        </article>
      </div>

      <section className="blog-related shell">
        <div className="blog-section-heading">
          <div><span className="eyebrow">{en ? "CONTINUE READING" : "繼續閱讀"}</span><h2>{en ? "Related practical guides" : "延伸解決下一個問題"}</h2></div>
        </div>
        <div className="blog-card-grid">
          {related.map((item, index) => (
            <a className="blog-card" href={prefix + "/blog/" + item.slug + end} key={item.slug}>
              <span className={"blog-card-index tone-" + index}>{String(index + 1).padStart(2, "0")}</span>
              <span className="blog-category">{item.category}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <footer><span>{item.readMinutes} {en ? "min read" : "分鐘閱讀"}</span><ArrowRight size={18} aria-hidden="true" /></footer>
            </a>
          ))}
        </div>
      </section>

      <AdPanel />
      <SiteFooter locale={locale} />
    </main>
  );
}
