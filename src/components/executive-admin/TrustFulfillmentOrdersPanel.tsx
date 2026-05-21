"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrustFulfillmentOrderDetailResultDto } from "@/lib/fulfillment/fulfillment-trust-order-detail-dtos";
import type {
  TrustFulfillmentQueueListResultDto,
  TrustFulfillmentQueueOrderSummaryDto,
} from "@/lib/fulfillment/fulfillment-trust-queue-dtos";
import { FULFILLMENT_PIPELINE_STAGES } from "@/lib/fulfillment/fulfillment-types";

type Props = {
  defaultClientId?: string;
  onOpenApproval?: (approvalId: string) => void;
  onApprovalsRefresh?: () => void;
};

function stageBadgeClass(stage: string): string {
  switch (stage) {
    case "executive_handoff_received":
      return "border-cyan-500/40 bg-cyan-950/40 text-cyan-100/90";
    case "fulfillment_queued":
      return "border-blue-500/35 bg-blue-950/35 text-blue-100/90";
    case "service_drafting":
      return "border-amber-500/35 bg-amber-950/35 text-amber-100/90";
    case "owner_review":
      return "border-violet-500/35 bg-violet-950/35 text-violet-100/90";
    case "approved_for_release":
    case "released":
      return "border-emerald-500/35 bg-emerald-950/35 text-emerald-100/90";
    default:
      return "border-slate-600/50 bg-slate-900/40 text-slate-300";
  }
}

function approvalBadgeClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-amber-500/40 bg-amber-950/30 text-amber-100/90";
    case "executed":
    case "approved":
      return "border-emerald-500/35 bg-emerald-950/30 text-emerald-100/90";
    case "rejected":
    case "failed":
      return "border-red-500/35 bg-red-950/30 text-red-200/90";
    default:
      return "border-slate-600/50 bg-slate-900/40 text-slate-400";
  }
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function TrustFulfillmentOrdersPanel({
  defaultClientId = "",
  onOpenApproval,
  onApprovalsRefresh,
}: Props) {
  const [orders, setOrders] = useState<TrustFulfillmentQueueOrderSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TrustFulfillmentOrderDetailResultDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (stageFilter.trim()) params.set("stage", stageFilter.trim());
      if (approvalFilter.trim()) params.set("approval", approvalFilter.trim());
      const r = await fetch(`/api/admin/executive-agent/fulfillment-queue-trust?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as TrustFulfillmentQueueListResultDto & {
        error?: string;
        message?: string;
      };
      if (!r.ok) {
        setError(j.message ?? j.error ?? `Queue load failed (${r.status})`);
        setOrders([]);
        return;
      }
      setOrders(Array.isArray(j.orders) ? j.orders : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [stageFilter, approvalFilter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const loadOrderDetail = useCallback(async (orderId: string) => {
    setDetailOrderId(orderId);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const r = await fetch(
        `/api/admin/executive-agent/fulfillment-orders-trust/${encodeURIComponent(orderId)}`,
        { credentials: "include", cache: "no-store" }
      );
      const j = (await r.json().catch(() => ({}))) as TrustFulfillmentOrderDetailResultDto & {
        ok?: boolean;
        message?: string;
        code?: string;
      };
      if (!r.ok || !j.ok) {
        setDetailError(j.message ?? j.code ?? `Detail load failed (${r.status})`);
        return;
      }
      setDetail(j);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailOrderId(null);
    setDetail(null);
    setDetailError(null);
  }, []);

  const refreshDetailIfOpen = useCallback(
    (orderId: string) => {
      void loadQueue();
      onApprovalsRefresh?.();
      if (detailOrderId === orderId) void loadOrderDetail(orderId);
    },
    [detailOrderId, loadOrderDetail, loadQueue, onApprovalsRefresh]
  );

  const proposeTrustPacket = useCallback(
    async (orderId: string) => {
      setActionBusy(`propose-trust-${orderId}`);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders-trust/${encodeURIComponent(orderId)}/propose-trust-packet`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }
        );
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          approvalId?: string;
          message?: string;
          code?: string;
        };
        if (!r.ok) {
          window.alert(j.message ?? j.code ?? `Propose failed (${r.status})`);
          return;
        }
        if (j.approvalId) onOpenApproval?.(j.approvalId);
        refreshDetailIfOpen(orderId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [onOpenApproval, refreshDetailIfOpen]
  );

  const approvePacket = useCallback(
    async (orderId: string) => {
      setActionBusy(`approve-trust-${orderId}`);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders-trust/${encodeURIComponent(orderId)}/deliverable/approve-packet`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          }
        );
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string; code?: string };
        if (!r.ok) {
          window.alert(j.message ?? j.code ?? `Approve failed (${r.status})`);
          return;
        }
        refreshDetailIfOpen(orderId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [refreshDetailIfOpen]
  );

  const requestRevision = useCallback(
    async (orderId: string) => {
      const note = window.prompt("Revision note for internal desk (optional):")?.trim() || null;
      setActionBusy(`revision-trust-${orderId}`);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders-trust/${encodeURIComponent(orderId)}/deliverable/request-revision`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ revisionNote: note }),
          }
        );
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string; code?: string };
        if (!r.ok) {
          window.alert(j.message ?? j.code ?? `Revision failed (${r.status})`);
          return;
        }
        refreshDetailIfOpen(orderId);
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [refreshDetailIfOpen]
  );

  const detailOrder = detail?.order;

  return (
    <div className="mt-4 rounded-xl border border-violet-500/20 bg-slate-950/60 p-4">
      <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-xs text-amber-100/95">
        <p className="font-semibold uppercase tracking-wide text-amber-200/90">
          TRUST fulfillment — legal review only (Slice 1)
        </p>
        <p className="mt-1 text-amber-100/80">
          DRAFT workpapers prepared for licensed counsel. No legal advice, no trust execution, no Smart Trust apply, no
          trust DB mutation, and no client delivery from this desk.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">
          Trust Records queue
        </h3>
        <button
          type="button"
          className="rounded border border-slate-600/60 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-800/60"
          onClick={() => void loadQueue()}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        <select
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300"
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
        >
          <option value="">All stages</option>
          {FULFILLMENT_PIPELINE_STAGES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300"
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value)}
        >
          <option value="">All approvals</option>
          <option value="none">none</option>
          <option value="pending">pending</option>
          <option value="executed">executed</option>
          <option value="rejected">rejected</option>
        </select>
        {defaultClientId ? (
          <span className="text-slate-500">Client filter: {shortId(defaultClientId)}</span>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}
      {loading ? <p className="mt-2 text-xs text-slate-500">Loading TRUST queue…</p> : null}

      {!loading && orders.length === 0 ? (
        <p className="mt-2 text-xs text-slate-500">No TRUST fulfillment orders on this desk.</p>
      ) : null}

      <ul className="mt-3 space-y-2">
        {orders.map((o) => (
          <li
            key={o.orderId}
            className="rounded-lg border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${stageBadgeClass(o.pipelineStage)}`}>
                {o.pipelineStage.replace(/_/g, " ")}
              </span>
              <span className={`rounded border px-1.5 py-0.5 text-[10px] ${approvalBadgeClass(o.approvalStatus)}`}>
                approval: {o.approvalStatus}
              </span>
              <span className="text-slate-500">client {shortId(o.clientId)}</span>
            </div>
            {o.salesSummaryExcerpt ? (
              <p className="mt-1 line-clamp-2 text-slate-400">{o.salesSummaryExcerpt}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-violet-500/40 px-2 py-0.5 text-[10px] text-violet-200 hover:bg-violet-950/40"
                onClick={() => void loadOrderDetail(o.orderId)}
              >
                Detail
              </button>
              {o.approvalId && o.approvalStatus === "pending" ? (
                <button
                  type="button"
                  className="rounded border border-amber-500/40 px-2 py-0.5 text-[10px] text-amber-100"
                  onClick={() => onOpenApproval?.(o.approvalId!)}
                >
                  Open approval
                </button>
              ) : null}
              <button
                type="button"
                disabled={actionBusy === `propose-trust-${o.orderId}`}
                className="rounded border border-cyan-500/35 px-2 py-0.5 text-[10px] text-cyan-100 disabled:opacity-50"
                onClick={() => void proposeTrustPacket(o.orderId)}
              >
                Propose trust packet
              </button>
            </div>
          </li>
        ))}
      </ul>

      {detailOrderId ? (
        <div className="mt-4 rounded-lg border border-violet-500/25 bg-slate-900/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-violet-200/80">
              Order {shortId(detailOrderId)}
            </h4>
            <button
              type="button"
              className="text-[10px] text-slate-500 hover:text-slate-300"
              onClick={closeDetail}
            >
              Close
            </button>
          </div>
          {detailLoading ? <p className="mt-2 text-xs text-slate-500">Loading detail…</p> : null}
          {detailError ? <p className="mt-2 text-xs text-red-300/90">{detailError}</p> : null}
          {detail && detailOrder ? (
            <div className="mt-2 space-y-3 text-xs text-slate-300">
              <p className="rounded border border-amber-500/25 bg-amber-950/20 px-2 py-1.5 text-amber-100/90">
                {detail.legal.banner} — {detail.legal.skipperWarning}
              </p>
              <div>
                <p className="font-medium text-violet-200/90">{detail.nextAction.title}</p>
                <p className="text-slate-400">{detail.nextAction.description}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-slate-500">Intake readiness</p>
                <p>
                  Tier: {detail.trustIntake.readiness.tier} · Score: {detail.trustIntake.readiness.score} · Ready:{" "}
                  {detail.trustIntake.readiness.fulfillmentReady ? "yes" : "no"}
                </p>
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-slate-950/80 p-2 text-[10px] text-slate-400">
                  {detail.trustIntake.skipperSummary}
                </pre>
              </div>
              {detail.deliverableDraft?.linked ? (
                <div className="rounded border border-slate-700/60 p-2">
                  <p className="text-[10px] uppercase text-slate-500">Trust packet preview</p>
                  {!detail.deliverableDraft.hasLegalDisclaimer ? (
                    <p className="text-red-300/90">Warning: linked note missing legal disclaimer marker.</p>
                  ) : null}
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-[10px] text-slate-400">
                    {detail.deliverableDraft.previewText ?? "(empty)"}
                  </pre>
                  {detail.deliverableDraft.canApprove ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={Boolean(actionBusy)}
                        className="rounded border border-emerald-500/40 px-2 py-0.5 text-emerald-200"
                        onClick={() => void approvePacket(detailOrderId)}
                      >
                        Approve packet (internal)
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(actionBusy)}
                        className="rounded border border-orange-500/40 px-2 py-0.5 text-orange-200"
                        onClick={() => void requestRevision(detailOrderId)}
                      >
                        Request revision
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div>
                <p className="text-[10px] uppercase text-slate-500">Timeline</p>
                <ul className="mt-1 space-y-1">
                  {detail.timeline.map((t) => (
                    <li key={t.id} className="text-[10px] text-slate-400">
                      {t.label} — {new Date(t.occurredAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                disabled={actionBusy === `propose-trust-${detailOrderId}`}
                className="rounded border border-cyan-500/35 px-2 py-1 text-[10px] text-cyan-100"
                onClick={() => void proposeTrustPacket(detailOrderId)}
              >
                Propose trust packet
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
