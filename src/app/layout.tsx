// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://troothhurtz.app"),
  title: {
    default: "TroothHurtz",
    template: "%s | TroothHurtz",
  },
  description: "TroothHurtz platform",
  icons: {
    // NOTE: `public/favicon.ico` in this repo is actually PNG data.
    // Many browsers ignore a PNG served as `image/x-icon`, so we explicitly serve a PNG favicon.
    icon: [{ url: "/favicon.png", type: "image/png", sizes: "any" }],
    shortcut: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/favicon.png" }],
  },
  openGraph: {
    type: "website",
    url: "https://troothhurtz.app",
    siteName: "TroothHurtz",
    title: "TroothHurtz",
    description: "TroothHurtz platform",
    images: [
      {
        url: "/SOCIAL1.jpg",
        // Match the actual image dimensions to avoid scraper issues.
        width: 1280,
        height: 853,
        alt: "TroothHurtz",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "TroothHurtz",
    description: "TroothHurtz platform",
    images: ["/SOCIAL1.jpg"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
