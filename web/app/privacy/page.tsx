import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "隱私權政策", description: "DUPESPACE 如何處理 Google Drive 中繼資料、OAuth 憑證、CSV 報告與廣告 Cookie。", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return <main><SiteHeader /><article className="legal shell"><span className="eyebrow"><i /> 最後更新：2026 年 8 月 21 日</span><h1>隱私權政策</h1><p className="lead">DUPESPACE 的原則很簡單：只處理完成清理所需的資料，Google Drive 檔案內容不會傳送到我們的伺服器。</p><h2>Google Drive 資料</h2><p>線上清理器透過 Google OAuth 取得使用者明確授權，讀取檔案 ID、名稱、父資料夾、大小、建立與修改時間、版本、所有權、權限、縮圖連結及校驗碼，以識別內容相同的二進位檔案。掃描後會選取可移至垃圾桶的非保留副本，使用者按下垃圾桶按鈕才會執行；若另外選擇「立即永久刪除」，仍必須重新手動選取並完成高風險確認。</p><p>圖片縮圖由 Google 直接傳送到你的瀏覽器，DUPESPACE 不代理、下載或儲存縮圖與檔案內容。一般檔案預覽會在 Google Drive 開啟。</p><h2>登入與安全</h2><p>OAuth 存取與更新權杖儲存在加密、HttpOnly、SameSite Cookie 中，不提供給頁面 JavaScript。掃描證明有時效；每次操作前會重新驗證目標與保留副本的版本、父資料夾、大小、修改時間、校驗碼、所有權及刪除權限。Web Client Secret 僅存放於加密託管環境，不會打包進桌面程式或提交 GitHub。</p><h2>操作與稽核報告</h2><p>垃圾桶與永久刪除使用不同 API 路徑，垃圾桶失敗不會自動改用永久刪除。結果可匯出 CSV，內容可能含檔名、完整父資料夾路徑、檔案 ID、大小、校驗碼、模式及失敗原因；CSV 只由你的瀏覽器產生並下載。</p><h2>廣告與 Cookie</h2><p>本網站使用 Google AdSense。Google 及其合作夥伴可能依其政策使用 Cookie 或類似技術提供、衡量及個人化廣告。訪客可在 Google 的廣告設定中管理個人化選項。</p><h2>桌面版</h2><p>桌面版不包含遙測。掃描與雜湊在使用者電腦執行；CSV 報告保留在本機，可能包含私人檔名與路徑，請妥善保管。</p><h2>聯絡與刪除</h2><p>中斷 Google 連線會清除 DUPESPACE 的登入 Cookie。問題可透過公開 GitHub 專案的 Issues 頁面提出。</p></article><SiteFooter /></main>;
}
