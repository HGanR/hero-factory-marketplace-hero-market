import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialEngagementThreads } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";

const Body = z.object({
  status: z.enum(["new", "triaged", "waiting", "resolved", "manual_only"]),
});

/**
 * PATCH /api/revenue-os/inbox/threads/:id/triage
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const db = await getDb();
  await db
    .update(socialEngagementThreads)
    .set({ status: parsed.data.status, updatedAt: new Date() })
    .where(and(eq(socialEngagementThreads.id, id), eq(socialEngagementThreads.userId, String(userId))));
  return NextResponse.json({ ok: true });
}
