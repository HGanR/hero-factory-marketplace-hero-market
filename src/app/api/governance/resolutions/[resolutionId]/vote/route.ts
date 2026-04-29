import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { resolutionVotes, resolutions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest, ctx: { params: Promise<{ resolutionId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { resolutionId } = await ctx.params;
    const body = await req.json();
    const { personId, personName, vote } = body;

    if (!personId || !personName || !vote) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "personId, personName, vote are required" } },
        { status: 400 }
      );
    }

    if (!["for", "against", "abstain"].includes(vote)) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "vote must be 'for', 'against', or 'abstain'" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Check if vote already exists
    const existing = await db
      .select()
      .from(resolutionVotes)
      .where(and(eq(resolutionVotes.resolutionId, resolutionId), eq(resolutionVotes.personId, personId)))
      .limit(1);

    if (existing.length > 0) {
      // Update existing vote
      await db
        .update(resolutionVotes)
        .set({ vote, votedAt: new Date() })
        .where(eq(resolutionVotes.id, existing[0].id));
    } else {
      // Create new vote
      await db.insert(resolutionVotes).values({
        id: uuidv4(),
        resolutionId,
        personId,
        personName,
        vote,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Vote on resolution error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to record vote" } },
      { status: 500 }
    );
  }
}
