import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { trademarkProjects } from "@/lib/db/schema";
import { ensureTrademarkTables } from "@/lib/trademark/db";
import { evaluateTrademarkReadiness } from "@/lib/trademark/readiness";
import { TrademarkProjectPayloadSchema, TrademarkProjectUpsertSchema } from "@/lib/trademark/schema";

function parsePayload(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    const normalized = TrademarkProjectPayloadSchema.safeParse(parsed);
    return normalized.success ? normalized.data : TrademarkProjectPayloadSchema.parse({});
  } catch {
    return TrademarkProjectPayloadSchema.parse({});
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const db = await getDb();
    await ensureTrademarkTables(db);
    const [project] = await db
      .select()
      .from(trademarkProjects)
      .where(and(eq(trademarkProjects.id, id), eq(trademarkProjects.userId, userId)))
      .limit(1);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const payload = parsePayload(project.payloadJson);
    const readiness = evaluateTrademarkReadiness(project.markType, payload);
    return NextResponse.json({
      id: project.id,
      title: project.title,
      markType: project.markType,
      status: project.status,
      payload,
      readiness,
      updatedAt: project.updatedAt,
    });
  } catch (error) {
    console.error("trademark-projects/[id] GET failed", error);
    return NextResponse.json({ error: "Failed to load trademark project" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const parsed = TrademarkProjectUpsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const db = await getDb();
    await ensureTrademarkTables(db);
    const [existing] = await db
      .select({ id: trademarkProjects.id })
      .from(trademarkProjects)
      .where(and(eq(trademarkProjects.id, id), eq(trademarkProjects.userId, userId)))
      .limit(1);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const readiness = evaluateTrademarkReadiness(parsed.data.markType, parsed.data.payload);
    await db
      .update(trademarkProjects)
      .set({
        clientId: parsed.data.payload.clientId ? Number(parsed.data.payload.clientId) || null : null,
        workspaceId: parsed.data.payload.workspaceId ? parsed.data.payload.workspaceId.trim() : null,
        title: parsed.data.title.trim(),
        markType: parsed.data.markType,
        status: readiness.filingReady ? "ready" : "draft",
        payloadJson: JSON.stringify(parsed.data.payload),
      })
      .where(and(eq(trademarkProjects.id, id), eq(trademarkProjects.userId, userId)));

    return NextResponse.json({ id, readiness, status: readiness.filingReady ? "ready" : "draft" });
  } catch (error) {
    console.error("trademark-projects/[id] PUT failed", error);
    return NextResponse.json({ error: "Failed to update trademark project" }, { status: 500 });
  }
}
