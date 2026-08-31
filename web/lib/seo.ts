import type { Metadata } from "next";

export function localizedAlternates(path: string) {
  const zh = `https://dupespace.app/${path}`;
  const en = `https://dupespace.app/en/${path ? `${path}/` : ""}`;
  return { canonical: zh, languages: { "zh-TW": zh, en, "x-default": zh } };
}

export function englishMetadata(path: string, title: string, description: string): Metadata {
  const canonical = `https://dupespace.app/en/${path ? `${path}/` : ""}`;
  const chinese = `https://dupespace.app/${path}`;
  return {
    title, description,
    alternates: { canonical, languages: { en: canonical, "zh-TW": chinese, "x-default": chinese } },
    openGraph: { title: `${title} | DUPESPACE`, description, url: canonical, type: "website", locale: "en_US", alternateLocale: ["zh_TW"], siteName: "DUPESPACE",
      images: [{ url: "https://dupespace.app/og.png", width: 1732, height: 909, alt: "DUPESPACE duplicate file cleaner" }] },
    twitter: { card: "summary_large_image", title: `${title} | DUPESPACE`, description, images: ["https://dupespace.app/og.png"] },
  };
}
