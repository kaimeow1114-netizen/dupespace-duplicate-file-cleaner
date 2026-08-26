import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = {
  title: "隱私權政策",
  description: "DUPESPACE 如何處理 Google Drive 中繼資料、OAuth 憑證、CSV 報告、裝置端偏好與廣告 Cookie。",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <main>
      <SiteHeader />
      <article className="legal shell">
        <span className="eyebrow"><CalendarDays size={15} aria-hidden="true" /> 最後更新：2026 年 8 月 21 日</span>
        <h1>隱私權政策</h1>
        <p className="lead">DUPESPACE 的原則很簡單：只處理完成清理所需的資料，Google Drive 檔案內容不會傳送到我們的伺服器。</p>
        <h2>Google Drive 資料</h2>
        <p>線上清理器透過 Google OAuth 取得使用者明確授權，讀取檔案與資料夾的 ID、名稱、父資料夾、大小、建立與修改時間、版本、所有權、權限、縮圖連結及校驗碼，以識別內容相同的二進位檔案與完整鏡像資料夾。使用者按下垃圾桶按鈕才會執行；永久刪除只適用一般檔案，資料夾永遠不能永久刪除。</p>
        <p>圖片縮圖由 Google 直接傳送到你的瀏覽器，DUPESPACE 不代理、下載或儲存縮圖與檔案內容。一般檔案預覽會在 Google Drive 開啟。</p>
        <h2>Google API Services User Data Policy 與 Limited Use</h2>
        <p>DUPESPACE 對從 Google APIs 取得資訊的使用及轉移，遵守 Google API Services User Data Policy，包括 Limited Use 要求。Google 使用者資料只用於提供使用者明確要求的登入、重複項目分析、檢查、垃圾桶、復原、中斷連線及稽核功能。</p>
        <p>Google 使用者資料不會出售、不會提供給 AdSense 或其他廣告系統、不會用於個人化廣告、廣告受眾建立、信用評估或任何與重複檔案清理無關的用途。除非為了安全調查、遵守法律、取得使用者明確同意或由使用者本人要求支援，DUPESPACE 人員不會讀取 Google 使用者資料。</p>
        <h2>登入與安全</h2>
        <p>OAuth 存取與更新權杖儲存在加密、Secure、HttpOnly、SameSite Cookie 中，不提供給頁面 JavaScript；登入最多維持 30 天，每次使用會重新加密。掃描證明 30 分鐘後失效；每次操作前會重新驗證目標與保留副本的版本、父資料夾、大小、修改時間、校驗碼、所有權及權限。Web Client Secret 僅存放於加密託管環境，不會打包進桌面程式或提交 GitHub。</p>
        <h2>操作、復原與稽核報告</h2>
        <p>垃圾桶、快速復原與永久刪除使用不同 API 路徑，垃圾桶失敗不會自動改用永久刪除。10 秒快速復原只接受原始簽章掃描證明，並重新確認項目確實位於垃圾桶、由登入者本人擁有且不在共用雲端硬碟。結果可匯出 CSV，內容可能含項目類型、名稱、完整父資料夾路徑、檔案 ID、大小、校驗碼、模式及失敗原因；CSV 只由你的瀏覽器產生並下載。</p>
        <h2>裝置端整理偏好</h2>
        <p>儲存健康趨勢、防護設定檔及容量費用等值計算的輸入只保存在目前瀏覽器的 localStorage。趨勢僅含時間、彙總評分及累計釋放容量，不保存檔名、路徑、檔案 ID 或 Google 帳號；可透過瀏覽器網站資料設定清除。</p>
        <h2>廣告與 Cookie</h2>
        <p>本網站使用 Google AdSense。Google 及其合作夥伴可能依其政策使用 Cookie 或類似技術提供、衡量及個人化廣告。訪客可在 Google 的廣告設定中管理個人化選項。</p>
        <h2>桌面版</h2>
        <p>桌面版不包含遙測。掃描與雜湊在使用者電腦執行；CSV 報告保留在本機，可能包含私人檔名與路徑，請妥善保管。</p>
        <h2>聯絡與刪除</h2>
        <p>中斷 Google 連線會嘗試撤銷 Google OAuth 權杖，並清除 DUPESPACE 的登入 Cookie。問題可透過公開 GitHub 專案的 Issues 頁面提出。</p>
      </article>
      <SiteFooter />
    </main>
  );
}
