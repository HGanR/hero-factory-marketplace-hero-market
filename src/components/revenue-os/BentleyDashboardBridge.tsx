"use client";

import { useEffect, useRef } from "react";
import {
  BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY,
  clearDashboardUserTouchedForIncomingBentleyHandoff,
  enrichDashboardFormNotesFromWorkflow,
  hasMinimumFieldsForFullAnalysis,
  hydrateBentleySnapshotFromHandoffPayload,
  parseBentleyDashboardPayload,
  payloadToDashboardFormState,
  resolveBentleyDashboardAutoRunMode,
  REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY,
  REVENUE_OS_BENTLEY_APPLIED_FORM_KEY,
  REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY,
  REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY,
  REVENUE_OS_BENTLEY_PREPARED_BADGE_KEY,
  REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY,
} from "@/lib/revenue-os/bentley-dashboard-handoff";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import {
  findSessionValueByKeyPrefix,
  readBentleySessionWithLegacyFallback,
  removeAllSessionKeysForLogicalBase,
  removeBentleySessionScopedAndLegacy,
  writeBentleySession,
} from "@/lib/revenue-os/bentley-storage-scope";
import {
  coerceRevenueOsDashboardFormFromStorage,
  isRevenueOsDashboardFormValues,
  normalizeDashboardFormValues,
  type RevenueOsDashboardFormValues,
} from "@/lib/revenue-os/run-revenue-os-analysis";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

type Props = {
  setForm: React.Dispatch<React.SetStateAction<RevenueOsDashboardFormValues>>;
  /**
   * Current dashboard form (merge baseline). Required so we can persist the merged handoff to session
   * **before** clearing the handoff key — React Strict Mode can drop a `setForm` functional update after
   * unmount, which previously deleted the handoff without leaving `bentley-applied-form` backup.
   */
  getDashboardFormForMerge: () => RevenueOsDashboardFormValues;
  onHydratedFromBentley: (hydrated: boolean) => void;
  /** Fired synchronously when Bentley scheduled a one-time autorun (before the queued run or pipeline). */
  onBentleyAutorunScheduled?: (detail: { mode: "analysis" | "pipeline" }) => void;
  /** Run analysis with an explicit form snapshot (post-handoff merge) */
  runAnalysisWithForm: (form: RevenueOsDashboardFormValues) => Promise<void>;
};

/**
 * One-shot handoff consume, plus session-only restore of the last Bentley merge after refresh.
 * Autorun only fires when a fresh handoff requests it (not on restore-from-backup).
 */
export function BentleyDashboardBridge({
  setForm,
  getDashboardFormForMerge,
  onHydratedFromBentley,
  onBentleyAutorunScheduled,
  runAnalysisWithForm,
}: Props) {
  const autoRunConsumedRef = useRef(false);
  const runRef = useRef(runAnalysisWithForm);
  runRef.current = runAnalysisWithForm;
  const setFormRef = useRef(setForm);
  setFormRef.current = setForm;
  const getBaselineRef = useRef(getDashboardFormForMerge);
  getBaselineRef.current = getDashboardFormForMerge;
  const onHydratedRef = useRef(onHydratedFromBentley);
  onHydratedRef.current = onHydratedFromBentley;
  const onAutorunRef = useRef(onBentleyAutorunScheduled);
  onAutorunRef.current = onBentleyAutorunScheduled;

  useEffect(() => {
    if (typeof window === "undefined") return;

    let rawHandoff = readBentleySessionWithLegacyFallback(BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY);
    if (!rawHandoff) {
      const found = findSessionValueByKeyPrefix(BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY);
      if (found?.value) {
        rawHandoff = found.value;
        bentleyContinuityLog("dashboard_hydrated", { handoff: "cross_scope_recover" });
      }
    }

    if (rawHandoff) {
      // Explicit chat → dashboard handoff must win over a stale "user edited form" flag from a prior visit.
      clearDashboardUserTouchedForIncomingBentleyHandoff();

      const env = parseBentleyDashboardPayload(rawHandoff);
      if (!env) {
        bentleyContinuityLog("dashboard_hydrated", { error: "handoff_parse_failed" });
        return;
      }

      const partial = payloadToDashboardFormState(env.payload);
      const baseline = getBaselineRef.current();
      const intelSnap = hydrateBentleySnapshotFromHandoffPayload(env.payload);
      const merged = normalizeDashboardFormValues({
        ...baseline,
        ...partial,
        notes: coerceTrimmedString(intelSnap.campaignNotes),
      });
      try {
        writeBentleySession(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY, JSON.stringify(merged));
      } catch {
        // ignore quota
      }
      removeAllSessionKeysForLogicalBase(BENTLEY_DASHBOARD_HANDOFF_STORAGE_KEY);

      setFormRef.current(merged);

      const autoRunMode = resolveBentleyDashboardAutoRunMode(env.payload);
      if (autoRunMode !== "off" && !autoRunConsumedRef.current) {
        const fullOk = hasMinimumFieldsForFullAnalysis(env.payload);
        if (fullOk.ok) {
          autoRunConsumedRef.current = true;
          if (autoRunMode === "full_pipeline") {
            try {
              writeBentleySession(REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY, "1");
            } catch {
              // ignore
            }
            bentleyContinuityLog("autorun_requested", {
              businessName: merged.businessName,
              mode: "full_pipeline",
            });
            onAutorunRef.current?.({ mode: "pipeline" });
          } else if (autoRunMode === "analysis_only") {
            try {
              writeBentleySession(REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY, "1");
            } catch {
              // ignore
            }
            bentleyContinuityLog("autorun_requested", { businessName: merged.businessName, mode: "analysis_only" });
            onAutorunRef.current?.({ mode: "analysis" });
            queueMicrotask(() => {
              void runRef.current(merged);
            });
          }
        } else {
          bentleyContinuityLog("autorun_requested", {
            skipped: "insufficient_handoff_for_full_analysis",
            businessName: merged.businessName,
            mode: autoRunMode,
          });
        }
      }

      writeBentleySession(REVENUE_OS_BENTLEY_PREPARED_BADGE_KEY, "1");
      onHydratedRef.current(true);
      bentleyContinuityLog("dashboard_hydrated", { source: "bentley_handoff", businessName: partial.businessName });
      return;
    }

    if (readBentleySessionWithLegacyFallback(REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY) === "1") {
      bentleyContinuityLog("dashboard_hydrated", { skipped: "user_touched_no_handoff" });
      return;
    }

    const rawApplied = readBentleySessionWithLegacyFallback(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
    if (!rawApplied) return;
    try {
      const parsed = JSON.parse(rawApplied) as unknown;
      const coerced = coerceRevenueOsDashboardFormFromStorage(parsed);
      if (!coerced) {
        if (!isRevenueOsDashboardFormValues(parsed)) {
          removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
          return;
        }
      }
      const formRestore = coerced ?? normalizeDashboardFormValues(parsed as RevenueOsDashboardFormValues);
      setFormRef.current((prev) =>
        enrichDashboardFormNotesFromWorkflow(normalizeDashboardFormValues({ ...prev, ...formRestore })),
      );
      onHydratedRef.current(true);
      bentleyContinuityLog("dashboard_hydrated", { source: "bentley-applied-form-restore", businessName: formRestore.businessName });
    } catch {
      removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
    }
    // Intentionally mount-once: avoid re-entrancy / Strict Mode double-consume when parent recreates callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export function markRevenueOsDashboardUserTouched(): void {
  if (typeof window === "undefined") return;
  writeBentleySession(REVENUE_OS_DASHBOARD_USER_TOUCHED_KEY, "1");
  removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
}

export function clearBentleyPreparedBadge(): void {
  if (typeof window === "undefined") return;
  removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_PREPARED_BADGE_KEY);
  removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_APPLIED_FORM_KEY);
  removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_ANALYSIS_SESSION_KEY);
  removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_AUTORUN_PENDING_KEY);
  removeBentleySessionScopedAndLegacy(REVENUE_OS_BENTLEY_AUTORUN_FULL_PIPELINE_KEY);
}

export function readBentleyPreparedBadge(): boolean {
  if (typeof window === "undefined") return false;
  return readBentleySessionWithLegacyFallback(REVENUE_OS_BENTLEY_PREPARED_BADGE_KEY) === "1";
}
