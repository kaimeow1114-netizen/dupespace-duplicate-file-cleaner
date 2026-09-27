import { AboutPage } from "../../components/about-page";
import { englishMetadata } from "../../../lib/seo";

export const metadata = englishMetadata(
  "about",
  "About DUPESPACE | Open-source, local-first file tools",
  "Why DUPESPACE exists, how its guidance and product behavior are reviewed, and where duplicate-file analysis intentionally keeps a safety boundary."
);

export default function Page() {
  return <AboutPage locale="en" />;
}
