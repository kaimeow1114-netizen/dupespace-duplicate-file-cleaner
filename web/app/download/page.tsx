import type { Metadata } from "next";
import { localizedAlternates } from "../../lib/seo";
import Image from "next/image";
import { HardDriveDownload, Info } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/site-shell";

const repo = "https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner";
const installer = `${repo}/releases/latest/download/DupeSpace-Setup.exe`;

export const metadata: Metadata = {
  title: "免費下載 Windows 重複檔案清理工具",
  description: "下載 DUPESPACE Windows 版前，先了解最舊檔保護、程式碼專案排除與資源回收筒規則。",
  alternates: localizedAlternates("download"),
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
            <p>DUPESPACE 只遞迴掃描您加入的本機資料夾，以完整 SHA-256 找出精確重複檔，每組最舊的一份自動鎖定。程式碼專案與系統位置不會成為刪除候選。</p>
            <div className="download-actions"><a className="button mint" href={installer}>下載 DupeSpace-Setup.exe</a><a className="button ghost" href={repo}>查看 GitHub 原始碼</a></div>
            <small className="download-note">免費使用 · MIT License · 安裝時可選擇建立桌面捷徑 · 內建安全更新</small>
          </div>
          <div className="download-product-card"><Image src="/dupespace-icon.png" alt="DUPESPACE 應用程式圖示" width={220} height={220} priority unoptimized /><b>DUPESPACE</b><span>Windows duplicate file cleaner</span></div>
        </div>
      </section>
      <section className="shell download-guide">
        <div className="download-requirements"><div><h2>更直覺的群組檢查</h2><p>影片、圖片與重要文件優先排列；每組只載入一張保留檔圖片，副本保留輕量的名稱與路徑。點擊檔名就能查看詳細資料，勾選與預覽互不干擾。</p></div><div><h2>少一點點擊，多一點掌握</h2><p>掃描完成後，所有符合安全條件的副本都會預先選取，包含小檔案與已驗證的重複資料夾。核對後按一次即可移至垃圾桶；保留檔與受保護項目不會被選取，永久刪除仍須獨立確認。</p></div></div>
        <div className="section-heading"><span className="eyebrow"><Info size={15} aria-hidden="true" /> 下載前請先了解</span><h2><span className="heading-phrase">三道保護，</span><wbr /><span className="heading-phrase">避免刪到仍有用途的副本。</span></h2></div>
        <div className="download-safety-grid">
          <article><b>01</b><h3>每組鎖定最舊檔</h3><p>不必先建立保留區。若有特別重要的原檔，也能把整理位置內的子資料夾設為永遠不可勾選。</p></article>
          <article><b>02</b><h3>程式碼專案硬性排除</h3><p>Git、SVN、常見建置專案、套件與虛擬環境中的相同設定或依賴，全部保留。</p></article>
          <article><b>03</b><h3>預設移至資源回收筒</h3><p>垃圾桶失敗只會記錄失敗，不會改用永久刪除；永久刪除永遠需要獨立高風險確認。</p></article>
        </div>
        <div className="download-requirements"><div><h2>安裝與使用</h2><ul><li>支援 Windows 10 與 Windows 11。</li><li>不需另行安裝 Python。</li><li>安裝程式可選擇建立桌面捷徑。</li><li>v1.1.0 起可在側邊欄檢查更新；下載後會核對 GitHub Release 的檔案大小與 SHA-256，仍由使用者確認啟動安裝。</li><li>大量結果採虛擬列表，操作完成可取得 CSV 稽核報告。</li></ul></div><div><h2>第一次掃描建議</h2><ol><li>點一下選擇資料夾，或把一個或多個資料夾拖進視窗。</li><li>畫面會明確顯示所有遞迴掃描位置；需要時再保護其中的子資料夾。</li><li>查看完整路徑與保護原因，再移至資源回收筒。</li></ol></div></div>
      </section>
      <SiteFooter />
    </main>
  );
}
