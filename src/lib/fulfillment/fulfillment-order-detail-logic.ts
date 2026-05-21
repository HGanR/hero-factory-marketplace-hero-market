import type { ClientDeliveryStatus } from "@/lib/fulfillment/fulfillment-client-delivery-dtos";
import type {
  FulfillmentNextActionDto,
  FulfillmentNextAdminAction,
  FulfillmentTimelineEntryDto,
  FulfillmentTimelineEntryKind,
} from "@/lib/fulfillment/fulfillment-order-detail-dtos";
import type { FulfillmentExecutiveApprovalStatus } from "@/lib/fulfillment/fulfillment-queue-dtos";
import { FULFILLMENT_ORDER_SOURCE_CLAUDE_WORKER } from "@/lib/fulfillment/fulfillment-types";

export type OrderEventRow = {
  id: string;
  actorType: string;
  actorId: string | null;
  fromStage: string | null;
  toStage: string;
  payloadJson: string | null;
  createdAt: Date | string;
};

export type ApprovalRowForTimeline = {
  id: string;
  status: FulfillmentExecutiveApprovalStatus;
  proposedAction: string;
  createdAt: Date | string | null;
  executedAt: Date | string | null;
};

const NEXT_ACTION_COPY: Record<FulfillmentNextAdminAction, { title: string; description: string }> = {
  needs_payment_confirmation: {
    title: "Confirm payment",
    description:
      "Verify PayPal manually, then confirm payment on the desk before Claude submits the WEBSITE handoff.",
  },
  ready_for_claude_handoff: {
    title: "Ready for Claude handoff",
    description:
      "Payment is confirmed and unconsumed. Claude worker may POST the WEBSITE fulfillment handoff using this confirmationId.",
  },
  ready_to_propose_site_builder_draft: {
    title: "Propose Site Builder draft",
    description:
      "Handoff is on file. Queue a createSiteBuilderTask executive approval — internal note only, no deploy or send.",
  },
  waiting_on_approval: {
    title: "Waiting on approval",
    description: "Review and approve the pending Site Builder task in the executive approvals queue.",
  },
  draft_created_owner_review: {
    title: "Review Site Builder draft",
    description:
      "Site Builder task is in an internal client note. Preview the draft, then approve for release or request revision — no email or deploy.",
  },
  ready_to_generate_client_delivery: {
    title: "Generate client review link",
    description:
      "Owner draft is approved for release. Create an expiring read-only workspace link and share it manually — no email or SMS.",
  },
  client_delivery_in_progress: {
    title: "Client review in progress",
    description:
      "A delivery workspace link is active. Monitor timeline, regenerate after draft changes, or revoke access.",
  },
  client_delivery_approved: {
    title: "Client approved draft",
    description:
      "The client acknowledged the draft in the review workspace. Owner retains control — no deploy or publish.",
  },
  order_closed: {
    title: "Order closed",
    description: "This WEBSITE fulfillment order is released or closed. No further desk actions in v1.",
  },
  none: {
    title: "No action required",
    description: "Monitor the timeline or refresh the queue for updates.",
  },
};

export function buildNextActionDto(action: FulfillmentNextAdminAction): FulfillmentNextActionDto {
  const copy = NEXT_ACTION_COPY[action];
  return { action, title: copy.title, description: copy.description };
}

export function resolveNextAdminAction(input: {
  pipelineStage: string;
  paymentStatus: "pending" | "confirmed" | "failed";
  paymentConsumed: boolean;
  approvalStatus: FulfillmentExecutiveApprovalStatus;
  hasClaudeHandoffEvent: boolean;
  orderSource: string;
  deliverableLinked?: boolean;
  deliverableReviewStatus?: "pending" | "approved" | "rejected";
  clientDeliveryStatus?: ClientDeliveryStatus;
}): FulfillmentNextAdminAction {
  if (input.pipelineStage === "released" || input.pipelineStage === "closed") {
    return "order_closed";
  }

  if (input.approvalStatus === "pending" || input.approvalStatus === "approved") {
    return "waiting_on_approval";
  }

  if (input.clientDeliveryStatus === "client_approved") {
    return "client_delivery_approved";
  }

  if (input.clientDeliveryStatus === "workspace_active") {
    return "client_delivery_in_progress";
  }

  if (
    input.pipelineStage === "approved_for_release" &&
    input.deliverableReviewStatus === "approved" &&
    (input.clientDeliveryStatus === "not_sent" ||
      input.clientDeliveryStatus === "client_revision_requested" ||
      input.clientDeliveryStatus == null)
  ) {
    return "ready_to_generate_client_delivery";
  }

  if (
    input.deliverableLinked &&
    input.deliverableReviewStatus === "pending" &&
    (input.pipelineStage === "owner_review" || input.approvalStatus === "executed")
  ) {
    return "draft_created_owner_review";
  }

  if (input.approvalStatus === "executed" || input.pipelineStage === "owner_review") {
    return "draft_created_owner_review";
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
    return "ready_to_propose_site_builder_draft";
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

function classifyEventRow(row: OrderEventRow): FulfillmentTimelineEntryKind {
  const payload = parsePayload(row.payloadJson);
  const action = typeof payload?.action === "string" ? payload.action : null;
  if (action === "site_builder_draft_linked") return "site_builder_draft_linked";
  if (action === "deliverable_approved_for_release") return "deliverable_approved_for_release";
  if (action === "deliverable_revision_requested") return "deliverable_revision_requested";
  if (action === "client_delivery_link_generated") return "client_delivery_link_generated";
  if (action === "client_delivery_link_revoked") return "client_delivery_link_revoked";
  if (action === "client_delivery_workspace_viewed") return "client_delivery_workspace_viewed";
  if (action === "client_delivery_client_approved") return "client_delivery_client_approved";
  if (action === "client_delivery_client_revision_requested") {
    return "client_delivery_client_revision_requested";
  }
  if (row.actorType === "claude_worker" && row.toStage === "executive_handoff_received") {
    return "claude_handoff_received";
  }
  if (
    row.toStage === "service_drafting" ||
    payload?.proposedAction === "createSiteBuilderTask" ||
    payload?.deliverableRouting === "site_builder_draft_only"
  ) {
    return "site_builder_draft_proposed";
  }
  return "stage_transition";
}

function labelForKind(kind: FulfillmentTimelineEntryKind, row: OrderEventRow): string {
  switch (kind) {
    case "claude_handoff_received":
      return "Claude handoff received";
    case "site_builder_draft_proposed":
      return "Site Builder draft proposed";
    case "site_builder_draft_linked":
      return "Site Builder draft linked for review";
    case "deliverable_approved_for_release":
      return "Draft approved for release (internal)";
    case "deliverable_revision_requested":
      return "Revision requested";
    case "client_delivery_link_generated":
      return "Client delivery link generated";
    case "client_delivery_link_revoked":
      return "Client delivery links revoked";
    case "client_delivery_workspace_viewed":
      return "Client opened review workspace";
    case "client_delivery_client_approved":
      return "Client approved draft";
    case "client_delivery_client_revision_requested":
      return "Client requested revision";
    case "stage_transition":
      return row.fromStage
        ? `Stage: ${row.fromStage.replace(/_/g, " ")} → ${row.toStage.replace(/_/g, " ")}`
        : `Stage: ${row.toStage.replace(/_/g, " ")}`;
    default:
      return kind.replace(/_/g, " ");
  }
}

export function buildFulfillmentOrderTimeline(input: {
  paymentConfirmedAt: Date | string | null;
  paymentStatus: "pending" | "confirmed" | "failed";
  events: OrderEventRow[];
  approval: ApprovalRowForTimeline | null;
}): FulfillmentTimelineEntryDto[] {
  const entries: FulfillmentTimelineEntryDto[] = [];

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
    const kind = classifyEventRow(row);
    const occurredAt = toIso(row.createdAt);
    if (!occurredAt) continue;
    entries.push({
      id: row.id,
      kind,
      label: labelForKind(kind, row),
      occurredAt,
      actorType: row.actorType,
      detail:
        kind === "site_builder_draft_proposed"
          ? "Queued createSiteBuilderTask approval"
          : kind === "claude_handoff_received"
            ? "WEBSITE / Site Builder intake"
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
          label: "Approval executed (internal note)",
          occurredAt: executed,
          actorType: "admin_human",
          detail: "Site Builder task captured — intake only",
        });
      }
    }
  }

  entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return entries;
}

export function hasClaudeHandoffEvent(events: OrderEventRow[]): boolean {
  return events.some(
    (e) => e.actorType === "claude_worker" && e.toStage === "executive_handoff_received"
  );
}

export function parseRequestedDeliverableSummary(
  json: string | null | undefined
): { type: string; title: string } | null {
  if (!json?.trim()) return null;
  try {
    const v = JSON.parse(json) as { type?: string; title?: string };
    const type = typeof v.type === "string" ? v.type.trim() : "";
    const title = typeof v.title === "string" ? v.title.trim().slice(0, 120) : "";
    if (!type && !title) return null;
    return { type: type || "site_builder_package", title: title || "Site Builder package" };
  } catch {
    return null;
  }
}
