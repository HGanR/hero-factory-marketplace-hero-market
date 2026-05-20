"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FulfillmentQueueListResultDto, FulfillmentQueueOrderSummaryDto } from "@/lib/fulfillment/fulfillment-queue-dtos";
import { FULFILLMENT_PIPELINE_STAGES } from "@/lib/fulfillment/fulfillment-types";

type Props = {
  /** CRM client filter from the executive desk (optional). */
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
    case "closed":
      return "border-slate-600/50 bg-slate-900/50 text-slate-400";
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
    case "none":
    default:
      return "border-slate-600/50 bg-slate-900/40 text-slate-400";
  }
}

function paymentBadgeClass(status: string): string {
  switch (status) {
    case "confirmed":
      return "border-emerald-500/35 bg-emerald-950/25 text-emerald-100/90";
    case "failed":
      return "border-red-500/35 bg-red-950/25 text-red-200/90";
    default:
      return "border-amber-500/35 bg-amber-950/25 text-amber-100/90";
  }
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

export function FulfillmentOrdersPanel({ defaultClientId = "", onOpenApproval, onApprovalsRefresh }: Props) {
  const [orders, setOrders] = useState<FulfillmentQueueOrderSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [confirmClientId, setConfirmClientId] = useState(defaultClientId);
  const [confirmRef, setConfirmRef] = useState("");
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  useEffect(() => {
    setConfirmClientId(defaultClientId);
  }, [defaultClientId]);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (stageFilter.trim()) params.set("stage", stageFilter.trim());
      if (approvalFilter.trim()) params.set("approval", approvalFilter.trim());
      const r = await fetch(`/api/admin/executive-agent/fulfillment-queue?${params}`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as FulfillmentQueueListResultDto & { error?: string; message?: string };
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

  const confirmPayment = useCallback(async () => {
    const clientId = confirmClientId.trim();
    if (!clientId) {
      setConfirmMsg("Enter a CRM client UUID to confirm payment.");
      return;
    }
    setActionBusy("confirm-payment");
    setConfirmMsg(null);
    try {
      const r = await fetch("/api/admin/executive-agent/payment-confirmations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          externalRef: confirmRef.trim() || null,
          paypalTransactionNote: confirmNote.trim() || null,
        }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        confirmation?: { id: string };
        error?: string;
        message?: string;
      };
      if (!r.ok) {
        setConfirmMsg(j.error ?? j.message ?? `Confirm failed (${r.status})`);
        return;
      }
      setConfirmMsg(
        j.confirmation?.id
          ? `Payment confirmed (${shortId(j.confirmation.id)}). Claude may hand off using this confirmationId.`
          : "Payment confirmed."
      );
      setConfirmRef("");
      setConfirmNote("");
      void loadQueue();
    } catch (e) {
      setConfirmMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setActionBusy(null);
    }
  }, [confirmClientId, confirmNote, confirmRef, loadQueue]);

  const proposeSiteBuilderDraft = useCallback(
    async (order: FulfillmentQueueOrderSummaryDto) => {
      setActionBusy(`propose-${order.orderId}`);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders/${encodeURIComponent(order.orderId)}/propose-site-builder-draft`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
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
        onApprovalsRefresh?.();
        void loadQueue();
        if (j.approvalId) {
          onOpenApproval?.(j.approvalId);
        }
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [loadQueue, onApprovalsRefresh, onOpenApproval]
  );

  const empty = !loading && !error && orders.length === 0;

  const stageOptions = useMemo(() => ["", ...FULFILLMENT_PIPELINE_STAGES], []);

  return (
    <div className="rounded-xl border border-emerald-400/25 bg-emerald-950/10 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/85">
          WEBSITE fulfillment (Site Builder)
        </h3>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadQueue()}
          className="rounded-full border border-emerald-500/35 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-100/90 hover:bg-emerald-900/30 disabled:opacity-40"
        >
          Refresh
        </button>
      </div>
      <p className="mb-3 text-[10px] leading-relaxed text-slate-500">
        Manual PayPal reconciliation only — confirm payment in PayPal, then confirm here. Draft routing queues executive
        approval; no deploy, publish, or auto-send.
      </p>

      <div className="mb-3 rounded-lg border border-slate-700/55 bg-slate-950/50 p-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Confirm payment (manual)</div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block text-[10px] text-slate-500">
            Client UUID
            <input
              value={confirmClientId}
              onChange={(e) => setConfirmClientId(e.target.value)}
              placeholder="00000000-0000-4000-8000-000000000001"
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-200"
            />
          </label>
          <label className="block text-[10px] text-slate-500">
            PayPal ref (optional)
            <input
              value={confirmRef}
              onChange={(e) => setConfirmRef(e.target.value)}
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-200"
            />
          </label>
        </div>
        <label className="mt-2 block text-[10px] text-slate-500">
          Desk note (optional)
          <input
            value={confirmNote}
            onChange={(e) => setConfirmNote(e.target.value)}
            className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-200"
          />
        </label>
        <button
          type="button"
          disabled={actionBusy != null}
          onClick={() => void confirmPayment()}
          className="mt-2 rounded bg-emerald-600/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white disabled:opacity-40"
        >
          {actionBusy === "confirm-payment" ? "Confirming…" : "Confirm payment"}
        </button>
        {confirmMsg ? <p className="mt-2 text-[10px] text-emerald-100/85">{confirmMsg}</p> : null}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
          aria-label="Filter by pipeline stage"
        >
          {stageOptions.map((s) => (
            <option key={s || "all"} value={s}>
              {s ? s.replace(/_/g, " ") : "All stages"}
            </option>
          ))}
        </select>
        <select
          value={approvalFilter}
          onChange={(e) => setApprovalFilter(e.target.value)}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
          aria-label="Filter by approval status"
        >
          <option value="">All approvals</option>
          <option value="none">No approval</option>
          <option value="pending">Pending</option>
          <option value="executed">Executed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {loading ? <p className="text-xs text-slate-500">Loading fulfillment queue…</p> : null}
      {error ? <p className="text-xs text-amber-200/90">{error}</p> : null}
      {empty ? (
        <p className="text-xs text-slate-500">No WEBSITE fulfillment orders match filters.</p>
      ) : null}

      {!loading && !error && orders.length > 0 ? (
        <ul className="mt-2 max-h-[28rem] space-y-2 overflow-y-auto text-[11px]">
          {orders.map((o) => {
            const pay = o.paymentConfirmation;
            const canPropose =
              o.approvalStatus !== "pending" &&
              o.pipelineStage !== "released" &&
              o.pipelineStage !== "closed";
            return (
              <li key={o.orderId} className="rounded-lg border border-slate-700/55 bg-slate-900/45 p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${stageBadgeClass(o.pipelineStage)}`}>
                    {o.pipelineStage.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${approvalBadgeClass(o.approvalStatus)}`}>
                    approval: {o.approvalStatus}
                  </span>
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${paymentBadgeClass(pay.status)}`}>
                    payment: {pay.status}
                    {pay.consumedAt ? " · consumed" : ""}
                  </span>
                  <span className="rounded border border-slate-700/60 px-1.5 py-0.5 text-[9px] text-slate-400">
                    {o.service.primary}
                  </span>
                </div>
                <div className="mt-1.5 font-mono text-[10px] text-slate-400">
                  order {shortId(o.orderId)} · client {shortId(o.clientId)} · {formatWhen(o.createdAt)}
                </div>
                {pay.externalRefMasked ? (
                  <div className="mt-1 text-[10px] text-slate-500">PayPal ref: {pay.externalRefMasked}</div>
                ) : null}
                {o.salesSummaryExcerpt ? (
                  <p className="mt-1.5 line-clamp-3 text-slate-400">{o.salesSummaryExcerpt}</p>
                ) : (
                  <p className="mt-1.5 text-slate-600">No sales summary excerpt.</p>
                )}
                {o.deliverable ? (
                  <div className="mt-1 text-[10px] text-slate-500">
                    Deliverable: {o.deliverable.artifactType} · review {o.deliverable.ownerReviewStatus}
                    {o.deliverable.artifactRef ? ` · ref ${shortId(o.deliverable.artifactRef)}` : ""}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={actionBusy != null || pay.status === "confirmed"}
                    title={
                      pay.status === "confirmed"
                        ? "Payment already confirmed on this order"
                        : "Use manual confirm form above for new payments"
                    }
                    className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-400 disabled:opacity-40"
                  >
                    Confirm payment
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy != null || !canPropose}
                    onClick={() => void proposeSiteBuilderDraft(o)}
                    className="rounded bg-[#00e5ff]/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-950 disabled:opacity-40"
                  >
                    {actionBusy === `propose-${o.orderId}` ? "…" : "Propose Site Builder draft"}
                  </button>
                  {o.approvalId ? (
                    <button
                      type="button"
                      className="rounded border border-[#00e5ff]/40 px-2 py-1 text-[10px] text-[#00e5ff]"
                      onClick={() => onOpenApproval?.(o.approvalId!)}
                    >
                      Open approval
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
