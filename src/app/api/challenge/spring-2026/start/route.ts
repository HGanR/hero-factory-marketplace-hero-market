import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUserId } from "@/lib/auth";
import { ensureChallengeTables } from "@/lib/db/challenge-ensure";
import {
  challengeSubmissions,
  challengeAuditLog,
} from "@/lib/db/schema.challenge";
import {
  CHALLENGE_KEY,
  RULES_VERSION,
  RUBRIC_VERSION,
  SCORING_VERSION,
} from "@/lib/challenge/spring2026/constants";
import { StartPayloadSchema } from "@/lib/challenge/spring2026/zod";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const userId = String(requireUserId(req));
    await ensureChallengeTables();
    const body = await req.json().catch(() => ({}));
    const parsed = StartPayloadSchema.safeParse(body);
    if (!parsed.success || !parsed.data.consented) {
      return NextResponse.json(
        { error: "Consent required to start" },
        { status: 400 }
      );
    }

    const submissionId = crypto.randomBytes(16).toString("hex");
    const db = await getDb();

    await db.insert(challengeSubmissions).values({
      submissionId,
      userId,
      challengeKey: CHALLENGE_KEY,
      rulesVersion: RULES_VERSION,
      rubricVersion: RUBRIC_VERSION,
      scoringVersion: SCORING_VERSION,
      status: "draft",
      answers: null,
    });

    await db.insert(challengeAuditLog).values({
      submissionId,
      userId,
      action: "started",
      details: JSON.stringify({ rulesVersion: RULES_VERSION }),
    });

    return NextResponse.json({ submissionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "Unauthorized") {
      return NextResponse.json(
        { error: "Please log in to continue. Sign in from the home page and try again." },
        { status: 401 }
      );
    }
    console.error("[challenge/start]", err);
    return NextResponse.json(
      { error: "Unable to start challenge. Please try again later." },
      { status: 500 }
    );
  }
}
