import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { inboxAcceptSuggestionAsNote, inboxUpdateSuggestionStatus } from "@/lib/social/engagement/inbox-actions";

const Body = z
  .object({
    threadId: z.string().uuid(),
    suggestionId: z.string().uuid(),
    textOverride: z.string().max(8000).optional().nullable(),
    /** When true, only updates suggestion row (no note). */
    statusOnly: z.boolean().optional(),
    /** dismiss without note */
    dismiss: z.boolean().optional(),
  })
  .refine((b) => !(b.dismiss && b.statusOnly), { message: "conflicting flags" });

/**
 * POST /api/revenue-os/inbox/suggestion/accept
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
  if (parsed.data.dismiss) {
    const r = await inboxUpdateSuggestionStatus(db, {
      userId: String(userId),
      threadId: parsed.data.threadId,
      suggestionId: parsed.data.suggestionId,
      status: "dismissed",
    });
    if (r.ok) {
      return NextResponse.json({ ok: true, status: "dismissed" });
    }
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  if (parsed.data.statusOnly) {
    const r = await inboxUpdateSuggestionStatus(db, {
      userId: String(userId),
      threadId: parsed.data.threadId,
      suggestionId: parsed.data.suggestionId,
      status: "accepted",
    });
    if (r.ok) {
      return NextResponse.json({ ok: true, status: "accepted" });
    }
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  const r = await inboxAcceptSuggestionAsNote(db, {
    userId: String(userId),
    threadId: parsed.data.threadId,
    suggestionId: parsed.data.suggestionId,
    textOverride: parsed.data.textOverride ?? null,
  });
  if (r.ok) {
    return NextResponse.json({ ok: true, status: "accepted" });
  }
  return NextResponse.json({ error: r.error }, { status: r.status });
}
