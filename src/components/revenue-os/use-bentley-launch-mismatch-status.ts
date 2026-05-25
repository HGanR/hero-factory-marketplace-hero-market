"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { detectBentleyLaunchMismatches } from "@/lib/revenue-os/bentley-launch-mismatch";
import { bentleyLaunchMismatchLines, type BentleyLaunchMismatchLine } from "@/lib/revenue-os/bentley-launch-mismatch-copy";
import { BENTLEY_PIPELINE_PROGRESS_EVENT } from "@/lib/revenue-os/bentley-pipeline-progress";
import type { BentleyOperationalBlockerRow } from "@/lib/revenue-os/bentley-autonomy-readiness";
import { getBentleyStorageScope } from "@/lib/revenue-os/bentley-storage-scope";
import {
  loadWorkflowState,
  subscribeBentleyWorkflowCrossTab,
  defaultWorkflowState,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

/** Dedupes continuity logs when multiple components mount the same hook (dashboard + obs panel). */
let lastContinuityMismatchKey = "";

async function fetchCampaignPostCount(campaignId: string): Promise<number | undefined> {
  try {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
      credentials: "include",
    });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { posts?: unknown[] };
    return Array.isArray(j.posts) ? j.posts.length : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Loads workflow state, optionally fetches `GET /api/campaigns/:id` for post counts when
 * `bentleyDbCampaignId` is set, and runs `detectBentleyLaunchMismatches`.
 */
export function useBentleyLaunchMismatchStatus(): {
  issues: string[];
  lines: BentleyLaunchMismatchLine[];
  loadingPosts: boolean;
  workflow: BentleyWorkflowState;
  operationalBlockers: BentleyOperationalBlockerRow[];
  loadingOperational: boolean;
  /** Re-runs autonomy-readiness fetch (e.g. after operator fixes OAuth or capped refresh). */
  refreshOperationalBlockers: () => void;
} {
  const [wf, setWf] = useState<BentleyWorkflowState>(defaultWorkflowState);
  const [postCount, setPostCount] = useState<number | undefined>(undefined);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [operationalBlockers, setOperationalBlockers] = useState<BentleyOperationalBlockerRow[]>([]);
  const [loadingOperational, setLoadingOperational] = useState(false);
  const [operationalRefreshTick, setOperationalRefreshTick] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);

  const refreshWf = useCallback(() => {
    setWf(loadWorkflowState());
  }, []);

  useLayoutEffect(() => {
    refreshWf();
    setSessionReady(true);
  }, [refreshWf]);

  const refreshOperationalBlockers = useCallback(() => {
    setOperationalRefreshTick((t) => t + 1);
  }, []);

  useEffect(() => {
    refreshWf();
    const on = () => refreshWf();
    window.addEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, on);
    window.addEventListener("bentley-workflow-updated", on);
    const onVis = () => {
      if (document.visibilityState === "visible") refreshWf();
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeBentleyWorkflowCrossTab(refreshWf);
    return () => {
      window.removeEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, on);
      window.removeEventListener("bentley-workflow-updated", on);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [refreshWf]);

  useEffect(() => {
    const onRefresh = () => refreshOperationalBlockers();
    window.addEventListener("bentley-operational-readiness-refresh", onRefresh);
    return () => window.removeEventListener("bentley-operational-readiness-refresh", onRefresh);
  }, [refreshOperationalBlockers]);

  const cid = sessionReady ? coerceTrimmedString(wf.artifacts.bentleyDbCampaignId) || undefined : undefined;

  useEffect(() => {
    if (!cid) {
      setPostCount(undefined);
      setLoadingPosts(false);
      return;
    }
    let cancelled = false;
    setLoadingPosts(true);
    void (async () => {
      const n = await fetchCampaignPostCount(cid);
      if (!cancelled) {
        setPostCount(n);
        setLoadingPosts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, wf.updatedAt]);

  useEffect(() => {
    const clientId = coerceTrimmedString(getBentleyStorageScope()?.clientId) || "";
    if (!cid || !clientId) {
      setOperationalBlockers([]);
      setLoadingOperational(false);
      return;
    }
    let cancelled = false;
    setLoadingOperational(true);
    void (async () => {
      try {
        const res = await fetch("/api/revenue-os/bentley/autonomy-readiness", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ clientId, workflow: loadWorkflowState() }),
        });
        const j = (await res.json()) as { report?: { operationalBlockers?: BentleyOperationalBlockerRow[] } };
        if (!cancelled) {
          setOperationalBlockers(j.report?.operationalBlockers ?? []);
        }
      } catch {
        if (!cancelled) setOperationalBlockers([]);
      } finally {
        if (!cancelled) setLoadingOperational(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cid, wf.updatedAt, operationalRefreshTick]);

  const issues = useMemo(
    () => detectBentleyLaunchMismatches(wf, { campaignPostCount: postCount }),
    [wf, postCount]
  );

  const lines = useMemo(() => bentleyLaunchMismatchLines(issues), [issues]);

  useEffect(() => {
    if (issues.length === 0) {
      lastContinuityMismatchKey = "";
      return;
    }
    const key = [...issues].sort().join("\u0001");
    if (key === lastContinuityMismatchKey) return;
    lastContinuityMismatchKey = key;
    bentleyContinuityLog("bentley_launch_mismatch", { issues, campaignId: cid ?? null });
  }, [issues, cid]);

  return {
    issues,
    lines,
    loadingPosts,
    workflow: wf,
    operationalBlockers,
    loadingOperational,
    refreshOperationalBlockers,
  };
}
