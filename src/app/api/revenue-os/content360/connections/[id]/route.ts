import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { clientProviderConnections } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import {
  countActiveContent360JobsForConnection,
  markContent360JobsDisconnectedForConnection,
} from "@/lib/revenue-os/content360-connection-disconnect";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

/**
 * DELETE /api/revenue-os/content360/connections/:id?clientId=
 */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: connectionId } = await ctx.params;
  if (!connectionId) return NextResponse.json({ error: "Missing connection id" }, { status: 400 });

  const clientId = req.nextUrl.searchParams.get("clientId");
  const owned = await requireOwnedClientId(userId, clientId);
  if (!owned.ok) return owned.response;

  await ensureClientHubTables();
  const db = await getDb();

  const found = await db
    .select({ id: clientProviderConnections.id })
    .from(clientProviderConnections)
    .where(
      and(
        eq(clientProviderConnections.id, connectionId),
        eq(clientProviderConnections.clientId, owned.clientId),
        eq(clientProviderConnections.provider, CONTENT360_PROVIDER_ID)
      )
    )
    .limit(1);

  if (found.length === 0) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const force =
    req.nextUrl.searchParams.get("force") === "1" || req.nextUrl.searchParams.get("force") === "true";
  const activeJobs = await countActiveContent360JobsForConnection(db, {
    clientId: owned.clientId,
    connectionId,
  });
  if (activeJobs > 0 && !force) {
    return NextResponse.json(
      {
        error:
          "This connection has scheduled or queued Content360 publish jobs. Cancel or wait for them to finish, or disconnect with ?force=1 after confirming you accept marking those jobs disconnected.",
        activeJobCount: activeJobs,
        code: "CONTENT360_ACTIVE_JOBS",
      },
      { status: 409 },
    );
  }

  if (activeJobs > 0 && force) {
    await markContent360JobsDisconnectedForConnection(db, {
      clientId: owned.clientId,
      connectionId,
    });
  }

  await db
    .delete(clientProviderConnections)
    .where(
      and(
        eq(clientProviderConnections.id, connectionId),
        eq(clientProviderConnections.clientId, owned.clientId),
        eq(clientProviderConnections.provider, CONTENT360_PROVIDER_ID)
      )
    );

  return NextResponse.json({ ok: true, deletedId: connectionId });
}
