import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { eq } from "drizzle-orm";
import { clientProviderConnections } from "@/lib/db/schema";
import { ensureClientHubTables } from "@/lib/db/client-hub-ensure";
import { encryptToken } from "@/lib/social/encrypt";
import { CONTENT360_PROVIDER_ID } from "@/lib/social/providers/content360/content360-types";
import { toPublicClientProviderConnection } from "@/lib/revenue-os/content360-public";
import { requireOwnedClientId } from "@/lib/revenue-os/content360-route-guards";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const BodySchema = z
  .object({
    clientId: z.string().uuid(),
    accountName: z.string().min(1).max(200),
    externalAccountId: z.string().max(120).optional().nullable(),
    accessToken: z.string().min(1).max(50_000),
    refreshToken: z.string().max(50_000).optional().nullable(),
    metadataJson: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .strict();

/**
 * POST /api/revenue-os/content360/connect
 * Phase 1: client-owner only (see TODO for assigned collaborators).
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

  const id = crypto.randomUUID();
  const accessEnc = encryptToken(parsed.data.accessToken.trim());
  const refreshEnc = parsed.data.refreshToken?.trim() ? encryptToken(parsed.data.refreshToken.trim()) : null;

  await db.insert(clientProviderConnections).values({
    id,
    userId: String(userId),
    clientId: owned.clientId,
    provider: CONTENT360_PROVIDER_ID,
    accountName: parsed.data.accountName.trim(),
    externalAccountId: parsed.data.externalAccountId?.trim() || null,
    accessTokenEnc: accessEnc,
    refreshTokenEnc: refreshEnc,
    connectionStatus: "pending",
    lastVerifiedAt: null,
    metadataJson: parsed.data.metadataJson ?? null,
  });

  const rows = await db.select().from(clientProviderConnections).where(eq(clientProviderConnections.id, id)).limit(1);
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Failed to load new connection" }, { status: 500 });
  }

  return NextResponse.json({
    connection: toPublicClientProviderConnection(row),
    note: "Credentials are stored encrypted server-side and are never returned by this API.",
  });
}
