import type { Metadata } from "next";
import { AiAgentServicesLanding } from "@/components/marketing/AiAgentServicesLanding";

export const metadata: Metadata = {
  title: "AI Agent Services — Custom AI assistants for small business | Hero Market",
  description:
    "Custom AI agents with website, admin panel, analytics, lead capture, conversation filtering, optional Telegram, and business-specific training. Close more sales and reclaim your time.",
  openGraph: {
    title: "AI Agent Services — Virtual assistant that works",
    description: "Website + AI agent + admin + analytics. Built for entrepreneurs and startups.",
  },
};

export default function AiAgentServicesPage() {
  return <AiAgentServicesLanding />;
}
