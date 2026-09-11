import { CheckCircle2, FileSearch, Scale, ShieldCheck } from "lucide-react";
import { AdPanel } from "./ad-panel";
import { SiteFooter, SiteHeader } from "./site-shell";

export function BlogEditorialPolicy({ locale }: { locale: "zh-TW" | "en" }) {
  const en = locale === "en";
  const prefix = en ? "/en" : "";
  const end = en ? "/" : "";
  const sections = en ? [
    {
      title: "Who publishes Space Notes",
      copy: "Space Notes is owned and published by the team behind DUPESPACE, a free and open-source file organization project. We disclose this relationship because some articles may discuss problems that DUPESPACE also addresses.",
    },
    {
      title: "How we test and compare tools",
      copy: "A comparison must identify the tested product, version or test date, the scenario, the criteria and any material limitation. We distinguish observed behavior from an inference. A paid relationship cannot buy a higher rank or remove a relevant drawback.",
    },
    {
      title: "Advertising and commercial relationships",
      copy: "Public articles may display advertising that funds hosting and publication. Advertising does not determine topics, methods or conclusions. Sponsored content, affiliate links or products supplied for review will be labeled near the relevant claim before a reader acts.",
    },
    {
      title: "Corrections, sources and updates",
      copy: "Articles show publication and update dates. When a material fact changes, we update the text and its date. Primary documentation is preferred for technical and policy claims. Readers can report a factual error through the public GitHub issue tracker.",
    },
  ] : [
    {
      title: "誰在發布 Space Notes",
      copy: "Space Notes 由免費開源檔案整理專案 DUPESPACE 團隊擁有並發布。部分文章會討論 DUPESPACE 也能處理的問題，因此我們主動揭露這層關係，讓讀者自行判斷。",
    },
    {
      title: "如何實測與比較工具",
      copy: "比較文章必須交代測試產品、版本或日期、使用情境、評估條件與重要限制，並區分實際觀察和推論。商業合作不能購買較高名次，也不能要求刪除與決策有關的缺點。",
    },
    {
      title: "廣告與商業關係",
      copy: "公開文章可能顯示廣告，用來支持託管與內容製作；廣告不決定選題、方法或結論。若有贊助內容、聯盟連結或廠商提供測試產品，會在讀者採取行動前，於相關內容附近清楚標示。",
    },
    {
      title: "更正、來源與更新",
      copy: "文章會標示發布與更新日期。重要事實改變時，我們會修正文案並更新日期；技術與政策主張優先採用第一方文件。讀者可以透過公開 GitHub 問題追蹤器回報可驗證的錯誤。",
    },
  ];

  return (
    <main lang={locale} className="blog-page">
      <SiteHeader locale={locale} pagePath="blog/editorial-policy" />
      <section className="blog-policy-hero">
        <div className="blog-reading">
          <span className="eyebrow light"><Scale size={16} aria-hidden="true" />{en ? "EDITORIAL POLICY" : "編輯與比較原則"}</span>
          <h1>{en ? "Trust starts with a visible method." : "信任不是口號，而是看得見的方法。"}</h1>
          <p>{en ? "How Space Notes chooses topics, tests tools, labels advertising and corrects material errors." : "說明 Space Notes 如何選題、測試工具、揭露廣告關係，以及更正重要錯誤。"}</p>
        </div>
      </section>
      <div className="blog-policy-layout shell">
        <aside>
          <ShieldCheck aria-hidden="true" />
          <h2>{en ? "Our non-negotiables" : "不妥協的內容原則"}</h2>
          <ul>
            <li><CheckCircle2 size={16} aria-hidden="true" />{en ? "No paid ranking positions" : "不販售排名位置"}</li>
            <li><CheckCircle2 size={16} aria-hidden="true" />{en ? "No fabricated tests or reviews" : "不捏造實測或評論"}</li>
            <li><CheckCircle2 size={16} aria-hidden="true" />{en ? "Material conflicts are disclosed" : "揭露會影響判斷的關係"}</li>
            <li><CheckCircle2 size={16} aria-hidden="true" />{en ? "Safety limits stay visible" : "安全限制不藏在小字裡"}</li>
          </ul>
        </aside>
        <article className="blog-reading blog-policy-body">
          {sections.map((section, index) => (
            <section key={section.title}>
              <span className="blog-section-number">{String(index + 1).padStart(2, "0")}</span>
              <h2>{section.title}</h2>
              <p>{section.copy}</p>
            </section>
          ))}
          <section>
            <span className="blog-section-number">05</span>
            <h2>{en ? "Report an issue" : "回報內容問題"}</h2>
            <p>{en ? "Use GitHub Issues for factual corrections and include the article URL, the disputed statement and a reliable source. Do not post private filenames, reports, credentials or personal information." : "若要回報可驗證的內容錯誤，請在 GitHub Issues 附上文章網址、有疑問的敘述與可靠來源。請勿公開私人檔名、報告、憑證或個人資料。"}</p>
            <a className="button secondary" href="https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/issues"><FileSearch size={17} aria-hidden="true" />{en ? "Open GitHub Issues" : "前往 GitHub Issues"}</a>
          </section>
          <a className="text-link" href={prefix + "/blog" + end}>{en ? "Back to Space Notes" : "返回 Space Notes"}</a>
        </article>
      </div>
      <AdPanel />
      <SiteFooter locale={locale} />
    </main>
  );
}
