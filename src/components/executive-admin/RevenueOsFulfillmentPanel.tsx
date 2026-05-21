"use client";

import { useCallback, useEffect, useState } from "react";
import { CampaignReviewPanel } from "@/components/executive-admin/CampaignReviewPanel";
import { LaunchReadinessPanel } from "@/components/executive-admin/LaunchReadinessPanel";
import type { RevenueOsFulfillmentOrderDetailResultDto } from "@/lib/fulfillment/revenue-os-fulfillment-dtos";
import type {
  RevenueOsFulfillmentQueueListResultDto,
  RevenueOsFulfillmentQueueOrderSummaryDto,
} from "@/lib/fulfillment/revenue-os-fulfillment-dtos";
import { FULFILLMENT_PIPELINE_STAGES } from "@/lib/fulfillment/fulfillment-types";

type Props = {
  defaultClientId?: string;
  onOpenApproval?: (approvalId: string) => void;
  onApprovalsRefresh?: () => void;
};

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function RevenueOsFulfillmentPanel({
  defaultClientId = "",
  onOpenApproval,
  onApprovalsRefresh,
}: Props) {
  const [orders, setOrders] = useState<RevenueOsFulfillmentQueueOrderSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RevenueOsFulfillmentOrderDetailResultDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (stageFilter.trim()) params.set("stage", stageFilter.trim());
      const r = await fetch(`/api/admin/executive-agent/revenue-os/orders?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as RevenueOsFulfillmentQueueListResultDto & {
        message?: string;
      };
      if (!r.ok) {
        setError(j.message ?? `HTTP ${r.status}`);
        setOrders([]);
        return;
      }
      let list = j.orders ?? [];
      if (defaultClientId.trim()) {
        list = list.filter((o) => o.clientId === defaultClientId.trim());
      }
      setOrders(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [stageFilter, defaultClientId]);

  const loadDetail = useCallback(async (orderId: string) => {
    setDetailError(null);
    setDetail(null);
    try {
      const r = await fetch(`/api/admin/executive-agent/revenue-os/orders/${orderId}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as RevenueOsFulfillmentOrderDetailResultDto & {
        message?: string;
      };
      if (!r.ok || !j.ok) {
        setDetailError(j.message ?? `HTTP ${r.status}`);
        return;
      }
      setDetail(j);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (detailOrderId) void loadDetail(detailOrderId);
    else setDetail(null);
  }, [detailOrderId, loadDetail]);

  async function proposeCampaignReview(orderId: string) {
    setActionBusy(orderId);
    try {
      const r = await fetch(
        `/api/admin/executive-agent/revenue-os/orders/${orderId}/propose-campaign-review`,
        { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      const j = (await r.json().catch(() => ({}))) as { message?: string; approvalId?: string };
      if (!r.ok) {
        setDetailError(j.message ?? `HTTP ${r.status}`);
        return;
      }
      onApprovalsRefresh?.();
      if (j.approvalId) onOpenApproval?.(j.approvalId);
      await loadQueue();
      if (detailOrderId === orderId) await loadDetail(orderId);
    } finally {
      setActionBusy(null);
    }
  }

  async function proposeLaunchReadiness(
    orderId: string,
    body: { readinessSummary: string; ownerAttestation: string; blockersResolved: string[] }
  ) {
    setActionBusy(orderId);
    try {
      const r = await fetch(
        `/api/admin/executive-agent/revenue-os/orders/${orderId}/approve-launch-readiness`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const j = (await r.json().catch(() => ({}))) as { message?: string; approvalId?: string };
      if (!r.ok) {
        setDetailError(j.message ?? `HTTP ${r.status}`);
        return;
      }
      onApprovalsRefresh?.();
      if (j.approvalId) onOpenApproval?.(j.approvalId);
      await loadQueue();
      if (detailOrderId === orderId) await loadDetail(orderId);
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-fuchsia-500/20 bg-slate-950/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fuchsia-200/80">
          REVENUE_OS fulfillment
        </h3>
        <select
          className="rounded border border-slate-700/60 bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All stages</option>
          {FULFILLMENT_PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        Governed campaign fulfillment — owner-approved review and launch checkpoints only.
      </p>
      {error ? <p className="mt-2 text-xs text-amber-200/90">{error}</p> : null}
      {loading ? (
        <p className="mt-2 text-xs text-slate-500">Loading queue…</p>
      ) : orders.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No REVENUE_OS orders for this desk.</p>
      ) : (
        <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-[11px]">
          {orders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => setDetailOrderId(o.id)}
                className={`w-full rounded-lg border px-2 py-1.5 text-left ${
                  detailOrderId === o.id
                    ? "border-fuchsia-500/40 bg-fuchsia-950/25"
                    : "border-slate-700/50 hover:bg-slate-900/50"
                }`}
              >
                <span className="font-mono text-slate-300">{shortId(o.id)}</span>
                <span className="ml-2 text-slate-500">{o.pipelineStage}</span>
                {o.stalledDays != null ? (
                  <span className="ml-2 text-amber-300/80">stalled {o.stalledDays}d</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {detailError ? <p className="mt-2 text-xs text-amber-200/90">{detailError}</p> : null}
      {detail ? (
        <div className="mt-3 space-y-3 border-t border-slate-700/40 pt-3">
          <p className="text-[10px] text-slate-500">{detail.legalBanner}</p>
          <p className="text-[10px] text-amber-200/70">{detail.revisionIntelligence.summary}</p>
          <CampaignReviewPanel
            detail={detail}
            busy={actionBusy === detail.order.id}
            onProposeReview={() => void proposeCampaignReview(detail.order.id)}
            onOpenApproval={onOpenApproval}
          />
          <LaunchReadinessPanel
            detail={detail}
            busy={actionBusy === detail.order.id}
            onProposeLaunchReadiness={(body) => void proposeLaunchReadiness(detail.order.id, body)}
            onOpenApproval={onOpenApproval}
          />
          {detail.kpiSnapshot.postLaunchNotes.length > 0 ? (
            <div className="rounded-lg border border-slate-700/50 p-2 text-[10px] text-slate-400">
              <div className="font-semibold uppercase tracking-wide text-slate-500">Post-launch analytics</div>
              <ul className="mt-1 list-inside list-disc">
                {detail.kpiSnapshot.postLaunchNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
