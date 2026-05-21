import type {
  ClientFulfillmentOrderSnapshot,
  UnifiedTimelineEntry,
  UnifiedTimelineEntryKind,
} from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export type RawOrderEventForTimeline = {
  id: string;
  orderId: string;
  primaryService: string;
  actorType: string;
  fromStage: string | null;
  toStage: string;
  payloadJson: string | null;
  createdAt: Date | string;
};

export type RawPaymentForTimeline = {
  id: string;
  status: "pending" | "confirmed" | "failed";
  confirmedAt: Date | string | null;
  consumedAt: Date | string | null;
  orderId: string | null;
};

function toIso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function departmentFromService(primary: string): typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE | typeof FULFILLMENT_PRIMARY_SERVICE_TRUST | null {
  if (primary === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) return FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_TRUST) return FULFILLMENT_PRIMARY_SERVICE_TRUST;
  return null;
}

function classifyEvent(row: RawOrderEventForTimeline): UnifiedTimelineEntryKind {
  if (row.actorType === "claude_worker" && row.toStage === "executive_handoff_received") {
    return "claude_handoff";
  }
  const payload = row.payloadJson?.trim();
  if (payload) {
    try {
      const p = JSON.parse(payload) as Record<string, unknown>;
      const action = typeof p.action === "string" ? p.action : "";
      if (action.includes("approved_for_release") || action.includes("packet_approved")) {
        return "deliverable_review";
      }
      if (action.includes("revision")) return "deliverable_review";
      if (action.includes("client_delivery")) return "client_delivery";
    } catch {
      /* ignore */
    }
  }
  return "stage_transition";
}

function labelForEvent(row: RawOrderEventForTimeline, kind: UnifiedTimelineEntryKind): string {
  const dept = departmentFromService(row.primaryService);
  const prefix = dept ? `[${dept}] ` : "";
  switch (kind) {
    case "claude_handoff":
      return `${prefix}Claude handoff received`;
    case "deliverable_review":
      return `${prefix}Deliverable review event`;
    case "client_delivery":
      return `${prefix}Client delivery event`;
    case "stage_transition":
      return row.fromStage
        ? `${prefix}Stage ${row.fromStage.replace(/_/g, " ")} → ${row.toStage.replace(/_/g, " ")}`
        : `${prefix}Stage ${row.toStage.replace(/_/g, " ")}`;
    default:
      return `${prefix}Fulfillment event`;
  }
}

/**
 * Merges payment + multi-department order events into one chronological client timeline.
 */
export function buildUnifiedClientTimeline(input: {
  payments: RawPaymentForTimeline[];
  events: RawOrderEventForTimeline[];
  approvalMarkers?: Array<{
    id: string;
    orderId: string;
    primaryService: string;
    status: string;
    proposedAction: string;
    createdAt: Date | string | null;
    executedAt: Date | string | null;
  }>;
}): UnifiedTimelineEntry[] {
  const entries: UnifiedTimelineEntry[] = [];

  for (const pay of input.payments) {
    const confirmed = toIso(pay.confirmedAt);
    if (pay.status === "confirmed" && confirmed) {
      entries.push({
        id: `pay-confirmed:${pay.id}`,
        kind: "payment_confirmed",
        label: "Payment confirmed (manual desk)",
        occurredAt: confirmed,
        department: null,
        orderId: pay.orderId,
        detail: "admin_manual reconciliation",
      });
    }
    const consumed = toIso(pay.consumedAt);
    if (consumed) {
      entries.push({
        id: `pay-consumed:${pay.id}`,
        kind: "payment_consumed",
        label: "Payment consumed for fulfillment handoff",
        occurredAt: consumed,
        department: null,
        orderId: pay.orderId,
        detail: null,
      });
    }
  }

  for (const row of input.events) {
    const occurredAt = toIso(row.createdAt);
    if (!occurredAt) continue;
    const kind = classifyEvent(row);
    entries.push({
      id: row.id,
      kind,
      label: labelForEvent(row, kind),
      occurredAt,
      department: departmentFromService(row.primaryService),
      orderId: row.orderId,
      detail: null,
    });
  }

  for (const a of input.approvalMarkers ?? []) {
    const created = toIso(a.createdAt);
    if (created) {
      entries.push({
        id: `approval-created:${a.id}`,
        kind: "approval_pending",
        label: `[${departmentFromService(a.primaryService) ?? "?"}] Executive approval queued`,
        occurredAt: created,
        department: departmentFromService(a.primaryService),
        orderId: a.orderId,
        detail: a.proposedAction,
      });
    }
    if (a.status === "executed") {
      const executed = toIso(a.executedAt) ?? created;
      if (executed) {
        entries.push({
          id: `approval-executed:${a.id}`,
          kind: "approval_executed",
          label: `[${departmentFromService(a.primaryService) ?? "?"}] Approval executed (internal note only)`,
          occurredAt: executed,
          department: departmentFromService(a.primaryService),
          orderId: a.orderId,
          detail: a.proposedAction,
        });
      }
    }
  }

  entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  return entries;
}

export function summarizeTimelineForSkipper(timeline: UnifiedTimelineEntry[]): string {
  if (!timeline.length) return "No fulfillment timeline events on file for this client.";
  const recent = timeline.slice(-8);
  return recent.map((e) => `${e.label} (${e.occurredAt.slice(0, 10)})`).join(" · ");
}
