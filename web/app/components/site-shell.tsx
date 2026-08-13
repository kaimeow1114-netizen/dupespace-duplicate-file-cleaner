import Image from "next/image";
import Link from "next/link";

const repo = "https://github.com/kaimeow1114-netizen/dupesweep-duplicate-file-cleaner";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav">
        <Link className="brand" href="/"><Image src="/dupesweep-icon.png" alt="" width={38} height={38} /><span>Dupe<em>Sweep</em></span></Link>
        <nav aria-label="主要導覽">
          <Link href="/#features">功能</Link><Link href="/cleaner">線上清理</Link><Link href="/#download">免費下載</Link><Link href="/support">整理指南</Link>
        </nav>
        <Link className="nav-cta" href="/cleaner">開始清理 <span>→</span></Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div><Link className="brand inverse" href="/"><Image src="/dupesweep-icon.png" alt="" width={38} height={38} /><span>Dupe<em>Sweep</em></span></Link><p>安全清理重複檔案，把空間還給重要的事。</p></div>
        <div><b>產品</b><Link href="/cleaner">線上清理器</Link><Link href="/#download">Windows 下載</Link><a href={repo}>GitHub 原始碼</a></div>
        <div><b>資訊</b><Link href="/support">整理指南</Link><Link href="/privacy">隱私權政策</Link><Link href="/terms">服務條款</Link></div>
      </div>
      <div className="shell footer-bottom"><span>© 2026 DupeSweep · MIT License</span><span>Google Drive 是 Google LLC 的商標。</span></div>
    </footer>
  );
}
