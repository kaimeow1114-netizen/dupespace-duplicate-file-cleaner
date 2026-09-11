import { BlogHome } from "../../components/blog-home";
import { englishMetadata } from "../../../lib/seo";

export const metadata = englishMetadata(
  "blog",
  "Space Notes | Practical file, software and digital work guides",
  "Evidence-led guidance for files, software tools, storage, backups and digital workflows. No fabricated rankings or disguised promotion."
);

export default function Page() {
  return <BlogHome locale="en" />;
}
