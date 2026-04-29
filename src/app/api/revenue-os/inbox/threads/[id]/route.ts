import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialEngagementAiSuggestions } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { loadEngagementThreadDetail } from "@/lib/social/engagement/upsert-social-engagement";

/**
 * GET /api/revenue-os/inbox/threads/:id
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const req = _req;
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  const d = await loadEngagementThreadDetail(db, { userId: String(userId), threadId: id });
  if (!d) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const sugs = await db
    .select()
    .from(socialEngagementAiSuggestions)
    .where(eq(socialEngagementAiSuggestions.threadId, id))
    .orderBy(desc(socialEngagementAiSuggestions.createdAt))
    .limit(5);
  return NextResponse.json({ ...d, suggestions: sugs });
}
