import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import {
  challengeSubmissions,
  challengeCredits,
  challengeAuditLog,
} from "@/lib/db/schema.challenge";
import { ApplyCreditPayloadSchema } from "@/lib/challenge/spring2026/zod";
import { qualifies } from "@/lib/challenge/spring2026/scoring";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const userId = String(requireUserId(req));
    const body = await req.json();
    const parsed = ApplyCreditPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { submissionId } = parsed.data;
    const db = await getDb();

    const sub = await db
      .select({
        userId: challengeSubmissions.userId,
        status: challengeSubmissions.status,
        totalScore: challengeSubmissions.totalScore,
      })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.submissionId, submissionId))
      .limit(1);

    if (!sub.length) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (sub[0].userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (sub[0].status !== "submitted") {
      return NextResponse.json(
        { error: "Submission must be submitted first" },
        { status: 400 }
      );
    }

    const score = sub[0].totalScore ?? 0;
    if (!qualifies(score)) {
      return NextResponse.json(
        { error: "Submission does not meet qualifying score" },
        { status: 400 }
      );
    }

    const existingCredit = await db
      .select({ id: challengeCredits.id })
      .from(challengeCredits)
      .where(eq(challengeCredits.submissionId, submissionId))
      .limit(1);

    if (existingCredit.length) {
      return NextResponse.json({
        ok: true,
        alreadyApplied: true,
        message: "Credit already applied",
      });
    }

    await db.insert(challengeCredits).values({
      submissionId,
      userId,
      challengeKey: "spring-entity-build-2026",
      creditType: "platform_credit",
      amount: 1,
    });

    await db.insert(challengeAuditLog).values({
      submissionId,
      userId,
      action: "credit_applied",
      details: JSON.stringify({ creditType: "platform_credit", amount: 1 }),
    });

    return NextResponse.json({
      ok: true,
      alreadyApplied: false,
      message: "Credit applied",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[challenge/apply-credit]", err);
    return NextResponse.json({ error: "Failed to apply credit" }, { status: 500 });
  }
}
