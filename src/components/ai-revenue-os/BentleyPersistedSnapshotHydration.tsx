"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  bentleySnapshotPatchFromPersistedDashboardForm,
  REVENUE_OS_BENTLEY_APPLIED_FORM_KEY,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import {
  findSessionValueByKeyPrefix,
  readBentleySessionWithLegacyFallback,
} from "@/lib/revenue-os/bentley-storage-scope";
import { isRevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import { readCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { useAiRevenueOsBentleyActions } from "./AiRevenueOsSharedState";

/**
 * Restores guided intake / Bentley snapshot from canonical storage (and on `/ai-revenue-os` from
 * `bentley-applied-form`) so navigation does not reset chat to the opening industry question.
 *
 * On `/revenue-os/dashboard`, only the **canonical** snapshot is applied here — the dashboard form
 * remains owned by `BentleyDashboardBridge`; shared chat state still needs the canonical merge so
 * Bentley does not restart intake when the dashboard mounts a fresh `AiRevenueOsSharedStateProvider`.
 */
export function BentleyPersistedSnapshotHydration() {
  const pathname = usePathname();
  const { applyBentleyPatch } = useAiRevenueOsBentleyActions();
  const didHydrateRef = useRef(false);

  /** Layout phase so snapshot (pipeline / launchPrefill) is merged before child `useEffect` (e.g. launch prefill). */
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const onDashboard = pathname?.includes("/revenue-os/dashboard") ?? false;
    const onAiPage = pathname?.startsWith("/ai-revenue-os") ?? false;
    if (!onDashboard && !onAiPage) return;
    if (didHydrateRef.current) return;

    const canonical = readCanonicalBentleySnapshot();
    if (canonical) {
      const patch = JSON.parse(JSON.stringify(canonical)) as Partial<BentleySnapshot>;
      applyBentleyPatch(patch);
      bentleyContinuityLog("dashboard_hydrated", { source: "canonical_snapshot", path: pathname });
    }

    if (onDashboard) {
      didHydrateRef.current = true;
      return;
    }

    let raw = readBentleySessionWithLegacyFallback(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
    if (!raw) {
      const found = findSessionValueByKeyPrefix(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
      raw = found?.value ?? null;
    }
    if (!raw) {
      didHydrateRef.current = true;
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isRevenueOsDashboardFormValues(parsed)) return;
      const patch = bentleySnapshotPatchFromPersistedDashboardForm(parsed);
      applyBentleyPatch(patch);
      bentleyContinuityLog("dashboard_hydrated", { source: "bentley-applied-form", path: pathname, businessName: parsed.businessName });
    } catch {
      // ignore corrupt backup
    }
    didHydrateRef.current = true;
  }, [pathname, applyBentleyPatch]);

  return null;
}
