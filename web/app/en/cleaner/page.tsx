import { englishMetadata } from "../../../lib/seo";
import { CleanerClient } from "../../components/cleaner-client";
import { SiteHeader, SiteFooter } from "../../components/site-shell";
import { ArrowRight, Cloud, HardDrive, ShieldCheck } from "lucide-react";
export const metadata = englishMetadata("cleaner", "Google Drive Cleaner — Find and Review Duplicate Files", "Scan Google Drive for duplicate files and mirrored folders. Review thumbnails, full paths and protected keepers. Move selected copies to trash and undo confirmed cleanup.");
export default function Page() {
  return <main className="cleaner-page">
    <SiteHeader locale="en" />
    <section className="cleaner-hero"><div className="shell"><span className="eyebrow light"><ShieldCheck size={16} aria-hidden="true" />GOOGLE DRIVE + WINDOWS</span><h1>Review duplicates.<br />Keep what matters.</h1><p>DUPESPACE compares Google Drive metadata and checksums, protects a keeper and moves selected copies to trash by default. No original file contents are downloaded to our servers.</p></div></section>
    <section className="cleaner-wrap">
      <nav className="cleaner-source-switch" aria-label="Choose scan source">
        <a className="active" href="/en/cleaner/" aria-current="page"><span className="source-icon"><Cloud size={22} aria-hidden="true" /></span><span><b>Google Drive cleaner</b><small>Online, no installation · Trash with a chance to restore</small></span><em>Selected</em></a>
        <a href="/en/download/"><span className="source-icon"><HardDrive size={22} aria-hidden="true" /></span><span><b>Windows local folders</b><small>Drag in folders · Protect selected subfolders</small></span><ArrowRight size={20} aria-hidden="true" /></a>
      </nav>
      <p className="local-cleanup-note"><ShieldCheck size={17} aria-hidden="true" /><span>Use the Windows app for local folders and Recycle Bin support. <a href="/en/privacy/">Read our privacy policy</a>.</span></p>
      <CleanerClient locale="en" />
    </section><SiteFooter locale="en" />
  </main>;
}
