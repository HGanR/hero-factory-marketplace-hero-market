import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { inboxAssignThread } from "@/lib/social/engagement/inbox-actions";

const Body = z.object({
  threadId: z.string().uuid(),
  assignedUserId: z.string().min(1).max(64),
  assignedRole: z.string().max(64).optional().nullable(),
});

/**
 * POST /api/revenue-os/inbox/assign
 * Assigns a new row (latest wins for display). Use "self" by passing your `userId` from client or a future `/me` endpoint.
 */
export async function POST(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const db = await getDb();
  const r = await inboxAssignThread(db, {
    userId: String(userId),
    threadId: parsed.data.threadId,
    assignedUserId: parsed.data.assignedUserId,
    assignedRole: parsed.data.assignedRole ?? null,
  });
  if (r.ok) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: r.error }, { status: r.status });
}
