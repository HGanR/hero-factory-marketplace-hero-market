"use client";

import { BentleyPipelineAmbientStatusForAiRevenueOsPage } from "@/components/ai-revenue-os/BentleyPipelineAmbientStatus";
import { BentleyRevenueOsChat } from "@/components/ai-revenue-os/BentleyRevenueOsChat";
import { BentleyRunObservabilityDebugPanel } from "@/components/revenue-os/BentleyRunObservabilityDebugPanel";

export function AiRevenueOsFooterWidgets() {
  return (
    <>
      <BentleyPipelineAmbientStatusForAiRevenueOsPage />
      <BentleyRevenueOsChat />
      <BentleyRunObservabilityDebugPanel />
    </>
  );
}
