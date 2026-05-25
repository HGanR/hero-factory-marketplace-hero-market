import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { clientProviderConnections } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { Content360Service } from "@/lib/social/providers/content360/content360-service";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import { toPublicClientProviderConnection } from "@/lib/revenue-os/content360-public";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const BodySchema = z
  .object({
    clientId: z.string().uuid(),
    connectionId: z.string().min(1).max(36),
  })
  .strict();

/**
 * POST /api/revenue-os/content360/verify
 */
export async function POST(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join("; ") || "Invalid body" }, { status: 400 });
  }

  const owned = await requireOwnedClientId(userId, parsed.data.clientId);
  if (!owned.ok) return owned.response;

  await ensureClientHubTables();
  const db = await getDb();
  const rows = await db
    .select()
    .from(clientProviderConnections)
    .where(
      and(
        eq(clientProviderConnections.id, parsed.data.connectionId),
        eq(clientProviderConnections.clientId, owned.clientId),
        eq(clientProviderConnections.provider, CONTENT360_PROVIDER_ID)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const svc = new Content360Service();
  const result = await svc.verifyConnection(row);

  const nextStatus =
    result.skipped === true ? "pending" : result.ok ? "active" : "error";

  await db
    .update(clientProviderConnections)
    .set({
      connectionStatus: nextStatus,
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(clientProviderConnections.id, row.id));

  const fresh = await db.select().from(clientProviderConnections).where(eq(clientProviderConnections.id, row.id)).limit(1);

  return NextResponse.json({
    verify: result,
    connection: fresh[0] ? toPublicClientProviderConnection(fresh[0]) : toPublicClientProviderConnection(row),
  });
}
