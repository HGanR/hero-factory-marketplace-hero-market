import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { retSessions } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * POST /api/ret/session
 * Body: { draft: object, sessionId?: string } — create or update (owner only).
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const draft = body?.draft;
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";

    if (!draft || typeof draft !== "object") {
      return NextResponse.json({ error: "draft object required" }, { status: 400 });
    }

    const draftJson = JSON.stringify(draft);
    if (draftJson.length > 500_000) {
      return NextResponse.json({ error: "draft too large" }, { status: 400 });
    }

    const db = await getDb();

    if (sessionId) {
      const [existing] = await db
        .select()
        .from(retSessions)
        .where(and(eq(retSessions.id, sessionId), eq(retSessions.userId, userId)))
        .limit(1);

      if (!existing) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      await db.update(retSessions).set({ draftJson }).where(eq(retSessions.id, sessionId));

      return NextResponse.json({ sessionId });
    }

    const id = randomUUID();
    await db.insert(retSessions).values({ id, userId, draftJson });

    return NextResponse.json({ sessionId: id });
  } catch (e) {
    console.error("[api/ret/session POST]", e);
    return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
  }
}

/**
 * GET /api/ret/session?id=...
 * Returns draft for the signed-in owner.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const db = await getDb();
    const [row] = await db
      .select()
      .from(retSessions)
      .where(and(eq(retSessions.id, id), eq(retSessions.userId, userId)))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let draft: unknown;
    try {
      draft = JSON.parse(row.draftJson);
    } catch {
      return NextResponse.json({ error: "Invalid stored draft" }, { status: 500 });
    }

    return NextResponse.json({ sessionId: row.id, draft });
  } catch (e) {
    console.error("[api/ret/session GET]", e);
    return NextResponse.json({ error: "Failed to load session" }, { status: 500 });
  }
}
