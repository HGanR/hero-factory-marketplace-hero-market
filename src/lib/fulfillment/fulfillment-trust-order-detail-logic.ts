import type {
  TrustFulfillmentNextActionDto,
  TrustFulfillmentNextAdminAction,
  TrustFulfillmentTimelineEntryDto,
  TrustFulfillmentTimelineEntryKind,
} from "@/lib/fulfillment/fulfillment-trust-order-detail-dtos";
import type { FulfillmentExecutiveApprovalStatus } from "@/lib/fulfillment/fulfillment-trust-queue-dtos";
import {
  hasClaudeHandoffEvent,
  parseRequestedDeliverableSummary,
  type OrderEventRow,
} from "@/lib/fulfillment/fulfillment-order-detail-logic";
import { FULFILLMENT_ORDER_SOURCE_CLAUDE_WORKER } from "@/lib/fulfillment/fulfillment-types";

export type { OrderEventRow };

export type ApprovalRowForTrustTimeline = {
  id: string;
  status: FulfillmentExecutiveApprovalStatus;
  proposedAction: string;
  createdAt: Date | string | null;
  executedAt: Date | string | null;
};

const NEXT_ACTION_COPY: Record<TrustFulfillmentNextAdminAction, { title: string; description: string }> = {
  needs_payment_confirmation: {
    title: "Confirm payment",
    description:
      "Verify PayPal manually, then confirm payment on the desk before Claude submits the TRUST handoff.",
  },
  ready_for_claude_handoff: {
    title: "Ready for Claude handoff",
    description:
      "Payment is confirmed and unconsumed. Claude worker may POST the TRUST fulfillment handoff using this confirmationId.",
  },
  ready_to_propose_trust_packet: {
    title: "Propose trust packet",
    description:
      "Handoff is on file. Queue createTrustFulfillmentPacket executive approval — internal legal-review note only.",
  },
  waiting_on_approval: {
    title: "Waiting on approval",
    description: "Review and approve the pending trust packet in the executive approvals queue.",
  },
  trust_packet_owner_review: {
    title: "Review trust packet",
    description:
      "Trust packet is in an internal client note. Preview the packet, then approve for internal release or request revision — no trust apply or client delivery.",
  },
  trust_packet_approved_internal: {
    title: "Packet approved (internal)",
    description:
      "Owner approved the trust packet for internal release. Slice 1 stops here — no Smart Trust apply, execution, or client delivery.",
  },
  order_closed: {
    title: "Order closed",
    description: "This TRUST fulfillment order is released or closed.",
  },
  none: {
    title: "No action required",
    description: "Monitor the timeline or refresh the queue.",
  },
};

export function buildTrustNextActionDto(action: TrustFulfillmentNextAdminAction): TrustFulfillmentNextActionDto {
  const copy = NEXT_ACTION_COPY[action];
  return { action, title: copy.title, description: copy.description };
}

export function resolveTrustNextAdminAction(input: {
  pipelineStage: string;
  paymentStatus: "pending" | "confirmed" | "failed";
  paymentConsumed: boolean;
  approvalStatus: FulfillmentExecutiveApprovalStatus;
  hasClaudeHandoffEvent: boolean;
  orderSource: string;
  deliverableLinked?: boolean;
  deliverableReviewStatus?: "pending" | "approved" | "rejected";
}): TrustFulfillmentNextAdminAction {
  if (input.pipelineStage === "released" || input.pipelineStage === "closed") {
    return "order_closed";
  }

  if (
    input.pipelineStage === "approved_for_release" &&
    input.deliverableReviewStatus === "approved"
  ) {
    return "trust_packet_approved_internal";
  }

  if (input.approvalStatus === "pending" || input.approvalStatus === "approved") {
    return "waiting_on_approval";
  }

  if (
    input.deliverableLinked &&
    input.deliverableReviewStatus === "pending" &&
    (input.pipelineStage === "owner_review" || input.approvalStatus === "executed")
  ) {
    return "trust_packet_owner_review";
  }

  if (input.approvalStatus === "executed" || input.pipelineStage === "owner_review") {
    return "trust_packet_owner_review";
  }

  if (input.paymentStatus !== "confirmed") {
    return "needs_payment_confirmation";
  }

  if (
    !input.paymentConsumed &&
    !input.hasClaudeHandoffEvent &&
    input.orderSource !== FULFILLMENT_ORDER_SOURCE_CLAUDE_WORKER
  ) {
    return "ready_for_claude_handoff";
  }

  if (
    input.paymentConsumed &&
    input.hasClaudeHandoffEvent &&
    (input.approvalStatus === "none" ||
      input.approvalStatus === "rejected" ||
      input.approvalStatus === "failed")
  ) {
    return "ready_to_propose_trust_packet";
  }

  return "none";
}

function toIso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function parsePayload(raw: string | null): Record<string, unknown> | null {
  if (!raw?.trim()) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function classifyTrustEventRow(row: OrderEventRow): TrustFulfillmentTimelineEntryKind {
  const payload = parsePayload(row.payloadJson);
  const action = typeof payload?.action === "string" ? payload.action : null;
  if (action === "trust_packet_linked") return "trust_packet_linked";
  if (action === "trust_packet_approved_for_release") return "trust_packet_approved_for_release";
  if (action === "trust_packet_revision_requested") return "trust_packet_revision_requested";
  if (row.actorType === "claude_worker" && row.toStage === "executive_handoff_received") {
    return "claude_handoff_received";
  }
  if (
    row.toStage === "service_drafting" ||
    payload?.proposedAction === "createTrustFulfillmentPacket" ||
    payload?.deliverableRouting === "trust_packet_only"
  ) {
    return "trust_packet_proposed";
  }
  return "stage_transition";
}

function labelForTrustKind(kind: TrustFulfillmentTimelineEntryKind, row: OrderEventRow): string {
  switch (kind) {
    case "claude_handoff_received":
      return "Claude TRUST handoff received";
    case "trust_packet_proposed":
      return "Trust packet proposed";
    case "trust_packet_linked":
      return "Trust packet linked for owner review";
    case "trust_packet_approved_for_release":
      return "Trust packet approved for internal release";
    case "trust_packet_revision_requested":
      return "Trust packet revision requested";
    case "stage_transition":
      return row.fromStage
        ? `Stage: ${row.fromStage.replace(/_/g, " ")} → ${row.toStage.replace(/_/g, " ")}`
        : `Stage: ${row.toStage.replace(/_/g, " ")}`;
    default:
      return kind.replace(/_/g, " ");
  }
}

export function buildTrustFulfillmentOrderTimeline(input: {
  paymentConfirmedAt: Date | string | null;
  paymentStatus: "pending" | "confirmed" | "failed";
  events: OrderEventRow[];
  approval: ApprovalRowForTrustTimeline | null;
}): TrustFulfillmentTimelineEntryDto[] {
  const entries: TrustFulfillmentTimelineEntryDto[] = [];

  const payIso = toIso(input.paymentConfirmedAt);
  if (input.paymentStatus === "confirmed" && payIso) {
    entries.push({
      id: "timeline-payment-confirmed",
      kind: "payment_confirmed",
      label: "Payment confirmed (manual)",
      occurredAt: payIso,
      actorType: "admin_human",
      detail: "admin_manual desk reconciliation",
    });
  }

  for (const row of input.events) {
    const kind = classifyTrustEventRow(row);
    const occurredAt = toIso(row.createdAt);
    if (!occurredAt) continue;
    entries.push({
      id: row.id,
      kind,
      label: labelForTrustKind(kind, row),
      occurredAt,
      actorType: row.actorType,
      detail:
        kind === "trust_packet_proposed"
          ? "Queued createTrustFulfillmentPacket approval"
          : kind === "claude_handoff_received"
            ? "TRUST / Trust Records intake"
            : null,
    });
  }

  if (input.approval) {
    const created = toIso(input.approval.createdAt);
    if (created) {
      entries.push({
        id: `approval-created-${input.approval.id}`,
        kind: "approval_created",
        label: "Executive approval created",
        occurredAt: created,
        actorType: "admin_human",
        detail: input.approval.proposedAction,
      });
    }
    if (input.approval.status === "executed") {
      const executed = toIso(input.approval.executedAt) ?? created;
      if (executed) {
        entries.push({
          id: `approval-executed-${input.approval.id}`,
          kind: "approval_executed",
          label: "Approval executed (internal legal-review note)",
          occurredAt: executed,
          actorType: "admin_human",
          detail: "Trust packet captured — no apply or trust DB mutation",
        });
      }
    }
  }

  entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return entries;
}

export { hasClaudeHandoffEvent, parseRequestedDeliverableSummary };
