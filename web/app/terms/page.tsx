import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "服務條款" };

export default function TermsPage() {
  return <main><SiteHeader /><article className="legal shell"><span className="eyebrow"><i /> 最後更新：2026 年 8 月 13 日</span><h1>服務條款</h1><p className="lead">使用 DupeSweep 即表示你同意先檢查結果、確認保留副本，並自行判斷垃圾桶保留期限是否符合需求。</p><h2>服務內容</h2><p>DupeSweep 依內容校驗碼協助找出可能的重複檔案，並將使用者選定的副本移至作業系統或 Google Drive 垃圾桶。本服務不保證所有檔案類型都能產生校驗碼，也不處理 Google Docs、Sheets、Slides 等 Workspace 原生檔案。</p><h2>使用者責任</h2><p>大量清理前應先測試少量檔案、檢查結果並確保重要資料另有備份。不得利用本服務存取無權管理的帳號或資料。</p><h2>無保證與責任限制</h2><p>本專案依 MIT License 以現況提供，不附帶明示或默示保證。Google API、網路、權限或垃圾桶政策可能造成個別項目未成功處理，結果會在介面中標示。</p><h2>廣告</h2><p>網站可能顯示第三方廣告。廣告內容由廣告供應商提供，不代表 DupeSweep 對該產品或服務背書。</p></article><SiteFooter /></main>;
}
