import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { challengeSubmissions, challengeCredits } from "@/lib/db/schema.challenge";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const userId = String(requireUserId(req));
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json(
        { error: "Missing id query parameter" },
        { status: 400 }
      );
    }

    const db = await getDb();

    const rows = await db
      .select({
        submissionId: challengeSubmissions.submissionId,
        userId: challengeSubmissions.userId,
        challengeKey: challengeSubmissions.challengeKey,
        status: challengeSubmissions.status,
        answers: challengeSubmissions.answers,
        totalScore: challengeSubmissions.totalScore,
        phaseScores: challengeSubmissions.phaseScores,
        submissionHash: challengeSubmissions.submissionHash,
        createdAt: challengeSubmissions.createdAt,
        updatedAt: challengeSubmissions.updatedAt,
      })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.submissionId, id))
      .limit(1);

    if (!rows.length) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    const row = rows[0];
    if (row.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const credits = await db
      .select({
        creditType: challengeCredits.creditType,
        amount: challengeCredits.amount,
        appliedAt: challengeCredits.appliedAt,
      })
      .from(challengeCredits)
      .where(eq(challengeCredits.submissionId, id));

    return NextResponse.json({
      submissionId: row.submissionId,
      status: row.status,
      answers: row.answers,
      totalScore: row.totalScore,
      phaseScores: row.phaseScores,
      submissionHash: row.submissionHash,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      credits,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[challenge/submission]", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
