"use client";

import { AiRevenueOsCollapsibleStep } from "@/components/ai-revenue-os/AiRevenueOsCollapsibleStep";
import { AiRevenueOsPipeline } from "@/components/ai-revenue-os/AiRevenueOsPipeline";
import { AiRevenueOsAboutThisPage } from "@/components/ai-revenue-os/AiRevenueOsAboutThisPage";
import { BentleyDeploymentReadinessPanel } from "@/components/revenue-os/BentleyDeploymentReadinessPanel";
import { BentleyDeploymentFeedbackPanel } from "@/components/revenue-os/BentleyDeploymentFeedbackPanel";
import { BentleyOptimizationMemoryPanel } from "@/components/revenue-os/BentleyOptimizationMemoryPanel";
import { BentleyPlatformRoleRoutingPanel } from "@/components/revenue-os/BentleyPlatformRoleRoutingPanel";
import { BentleyContentBatchRoutingPanel } from "@/components/revenue-os/BentleyContentBatchRoutingPanel";
import { BentleyBatchCalendarSequencingPanel } from "@/components/revenue-os/BentleyBatchCalendarSequencingPanel";
import { BentleySequenceSchedulePanel } from "@/components/revenue-os/BentleySequenceSchedulePanel";
import { BentleyPublishWorkflowReviewPanel } from "@/components/revenue-os/BentleyPublishWorkflowReviewPanel";
import { BentleyApprovalWorkerAnalyticsPanel } from "@/components/revenue-os/BentleyApprovalWorkerAnalyticsPanel";

export function AiRevenueOsSteps45Chunk() {
  return (
    <>
      <AiRevenueOsCollapsibleStep
        step={4}
        id="content-pipeline"
        dataBentleySection="content-engine"
        openOnHashIds={[
          "content-engine",
          "research-assistant",
          "trends-library",
          "campaign-from-notes",
          "campaign-media-brief",
          "consultant-plan",
          "launch-variant-optimization",
          "launch-distribution-volume",
          "launch-past-generations",
          "bentley-deployment-readiness",
          "bentley-deployment-feedback",
          "bentley-optimization-memory",
          "bentley-platform-role-routing",
          "bentley-content-batch-routing",
          "bentley-batch-calendar-sequencing",
          "bentley-sequence-schedule",
          "bentley-publish-workflow-review",
          "bentley-approval-worker-analytics",
        ]}
        title="Research → trends → Content Engine™ → campaign"
        subtitle="Full pipeline: enrich, generate, optimize volume, launch from notes."
      >
        <AiRevenueOsPipeline omitContentEngineBentleyMarker />
        <div className="mt-8 pt-6 border-t border-slate-800/80 space-y-6">
          <BentleyDeploymentReadinessPanel />
          <BentleyDeploymentFeedbackPanel />
          <BentleyOptimizationMemoryPanel />
          <BentleyPlatformRoleRoutingPanel />
          <BentleyContentBatchRoutingPanel />
          <BentleyBatchCalendarSequencingPanel />
          <BentleySequenceSchedulePanel />
          <BentleyPublishWorkflowReviewPanel />
          <BentleyApprovalWorkerAnalyticsPanel />
        </div>
      </AiRevenueOsCollapsibleStep>

      <AiRevenueOsCollapsibleStep
        step={5}
        id="about-this-page"
        openOnHashIds={[
          "economic-systems",
          "how-it-works",
          "data-governed",
          "roadmap-phases",
          "phase-i",
          "phase-ii",
          "phase-iii",
          "phase-iv",
          "transformation",
          "problem",
          "architecture",
          "protocol",
          "math",
          "who",
          "access",
        ]}
        title="About this page"
        subtitle="Reference material: economics, positioning, roadmap, protocol, and architecture — expand when you need context beyond the pipeline."
      >
        <AiRevenueOsAboutThisPage />
      </AiRevenueOsCollapsibleStep>
    </>
  );
}
