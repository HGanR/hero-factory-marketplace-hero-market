import type { ExecutiveOperationalThreadKind } from "@/lib/executive-agent/executive-conversation-threads";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type FulfillmentThreadLinkInput = {
  orderId: string;
  clientId?: string | null;
  department: FulfillmentOrchestrationDepartment;
  subjectId?: string | null;
  stageLabel?: string | null;
};

export function fulfillmentCaseThreadKind(): ExecutiveOperationalThreadKind {
  return "fulfillment_case";
}

export function buildFulfillmentCaseThreadTitle(input: FulfillmentThreadLinkInput): string {
  const short = input.orderId.length > 10 ? `${input.orderId.slice(0, 8)}…` : input.orderId;
  const stage = input.stageLabel?.trim();
  if (stage) return `${input.department} case ${short} — ${stage}`;
  return `${input.department} fulfillment case ${short}`;
}

export function fulfillmentThreadSubjectId(
  department: FulfillmentOrchestrationDepartment
): "site_builder" | "trust_jarva" {
  return department === "WEBSITE" ? "site_builder" : "trust_jarva";
}

export function fulfillmentThreadLinkKey(orderId: string): string {
  return `fulfillment_case:${orderId.trim()}`;
}

export function parseFulfillmentThreadLinkKey(
  key: string
): { orderId: string } | null {
  const m = /^fulfillment_case:(.+)$/.exec(key.trim());
  if (!m?.[1]) return null;
  return { orderId: m[1] };
}
