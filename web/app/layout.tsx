import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dupespace.app"),
  title: { default: "DUPESPACE｜資料夾合併前核對與重複檔案工具", template: "%s｜DUPESPACE" },
  description: "免費比較兩個資料夾，找出改名後的相同檔案、缺漏與版本衝突。瀏覽器本機完成，免登入、不傳送檔案至伺服器、唯讀不改檔。",
  alternates: {
    canonical: "https://dupespace.app/",
    languages: {
      "zh-TW": "https://dupespace.app/",
      en: "https://dupespace.app/en/",
      "x-default": "https://dupespace.app/",
    },
  },
  applicationName: "DUPESPACE",
  category: "utilities",
  keywords: ["資料夾合併", "比較兩個資料夾", "資料夾差異比對", "改名重複檔案", "重複檔案搜尋", "本機重複檔案", "duplicate file finder", "compare folders", "merge folders without duplicates", "find renamed duplicate files"],
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }, { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "DUPESPACE｜合併資料夾前，先找出改名重複與版本衝突",
    description: "免費比較兩個資料夾，辨識改名後的相同內容、缺漏與版本衝突；免登入、不傳送檔案至伺服器、唯讀不改檔。",
    type: "website",
    locale: "zh_TW",
    url: "https://dupespace.app/",
    siteName: "DUPESPACE",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "DUPESPACE 重複檔案清理工具" }],
  },
  twitter: { card: "summary_large_image", title: "DUPESPACE｜資料夾合併前核對工具", description: "在瀏覽器本機找出改名重複、單邊缺漏與版本衝突；不傳送檔案至伺服器、唯讀不改檔。", images: ["/og.png"] },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DUPESPACE" },
  other: { "msapplication-TileColor": "#082b40", "msapplication-TileImage": "/mstile-150x150.png" },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await headers()).get("x-dupespace-locale") === "en" ? "en" : "zh-TW";
  return (
    <html lang={locale}>
      <head>
        <meta name="theme-color" content="#082b40" />
        <meta name="google-adsense-account" content="ca-pub-7998471640181666" />
      </head>
      <body>{children}</body>
    </html>
  );
}
