"use client";

import { useEffect, useRef } from "react";
import { useAiRevenueOsBentleyActions } from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY } from "@/lib/revenue-os/bentley-dashboard-handoff";
import { resumeDashboardPipelineWithLifecycle } from "@/lib/revenue-os/bentley-pipeline-resume";
import {
  readBentleySessionWithLegacyFallback,
  removeBentleySessionScopedAndLegacy,
} from "@/lib/revenue-os/bentley-storage-scope";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

type Props = {
  hydratedFromBentley: boolean;
  userId: string;
  clientId: string;
  trustId: string;
  onFinished: (ok: boolean, reason?: string) => void;
};

/**
 * After Bentley handoff with `autoRunMode: "full_pipeline"`, Bridge sets a session flag;
 * this effect runs `resumeDashboardPipelineWithLifecycle` once shared Bentley state matches the merged dashboard form.
 */
export function BentleyDashboardPipelineAutorun({
  hydratedFromBentley,
  userId,
  clientId,
  trustId,
  onFinished,
}: Props) {
  const { getBentleySnapshot, applyBentleyPatch } = useAiRevenueOsBentleyActions();
  const startedRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (typeof window === "undefined" || !hydratedFromBentley) return;
    if (readBentleySessionWithLegacyFallback(REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY) !== "1") return;
    if (startedRef.current) return;
    startedRef.current = true;
    removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY);

    void (async () => {
      bentleyContinuityLog("dashboard_pipeline_autorun_started", { userId });
      const result = await resumeDashboardPipelineWithLifecycle({
        getSnapshot: getBentleySnapshot,
        applyPatch: applyBentleyPatch,
        userId,
        clientId: coerceTrimmedString(clientId) || undefined,
        trustId: coerceTrimmedString(trustId) || undefined,
      });
      bentleyContinuityLog("dashboard_pipeline_autorun_finished", {
        ok: result.ok,
        status: result.ok ? "complete" : "failed",
      });
      onFinishedRef.current(result.ok, result.reason);
    })();
  }, [hydratedFromBentley, userId, clientId, trustId, getBentleySnapshot, applyBentleyPatch]);

  return null;
}
