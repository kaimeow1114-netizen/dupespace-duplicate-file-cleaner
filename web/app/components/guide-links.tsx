import { ArrowUpRight } from "lucide-react";
import { guides } from "../../lib/guides";

export function GuideLinks({ locale = "zh-TW" }: { locale?: "zh-TW" | "en" }) {
  const en = locale === "en";
  return <section className="section guide-links-band"><div className="shell"><div className="section-heading"><span className="eyebrow">FILE GUIDES</span><h2>{en ? "A little context makes cleanup safer." : "整理之前，先解開常見疑問。"}</h2></div><div className="guide-link-grid">{guides[locale].map((guide) => <a className="guide-link-card" key={guide.slug} href={`${en ? "/en" : ""}/guides/${guide.slug}${en ? "/" : ""}`}><span>{en ? "Practical guide" : "實用指南"}<ArrowUpRight size={20} aria-hidden="true" /></span><h3>{guide.title}</h3><p>{guide.description}</p></a>)}</div></div></section>;
}
