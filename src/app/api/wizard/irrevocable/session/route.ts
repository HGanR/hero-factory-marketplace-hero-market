import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { wizardSessions } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and, desc, or, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const trustId: string | undefined = body.trustId;

    const db = await getDb();

    // Reuse an existing draft session for this user/trustId if present
    const existing = await db
      .select()
      .from(wizardSessions)
      .where(
        and(
          eq(wizardSessions.userId, userId),
          eq(wizardSessions.kind, "IRREVOCABLE_TRUST"),
          trustId ? eq(wizardSessions.trustId, trustId) : isNull(wizardSessions.trustId),
          or(eq(wizardSessions.status, "DRAFT"), eq(wizardSessions.status, "REVIEW"))
        )
      )
      .orderBy(desc(wizardSessions.updatedAt))
      .limit(1);

    let session;
    if (existing.length > 0) {
      session = existing[0];
    } else {
      const sessionId = uuidv4();
      await db.insert(wizardSessions).values({
        id: sessionId,
        userId,
        trustId: trustId ?? null,
        kind: "IRREVOCABLE_TRUST",
        status: "DRAFT",
        currentStep: "state",
        dataJson: "{}",
      });
      // Fetch the created session
      const created = await db
        .select()
        .from(wizardSessions)
        .where(eq(wizardSessions.id, sessionId))
        .limit(1);
      session = created[0];
    }

    return NextResponse.json({ ok: true, sessionId: session.id, session });
  } catch (error: any) {
    console.error("Wizard session creation error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to create session" } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ ok: false, error: { code: "BAD_REQUEST", message: "Missing sessionId" } }, { status: 400 });
    }

    const db = await getDb();
    const session = await db
      .select()
      .from(wizardSessions)
      .where(and(eq(wizardSessions.id, sessionId), eq(wizardSessions.userId, userId)))
      .limit(1);

    if (session.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
    }

    return NextResponse.json({ ok: true, session: session[0] });
  } catch (error: any) {
    console.error("Wizard session fetch error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to fetch session" } },
      { status: 500 }
    );
  }
}
