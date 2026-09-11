import { headers } from "next/headers";
import {
  ArrowRight,
  BookOpenText,
  CalendarDays,
  Clock3,
  FileCheck2,
  FolderSearch,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { blogArticles, type BlogLocale } from "../../lib/blog";
import { AdPanel } from "./ad-panel";
import { SiteFooter, SiteHeader } from "./site-shell";

function formatDate(value: string, locale: BlogLocale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "zh-TW", {
    year: "numeric",
    month: locale === "en" ? "short" : "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T00:00:00Z"));
}

export async function BlogHome({ locale }: { locale: BlogLocale }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const articles = blogArticles[locale];
  const featured = articles.find((article) => article.featured) ?? articles[0];
  const latest = articles.filter((article) => article.slug !== featured.slug);
  const nonce = (await headers()).get("x-dupespace-nonce") ?? undefined;
  const canonical = "https://dupespace.app" + prefix + "/blog" + end;

  return (
    <main lang={locale} className="blog-page">
      <SiteHeader locale={locale} pagePath="blog" />
      <script
        suppressHydrationWarning
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: en ? "Space Notes by DUPESPACE" : "Space Notes｜數位工具與工作整理誌",
            description: en
              ? "Evidence-led guidance for files, software tools, storage and digital work."
              : "以實測、方法與清楚邊界，解決檔案、軟體工具、儲存與數位工作問題。",
            url: canonical,
            inLanguage: locale,
            publisher: {
              "@type": "Organization",
              name: "DUPESPACE",
              url: "https://dupespace.app/",
            },
            blogPost: articles.map((article) => ({
              "@type": "BlogPosting",
              headline: article.title,
              url: canonical + (en ? "" : "/") + article.slug + end,
              datePublished: article.published,
              dateModified: article.updated,
            })),
          }).replace(/</g, "\\u003c"),
        }}
      />

      <section className="blog-hero">
        <div className="shell blog-hero-grid">
          <div className="blog-hero-copy">
            <span className="eyebrow light">
              <BookOpenText size={16} aria-hidden="true" />
              SPACE NOTES
            </span>
            <h1>
              {en ? "Practical guidance for " : "把檔案與軟體問題，"}
              <span className="gradient-text">{en ? "files and digital work." : "說清楚再動手。"}</span>
            </h1>
            <p>
              {en
                ? "Practical, evidence-led guides for storage, software tools, backups and safer digital workflows. No manufactured rankings and no disguised promotion."
                : "從檔案整理、軟體工具到備份與數位工作流程，用可驗證的方法提供真正能解決問題的內容。不做假排名，也不把廣告包裝成建議。"}
            </p>
            <div className="blog-hero-actions">
              <a className="button primary" href={"#latest"}>
                {en ? "Read the latest guides" : "閱讀最新指南"}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <a className="button secondary inverse-button" href={prefix + "/blog/editorial-policy" + end}>
                {en ? "Editorial policy" : "編輯與比較原則"}
              </a>
            </div>
          </div>
          <aside className="blog-standard-card" aria-label={en ? "Editorial standard" : "編輯標準"}>
            <span><Scale size={20} aria-hidden="true" /></span>
            <small>{en ? "EDITORIAL STANDARD" : "內容原則"}</small>
            <h2>{en ? "Test first. Compare with context." : "先有實測，再談比較。"}</h2>
            <p>{en ? "We explain methods, limitations and ownership. Advertising never determines a conclusion." : "公開方法、限制與網站所有權；廣告收入不決定文章結論。"}</p>
            <ul>
              <li><ShieldCheck size={16} aria-hidden="true" />{en ? "Clear safety boundaries" : "清楚標示安全邊界"}</li>
              <li><FileCheck2 size={16} aria-hidden="true" />{en ? "No paid ranking positions" : "不販售排名位置"}</li>
              <li><CalendarDays size={16} aria-hidden="true" />{en ? "Visible publish and update dates" : "標示發布與更新日期"}</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="blog-featured shell">
        <div className="blog-section-heading">
          <div><span className="eyebrow">{en ? "START HERE" : "本期精選"}</span><h2>{en ? "One problem, explained completely." : "從最常被忽略的問題開始。"}</h2></div>
          <p>{en ? "A concise answer is useful. A reliable decision needs the reasoning behind it." : "快速答案能解惑；完整的判斷方法，才能避免下一次再遇到同一個問題。"}</p>
        </div>
        <a className="blog-feature-card" href={prefix + "/blog/" + featured.slug + end}>
          <div className="blog-feature-visual" aria-hidden="true">
            <FolderSearch />
            <span className="blog-file file-a">IMG_2048.JPG</span>
            <span className="blog-file file-b">旅行精選.jpg</span>
            <i />
          </div>
          <div>
            <span className="blog-category">{featured.category}</span>
            <h2>{featured.title}</h2>
            <p>{featured.description}</p>
            <footer>
              <span><CalendarDays size={15} aria-hidden="true" />{formatDate(featured.updated, locale)}</span>
              <span><Clock3 size={15} aria-hidden="true" />{featured.readMinutes} {en ? "min read" : "分鐘閱讀"}</span>
              <b>{en ? "Read guide" : "閱讀全文"}<ArrowRight size={17} aria-hidden="true" /></b>
            </footer>
          </div>
        </a>
      </section>

      <section id="latest" className="blog-latest shell">
        <div className="blog-section-heading">
          <div><span className="eyebrow">{en ? "LATEST" : "最新內容"}</span><h2>{en ? "Build a safer digital workflow." : "建立不靠運氣的數位整理習慣。"}</h2></div>
          <p>{en ? "Useful beyond one product: each article should help even if you never use DUPESPACE." : "每篇文章都必須在你不使用 DUPESPACE 的情況下，仍然能獨立解決問題。"}</p>
        </div>
        <div className="blog-card-grid">
          {latest.map((article, index) => (
            <a className="blog-card" href={prefix + "/blog/" + article.slug + end} key={article.slug}>
              <span className={"blog-card-index tone-" + index}>{String(index + 1).padStart(2, "0")}</span>
              <span className="blog-category">{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
              <footer><span><Clock3 size={14} aria-hidden="true" />{article.readMinutes} {en ? "min" : "分鐘"}</span><ArrowRight size={18} aria-hidden="true" /></footer>
            </a>
          ))}
        </div>
      </section>

      <section className="blog-principles">
        <div className="shell blog-principles-grid">
          <div><span className="eyebrow light">{en ? "USEFUL BY DESIGN" : "內容不是廣告的外殼"}</span><h2>{en ? "Useful even without our software." : "即使不用 DUPESPACE，也要能解決問題。"}</h2></div>
          <div className="blog-principle-list">
            <article><span>01</span><div><h3>{en ? "Name the risk" : "先說明風險"}</h3><p>{en ? "Explain what can go wrong before recommending an action." : "在建議操作之前，先讓讀者理解什麼情況可能出錯。"}</p></div></article>
            <article><span>02</span><div><h3>{en ? "Show the method" : "公開判斷方法"}</h3><p>{en ? "Describe test conditions, versions and limits behind comparisons." : "比較工具時說明版本、測試條件與限制，不只給結論。"}</p></div></article>
            <article><span>03</span><div><h3>{en ? "Separate ads from advice" : "分開廣告與建議"}</h3><p>{en ? "Sponsored or affiliate relationships are labeled and never buy a ranking." : "合作或聯盟關係會清楚標示，也不能購買排名。"}</p></div></article>
          </div>
        </div>
      </section>

      <section className="blog-guides shell">
        <div>
          <span className="eyebrow">{en ? "QUICK GUIDES" : "快速指南"}</span>
          <h2>{en ? "Need a focused answer?" : "只想先解決眼前的整理問題？"}</h2>
          <p>{en ? "Shorter safety guides cover duplicate photos and Windows cleanup." : "閱讀重複照片與 Windows 清理的精簡安全指南。"}</p>
        </div>
        <div>
          <a href={prefix + "/guides/duplicate-photos" + end}>{en ? "How to find duplicate photos safely" : "如何安全整理重複照片"}<ArrowRight size={17} aria-hidden="true" /></a>
          <a href={prefix + "/guides/safe-windows-cleanup" + end}>{en ? "Safe Windows duplicate cleanup" : "Windows 重複檔案安全清理"}<ArrowRight size={17} aria-hidden="true" /></a>
        </div>
      </section>

      <AdPanel />
      <SiteFooter locale={locale} />
    </main>
  );
}
