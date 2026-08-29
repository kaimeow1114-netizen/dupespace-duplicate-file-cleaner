import type { Metadata } from "next";
import Image from "next/image";
import { HardDriveDownload, Info } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/site-shell";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";
const installer = `${repo}/releases/latest/download/DupeSpace-Setup.exe`;

export const metadata: Metadata = {
  title: "免費下載 Windows 重複檔案清理工具",
  description: "下載 DUPESPACE Windows 版前，先了解保留區、清理區、程式碼專案保護與資源回收筒規則。",
  alternates: { canonical: "/download" },
};

export default function DownloadPage() {
  return (
    <main>
      <SiteHeader />
      <section className="download-hero">
        <div className="shell download-hero-grid">
          <div>
            <span className="eyebrow light"><HardDriveDownload size={15} aria-hidden="true" /> WINDOWS 10 / 11 • 免費開源</span>
            <h1><span className="heading-phrase">先看清楚用途，</span><wbr /><span className="heading-phrase">再清理副本。</span></h1>
            <p>DUPESPACE Windows 版只列出「清理區已有、保留區也有相同內容」的精確重複檔。程式碼專案與系統位置不會成為刪除候選。</p>
            <div className="download-actions"><a className="button mint" href={installer}>下載 DupeSpace-Setup.exe</a><a className="button ghost" href={repo}>查看 GitHub 原始碼</a></div>
            <small className="download-note">免費使用 · MIT License · 安裝時可選擇建立桌面捷徑 · 內建安全更新</small>
          </div>
          <div className="download-product-card"><Image src="/dupespace-icon.png" alt="DUPESPACE 應用程式圖示" width={220} height={220} priority unoptimized /><b>DUPESPACE</b><span>Windows duplicate file cleaner</span></div>
        </div>
      </section>
      <section className="shell download-guide">
        <div className="section-heading"><span className="eyebrow"><Info size={15} aria-hidden="true" /> 下載前請先了解</span><h2><span className="heading-phrase">三道保護，</span><wbr /><span className="heading-phrase">避免刪到仍有用途的副本。</span></h2></div>
        <div className="download-safety-grid">
          <article><b>01</b><h3>保留區永遠不刪</h3><p>把原始照片、工作文件與主要備份放進保留區。即使內容相同，保留區檔案也不能勾選。</p></article>
          <article><b>02</b><h3>程式碼專案硬性排除</h3><p>Git、SVN、常見建置專案、套件與虛擬環境中的相同設定或依賴，全部保留。</p></article>
          <article><b>03</b><h3>預設移至資源回收筒</h3><p>垃圾桶失敗只會記錄失敗，不會改用永久刪除；永久刪除永遠需要獨立高風險確認。</p></article>
        </div>
        <div className="download-requirements"><div><h2>安裝與使用</h2><ul><li>支援 Windows 10 與 Windows 11。</li><li>不需另行安裝 Python。</li><li>安裝程式可選擇建立桌面捷徑。</li><li>v1.1.0 起可在側邊欄檢查更新；下載後會核對 GitHub Release 的檔案大小與 SHA-256，仍由使用者確認啟動安裝。</li><li>大量結果採漸進顯示，操作完成可下載 CSV 稽核報告。</li></ul></div><div><h2>第一次掃描建議</h2><ol><li>先用少量、可復原的測試副本熟悉流程。</li><li>確認保留區與清理區沒有重疊或巢狀。</li><li>查看完整路徑與保護原因，再移至資源回收筒。</li></ol></div></div>
      </section>
      <SiteFooter />
    </main>
  );
}
