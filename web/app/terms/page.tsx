import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "服務條款", description: "DUPESWEEP 垃圾桶與永久刪除功能的使用條款、安全責任與限制。", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <main><SiteHeader /><article className="legal shell"><span className="eyebrow"><i /> 最後更新：2026 年 8 月 13 日</span><h1>服務條款</h1><p className="lead">使用 DUPESWEEP 即表示你同意先檢查結果、確認保留副本，並了解垃圾桶與永久刪除是兩種完全不同的操作。</p><h2>服務內容</h2><p>DUPESWEEP 依內容校驗碼協助找出重複檔案。預設及建議模式會將使用者選定的副本移至 Windows 資源回收筒或 Google Drive 垃圾桶；永久刪除是使用者必須主動選擇的高風險進階功能，完成後沒有復原方式。本服務不處理資料夾、捷徑或 Google Workspace 原生文件等沒有穩定二進位校驗碼的項目。</p><h2>安全規則</h2><p>每個重複群組至少保留一份。執行前會重新檢查檔案狀態；檔案若在掃描後改變就跳過。垃圾桶失敗只會記錄失敗，不會自動改成永久刪除。永久刪除無法停用警告，也不會處理 Windows 受保護系統位置。</p><h2>使用者責任</h2><p>大量清理前應先測試少量檔案、檢查結果、下載 CSV 稽核報告，並確保重要資料另有備份。選擇永久刪除即表示你理解該操作無法復原。不得利用本服務存取無權管理的帳號或資料。</p><h2>無保證與責任限制</h2><p>本專案依 MIT License 以現況提供，不附帶明示或默示保證。Google API、網路、權限或垃圾桶政策可能造成個別項目未成功處理，結果會在介面與 CSV 中標示。</p><h2>廣告</h2><p>網站可能顯示第三方廣告。廣告內容由廣告供應商提供，不代表 DUPESWEEP 對該產品或服務背書。</p></article><SiteFooter /></main>;
}
