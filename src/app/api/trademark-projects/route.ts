import crypto from "crypto";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { trademarkProjects } from "@/lib/db/schema";
import { ensureTrademarkTables } from "@/lib/trademark/db";
import { evaluateTrademarkReadiness } from "@/lib/trademark/readiness";
import { TrademarkProjectPayloadSchema, TrademarkProjectUpsertSchema } from "@/lib/trademark/schema";

function safeParsePayload(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    const normalized = TrademarkProjectPayloadSchema.safeParse(parsed);
    return normalized.success ? normalized.data : TrademarkProjectPayloadSchema.parse({});
  } catch {
    return TrademarkProjectPayloadSchema.parse({});
  }
}

export async function GET() {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await ensureTrademarkTables(db);
    const rows = await db
      .select({
        id: trademarkProjects.id,
        title: trademarkProjects.title,
        markType: trademarkProjects.markType,
        status: trademarkProjects.status,
        payloadJson: trademarkProjects.payloadJson,
        updatedAt: trademarkProjects.updatedAt,
      })
      .from(trademarkProjects)
      .where(eq(trademarkProjects.userId, userId))
      .orderBy(desc(trademarkProjects.updatedAt));

    const projects = rows.map((row) => {
      const payload = safeParsePayload(row.payloadJson);
      const readiness = evaluateTrademarkReadiness(row.markType, payload);
      return {
        id: row.id,
        title: row.title,
        markType: row.markType,
        status: row.status,
        score: readiness.score,
        filingReady: readiness.filingReady,
        updatedAt: row.updatedAt,
      };
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("trademark-projects GET failed", error);
    return NextResponse.json({ error: "Failed to list trademark projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = TrademarkProjectUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const db = await getDb();
    await ensureTrademarkTables(db);
    const readiness = evaluateTrademarkReadiness(parsed.data.markType, parsed.data.payload);

    await db.insert(trademarkProjects).values({
      id,
      userId,
      clientId: parsed.data.payload.clientId ? Number(parsed.data.payload.clientId) || null : null,
      workspaceId: parsed.data.payload.workspaceId ? parsed.data.payload.workspaceId.trim() : null,
      title: parsed.data.title.trim(),
      markType: parsed.data.markType,
      status: readiness.filingReady ? "ready" : "draft",
      payloadJson: JSON.stringify(parsed.data.payload),
    });

    return NextResponse.json({
      id,
      title: parsed.data.title.trim(),
      markType: parsed.data.markType,
      status: readiness.filingReady ? "ready" : "draft",
      readiness,
    });
  } catch (error) {
    console.error("trademark-projects POST failed", error);
    return NextResponse.json({ error: "Failed to create trademark project" }, { status: 500 });
  }
}
