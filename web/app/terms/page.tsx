import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = { title: "服務條款", description: "DUPESPACE 垃圾桶與永久刪除功能的使用條款、安全責任與限制。", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return <main><SiteHeader /><article className="legal shell"><span className="eyebrow"><i /> 最後更新：2026 年 8 月 21 日</span><h1>服務條款</h1><p className="lead">使用 DUPESPACE 即表示你同意先檢查結果、確認保留副本，並了解垃圾桶與永久刪除是兩種完全不同的操作。</p><h2>服務內容</h2><p>DUPESPACE 依內容校驗碼協助找出重複檔案，並以相對路徑、大小與每個檔案校驗碼識別完整鏡像資料夾。只有按下「移至 Google Drive 垃圾桶」才會執行；永久刪除是使用者必須主動選擇、重新選取並確認的高風險功能，而且只適用一般檔案。資料夾、捷徑及 Google Workspace 原生文件不能永久刪除。</p><h2>安全規則</h2><p>每個重複群組至少保留一份。程式碼專案、套件目錄、虛擬環境、備份與同步情境不會列為整資料夾清理候選；Google Drive 非本人擁有及共用雲端硬碟項目同樣排除。執行前會重新檢查項目狀態；資料夾數量、容量、最新修改時間或內容若在掃描後改變就取消。垃圾桶失敗只會記錄失敗，不會自動改成永久刪除。</p><h2>使用者責任</h2><p>大量清理前應先測試少量項目、檢查完整父資料夾路徑、預覽與資料夾雙樹比對、下載 CSV 稽核報告，並確保重要資料另有備份。選擇永久刪除即表示你理解該操作無法復原。不得利用本服務存取無權管理的帳號或資料。</p><h2>無保證與責任限制</h2><p>本專案依 MIT License 以現況提供，不附帶明示或默示保證。Google API、網路、權限或垃圾桶政策可能造成個別項目未成功處理，結果會在介面與 CSV 中標示。</p><h2>廣告</h2><p>網站可能顯示第三方廣告。廣告內容由廣告供應商提供，不代表 DUPESPACE 對該產品或服務背書。</p></article><SiteFooter /></main>;
}
