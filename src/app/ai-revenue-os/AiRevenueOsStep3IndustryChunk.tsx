"use client";

import dynamic from "next/dynamic";
import { AiRevenueOsCollapsibleStep } from "@/components/ai-revenue-os/AiRevenueOsCollapsibleStep";

const IndustryIntelligenceSectionLazy = dynamic(
  () =>
    import("@/components/ai-revenue-os/IndustryIntelligenceSection").then(
      (m) => m.IndustryIntelligenceSection
    ),
  {
    ssr: false,
    loading: () => <p className="text-slate-500 text-sm py-4">Loading industry tools…</p>,
  }
);

export function AiRevenueOsStep3IndustryChunk() {
  return (
    <AiRevenueOsCollapsibleStep
      step={3}
      id="industry-intelligence"
      dataBentleySection="industry-intelligence"
      openOnHashIds={[
        "step-questionnaire",
        "revenue-equation-engine",
        "step-variables",
        "step-benchmarks",
        "step-analysis",
        "step-industry",
      ]}
      title="Industry intelligence & revenue equation"
      subtitle="Questionnaire, benchmarks, and simulation — manual path when not using Bentley."
    >
      <IndustryIntelligenceSectionLazy anchorOnParent />
    </AiRevenueOsCollapsibleStep>
  );
}
