/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids Vinext's deployed Link interception bug. */
import Image from "next/image";
import { ArrowRight, ChevronDown, Files, FolderSync, Menu } from "lucide-react";
import { GitHubStars } from "./github-stars";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";

export function SiteHeader({ locale = "zh-TW", privateWorkspace = false, pagePath = "" }: { locale?: "zh-TW" | "en"; privateWorkspace?: boolean; pagePath?: string }) {
  const en = locale === "en";
  const home = en ? "/en/" : "/";
  const languagePath = en ? "/" + pagePath : "/en/" + (pagePath ? pagePath + "/" : "");
  return (
    <header className="site-header">
      <div className="shell nav">
        <a className="brand" href={home} aria-label={en ? "DUPESPACE home" : "DUPESPACE 首頁"}><Image src="/dupespace-icon.png" alt="DUPESPACE" width={38} height={38} unoptimized /><span className="brand-name notranslate" translate="no" lang="en">DUPE<em>SPACE</em></span></a>
        <nav aria-label={en ? "Main navigation" : "主要導覽"}>
          <a href={home + "#features"}>{en ? "Features" : "功能特色"}</a>
          <details className="nav-tools">
            <summary aria-haspopup="true">{en ? "Online file tools" : "線上檔案工具"}<ChevronDown size={15} aria-hidden="true" /></summary>
            <div className="nav-tools-menu">
              <small>{en ? "COMPARE AND MERGE" : "核對與合併"}</small>
              <a href={en ? "/en/merge/" : "/merge"}><FolderSync aria-hidden="true" /><span><b>{en ? "Folder merge preview" : "資料夾合併前核對"}</b><em>{en ? "Find renamed matches, missing files and conflicts" : "找出改名、缺漏與版本衝突"}</em></span></a>
              <small>{en ? "CLEAN UP SPACE" : "空間整理"}</small>
              <a href={en ? "/en/local/" : "/local"}><Files aria-hidden="true" /><span><b>{en ? "Duplicate file finder" : "重複檔案搜尋"}</b><em>{en ? "Find exact duplicates inside one folder" : "找出單一資料夾內的完全相同檔案"}</em></span></a>
            </div>
          </details>
          <a href={en ? "/en/download/" : "/download"}>{en ? "Windows" : "Windows 客戶端"}</a>
          <a href={en ? "/en/support/" : "/support"}>{en ? "Safety guide" : "安全整理指南"}</a>
          <a href={en ? "/en/blog/" : "/blog"}>Space Notes</a>
        </nav>
        <div className="nav-actions">
          <a className="text-button" href={languagePath} lang={en ? "zh-TW" : "en"} hrefLang={en ? "zh-TW" : "en"}>{en ? "繁中" : "EN"}</a>
          <GitHubStars locale={locale} live={!privateWorkspace} />
          <a className="nav-cta" href={en ? "/en/merge/" : "/merge"}><span>{en ? "Compare two folders" : "比較兩個資料夾"}</span><ArrowRight className="nav-cta-arrow" size={20} strokeWidth={1.8} aria-hidden="true" /></a>
          <details className="mobile-nav">
            <summary aria-label={en ? "Open navigation" : "開啟導覽選單"}><Menu aria-hidden="true" /></summary>
            <div>
              <a href={home + "#features"}>{en ? "Features" : "功能特色"}</a>
              <b>{en ? "Online file tools" : "線上檔案工具"}</b>
              <a href={en ? "/en/merge/" : "/merge"}>{en ? "Folder merge preview" : "資料夾合併前核對"}</a>
              <a href={en ? "/en/local/" : "/local"}>{en ? "Duplicate file finder" : "重複檔案搜尋"}</a>
              <a href={en ? "/en/download/" : "/download"}>{en ? "Windows client" : "Windows 客戶端"}</a>
              <a href={en ? "/en/support/" : "/support"}>{en ? "Safety guide" : "安全整理指南"}</a>
              <a href={en ? "/en/blog/" : "/blog"}>Space Notes</a>
              <a href={home + "#faq"}>{en ? "FAQ" : "常見問題"}</a>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ locale = "zh-TW" }: { locale?: "zh-TW" | "en" }) {
  if (locale === "en") return <footer className="footer"><div className="shell footer-grid">
    <div><a className="brand inverse notranslate" href="/en/" translate="no" lang="en">DUPESPACE</a><p>Find duplicate files. Make room for what matters.</p></div>
    <div><b>Product</b><a href="/en/merge/">Folder merge preview</a><a href="/en/local/">Duplicate file finder</a><a href="/en/download/">Windows download</a><a href={repo}>Source code on GitHub</a></div>
    <div><b>Information</b><a href="/en/blog/">Space Notes</a><a href="/en/blog/editorial-policy/">Editorial policy</a><a href="/en/support/">Safety guide</a><a href="/en/privacy/">Privacy policy</a><a href="/en/terms/">Terms of service</a><a href="/" hrefLang="zh-TW" lang="zh-TW">繁體中文</a></div>
  </div><div className="shell footer-bottom"><span>© 2026 DUPESPACE · MIT License</span><span>Local-first · Free and open source</span></div></footer>;
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div><a className="brand inverse" href="/" aria-label="DUPESPACE 首頁"><Image src="/dupespace-icon.png" alt="DUPESPACE 雲朵文件標誌" width={38} height={38} unoptimized /><span className="brand-name notranslate" translate="no" lang="en">DUPE<em>SPACE</em></span></a><p>看清楚檔案差異，再安心整理空間。</p></div>
        <div><b>產品</b><a href="/merge">比較兩個資料夾</a><a href="/local">尋找重複檔案</a><a href="/download">下載 Windows 清理工具</a><a href={repo}>GitHub 原始碼</a></div>
        <div><b>資訊</b><a href="/blog">Space Notes</a><a href="/blog/editorial-policy">編輯與比較原則</a><a href="/support">整理指南</a><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 <span className="notranslate" translate="no" lang="en">DUPESPACE</span> · MIT License</span><span>本機優先 · 免費開源</span></div>
    </footer>
  );
}
