"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FulfillmentOrderDetailResultDto,
  FulfillmentTimelineEntryKind,
  WebsiteIntakeReadinessTier,
} from "@/lib/fulfillment/fulfillment-order-detail-dtos";
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

function intakeTierBadgeClass(tier: WebsiteIntakeReadinessTier): string {
  switch (tier) {
    case "strong":
      return "border-emerald-500/45 bg-emerald-950/40 text-emerald-100";
    case "medium":
      return "border-amber-500/40 bg-amber-950/35 text-amber-100/90";
    case "weak":
    default:
      return "border-red-500/35 bg-red-950/30 text-red-200/90";
  }
}

function timelineDotClass(kind: FulfillmentTimelineEntryKind): string {
  switch (kind) {
    case "payment_confirmed":
      return "bg-emerald-400";
    case "claude_handoff_received":
      return "bg-cyan-400";
    case "site_builder_draft_proposed":
      return "bg-[#00e5ff]";
    case "approval_created":
      return "bg-amber-400";
    case "approval_executed":
      return "bg-violet-400";
    case "site_builder_draft_linked":
      return "bg-sky-400";
    case "deliverable_approved_for_release":
      return "bg-emerald-500";
    case "deliverable_revision_requested":
      return "bg-orange-400";
    case "client_delivery_link_generated":
      return "bg-teal-400";
    case "client_delivery_link_revoked":
      return "bg-slate-500";
    case "client_delivery_workspace_viewed":
      return "bg-sky-300";
    case "client_delivery_client_approved":
      return "bg-emerald-400";
    case "client_delivery_client_revision_requested":
      return "bg-orange-300";
    default:
      return "bg-slate-500";
  }
}

function clientDeliveryBadgeClass(status: string): string {
  switch (status) {
    case "workspace_active":
      return "border-cyan-500/40 bg-cyan-950/35 text-cyan-100/90";
    case "client_approved":
      return "border-emerald-500/40 bg-emerald-950/35 text-emerald-100/90";
    case "client_revision_requested":
      return "border-orange-500/40 bg-orange-950/35 text-orange-100/90";
    case "not_sent":
    default:
      return "border-slate-600/50 bg-slate-900/40 text-slate-400";
  }
}

function tokenStatusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "text-emerald-300";
    case "expired":
      return "text-amber-300";
    case "revoked":
      return "text-slate-500";
    default:
      return "text-slate-400";
  }
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
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FulfillmentOrderDetailResultDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lastWorkspaceUrl, setLastWorkspaceUrl] = useState<string | null>(null);
  const [deliveryMsg, setDeliveryMsg] = useState<string | null>(null);

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

  const loadOrderDetail = useCallback(async (orderId: string) => {
    setDetailOrderId(orderId);
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    try {
      const r = await fetch(
        `/api/admin/executive-agent/fulfillment-orders/${encodeURIComponent(orderId)}`,
        { credentials: "include", cache: "no-store" }
      );
      const j = (await r.json().catch(() => ({}))) as FulfillmentOrderDetailResultDto & {
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
    setLastWorkspaceUrl(null);
    setDeliveryMsg(null);
  }, []);

  const refreshDetailIfOpen = useCallback(
    (orderId: string) => {
      void loadQueue();
      if (detailOrderId === orderId) {
        void loadOrderDetail(orderId);
      }
    },
    [detailOrderId, loadOrderDetail, loadQueue]
  );

  const approveDeliverableDraft = useCallback(
    async (orderId: string) => {
      setActionBusy(`approve-draft-${orderId}`);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders/${encodeURIComponent(orderId)}/deliverable/approve-draft`,
          { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }
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

  const requestDeliverableRevision = useCallback(
    async (orderId: string) => {
      const note = window.prompt("Revision note for internal desk (optional):")?.trim() || null;
      setActionBusy(`revision-draft-${orderId}`);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders/${encodeURIComponent(orderId)}/deliverable/request-revision`,
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

  const generateClientDeliveryLink = useCallback(
    async (orderId: string, regenerate: boolean) => {
      setActionBusy(regenerate ? `regen-delivery-${orderId}` : `gen-delivery-${orderId}`);
      setDeliveryMsg(null);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders/${encodeURIComponent(orderId)}/client-delivery/generate-link`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ expiresInDays: 14, regenerate }),
          }
        );
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          workspaceUrl?: string;
          message?: string;
          code?: string;
        };
        if (!r.ok) {
          setDeliveryMsg(j.message ?? j.code ?? `Link generation failed (${r.status})`);
          return;
        }
        if (j.workspaceUrl) {
          setLastWorkspaceUrl(j.workspaceUrl);
        }
        setDeliveryMsg(j.message ?? "Client review link ready — copy and share manually.");
        refreshDetailIfOpen(orderId);
      } catch (e) {
        setDeliveryMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [refreshDetailIfOpen]
  );

  const revokeClientDeliveryLinks = useCallback(
    async (orderId: string) => {
      if (!window.confirm("Revoke all active client delivery links for this order?")) return;
      setActionBusy(`revoke-delivery-${orderId}`);
      setDeliveryMsg(null);
      try {
        const r = await fetch(
          `/api/admin/executive-agent/fulfillment-orders/${encodeURIComponent(orderId)}/client-delivery/revoke-links`,
          { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" }
        );
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          revoked?: number;
          message?: string;
        };
        if (!r.ok) {
          setDeliveryMsg(j.message ?? `Revoke failed (${r.status})`);
          return;
        }
        setLastWorkspaceUrl(null);
        setDeliveryMsg(
          typeof j.revoked === "number"
            ? `Revoked ${j.revoked} active link(s).`
            : "Delivery links revoked."
        );
        refreshDetailIfOpen(orderId);
      } catch (e) {
        setDeliveryMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [refreshDetailIfOpen]
  );

  const copyWorkspaceUrl = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setDeliveryMsg("Workspace URL copied to clipboard.");
    } catch {
      setDeliveryMsg("Copy failed — select the URL manually.");
    }
  }, []);

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
        if (detailOrderId === order.orderId) {
          void loadOrderDetail(order.orderId);
        }
        if (j.approvalId) {
          onOpenApproval?.(j.approvalId);
        }
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      } finally {
        setActionBusy(null);
      }
    },
    [detailOrderId, loadOrderDetail, loadQueue, onApprovalsRefresh, onOpenApproval]
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
                    disabled={actionBusy != null}
                    onClick={() => void loadOrderDetail(o.orderId)}
                    className="rounded border border-emerald-500/40 px-2 py-1 text-[10px] text-emerald-100/90 hover:bg-emerald-950/40"
                  >
                    View details
                  </button>
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

      {detailOrderId ? (
        <div
          className="fixed inset-0 z-[85] flex justify-end bg-black/55 backdrop-blur-[2px]"
          role="presentation"
          onClick={closeDetail}
        >
          <div
            role="dialog"
            aria-labelledby="fulfillment-order-detail-title"
            className="flex h-full w-full max-w-md flex-col border-l border-emerald-500/25 bg-slate-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <h4
                id="fulfillment-order-detail-title"
                className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200/90"
              >
                Order detail
              </h4>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-[11px]">
              {detailLoading ? <p className="text-slate-500">Loading order detail…</p> : null}
              {detailError ? <p className="text-amber-200/90">{detailError}</p> : null}
              {detail?.ok ? (
                <>
                  <div className="mb-3 rounded-lg border border-emerald-500/35 bg-emerald-950/25 p-2">
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-200/80">
                      Next action
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-emerald-50">{detail.nextAction.title}</div>
                    <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{detail.nextAction.description}</p>
                    <div className="mt-1 font-mono text-[9px] text-slate-500">code: {detail.nextAction.action}</div>
                  </div>

                  <div className="mb-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-2">
                    <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                      Intake readiness
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${intakeTierBadgeClass(detail.websiteIntake.readiness.tier)}`}
                      >
                        {detail.websiteIntake.readiness.tier} intake
                      </span>
                      <span className="rounded border border-slate-600/60 px-1.5 py-0.5 text-[9px] text-slate-300">
                        score {detail.websiteIntake.readiness.score}/100
                      </span>
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${
                          detail.websiteIntake.readiness.fulfillmentReady
                            ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100/90"
                            : "border-amber-500/35 bg-amber-950/25 text-amber-100/85"
                        }`}
                      >
                        {detail.websiteIntake.readiness.fulfillmentReady
                          ? "fulfillment-ready"
                          : "not ready"}
                      </span>
                    </div>
                    {detail.websiteIntake.readiness.missingFields.length > 0 ? (
                      <div className="mt-2">
                        <div className="text-[9px] uppercase tracking-wide text-slate-500">Missing information</div>
                        <ul className="mt-1 list-inside list-disc text-[10px] text-amber-100/80">
                          {detail.websiteIntake.readiness.missingFields.map((field) => (
                            <li key={field}>{field}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] text-emerald-100/80">No critical intake gaps flagged.</p>
                    )}
                  </div>

                  <div className="mb-3 flex flex-wrap gap-1">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${stageBadgeClass(detail.order.pipelineStage)}`}
                    >
                      {detail.order.pipelineStage.replace(/_/g, " ")}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${approvalBadgeClass(detail.order.approvalStatus)}`}
                    >
                      approval: {detail.order.approvalStatus}
                    </span>
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${paymentBadgeClass(detail.paymentConfirmation.status)}`}
                    >
                      payment: {detail.paymentConfirmation.status}
                    </span>
                  </div>

                  <div className="mb-3 font-mono text-[10px] text-slate-400">
                    order {detail.order.orderId} · client {shortId(detail.order.clientId)}
                    <br />
                    source {detail.order.source} · {formatWhen(detail.order.createdAt)}
                  </div>

                  <section className="mb-3">
                    <h5 className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Timeline</h5>
                    {detail.timeline.length === 0 ? (
                      <p className="mt-1 text-slate-600">No timeline events yet.</p>
                    ) : (
                      <ol className="mt-2 space-y-2 border-l border-slate-800 pl-3">
                        {detail.timeline.map((entry) => (
                          <li key={entry.id} className="relative">
                            <span
                              className={`absolute -left-[1.15rem] top-1 h-2 w-2 rounded-full ${timelineDotClass(entry.kind)}`}
                            />
                            <div className="text-[10px] text-slate-200">{entry.label}</div>
                            <div className="text-[9px] text-slate-500">{formatWhen(entry.occurredAt)}</div>
                            {entry.detail ? (
                              <div className="text-[9px] text-slate-600">{entry.detail}</div>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <section className="mb-3 rounded border border-slate-800/80 bg-slate-900/40 p-2">
                    <h5 className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Payment</h5>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {detail.paymentConfirmation.provider} · {detail.paymentConfirmation.status}
                      {detail.paymentConfirmation.externalRefMasked
                        ? ` · ref ${detail.paymentConfirmation.externalRefMasked}`
                        : ""}
                    </div>
                    <div className="text-[9px] text-slate-600">
                      confirmed {formatWhen(detail.paymentConfirmation.confirmedAt)} · consumed{" "}
                      {formatWhen(detail.paymentConfirmation.consumedAt)}
                    </div>
                  </section>

                  <section className="mb-3 rounded border border-slate-800/80 bg-slate-900/35 p-2">
                    <h5 className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                      Skipper intake summary
                    </h5>
                    <pre className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[10px] leading-relaxed text-slate-400">
                      {detail.websiteIntake.skipperSummary}
                    </pre>
                  </section>

                  <section className="mb-3">
                    <h5 className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                      Claude sales excerpt
                    </h5>
                    {detail.order.salesSummaryExcerpt ? (
                      <p className="mt-1 text-slate-400">{detail.order.salesSummaryExcerpt}</p>
                    ) : (
                      <p className="mt-1 text-slate-600">No excerpt on file.</p>
                    )}
                  </section>

                  {detail.order.requestedDeliverable ? (
                    <section className="mb-3 text-[10px] text-slate-500">
                      Deliverable request: {detail.order.requestedDeliverable.type} —{" "}
                      {detail.order.requestedDeliverable.title}
                    </section>
                  ) : null}

                  {detail.deliverableDraft ? (
                    <section className="mb-3 rounded-lg border border-[#00e5ff]/25 bg-slate-900/55 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-[9px] font-semibold uppercase tracking-wide text-[#00e5ff]/90">
                          Site Builder draft (owner review)
                        </h5>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${
                            detail.deliverableDraft.ownerReviewStatus === "approved" &&
                            detail.deliverableDraft.pipelineStage === "approved_for_release"
                              ? "border-emerald-500/40 bg-emerald-950/35 text-emerald-100/90"
                              : "border-slate-600/50 bg-slate-900/40 text-slate-400"
                          }`}
                        >
                          {detail.deliverableDraft.ownerReviewStatus === "approved" &&
                          detail.deliverableDraft.pipelineStage === "approved_for_release"
                            ? "owner approved for release"
                            : `owner review: ${detail.deliverableDraft.ownerReviewStatus}`}
                        </span>
                      </div>
                      {detail.deliverableDraft.linked && detail.deliverableDraft.previewText ? (
                        <>
                          {detail.deliverableDraft.title ? (
                            <div className="mt-2 text-[11px] font-semibold text-slate-200">
                              {detail.deliverableDraft.title}
                              {detail.deliverableDraft.priority
                                ? ` · ${detail.deliverableDraft.priority}`
                                : ""}
                            </div>
                          ) : null}
                          <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded border border-slate-800/80 bg-slate-950/60 p-2 font-sans text-[10px] leading-relaxed text-slate-300">
                            {detail.deliverableDraft.previewText}
                          </pre>
                          <div className="mt-1 font-mono text-[9px] text-slate-500">
                            note {detail.deliverableDraft.clientNoteId
                              ? shortId(detail.deliverableDraft.clientNoteId)
                              : "—"}{" "}
                            · review {detail.deliverableDraft.ownerReviewStatus}
                          </div>
                        </>
                      ) : (
                        <p className="mt-2 text-[10px] text-slate-500">
                          Draft not linked yet. Execute the Site Builder task approval to attach the internal
                          note.
                        </p>
                      )}
                      {detail.deliverableDraft.canApprove || detail.deliverableDraft.canRequestRevision ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button
                            type="button"
                            disabled={actionBusy != null || !detail.deliverableDraft.canApprove}
                            onClick={() => void approveDeliverableDraft(detail.order.orderId)}
                            className="rounded bg-emerald-600/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white disabled:opacity-40"
                          >
                            Approve draft for release
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy != null || !detail.deliverableDraft.canRequestRevision}
                            onClick={() => void requestDeliverableRevision(detail.order.orderId)}
                            className="rounded border border-amber-500/45 px-2 py-1 text-[10px] text-amber-100/90 disabled:opacity-40"
                          >
                            Request revision
                          </button>
                        </div>
                      ) : null}
                    </section>
                  ) : null}

                  {detail.clientDelivery ? (
                    <section className="mb-3 rounded-lg border border-teal-500/25 bg-slate-900/55 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h5 className="text-[9px] font-semibold uppercase tracking-wide text-teal-200/90">
                          Client delivery workspace
                        </h5>
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${clientDeliveryBadgeClass(detail.clientDelivery.status)}`}
                        >
                          {detail.clientDelivery.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-slate-500">
                        Draft v{detail.clientDelivery.draftVersion} · expiring read-only links · no email or SMS
                      </p>
                      {detail.clientDelivery.timeline.length > 0 ? (
                        <ol className="mt-2 space-y-1 border-l border-slate-800 pl-2">
                          {detail.clientDelivery.timeline.map((entry) => (
                            <li key={entry.id} className="text-[9px] text-slate-400">
                              <span className="text-slate-300">{entry.label}</span>
                              <span className="ml-1 text-slate-600">{formatWhen(entry.occurredAt)}</span>
                              {entry.detail ? (
                                <span className="ml-1 text-slate-600">· {entry.detail}</span>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      {lastWorkspaceUrl ? (
                        <div className="mt-2 rounded border border-teal-600/30 bg-slate-950/60 p-2">
                          <div className="text-[9px] uppercase tracking-wide text-teal-300/80">
                            Latest generated link (copy now)
                          </div>
                          <p className="mt-1 break-all font-mono text-[9px] text-teal-100/90">
                            {lastWorkspaceUrl}
                          </p>
                          <button
                            type="button"
                            disabled={actionBusy != null}
                            onClick={() => void copyWorkspaceUrl(lastWorkspaceUrl)}
                            className="mt-1 rounded border border-teal-500/40 px-2 py-0.5 text-[9px] text-teal-100/90 disabled:opacity-40"
                          >
                            Copy URL
                          </button>
                        </div>
                      ) : null}
                      {detail.clientDelivery.tokens.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-[9px] text-slate-500">
                          {detail.clientDelivery.tokens.map((t) => (
                            <li key={t.id} className="font-mono">
                              {t.tokenPrefix} · v{t.draftVersion} ·{" "}
                              <span className={tokenStatusBadgeClass(t.status)}>{t.status}</span> · exp{" "}
                              {formatWhen(t.expiresAt)}
                              {t.lastAccessedAt ? ` · viewed ${formatWhen(t.lastAccessedAt)}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          disabled={actionBusy != null || !detail.clientDelivery.canGenerateLink}
                          onClick={() => void generateClientDeliveryLink(detail.order.orderId, false)}
                          className="rounded bg-teal-700/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white disabled:opacity-40"
                        >
                          Generate client link
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy != null || !detail.clientDelivery.canGenerateLink}
                          onClick={() => void generateClientDeliveryLink(detail.order.orderId, true)}
                          className="rounded border border-teal-500/45 px-2 py-1 text-[10px] text-teal-100/90 disabled:opacity-40"
                          title="Revokes prior links and bumps draft version"
                        >
                          Regenerate link
                        </button>
                        <button
                          type="button"
                          disabled={actionBusy != null}
                          onClick={() => void revokeClientDeliveryLinks(detail.order.orderId)}
                          className="rounded border border-slate-600/50 px-2 py-1 text-[10px] text-slate-400 disabled:opacity-40"
                        >
                          Revoke links
                        </button>
                      </div>
                      {deliveryMsg ? (
                        <p className="mt-2 text-[10px] text-teal-100/85">{deliveryMsg}</p>
                      ) : null}
                    </section>
                  ) : null}

                  {detail.deliverable ? (
                    <section className="mb-3 text-[10px] text-slate-500">
                      Deliverable shell: {detail.deliverable.artifactType} · review{" "}
                      {detail.deliverable.ownerReviewStatus}
                      {detail.deliverable.artifactRef
                        ? ` · ref ${shortId(detail.deliverable.artifactRef)}`
                        : ""}
                    </section>
                  ) : null}

                  {detail.approval ? (
                    <section className="mb-3 text-[10px] text-slate-500">
                      Approval {shortId(detail.approval.id)} · {detail.approval.status} ·{" "}
                      {detail.approval.proposedAction}
                    </section>
                  ) : null}

                  <div className="flex flex-wrap gap-1 border-t border-slate-800 pt-3">
                    {detail.nextAction.action === "ready_to_propose_site_builder_draft" ? (
                      <button
                        type="button"
                        disabled={actionBusy != null}
                        onClick={() =>
                          void proposeSiteBuilderDraft({
                            orderId: detail.order.orderId,
                            clientId: detail.order.clientId,
                            pipelineStage: detail.order.pipelineStage,
                            approvalStatus: detail.order.approvalStatus,
                            approvalId: detail.order.approvalId,
                            proposedAction: detail.order.proposedAction,
                            paymentConfirmation: detail.paymentConfirmation,
                            createdAt: detail.order.createdAt,
                            salesSummaryExcerpt: detail.order.salesSummaryExcerpt,
                            deliverable: detail.deliverable,
                            assignedDepartment: detail.order.assignedDepartment,
                            service: detail.order.service,
                          })
                        }
                        className="rounded bg-[#00e5ff]/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-950 disabled:opacity-40"
                      >
                        Propose Site Builder draft
                      </button>
                    ) : null}
                    {detail.order.approvalId ? (
                      <button
                        type="button"
                        className="rounded border border-[#00e5ff]/40 px-2 py-1 text-[10px] text-[#00e5ff]"
                        onClick={() => onOpenApproval?.(detail.order.approvalId!)}
                      >
                        Open approval
                      </button>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
