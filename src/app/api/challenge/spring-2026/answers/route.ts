import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { challengeSubmissions, challengeAuditLog } from "@/lib/db/schema.challenge";
import { SaveAnswersPayloadSchema } from "@/lib/challenge/spring2026/zod";
import { eq } from "drizzle-orm";

export async function PUT(req: NextRequest) {
  try {
    const userId = String(requireUserId(req));
    const body = await req.json();
    const parsed = SaveAnswersPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { submissionId, answers } = parsed.data;
    const db = await getDb();

    const existing = await db
      .select({ id: challengeSubmissions.id, userId: challengeSubmissions.userId })
      .from(challengeSubmissions)
      .where(eq(challengeSubmissions.submissionId, submissionId))
      .limit(1);

    if (!existing.length) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }
    if (existing[0].userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(challengeSubmissions)
      .set({
        answers: answers as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(challengeSubmissions.submissionId, submissionId));

    await db.insert(challengeAuditLog).values({
      submissionId,
      userId,
      action: "draft_saved",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[challenge/answers]", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
