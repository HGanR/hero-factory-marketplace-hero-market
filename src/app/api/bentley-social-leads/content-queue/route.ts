import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4J — List / create content queue items (draft → ready → posted).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyContentQueueItems } from "@/lib/db/schema.bentley-social-leads";

export const runtime = "nodejs";

const STATUSES = new Set(["draft", "ready", "posted"]);

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("queueStatus")?.trim();
  const limit = Math.min(120, Math.max(1, parseInt(url.searchParams.get("limit") ?? "80", 10) || 80));

  const db = await getDb();
  const where =
    status && STATUSES.has(status)
      ? and(eq(bentleyContentQueueItems.userId, userId), eq(bentleyContentQueueItems.queueStatus, status))
      : eq(bentleyContentQueueItems.userId, userId);

  const rows = await db
    .select()
    .from(bentleyContentQueueItems)
    .where(where)
    .orderBy(desc(bentleyContentQueueItems.updatedAt))
    .limit(limit);

  return NextResponse.json({ items: rows });
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    payloadJson?: Record<string, unknown>;
    queueStatus?: string;
    platformFormat?: string;
    generationVariantId?: string | null;
    batchId?: string | null;
    variationIndex?: number | null;
  };

  const payloadJson =
    body.payloadJson && typeof body.payloadJson === "object" ? body.payloadJson : null;
  if (!payloadJson) {
    return NextResponse.json({ error: "payloadJson is required" }, { status: 400 });
  }

  const qs = String(body.queueStatus ?? "draft").trim();
  const queueStatus = STATUSES.has(qs) ? qs : "draft";

  const id = randomUUID();
  const db = await getDb();
  await db.insert(bentleyContentQueueItems).values({
    id,
    userId,
    title: String(body.title ?? "").slice(0, 512),
    payloadJson,
    queueStatus,
    platformFormat: String(body.platformFormat ?? "multi").slice(0, 32),
    generationVariantId: body.generationVariantId?.trim() || null,
    batchId: body.batchId?.trim() || null,
    variationIndex: typeof body.variationIndex === "number" ? body.variationIndex : null,
  });

  const [row] = await db.select().from(bentleyContentQueueItems).where(eq(bentleyContentQueueItems.id, id)).limit(1);
  return NextResponse.json({ item: row });
}
