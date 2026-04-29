import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureRevenueOsWorkspaceApisTable } from "@/lib/db/revenue-os-workspace-apis-ensure";
import { revenueOsWorkspaceApis } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";
import { encryptToken } from "@/lib/social/encrypt";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
const CreateSchema = z.object({
  clientId: z.string().optional(),
  trustId: z.string().optional(),
  provider: z.string().min(1).max(64),
  label: z.string().max(120).optional(),
  apiKey: z.string().min(1),
  endpointUrl: z.string().url().max(512).optional().nullable(),
  costAcknowledged: z.literal(true),
});

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await ensureRevenueOsWorkspaceApisTable();
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId")?.trim() || "";
    const trustId = searchParams.get("trustId")?.trim() || "";

    const db = await getDb();
    const rows = await db
      .select({
        id: revenueOsWorkspaceApis.id,
        userId: revenueOsWorkspaceApis.userId,
        clientId: revenueOsWorkspaceApis.clientId,
        trustId: revenueOsWorkspaceApis.trustId,
        provider: revenueOsWorkspaceApis.provider,
        label: revenueOsWorkspaceApis.label,
        endpointUrl: revenueOsWorkspaceApis.endpointUrl,
        costAcknowledgmentAt: revenueOsWorkspaceApis.costAcknowledgmentAt,
        createdAt: revenueOsWorkspaceApis.createdAt,
      })
      .from(revenueOsWorkspaceApis)
      .where(
        and(
          eq(revenueOsWorkspaceApis.userId, String(userId)),
          eq(revenueOsWorkspaceApis.clientId, clientId),
          eq(revenueOsWorkspaceApis.trustId, trustId)
        )
      )
      .orderBy(desc(revenueOsWorkspaceApis.createdAt))
      .limit(50);

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        label: r.label,
        endpointUrl: r.endpointUrl,
        costAcknowledgmentAt: r.costAcknowledgmentAt,
        createdAt: r.createdAt,
        hasApiKey: true, // never expose actual key
      })),
    });
  } catch (e) {
    console.error("[revenue-os/workspace-apis] GET", e);
    return NextResponse.json({ error: "Failed to list workspace APIs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  try {
    const userId = await getAuthedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      const hasCostAck = parsed.error.issues.some((e) => e.path.includes("costAcknowledged"));
      const msg = hasCostAck
        ? "You must acknowledge that all API costs are your responsibility before adding an integration."
        : parsed.error.issues[0]?.message ?? "Invalid request";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const clientId = parsed.data.clientId?.trim() || "";
    const trustId = parsed.data.trustId?.trim() || "";

    await ensureRevenueOsWorkspaceApisTable();
    const db = await getDb();
    const id = crypto.randomUUID();

    await db.insert(revenueOsWorkspaceApis).values({
      id,
      userId: String(userId),
      clientId,
      trustId,
      provider: parsed.data.provider.trim(),
      label: parsed.data.label?.trim() || null,
      apiKeyEnc: encryptToken(parsed.data.apiKey.trim()),
      endpointUrl: parsed.data.endpointUrl?.trim() || null,
      costAcknowledgmentAt: new Date(),
    });

    return NextResponse.json({
      id,
      provider: parsed.data.provider,
      message: "API integration added to this workspace. All usage and costs are your responsibility.",
    });
  } catch (e) {
    console.error("[revenue-os/workspace-apis] POST", e);
    return NextResponse.json({ error: "Failed to add workspace API" }, { status: 500 });
  }
}
