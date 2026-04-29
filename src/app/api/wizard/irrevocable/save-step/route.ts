import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { wizardSessions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import {
  StepStateSchema,
  StepPartiesSchema,
  StepTrustTermsSchema,
  StepDistributionsSchema,
  StepPowersSchema,
  StepFundingSchema,
  StepReviewSchema,
} from "@/lib/irrevocableTrust/schema";

const StepSchemas: Record<string, any> = {
  state: StepStateSchema,
  parties: StepPartiesSchema,
  terms: StepTrustTermsSchema,
  distributions: StepDistributionsSchema,
  powers: StepPowersSchema,
  funding: StepFundingSchema,
  review: StepReviewSchema,
};

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { sessionId, stepKey, stepData, nextStep } = body as {
      sessionId: string;
      stepKey: string;
      stepData: unknown;
      nextStep?: string;
    };

    const schema = StepSchemas[stepKey];
    if (!schema) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_STEP", message: `Unknown step: ${stepKey}` } },
        { status: 400 }
      );
    }

    const parsed = schema.safeParse(stepData);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: { code: "VALIDATION", message: "Step validation failed", details: parsed.error.flatten() } },
        { status: 422 }
      );
    }

    const db = await getDb();
    const sessionRows = await db
      .select()
      .from(wizardSessions)
      .where(and(eq(wizardSessions.id, sessionId), eq(wizardSessions.userId, userId)))
      .limit(1);

    if (sessionRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
    }

    const session = sessionRows[0];
    if (session.status === "LOCKED" || session.status === "GENERATED") {
      return NextResponse.json({ ok: false, error: { code: "LOCKED", message: "Session is locked" } }, { status: 409 });
    }

    const currentData = JSON.parse(session.dataJson || "{}");
    const merged = {
      ...currentData,
      [stepKey]: parsed.data,
    };

    const newStatus = stepKey === "review" ? "REVIEW" : session.status;

    const updated = await db
      .update(wizardSessions)
      .set({
        dataJson: JSON.stringify(merged),
        currentStep: nextStep ?? session.currentStep,
        status: newStatus,
      })
      .where(eq(wizardSessions.id, sessionId));

    // Fetch updated session
    const updatedRows = await db
      .select()
      .from(wizardSessions)
      .where(eq(wizardSessions.id, sessionId))
      .limit(1);

    return NextResponse.json({ ok: true, session: updatedRows[0] });
  } catch (error: any) {
    console.error("Save step error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to save step" } },
      { status: 500 }
    );
  }
}
