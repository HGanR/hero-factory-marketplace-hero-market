import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import type { ClaudeHandoffResult } from "@/lib/fulfillment/claude-handoff-service";
import { submitClaudeFulfillmentHandoff as submitWebsiteHandoff } from "@/lib/fulfillment/claude-handoff-service";
import { submitClaudeTrustFulfillmentHandoff } from "@/lib/fulfillment/claude-handoff-trust-service";
import { ClaudeTrustFulfillmentHandoffBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas-trust";
import { ClaudeFulfillmentHandoffBodySchema } from "@/lib/fulfillment/fulfillment-payload-schemas";
import { FULFILLMENT_PRIMARY_SERVICE_TRUST, FULFILLMENT_PRIMARY_SERVICE_WEBSITE } from "@/lib/fulfillment/fulfillment-types";
import type { ClaudeWorkerAuthContext } from "@/lib/workers/claude-worker-auth";

type Db = MySql2Database<typeof schema>;

function detectPrimaryService(body: unknown): typeof FULFILLMENT_PRIMARY_SERVICE_WEBSITE | typeof FULFILLMENT_PRIMARY_SERVICE_TRUST | null {
  if (!body || typeof body !== "object") return null;
  const primary = (body as { service?: { primary?: string } }).service?.primary;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_WEBSITE) return FULFILLMENT_PRIMARY_SERVICE_WEBSITE;
  if (primary === FULFILLMENT_PRIMARY_SERVICE_TRUST) return FULFILLMENT_PRIMARY_SERVICE_TRUST;
  return null;
}

/**
 * Routes Claude fulfillment handoffs by service.primary — WEBSITE and TRUST are isolated.
 */
export async function submitClaudeFulfillmentHandoff(
  db: Db,
  input: {
    worker: ClaudeWorkerAuthContext;
    body: unknown;
    idempotencyKey?: string | null;
  }
): Promise<ClaudeHandoffResult> {
  const primary = detectPrimaryService(input.body);
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
    message: "service.primary must be WEBSITE or TRUST.",
  };
}
