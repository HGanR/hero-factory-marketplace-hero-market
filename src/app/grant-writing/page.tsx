import type { Metadata } from "next";
import { GrantWritingLanding } from "@/components/marketing/GrantWritingLanding";

export const metadata: Metadata = {
  title: "Grant Writing Services — Proposals for Foundations, Charities & Nonprofits | Hero Market",
  description:
    "Organized grant proposals that funders take seriously. For foundations, charities, nonprofits, and mission-driven businesses — strategy, narrative alignment, compliance support, and submission-ready packaging.",
  openGraph: {
    title: "Grant Writing — Win funding with organized proposals",
    description: "Turn vision into fundable proposals. Built for boards, EDs, and representatives chasing grants.",
  },
};

export default function GrantWritingPage() {
  return <GrantWritingLanding />;
}
