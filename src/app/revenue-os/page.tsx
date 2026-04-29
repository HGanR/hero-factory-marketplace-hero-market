import type { Metadata } from "next";
import RevenueOSLandingPage from "@/components/revenue-os/RevenueOSLandingPage";

export const metadata: Metadata = {
  title: "Revenue OS — Campaign Governance",
  description:
    "Structured campaign approvals, role enforcement, audit trails, SLA visibility, and compliance reporting. Operational governance for agencies and growth teams.",
};

export default function RevenueOsMarketingPage() {
  return <RevenueOSLandingPage />;
}
