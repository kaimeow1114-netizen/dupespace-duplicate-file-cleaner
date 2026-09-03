import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dupespace.app"),
  title: { default: "DUPESPACE｜免費開源的本機重複檔案分析與 Windows 清理工具", template: "%s｜DUPESPACE" },
  description: "免費搜尋內容相同的照片、影片與文件。在瀏覽器分析本機資料夾，免登入、免上傳；使用 Windows 版核對副本後移至資源回收筒。",
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
  keywords: ["重複檔案刪除", "重複檔案清理", "重複檔案搜尋", "本機重複檔案", "照片重複檔案", "影片重複檔案", "Windows 重複檔案工具", "duplicate file finder", "duplicate file cleaner", "duplicate photo finder"],
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }, { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "DUPESPACE｜把重複檔案掃乾淨",
    description: "免登入、零上傳，在瀏覽器分析本機重複檔案；Windows 版支援預設可復原清理與 CSV 稽核報告。",
    type: "website",
    locale: "zh_TW",
    url: "https://dupespace.app/",
    siteName: "DUPESPACE",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "DUPESPACE 重複檔案清理工具" }],
  },
  twitter: { card: "summary_large_image", title: "DUPESPACE｜本機重複檔案分析工具", description: "零上傳分析本機重複檔案，並使用 Windows 版安全整理儲存空間。", images: ["/og.png"] },
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
