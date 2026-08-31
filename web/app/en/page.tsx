import { englishMetadata } from "../../lib/seo";
import { AdPanel } from "../components/ad-panel";
import { ArrowRight, HardDriveDownload, ShieldCheck } from "lucide-react";
import { HeroDashboard } from "../components/hero-dashboard";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata = englishMetadata("", "Free Google Drive Cleaner & Windows Duplicate File Cleaner", "DUPESPACE is a free, open-source Google Drive cleaner for exact duplicate files. Review paths, protect a keeper and move unwanted copies to trash. Windows app available.");

const faq = [
  ["What does this Google Drive cleaner remove?", "DUPESPACE identifies exact duplicate binary files and strictly mirrored folders. It does not decide whether a copy is unnecessary just from its name, and it is not a general junk-file or Gmail cleaner."],
  ["Are my original files uploaded?", "No original file contents are downloaded to our servers. Scanning uses Google Drive metadata and content checksums. Small previews may be forwarded privately to your browser, without server storage or advertising use."],
  ["Can I undo cleanup?", "Trash is the default. A short undo action is available after successful cleanup; you can also use Google Drive Trash subject to Google’s retention rules. Permanent deletion is a separate, explicitly confirmed file-only operation and cannot be undone."],
  ["Does moving files to trash immediately free my Google storage?", "No. Items in Google Drive Trash may still count toward your storage quota. Duplicate capacity is an estimate of what you can organize, not a promise that quota has already been released."],
  ["Why are repeat scans faster?", "A device-local encrypted metadata index can synchronize changes since your last scan. It is bound to your account and expires after seven days. Folder or permission changes, unavailable storage or an invalid index can require a full scan. Every cleanup still revalidates the target and keeper."],
  ["Can it clean local Windows folders?", "Yes, using the free desktop application. Select folders or drag them into the app; full SHA-256 comparisons run locally. System locations and detected software projects are protected. Review each candidate before removing it."],
];

export default function EnglishHome() {
  return (
    <main lang="en">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "DUPESPACE", url: "https://dupespace.app/en/", applicationCategory: "UtilitiesApplication", operatingSystem: "Web, Windows 10, Windows 11", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
        { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) },
      ]) }} />
      <SiteHeader locale="en" />
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> FREE • OPEN SOURCE • PRIVACY-FIRST</span>
          <h1><span>Find duplicate files.</span><br /><span className="gradient-text">Make room for what matters.</span></h1>
          <p className="purpose-statement"><strong>DUPESPACE is an open-source duplicate file cleaner for Google Drive and Windows.</strong>It finds exact duplicate files and strictly mirrored folders, protects one original in every group, and moves selected copies to trash by default. Original files remain in your Google Drive. Small image, video and PDF thumbnails may be forwarded privately to your browser, without storage or sharing with advertisers.</p>
          <div className="hero-actions"><a className="button primary" href="/en/cleaner/"><span>Open Google Drive cleaner</span><ArrowRight size={18} aria-hidden="true" /></a><a className="button secondary" href="/en/download/"><HardDriveDownload size={18} aria-hidden="true" /><span>Download for Windows</span></a></div>
          <p><a href="/en/privacy/">Read our privacy policy</a> · Independent of Google · Free and open source</p>
          </div>
          <div className="hero-dashboard-wrap"><HeroDashboard locale="en" /></div>
        </div>
      </section>
      <section className="section feature-band" id="features"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> SAFE BY DESIGN</span><h2>A drive cleaner with clear safety boundaries.</h2><p>Exact matches are candidates, not automatic deletion decisions.</p></div><div className="download-safety-grid">
        <article><ShieldCheck aria-hidden="true" /><h3>Keep one copy</h3><p>Protection rules come first, then earlier creation time. Missing or equal times use shorter paths. Neither timestamps nor path length prove a file’s original purpose.</p></article>
        <article><ShieldCheck aria-hidden="true" /><h3>Review before removal</h3><p>Inspect thumbnails and complete paths. Software projects and unverifiable folder contents are excluded. Trash failures never become permanent deletions.</p></article>
        <article><ShieldCheck aria-hidden="true" /><h3>Validate again</h3><p>Before cleanup, we check the target and keeper against their scanned versions, sizes, checksums, locations and permissions. Changed items are skipped.</p></article>
      </div></div></section>
      <section className="section alternate"><div className="shell"><h2>Google Drive duplicate file cleaner: how it works</h2><ol><li>Connect your Google account and start a metadata scan.</li><li>Review duplicate groups and their protected keepers.</li><li>Move selected copies to trash and review the confirmed results.</li></ol><p>Windows uses full SHA-256 hashing. Google Drive uses checksums provided by its API. No original cloud file contents need to pass through DUPESPACE.</p><a className="button mint" href="/en/support/">Read the safety guide</a></div></section>
      <section className="section faq-band" id="faq"><div className="shell"><h2>Google Drive cleaner FAQ</h2>{faq.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      <section className="section privacy-band"><div className="shell"><h2>Your Drive data is not advertising data.</h2><p>DUPESPACE uses Google API data only to provide requested sign-in, scanning, review, cleanup, restore and audit features. Our use and transfer of this information follows the Google API Services User Data Policy, including Limited Use requirements. It is not sold or used for targeted advertising.</p><a href="/en/privacy/">Access, storage, retention and privacy details</a></div></section>
      <AdPanel />
      <SiteFooter locale="en" />
    </main>
  );
}
