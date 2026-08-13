import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();
  return {
    metadataBase: base,
    title: { default: "DupeSweep｜重複檔案清理工具", template: "%s｜DupeSweep" },
    description: "免費清理 Windows 與 Google Drive 重複檔案，量化節省空間並保留可復原垃圾桶。",
    icons: { icon: "/dupesweep-icon.png", shortcut: "/dupesweep-icon.png" },
    openGraph: {
      title: "DupeSweep｜把重複檔案掃乾淨",
      description: "Windows 與 Google Drive 的安全重複檔案清理器。",
      type: "website",
      images: [{ url: image, width: 1732, height: 909, alt: "DupeSweep 重複檔案清理工具" }],
    },
    twitter: { card: "summary_large_image", images: [image] },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <head>
        <meta name="google-adsense-account" content="ca-pub-7998471640181666" />
        <script
          async
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7998471640181666"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
