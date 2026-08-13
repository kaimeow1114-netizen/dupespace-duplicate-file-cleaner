import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dupespace.app"),
  title: { default: "DUPESPACE｜重複檔案刪除與清理工具", template: "%s｜DUPESPACE" },
  description: "免費搜尋並清理 Windows 與 Google Drive 重複檔案。預設移至垃圾桶、保護每組一份原檔，支援 5,000 個以上檔案與 CSV 稽核報告。",
  alternates: { canonical: "/", languages: { "zh-Hant-TW": "/", en: "/" } },
  applicationName: "DUPESPACE",
  category: "utilities",
  keywords: ["重複檔案刪除", "重複檔案清理", "重複檔案搜尋", "Google Drive 重複檔案", "雲端硬碟清理", "Windows 重複檔案工具", "duplicate file cleaner", "Google Drive duplicate file cleaner"],
  manifest: "/site.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" }, { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "DUPESPACE｜把重複檔案掃乾淨",
    description: "Windows 與 Google Drive 的安全重複檔案清理器。",
    type: "website",
    locale: "zh_TW",
    url: "https://dupespace.app",
    siteName: "DUPESPACE",
    images: [{ url: "/og.png", width: 1732, height: 909, alt: "DUPESPACE 重複檔案清理工具" }],
  },
  twitter: { card: "summary_large_image", title: "DUPESPACE｜重複檔案清理工具", description: "安全整理 Windows 與 Google Drive 重複檔案。", images: ["/og.png"] },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "DUPESPACE" },
  other: { "msapplication-TileColor": "#082b40", "msapplication-TileImage": "/mstile-150x150.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        <meta name="theme-color" content="#082b40" />
        <meta name="google-adsense-account" content="ca-pub-7998471640181666" />
      </head>
      <body>{children}</body>
    </html>
  );
}
