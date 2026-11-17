import type { Metadata } from "next";

const title = "Create a DIGITAL TRUST the SMART TRUST™ | TROOTHHURTZ";
const description =
  "Explore TROOTHHURTZ Digital Trust Infrastructure: private trust records, digital assets and cryptographic evidence.";
// This file must be uploaded as a real public asset before publishing the preview.
const socialImage = "/digital-trust/smart-trust-social-banner.jpg";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/trust-records/digital-trust" },
  openGraph: {
    type: "website",
    url: "https://troothhurtz.app/trust-records/digital-trust",
    siteName: "TroothHurtz",
    title,
    description,
    images: [{ url: socialImage, width: 1200, height: 630, alt: "Create a DIGITAL TRUST the SMART TRUST™ — black and gold shield banner" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
};

export default function DigitalTrustLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
