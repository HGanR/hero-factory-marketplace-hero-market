import type { Metadata } from "next";

const title = "NFT Marketplace | HERO MARKET";
const description =
  "Explore the HERO MARKET NFT Marketplace, digital collectibles, and 3D world assets.";
const socialImage = "/nft-marketplace/hero-market-banner-first-slide.png";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/nft-marketplace",
  },
  openGraph: {
    type: "website",
    url: "https://troothhurtz.app/nft-marketplace",
    siteName: "TroothHurtz",
    title,
    description,
    images: [{ url: socialImage, alt: "HERO MARKET NFT Marketplace banner" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
};

export default function NftMarketplaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
