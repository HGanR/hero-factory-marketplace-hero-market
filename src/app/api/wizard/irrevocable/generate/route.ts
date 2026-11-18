import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { wizardSessions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { IrrevocableTrustWizardSchema } from "@/lib/irrevocableTrust/schema";

/**
 * Do not report a trust instrument as generated until a real document
 * has been assembled, stored, and made available through authorized access.
 * The previous implementation saved only a JSON storage-key placeholder
 * and permanently locked the session.
 */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: { code: "INVALID_REQUEST", message: "Session ID is required" } }, { status: 400 });
    }

    const db = await getDb();
    const rows = await db.select().from(wizardSessions)
      .where(and(eq(wizardSessions.id, sessionId), eq(wizardSessions.userId, userId)))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
    }

    const session = rows[0];
    if (session.status === "LOCKED" || session.status === "GENERATED") {
      return NextResponse.json({ ok: false, error: { code: "ALREADY_GENERATED", message: "This session is locked; contact support for review" } }, { status: 409 });
    }

    const parsed = IrrevocableTrustWizardSchema.safeParse(JSON.parse(session.dataJson || "{}"));
    if (!parsed.success) {
      return NextResponse.json({
        ok: false,
        error: { code: "VALIDATION", message: "Complete the required wizard fields before document assembly", details: parsed.error.flatten() },
      }, { status: 422 });
    }

    return NextResponse.json({
      ok: false,
      error: {
        code: "DOCUMENT_ENGINE_PENDING",
        message: "Your wizard data is valid, but the full trust declaration generator is not yet connected. Your session remains editable. No trust instrument has been issued or approved.",
      },
    }, { status: 501 });
  } catch (error) {
    console.error("Trust instrument generation failed", error);
    return NextResponse.json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Unable to process the document request" } }, { status: 500 });
  }
}
