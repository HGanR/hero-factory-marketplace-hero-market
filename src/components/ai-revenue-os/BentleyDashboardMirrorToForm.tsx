"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import { dashboardFormPatchFromBentleySnapshotIfDiff } from "@/lib/revenue-os/bentley-dashboard-handoff";
import { useAiRevenueOsBentleyActions, useAiRevenueOsSnapshotSignature } from "./AiRevenueOsSharedState";

type Props = {
  formRef: RefObject<RevenueOsDashboardFormValues | null>;
  /** Applies snapshot→form diff without marking the dashboard as user-edited (does not block Bentley handoff hydration). */
  applySyncPatch: (patch: Partial<RevenueOsDashboardFormValues>) => void;
};

/**
 * When Bentley chat (or any code path) updates the shared Bentley snapshot without going through
 * dashboard `form`, push those overlapping fields into `form` so the dashboard stays canonical and
 * BentleyDashboardSharedStateSync does not later overwrite chat edits.
 *
 * Runs only when `snapshotSignature` changes (not on every keystroke). Uses diff-only patches to avoid loops.
 */
export function BentleyDashboardMirrorToForm({ formRef, applySyncPatch }: Props) {
  const snapshotSig = useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const getSnapRef = useRef(getBentleySnapshot);
  getSnapRef.current = getBentleySnapshot;
  const applyRef = useRef(applySyncPatch);
  applyRef.current = applySyncPatch;

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const snap = getSnapRef.current();
    const patch = dashboardFormPatchFromBentleySnapshotIfDiff(snap, form);
    if (Object.keys(patch).length === 0) return;
    applyRef.current(patch);
  }, [snapshotSig]);

  return null;
}
