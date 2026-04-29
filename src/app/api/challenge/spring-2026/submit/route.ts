import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { challengeSubmissions, challengeAuditLog } from "@/lib/db/schema.challenge";
import { SubmitPayloadSchema } from "@/lib/challenge/spring2026/zod";
import { computeSpring2026Score, submissionHash, qualifies } from "@/lib/challenge/spring2026/scoring";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const userId = String(requireUserId(req));
    const body = await req.json();
    const parsed = SubmitPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { submissionId, answers } = parsed.data;
    const db = await getDb();

    const existing = await db
      .select({
        id: challengeSubmissions.id,
        userId: challengeSubmissions.userId,
        status: challengeSubmissions.status,
      })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.submissionId, submissionId))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (existing[0].userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (existing[0].status === "submitted") {
      return NextResponse.json({ error: "Already submitted" }, { status: 400 });
    }

    const { total, phaseScores } = computeSpring2026Score(answers);
    const hash = submissionHash(answers, submissionId);

    await db
      .update(challengeSubmissions)
      .set({
        answers: answers as unknown as Record<string, unknown>,
        totalScore: total,
        phaseScores: phaseScores as unknown as Record<string, unknown>,
        submissionHash: hash,
        status: "submitted",
        updatedAt: new Date(),
      })
      .where(eq(challengeSubmissions.submissionId, submissionId));

    await db.insert(challengeAuditLog).values({
      submissionId,
      userId,
      action: "submitted",
      details: JSON.stringify({ totalScore: total, qualifies: qualifies(total) }),
    });

    return NextResponse.json({
      totalScore: total,
      phaseScores,
      qualifies: qualifies(total),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[challenge/submit]", err);
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 });
  }
}
