import type { ClaudeHandoffResult } from "@/lib/fulfillment/claude-handoff-service";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

export type ClaudeFulfillmentHandoffPrimary =
  | typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE
  | typeof FULFILLMENT_PRIMARY_SERVICE_TRUST
  | typeof FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS
  | typeof FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST
  | null;

export function detectClaudeFulfillmentHandoffPrimary(body: unknown): ClaudeFulfillmentHandoffPrimary {
  if (!body || typeof body !== "object") return null;
  const primary = (body as { service?: { primary?: string } }).service?.primary;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) return FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_TRUST) return FULFILLMENT_PRIMARY_SERVICE_TRUST;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) return FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST) return FULFILLMENT_PRIMARY_SERVICE_SMART_TRUST;
  return null;
}

/** SMART_TRUST uses executive-desk intake only — not Claude worker handoff. */
export function smartTrustDeskOnlyHandoffResult(): ClaudeHandoffResult {
  return {
    ok: false,
    httpStatus: 400,
    code: "smart_trust_desk_only",
    message:
      "SMART_TRUST governance fulfillment uses executive-desk intake — not Claude worker handoff. Preserve TRUST isolation; no autonomous trust execution or legal automation.",
  };
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
