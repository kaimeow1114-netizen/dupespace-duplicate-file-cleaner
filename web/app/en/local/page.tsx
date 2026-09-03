import { FileSearch, ShieldCheck } from "lucide-react";
import { englishMetadata } from "../../../lib/seo";
import { LocalAnalyzer } from "../../components/local-analyzer";
import { SiteFooter, SiteHeader } from "../../components/site-shell";

export const metadata = englishMetadata("local", "Local Duplicate File Analyzer — No Upload, No Account", "Analyze a local folder for exact duplicate files without uploading filenames, paths or file contents. The browser creates a read-only report and cannot delete files.");

export default function LocalPage() {
  return <main className="local-page" lang="en"><SiteHeader pagePath="local" locale="en" privateWorkspace /><section className="local-hero"><div className="shell"><span className="eyebrow light"><FileSearch size={16} aria-hidden="true" /> LOCAL FILE ANALYZER</span><h1>Find local duplicates.<br /><span className="gradient-text">Keep every file on your device.</span></h1><p>No account and no installation. DUPESPACE reads only the folder you choose, compares content inside your browser and creates a report. Files are not uploaded, and the web app cannot delete them.</p><div className="local-hero-trust"><span><ShieldCheck size={15} aria-hidden="true" />Read-only analysis. Originals stay unchanged.</span><span><ShieldCheck size={15} aria-hidden="true" />Unexported results leave memory when you close the tab</span></div></div></section><div className="shell local-wrap"><LocalAnalyzer locale="en" /></div><SiteFooter locale="en" /></main>;
}
