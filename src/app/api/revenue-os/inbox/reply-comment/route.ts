import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { inboxReplyToThreadComment } from "@/lib/social/engagement/inbox-actions";

const Body = z.object({
  threadId: z.string().uuid(),
  messageId: z.string().min(1).optional().nullable(),
  socialAccountId: z.string().min(1),
  replyText: z.string().min(1).max(8000),
});

/**
 * POST /api/revenue-os/inbox/reply-comment
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
  const r = await inboxReplyToThreadComment(db, { userId: String(userId), ...parsed.data, messageId: parsed.data.messageId ?? null });
  if (r.ok) {
    return NextResponse.json({
      ok: true,
      platformReplyId: r.platformReplyId,
      threadStatus: r.threadStatus,
      heldForApproval: r.heldForApproval === true,
    });
  }
  if ("status" in r && r.status) {
    return NextResponse.json({ error: "error" in r ? r.error : "failed" }, { status: r.status });
  }
  return NextResponse.json({
    ok: false,
    requiresManual: r.requiresManual,
    reason: r.reason,
    canReply: r.canReply,
  });
}
