import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { retryFailedContent360BatchJobs } from "@/lib/revenue-os/content360-batch-actions-server";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const BodySchema = z
  .object({
    clientId: z.string().uuid(),
  })
  .strict();

/**
 * POST /api/revenue-os/content360/batches/:id/retry-failed
 * Requeues failed jobs in the batch only; does not duplicate successful schedules.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: batchId } = await ctx.params;
  if (!batchId) return NextResponse.json({ error: "Missing batch id" }, { status: 400 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join("; ") || "Invalid body" }, { status: 400 });
  }

  const owned = await requireOwnedClientId(userId, parsed.data.clientId);
  if (!owned.ok) return owned.response;

  await ensureClientHubTables();
  const db = await getDb();

  const out = await retryFailedContent360BatchJobs(db, {
    userId,
    clientId: owned.clientId,
    batchId,
  });

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: out.status });
  }

  return NextResponse.json({
    batchId: out.batchId,
    retried: out.retried,
    skipped: out.skipped,
  });
}
