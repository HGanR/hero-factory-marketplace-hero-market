"use client";

import type { ReactNode } from "react";
import { AIAdvisorPanel } from "./AIAdvisorPanel";
import { ProgressTracker } from "./ProgressTracker";
import { SystemHeader } from "./SystemHeader";
import { WorkflowSidebar } from "./WorkflowSidebar";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import type { AdvisorModule } from "./mockAi";

type Step = { id: string; label: string };

type Props = {
  systemName: string;
  tagline: string;
  steps: Step[];
  stepIndex: number;
  onStep: (index: number) => void;
  sidebarTitle: string;
  advisorModule: Exclude<AdvisorModule, "hub">;
  panel: ReactNode;
  headerActions?: ReactNode;
};

export function FinancialReadinessWorkSurface({
  systemName,
  tagline,
  steps,
  stepIndex,
  onStep,
  sidebarTitle,
  advisorModule,
  panel,
  headerActions,
}: Props) {
  const { state } = useFinancialReadiness();
  const stepLabel = steps[stepIndex]?.label ?? "";

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <SystemHeader systemName={systemName} tagline={tagline} actions={headerActions} />
      <ProgressTracker steps={steps} currentIndex={stepIndex} />
      <div className="grid lg:grid-cols-[minmax(220px,280px)_1fr] gap-6 items-start">
        <WorkflowSidebar
          title={sidebarTitle}
          steps={steps}
          currentIndex={stepIndex}
          onSelect={onStep}
        />
        <div className="grid xl:grid-cols-[1fr_minmax(260px,320px)] gap-6 items-start">
          {panel}
          <AIAdvisorPanel
            context={{ module: advisorModule, stepLabel, state }}
          />
        </div>
      </div>
    </div>
  );
}
