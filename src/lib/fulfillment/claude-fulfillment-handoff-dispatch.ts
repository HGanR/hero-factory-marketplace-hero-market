import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import type { ClaudeHandoffResult } from "@/lib/fulfillment/claude-handoff-service";
import { submitClaudeFulfillmentHandoff as submitWebsiteHandoff } from "@/lib/fulfillment/claude-handoff-service";
import { submitClaudeTrustFulfillmentHandoff } from "@/lib/fulfillment/claude-handoff-trust-service";
import { ClaudeTrustFulfillmentHandoffBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas-trust";
import { ClaudeFulfillmentHandoffBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas";
import {
  detectClaudeFulfillmentHandoffPrimary,
  revenueOsDeskOnlyHandoffResult,
} from "@/lib/fulfillment/claude-fulfillment-handoff-routing";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";
import type { ClaudeWorkerAuthContext } from "@/lib/workers/claude-worker-auth";

type Db = MySql2Database<typeof schema>;

/**
 * Routes Claude fulfillment handoffs by service.primary — WEBSITE, TRUST, and REVENUE_OS are isolated.
 * REVENUE_OS campaign fulfillment is executive-desk intake only in v1 (no worker auto-routing).
 */
export async function submitClaudeFulfillmentHandoff(
  db: Db,
  input: {
    worker: ClaudeWorkerAuthContext;
    body: unknown;
    idempotencyKey?: string | null;
  }
): Promise<ClaudeHandoffResult> {
  const primary = detectClaudeFulfillmentHandoffPrimary(input.body);
  if (primary === FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS) {
    return revenueOsDeskOnlyHandoffResult();
  }
  if (primary === FULFILLMENT_PRIMARY_SERVICE_TRUST) {
    return submitClaudeTrustFulfillmentHandoff(db, input);
  }
  if (primary === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) {
    return submitWebsiteHandoff(db, input);
  }

  const trustTry = ClaudeTrustFulfillmentHandoffBodySchema.safeParse(input.body);
  const webTry = ClaudeFulfillmentHandoffBodySchema.safeParse(input.body);
  if (trustTry.success && !webTry.success) {
    return {
      ok: false,
      httpStatus: 400,
      code: "invalid_payload",
      message: trustTry.error.issues.map((i) => i.message).join("; "),
    };
  }

  return {
    ok: false,
    httpStatus: 400,
    code: "invalid_payload",
    message: "service.primary must be WEBSITE or TRUST (REVENUE_OS via executive desk only).",
  };
}
