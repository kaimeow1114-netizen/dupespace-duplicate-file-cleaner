import { AboutPage } from "../components/about-page";
import { chineseMetadata } from "../../lib/seo";

export const metadata = chineseMetadata(
  "about",
  "關於 DUPESPACE｜開源、本機優先的檔案整理工具",
  "了解 DUPESPACE 為什麼存在、如何驗證內容與產品行為，以及重複檔案分析刻意保留的安全界線。"
);

export default function Page() {
  return <AboutPage locale="zh-TW" />;
}
