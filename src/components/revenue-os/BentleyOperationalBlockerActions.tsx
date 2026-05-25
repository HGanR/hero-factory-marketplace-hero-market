"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { BentleyOperationalBlockerRow } from "@/lib/revenue-os/bentley-autonomy-readiness";
import {
  BENTLEY_OPERATIONAL_MAX_RETRIES,
  bentleyBlockerActionLabel,
  mergeBentleyBlockerActions,
  operationalCodesFromRows,
  type BentleyBlockerActionId,
} from "@/lib/revenue-os/bentley-operational-blocker-resolution";
import {
  getBentleyOperationalRetryCount,
  retryBentleyLaunchSyncClient,
  retryBentleyLaunchSyncContent360PlatformClient,
  retryBentleyOperationalReadinessClient,
} from "@/lib/revenue-os/bentley-operational-retry-client";
import { getBentleyStorageScope } from "@/lib/revenue-os/bentley-storage-scope";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

const btnBase =
  "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btnBase} border-cyan-500/50 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50`;
const linkBase =
  `${btnBase} border-slate-500/45 bg-slate-900/50 text-slate-100 hover:border-cyan-500/40 hover:bg-slate-800/60`;

export function BentleyOperationalBlockerActions(props: {
  operationalBlockers: BentleyOperationalBlockerRow[];
  campaignId: string | undefined;
}) {
  const scope = typeof window !== "undefined" ? getBentleyStorageScope() : null;
  const clientId = coerceTrimmedString(scope?.clientId) || undefined;
  const codes = useMemo(
    () => operationalCodesFromRows(props.operationalBlockers),
    [props.operationalBlockers]
  );
  const merged = useMemo(
    () => mergeBentleyBlockerActions(codes, { clientId, campaignId: props.campaignId }),
    [codes, clientId, props.campaignId]
  );

  const cid = coerceTrimmedString(props.campaignId) || undefined;
  const [busy, setBusy] = useState<BentleyBlockerActionId | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [c360PlatformRetryAvailable, setC360PlatformRetryAvailable] = useState(false);
  const [c360PlatformBusy, setC360PlatformBusy] = useState(false);

  useEffect(() => {
    if (codes.length === 0) {
      setC360PlatformRetryAvailable(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/admin/content360/platform-status", { credentials: "include" });
        if (cancelled) return;
        if (!r.ok) {
          setC360PlatformRetryAvailable(false);
          return;
        }
        const j = (await r.json().catch(() => ({}))) as { canUseContent360PlatformSchedule?: boolean };
        setC360PlatformRetryAvailable(Boolean(j.canUseContent360PlatformSchedule));
      } catch {
        if (!cancelled) setC360PlatformRetryAvailable(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codes.length]);

  const anyBusy = busy !== null || c360PlatformBusy;

  if (codes.length === 0) return null;

  async function onRetryLaunchC360Platform() {
    if (!cid) {
      setNote("Set a campaign in workflow (launch from AI Revenue OS) before retrying sync.");
      return;
    }
    setC360PlatformBusy(true);
    setNote(null);
    try {
      const r = await retryBentleyLaunchSyncContent360PlatformClient(cid);
      setNote(r.ok ? (r.message ?? "Launch sync completed.") : r.message);
    } finally {
      setC360PlatformBusy(false);
    }
  }

  async function onRetryLaunch() {
    if (!cid) {
      setNote("Set a campaign in workflow (launch from AI Revenue OS) before retrying sync.");
      return;
    }
    setBusy("retry_launch_sync");
    setNote(null);
    try {
      const r = await retryBentleyLaunchSyncClient(cid);
      setNote(r.ok ? (r.message ?? "Launch sync completed.") : r.message);
    } finally {
      setBusy(null);
    }
  }

  function onRefreshReadiness() {
    if (!cid) {
      setNote("Campaign id missing from workflow artifacts.");
      return;
    }
    setBusy("refresh_operational_readiness");
    setNote(null);
    try {
      const r = retryBentleyOperationalReadinessClient(cid);
      setNote(r.ok ? (r.message ?? "Refreshing…") : r.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-slate-600/30 pt-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">Recommended actions</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Operational blocker actions">
        {merged.map((m) => {
          if (m.actionId === "retry_launch_sync") {
            const used = cid ? getBentleyOperationalRetryCount("launch_sync", cid) : 0;
            return (
              <button
                key={m.actionId}
                type="button"
                disabled={anyBusy}
                aria-busy={busy === "retry_launch_sync"}
                onClick={() => void onRetryLaunch()}
                className={btnPrimary}
              >
                {bentleyBlockerActionLabel("retry_launch_sync")}
                {cid ? (
                  <span className="font-normal text-cyan-200/70">
                    ({used} of {BENTLEY_OPERATIONAL_MAX_RETRIES} retries used this session)
                  </span>
                ) : null}
              </button>
            );
          }
          if (m.actionId === "refresh_operational_readiness") {
            const used = cid ? getBentleyOperationalRetryCount("readiness_refresh", cid) : 0;
            return (
              <button
                key={m.actionId}
                type="button"
                disabled={anyBusy}
                aria-busy={busy === "refresh_operational_readiness"}
                onClick={onRefreshReadiness}
                className={btnPrimary}
              >
                {bentleyBlockerActionLabel("refresh_operational_readiness")}
                {cid ? (
                  <span className="font-normal text-cyan-200/70">
                    ({used} of {BENTLEY_OPERATIONAL_MAX_RETRIES} retries used this session)
                  </span>
                ) : null}
              </button>
            );
          }
          return (
            <Link key={m.actionId} href={m.href} className={linkBase}>
              {m.label}
            </Link>
          );
        })}
      </div>
      {c360PlatformRetryAvailable && cid ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Content360 platform scheduling (admin)">
          <button
            type="button"
            disabled={anyBusy}
            aria-busy={c360PlatformBusy}
            onClick={() => void onRetryLaunchC360Platform()}
            className={`${btnPrimary} border-amber-500/45 bg-amber-950/35 text-amber-100 hover:bg-amber-900/45`}
          >
            Retry with Content360 platform scheduling
            <span className="font-normal text-amber-200/75">
              ({getBentleyOperationalRetryCount("launch_sync_content360_platform", cid)} of {BENTLEY_OPERATIONAL_MAX_RETRIES}{" "}
              retries this session)
            </span>
          </button>
        </div>
      ) : null}
      {note ? (
        <p className="text-[10px] text-slate-400 break-words" role="status">
          {note}
        </p>
      ) : null}
      <p className="text-[10px] text-slate-500">
        Launch sync retries reset after a successful sync. Readiness refresh retries are capped per session — no auto-publish and
        no approval bypass.
      </p>
    </div>
  );
}
