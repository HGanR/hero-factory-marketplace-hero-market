import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4J — Update queue item (status, deployment link).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyContentQueueItems } from "@/lib/db/schema.bentley-social-leads";

export const runtime = "nodejs";

const STATUSES = new Set(["draft", "ready", "posted"]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    queueStatus?: string;
    contentDeploymentId?: string | null;
    title?: string;
  };

  const db = await getDb();
  const [row] = await db
    .select()
    .from(bentleyContentQueueItems)
    .where(and(eq(bentleyContentQueueItems.id, id), eq(bentleyContentQueueItems.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  let changed = false;
  if (typeof body.title === "string") {
    patch.title = body.title.slice(0, 512);
    changed = true;
  }
  if (body.queueStatus !== undefined) {
    const qs = String(body.queueStatus).trim();
    if (!STATUSES.has(qs)) return NextResponse.json({ error: "Invalid queueStatus" }, { status: 400 });
    patch.queueStatus = qs;
    changed = true;
  }
  if (body.contentDeploymentId !== undefined) {
    patch.contentDeploymentId = body.contentDeploymentId?.trim() || null;
    changed = true;
  }

  if (!changed) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await db.update(bentleyContentQueueItems).set(patch as never).where(eq(bentleyContentQueueItems.id, id));

  const [next] = await db.select().from(bentleyContentQueueItems).where(eq(bentleyContentQueueItems.id, id)).limit(1);
  return NextResponse.json({ item: next });
}
