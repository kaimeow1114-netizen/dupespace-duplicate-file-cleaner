import { BlogEditorialPolicy } from "../../components/blog-editorial-policy";
import { chineseMetadata } from "../../../lib/seo";

export const metadata = chineseMetadata(
  "blog/editorial-policy",
  "Space Notes 編輯與比較原則",
  "了解 Space Notes 如何實測工具、揭露廣告與商業關係、標示更新日期，並處理內容更正。"
);

export default function Page() {
  return <BlogEditorialPolicy locale="zh-TW" />;
}
