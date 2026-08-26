import type { Metadata } from "next";
import { ArrowRight, HardDriveDownload, ShieldCheck } from "lucide-react";
import { HeroDashboard } from "../components/hero-dashboard";
import { SiteFooter, SiteHeader } from "../components/site-shell";

export const metadata: Metadata = {
  title: "Open-source duplicate file cleaner for Google Drive and Windows",
  description: "Find, review and safely move exact duplicate files and mirrored folders to trash. File contents never pass through DUPESPACE servers.",
  alternates: {
    canonical: "https://dupespace.app/en",
    languages: { "zh-TW": "https://dupespace.app/", en: "https://dupespace.app/en", "x-default": "https://dupespace.app/" },
  },
};

export default function EnglishHome() {
  return (
    <main lang="en">
      <SiteHeader />
      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
          <span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> FREE • OPEN SOURCE • PRIVACY-FIRST</span>
          <h1><span className="headline-line">Match file contents precisely.</span><span className="headline-line gradient-text">Protect your storage proactively.</span></h1>
          <p className="purpose-statement"><strong>DUPESPACE is an open-source duplicate file cleaner for Google Drive and Windows.</strong>It finds exact duplicate files and strictly mirrored folders, protects one original in every group, and moves selected copies to trash by default. Your Google Drive file contents are never uploaded to DUPESPACE servers.</p>
          <div className="hero-actions"><a className="button primary" href="/cleaner"><span>Start a safe scan</span><ArrowRight size={18} aria-hidden="true" /></a><a className="button secondary" href="/download"><HardDriveDownload size={18} aria-hidden="true" /><span>Download for Windows</span></a></div>
          </div>
          <div className="hero-dashboard-wrap"><HeroDashboard /></div>
        </div>
      </section>
      <section className="section feature-band"><div className="shell"><div className="section-heading"><span className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> SAFE BY DESIGN</span><h2>Exact matches are candidates, not automatic deletion decisions.</h2><p>DUPESPACE preserves one keeper, excludes software projects and unverifiable items, revalidates every operation, and never falls back from trash to permanent deletion.</p></div></div></section>
      <SiteFooter />
    </main>
  );
}
