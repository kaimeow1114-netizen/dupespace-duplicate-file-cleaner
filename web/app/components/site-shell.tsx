/* eslint-disable @next/next/no-html-link-for-pages -- Native navigation avoids Vinext's deployed Link interception bug. */
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { GitHubStars } from "./github-stars";
import { SessionBadge } from "./session-badge";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav">
        <a className="brand" href="/" aria-label="DUPESPACE 首頁"><Image src="/dupespace-icon.png" alt="DUPESPACE 雲朵文件標誌" width={38} height={38} unoptimized /><span className="brand-name notranslate" translate="no" lang="en">DUPE<em>SPACE</em></span></a>
        <nav aria-label="主要導覽">
          <a href="/#features">功能特色</a><a href="/cleaner">線上清理</a><a href="/download">Windows 客戶端</a><a href="/support">安全整理指南</a><a href="/#faq">常見問題</a>
        </nav>
        <div className="nav-actions"><SessionBadge /><GitHubStars /><a className="nav-cta" href="/cleaner"><span>立即清理</span><ArrowRight size={15} aria-hidden="true" /></a></div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div><a className="brand inverse" href="/" aria-label="DUPESPACE 首頁"><Image src="/dupespace-icon.png" alt="DUPESPACE 雲朵文件標誌" width={38} height={38} unoptimized /><span className="brand-name notranslate" translate="no" lang="en">DUPE<em>SPACE</em></span></a><p>安全清理重複檔案，把空間還給重要的事。</p></div>
        <div><b>產品</b><a href="/cleaner">線上清理器</a><a href="/download">Windows 下載說明</a><a href={repo}>GitHub 原始碼</a></div>
        <div><b>資訊</b><a href="/support">整理指南</a><a href="/privacy">隱私權政策</a><a href="/terms">服務條款</a></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 <span className="notranslate" translate="no" lang="en">DUPESPACE</span> · MIT License</span><span>Google Drive 是 Google LLC 的商標。</span></div>
    </footer>
  );
}
