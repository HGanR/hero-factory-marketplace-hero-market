import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { wizardSessions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { RevocableStepSchemas } from "@/lib/revocableTrust/schema";
import { and, eq } from "drizzle-orm";

const NEXT = ["state", "parties", "terms", "funding", "review"] as const;
export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ ok: false, error: { message: "Sign in to save your draft." } }, { status: 401 });
  try {
    const body = await req.json();
    const step = body.stepKey as keyof typeof RevocableStepSchemas;
    if (!Object.prototype.hasOwnProperty.call(RevocableStepSchemas, step)) return NextResponse.json({ ok: false, error: { message: "Invalid step." } }, { status: 400 });
    const parsed = RevocableStepSchemas[step].safeParse(body.stepData);
    if (!parsed.success) return NextResponse.json({ ok: false, error: { message: "Please complete all required fields.", details: parsed.error.flatten() } }, { status: 422 });
    const db = await getDb();
    const [session] = await db.select().from(wizardSessions).where(and(eq(wizardSessions.id, body.sessionId), eq(wizardSessions.userId, userId), eq(wizardSessions.kind, "REVOCABLE_TRUST"))).limit(1);
    if (!session) return NextResponse.json({ ok: false, error: { message: "Draft not found." } }, { status: 404 });
    if (session.status === "LOCKED" || session.status === "GENERATED") return NextResponse.json({ ok: false, error: { message: "This draft is locked." } }, { status: 409 });
    const data = JSON.parse(session.dataJson || "{}");
    const next = NEXT[Math.min(NEXT.indexOf(step) + 1, NEXT.length - 1)];
    await db.update(wizardSessions).set({ dataJson: JSON.stringify({ ...data, [step]: parsed.data }), currentStep: next, status: step === "review" ? "REVIEW" : "DRAFT" }).where(and(eq(wizardSessions.id, session.id), eq(wizardSessions.userId, userId), eq(wizardSessions.kind, "REVOCABLE_TRUST")));
    return NextResponse.json({ ok: true, nextStep: next });
  } catch (error) {
    console.error("Revocable wizard save failed", error);
    return NextResponse.json({ ok: false, error: { message: "Unable to save your draft. Please try again." } }, { status: 500 });
  }
}
