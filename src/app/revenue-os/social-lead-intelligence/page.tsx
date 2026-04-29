import { BentleySocialLeadIntelligenceClient } from "@/components/bentley-social-leads/BentleySocialLeadIntelligenceClient";

export const metadata = {
  title: "Bentley Social Lead Intelligence · Revenue OS",
  description:
    "Batch social lead intelligence from public surfaces only — manual follow-up guidance, no automated outreach.",
};

export default function SocialLeadIntelligencePage() {
  return <BentleySocialLeadIntelligenceClient />;
}
