"use client";

import { ClientReadinessQuestionnaire } from "@/components/ai-revenue-os/ClientReadinessQuestionnaire";
import { RevenueSimulationBlock } from "@/components/ai-revenue-os/RevenueSimulationBlock";
import { BenchmarkComparisonPanel } from "@/components/revenue-os/BenchmarkComparisonPanel";
import { useAiRevenueOsProfile, useAiRevenueOsRevenueInputs } from "@/components/ai-revenue-os/AiRevenueOsSharedState";

export type IndustryIntelligenceSectionProps = {
  /** Reserved for scroll/anchor sync with parent accordion */
  anchorOnParent?: boolean;
};

export function IndustryIntelligenceSection({ anchorOnParent: _anchorOnParent }: IndustryIntelligenceSectionProps) {
  const { effectiveIndustryLabel, questionnaireAnswers, setQuestionnaireAnswers } = useAiRevenueOsProfile();
  const { traffic, setTraffic, conversionRate, setConversionRate, aov, setAov } = useAiRevenueOsRevenueInputs();

  const industry = effectiveIndustryLabel.trim() || "General";
  const yourCac = 0;

  return (
    <div className="space-y-10">
      <section id="step-questionnaire" className="scroll-mt-24">
        <ClientReadinessQuestionnaire answers={questionnaireAnswers} onChange={setQuestionnaireAnswers} />
      </section>

      <section id="revenue-equation-engine" className="scroll-mt-24">
        <RevenueSimulationBlock
          traffic={traffic}
          setTraffic={setTraffic}
          conversion={conversionRate}
          setConversion={setConversionRate}
          aov={aov}
          setAov={setAov}
          industry={industry}
          industryLabel={industry}
          questionnaireAnswers={questionnaireAnswers}
        />
      </section>

      <section id="step-benchmarks" className="scroll-mt-24">
        <BenchmarkComparisonPanel industry={industry} yourConversionPct={conversionRate} yourCac={yourCac} />
      </section>
    </div>
  );
}
