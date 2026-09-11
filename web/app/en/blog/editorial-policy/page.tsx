import { BlogEditorialPolicy } from "../../../components/blog-editorial-policy";
import { englishMetadata } from "../../../../lib/seo";

export const metadata = englishMetadata(
  "blog/editorial-policy",
  "Space Notes editorial policy",
  "How Space Notes tests tools, discloses advertising and commercial relationships, dates updates and corrects material errors."
);

export default function Page() {
  return <BlogEditorialPolicy locale="en" />;
}
