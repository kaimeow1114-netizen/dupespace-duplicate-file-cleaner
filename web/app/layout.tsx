import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dupespace.app"),
  title: { default: "DUPESPACE｜開源的 Google Drive 與 Windows 重複檔案清理工具", template: "%s｜DUPESPACE" },
  description: "免費搜尋、檢查並安全清理 Windows 與 Google Drive 重複檔案及鏡像資料夾。內容級精確比對，預設移至垃圾桶，不下載原始檔案，小縮圖按需轉送、不保存。",
  alternates: {
    canonical: "https://dupespace.app/",
    languages: {
      "zh-TW": "https://dupespace.app/",
      en: "https://dupespace.app/en",
      "x-default": "https://dupespace.app/",
    },
  },
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
    description: "找出並安全清理 Windows 與 Google Drive 重複檔案及鏡像資料夾。預設移至垃圾桶，不下載原始檔案，小縮圖按需轉送、不保存。",
    type: "website",
    locale: "zh_TW",
    url: "https://dupespace.app/",
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
    <html lang="zh-TW">
      <head>
        <meta name="theme-color" content="#082b40" />
        <meta name="google-adsense-account" content="ca-pub-7998471640181666" />
      </head>
      <body>{children}</body>
    </html>
  );
}
