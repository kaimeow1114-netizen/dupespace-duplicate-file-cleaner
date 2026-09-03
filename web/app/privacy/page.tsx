import { CalendarDays } from "lucide-react";
import { chineseMetadata } from "../../lib/seo";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata = chineseMetadata("privacy", "隱私權政策", "DUPESPACE 如何在瀏覽器與 Windows 裝置端分析檔案、產生 CSV 報告，以及如何在公開內容頁使用 AdSense。");

export default function PrivacyPage() {
  return <main><SiteHeader pagePath="privacy" /><article className="legal shell">
    <span className="eyebrow"><CalendarDays size={15} aria-hidden="true" /> 最後更新：2026 年 9 月 2 日</span>
    <h1>隱私權政策</h1>
    <p className="lead">DUPESPACE 採本機優先設計：檔案分析盡量留在你的裝置，檔名、路徑與內容不應成為伺服器或廣告資料。</p>
    <h2>網頁版資料夾分析</h2>
    <p>網頁版只可讀取你透過瀏覽器檔案選擇器或拖放動作主動交付的檔案。檔名、相對路徑、檔案內容、內容指紋與分析結果都在瀏覽器記憶體中處理，不會上傳到 DUPESPACE 伺服器。網頁版沒有移動、覆寫或刪除本機檔案的權限。</p>
    <p>圖片群組只為目前顯示的建議保留檔建立裝置端 Blob 縮圖網址，不會上傳圖片。關閉頁面或更換結果時會釋放縮圖網址；關閉分頁後，未匯出的分析結果會從頁面記憶體移除。</p>
    <h2>分析工作區的網路邊界</h2>
    <p><code>/local</code> 與 <code>/en/local/</code> 使用較嚴格的 Content Security Policy，只允許本站程式、裝置端 Blob 圖片及本站連線。分析工作區不載入 AdSense、第三方分析、外部框架或社群追蹤程式。</p>
    <h2>CSV 報告</h2>
    <p>CSV 報告由瀏覽器在裝置端建立並下載，可能包含私人檔名、相對路徑、大小、修改時間與內容指紋。DUPESPACE 不接收報告內容；請勿把未遮蔽的報告貼到公開 Issues 或分享給不信任的對象。</p>
    <h2>Windows 桌面版</h2>
    <p>桌面版不包含使用者行為遙測。掃描、內容比對、預覽與 CSV 報告都在使用者電腦執行。更新檢查只讀取公開 GitHub Release 資訊，下載後核對安裝檔大小與 SHA-256；本機報告與偏好由使用者自行管理。</p>
    <h2>舊版工作階段遷移</h2>
    <p>託管雲端清理功能已停止。舊入口會嘗試撤銷既有 OAuth 權杖，成功後清除加密登入 Cookie；所有舊掃描、縮圖、垃圾桶與刪除 API 都會回覆功能已停止，不再接受新登入或檔案操作。若撤銷服務暫時無法連線，舊加密 Cookie 只供再次撤銷使用，不會恢復檔案存取，並在原到期日失效。你也可在原帳號的第三方存取設定手動撤銷。舊瀏覽器快取會嘗試清除；從未再次開啟本站的裝置無法由本站遠端清除。</p>
    <h2>廣告與 Cookie</h2>
    <p>首頁、下載頁與整理指南等公開內容頁使用 Google AdSense Auto Ads。Google 及其合作夥伴可能依其政策使用 Cookie 或類似技術提供、衡量及個人化廣告。你可在 Google 廣告設定中管理個人化選項。廣告系統不會載入本機分析工作區，也不會取得檔案清單、內容指紋、縮圖或 CSV 報告。</p>
    <h2>聯絡方式</h2>
    <p>可透過公開 GitHub 專案的 <a href="https://github.com/kaimeow1114-netizen/dupespace-duplicate-file-cleaner/issues">Issues</a> 回報問題。請提供版本、重現步驟與已遮蔽的錯誤訊息，不要張貼密碼、權杖、私人檔名、完整路徑或未遮蔽的 CSV。</p>
  </article><SiteFooter /></main>;
}
