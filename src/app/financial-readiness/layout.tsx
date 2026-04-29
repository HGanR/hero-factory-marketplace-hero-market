import type { Metadata } from "next";
import { FinancialReadinessLayoutClient } from "@/components/financial-readiness/FinancialReadinessLayoutClient";

export const metadata: Metadata = {
  title: "Financial Readiness Center",
  description:
    "Credit foundation, credit optimization, and debt resolution — modular workflows with AI-assisted guidance.",
};

export default function FinancialReadinessLayout({ children }: { children: React.ReactNode }) {
  return <FinancialReadinessLayoutClient>{children}</FinancialReadinessLayoutClient>;
}
