/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids Vinext's deployed Link interception bug. */
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { GitHubStars } from "./github-stars";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";

export function SiteHeader({ locale = "zh-TW", privateWorkspace = false, pagePath = "" }: { locale?: "zh-TW" | "en"; privateWorkspace?: boolean; pagePath?: string }) {
  const en = locale === "en";
  const home = en ? "/en/" : "/";
  return (
    <header className="site-header">
      <div className="shell nav">
        <a className="brand" href={home} aria-label={en ? "DUPESPACE home" : "DUPESPACE 首頁"}><Image src="/dupespace-icon.png" alt="DUPESPACE" width={38} height={38} unoptimized /><span className="brand-name notranslate" translate="no" lang="en">DUPE<em>SPACE</em></span></a>
        <nav aria-label={en ? "Main navigation" : "主要導覽"}>
          <a href={`${home}#features`}>{en ? "Features" : "功能特色"}</a><a href={en ? "/en/local/" : "/local"}>{en ? "Local analyzer" : "本機分析"}</a><a href={en ? "/en/download/" : "/download"}>{en ? "Windows" : "Windows 客戶端"}</a><a href={en ? "/en/support/" : "/support"}>{en ? "Safety guide" : "安全整理指南"}</a><a href={`${home}#faq`}>{en ? "FAQ" : "常見問題"}</a>
        </nav>
        <div className="nav-actions"><a className="text-button" href={en ? `/${pagePath}` : `/en/${pagePath ? `${pagePath}/` : ""}`} lang={en ? "zh-TW" : "en"} hrefLang={en ? "zh-TW" : "en"}>{en ? "繁中" : "EN"}</a><GitHubStars locale={locale} live={!privateWorkspace} /><a className="nav-cta" href={en ? "/en/local/" : "/local"}><span>{en ? "Analyze locally" : "開始分析"}</span><ArrowRight className="nav-cta-arrow" size={20} strokeWidth={1.8} aria-hidden="true" /></a></div>
      </div>
    </header>
  );
}

export function SiteFooter({ locale = "zh-TW" }: { locale?: "zh-TW" | "en" }) {
  if (locale === "en") return <footer className="footer"><div className="shell footer-grid">
    <div><a className="brand inverse notranslate" href="/en/" translate="no" lang="en">DUPESPACE</a><p>Find duplicate files. Make room for what matters.</p></div>
    <div><b>Product</b><a href="/en/local/">Local folder analyzer</a><a href="/en/download/">Windows download</a><a href={repo}>Source code on GitHub</a></div>
    <div><b>Information</b><a href="/en/support/">Safety guide</a><a href="/en/privacy/">Privacy policy</a><a href="/en/terms/">Terms of service</a><a href="/" hrefLang="zh-TW" lang="zh-TW">繁體中文</a></div>
  </div><div className="shell footer-bottom"><span>© 2026 DUPESPACE · MIT License</span><span>Local-first · Free and open source</span></div></footer>;
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div><a className="brand inverse" href="/" aria-label="DUPESPACE 首頁"><Image src="/dupespace-icon.png" alt="DUPESPACE 雲朵文件標誌" width={38} height={38} unoptimized /><span className="brand-name notranslate" translate="no" lang="en">DUPE<em>SPACE</em></span></a><p>安全清理重複檔案，把空間還給重要的事。</p></div>
        <div><b>產品</b><a href="/local">本機資料夾分析</a><a href="/download">Windows 下載說明</a><a href={repo}>GitHub 原始碼</a></div>
        <div><b>資訊</b><a href="/support">整理指南</a><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 <span className="notranslate" translate="no" lang="en">DUPESPACE</span> · MIT License</span><span>本機優先 · 免費開源</span></div>
    </footer>
  );
}
