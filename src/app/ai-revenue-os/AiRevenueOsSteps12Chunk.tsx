"use client";

import { AiRevenueOsCollapsibleStep } from "@/components/ai-revenue-os/AiRevenueOsCollapsibleStep";
import { BentleyWorkflowProgress } from "@/components/ai-revenue-os/BentleyWorkflowProgress";
import { BentleyContentHandoffIntakePanel } from "@/components/ai-revenue-os/BentleyContentHandoffIntakePanel";
import { EngagementCapturePanel } from "@/components/ai-revenue-os/EngagementCapturePanel";
import { TrackedLeadsPanel } from "@/components/ai-revenue-os/TrackedLeadsPanel";
import { ConversionOutcomesPanel } from "@/components/ai-revenue-os/ConversionOutcomesPanel";
import { IntelligenceAccelerationPanel } from "@/components/ai-revenue-os/IntelligenceAccelerationPanel";

export function AiRevenueOsSteps12Chunk() {
  return (
    <>
      <AiRevenueOsCollapsibleStep
        step={1}
        id="workflow-handoff"
        defaultOpen
        title="Workflow & Bentley handoff"
        subtitle="Progress, intake, and scope sync — start here."
      >
        <div className="max-w-4xl space-y-8">
          <BentleyWorkflowProgress />
          <BentleyContentHandoffIntakePanel />
        </div>
      </AiRevenueOsCollapsibleStep>

      <AiRevenueOsCollapsibleStep
        step={2}
        id="execution-leads"
        title="Execution & lead loop"
        subtitle="Capture engagement, classify, and track leads (manual deployment)."
      >
        <div className="max-w-4xl space-y-8">
          <p className="text-gray-400 text-sm max-w-2xl">
            Capture post responses, re-run Bentley classification, and track lightweight lead status. No automated
            posting — operators copy from Content Engine and mark deployments when published.
          </p>
          <EngagementCapturePanel />
          <IntelligenceAccelerationPanel />
          <ConversionOutcomesPanel />
          <TrackedLeadsPanel />
        </div>
      </AiRevenueOsCollapsibleStep>
    </>
  );
}
