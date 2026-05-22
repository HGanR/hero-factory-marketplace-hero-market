import type { ClaudeHandoffResult } from "@/lib/fulfillment/claude-handoff-service";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export type ClaudeFulfillmentHandoffPrimary =
  | typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE
  | typeof FULFILLMENT_PRIMARY_SERVICE_TRUST
  | typeof FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS
  | null;

export function detectClaudeFulfillmentHandoffPrimary(body: unknown): ClaudeFulfillmentHandoffPrimary {
  if (!body || typeof body !== "object") return null;
  const primary = (body as { service?: { primary?: string } }).service?.primary;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) return FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_TRUST) return FULFILLMENT_PRIMARY_SERVICE_TRUST;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) return FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS;
  return null;
}

/** REVENUE_OS uses executive-desk intake only — not Claude worker handoff. */
export function revenueOsDeskOnlyHandoffResult(): ClaudeHandoffResult {
  return {
    ok: false,
    httpStatus: 400,
    code: "revenue_os_desk_only",
    message:
      "REVENUE_OS fulfillment uses governed executive-desk intake — not Claude worker handoff. Preserve WEBSITE/TRUST isolation; link campaign via executive order handoff.",
  };
}
