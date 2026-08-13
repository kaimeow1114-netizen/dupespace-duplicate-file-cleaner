import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "隱私權政策" };

export default function PrivacyPage() {
  return <main><SiteHeader /><article className="legal shell"><span className="eyebrow"><i /> 最後更新：2026 年 8 月 13 日</span><h1>隱私權政策</h1><p className="lead">DupeSweep 的原則很簡單：完成清理所需的資料才會處理，檔案內容不會傳送到我們的伺服器。</p><h2>Google Drive 資料</h2><p>線上清理器透過 Google OAuth 取得使用者明確授權，讀取檔案名稱、大小、建立時間、版本與校驗碼，以識別內容相同的二進位檔案。只有在使用者再次確認後，選定的副本才會被標記為移至 Google Drive 垃圾桶；DupeSweep 不會永久刪除檔案。</p><h2>登入與安全</h2><p>OAuth 存取權杖儲存在加密、HttpOnly、SameSite Cookie 中，不提供給頁面 JavaScript。掃描產生的移除證明有時效，執行前會重新確認選定檔案與保留副本未被修改。</p><h2>廣告與 Cookie</h2><p>本網站使用 Google AdSense。Google 及其合作夥伴可能依其政策使用 Cookie 或類似技術提供、衡量及個人化廣告。訪客可在 Google 的廣告設定中管理個人化選項。</p><h2>桌面版</h2><p>桌面版不包含遙測。掃描與雜湊在使用者電腦執行；CSV 報告保留在本機，可能包含私人檔名與路徑，請妥善保管。</p><h2>聯絡與刪除</h2><p>中斷 Google 連線會清除 DupeSweep 的登入 Cookie。問題可透過公開 GitHub 專案的 Issues 頁面提出。</p></article><SiteFooter /></main>;
}
