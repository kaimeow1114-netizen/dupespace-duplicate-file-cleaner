import { BlogHome } from "../components/blog-home";
import { chineseMetadata } from "../../lib/seo";

export const metadata = chineseMetadata(
  "blog",
  "Space Notes｜檔案、軟體工具與數位整理指南",
  "從檔案整理、軟體工具、備份到數位工作流程，以實測與清楚方法解決問題。不做假排名，也不把廣告包裝成建議。"
);

export default function Page() {
  return <BlogHome locale="zh-TW" />;
}
