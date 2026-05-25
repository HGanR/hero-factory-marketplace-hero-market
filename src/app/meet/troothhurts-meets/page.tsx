import type { Metadata } from "next";
import { TroothhurtsMeetsLanding } from "@/components/marketing/TroothhurtsMeetsLanding";

export const metadata: Metadata = {
  title: "TroothHurts Meets™ — Private meetings, multi-platform broadcast, NFT-gated access",
  description:
    "Host private meetings, broadcast live to TikTok, Instagram, Facebook, Twitch, and RTMP, and protect access with NFT/token gating. Premium Web3-ready meeting and studio platform.",
  openGraph: {
    title: "TroothHurts Meets™",
    description: "Host. Broadcast. Gate. Monetize — in one system.",
  },
};

export default function TroothhurtsMeetsPage() {
  return <TroothhurtsMeetsLanding />;
}
