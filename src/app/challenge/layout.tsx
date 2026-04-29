import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "30-Day Business Challenge | Troo",
  description: "Build a real business in 30 days. #30DayChallenge #BusinessChallenge #EntrepreneurChallenge #BuildABusiness",
  openGraph: {
    title: "30-Day Business Challenge | Troo",
    description: "Build a real business in 30 days. Join entrepreneurs building with AI agents, world offices, and platform tools.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "30-Day Business Challenge | Troo",
    description: "Build a real business in 30 days. #30DayChallenge #BusinessChallenge #EntrepreneurChallenge #BuildABusiness",
  },
};

export default function ChallengeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
