"use client";

import { useEffect, useRef } from "react";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import { bentleySnapshotPatchFromPersistedDashboardForm } from "@/lib/revenue-os/bentley-dashboard-handoff";
import { useAiRevenueOsBentleyActions } from "./AiRevenueOsSharedState";

const DEBOUNCE_MS = 250;

/**
 * Keeps `AiRevenueOsSharedState` aligned with the Revenue OS dashboard form so Bentley chat / workflow
 * reflect the same numbers and narrative after “Open Dashboard” or manual edits.
 *
 * Source of truth for this sync is **dashboard `form` state** only. Bentley chat patches that are not
 * reflected in `form` are preserved until the user edits the form again (then form-derived snapshot wins).
 *
 * Debounce batches rapid edits; downstream logic should not assume a fixed delay beyond `DEBOUNCE_MS`.
 * Use `onBentleySnapshotAppliedFromForm` when you need to run work **after** a form-derived snapshot
 * patch actually landed (e.g. `reconcileBentleySnapshotFromWorkflow`).
 */
export function BentleyDashboardSharedStateSync({
  form,
  onBentleySnapshotAppliedFromForm,
}: {
  form: RevenueOsDashboardFormValues;
  /** Invoked once per applied patch when the derived snapshot signature changed (after debounce). */
  onBentleySnapshotAppliedFromForm?: () => void;
}) {
  const { applyBentleyPatch } = useAiRevenueOsBentleyActions();
  const formJson = JSON.stringify(form);
  const applyRef = useRef(applyBentleyPatch);
  /** Avoid redundant `applyBentleyPatch` when `formJson` stabilizes to the same derived snapshot. */
  const lastAppliedFormSnapshotSig = useRef<string>("");

  useEffect(() => {
    applyRef.current = applyBentleyPatch;
  }, [applyBentleyPatch]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const parsed = JSON.parse(formJson) as RevenueOsDashboardFormValues;
        const next = bentleySnapshotPatchFromPersistedDashboardForm(parsed);
        const sig = JSON.stringify(next);
        if (sig === lastAppliedFormSnapshotSig.current) return;
        lastAppliedFormSnapshotSig.current = sig;
        applyRef.current(next);
        onBentleySnapshotAppliedFromForm?.();
      } catch {
        // ignore malformed snapshot
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [formJson, onBentleySnapshotAppliedFromForm]);

  return null;
}
