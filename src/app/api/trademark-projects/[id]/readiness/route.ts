import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { trademarkProjects } from "@/lib/db/schema";
import { ensureTrademarkTables } from "@/lib/trademark/db";
import { evaluateTrademarkReadiness } from "@/lib/trademark/readiness";
import { TrademarkProjectPayloadSchema } from "@/lib/trademark/schema";

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
      .select({
        id: trademarkProjects.id,
        title: trademarkProjects.title,
        markType: trademarkProjects.markType,
        payloadJson: trademarkProjects.payloadJson,
      })
      .from(trademarkProjects)
      .where(and(eq(trademarkProjects.id, id), eq(trademarkProjects.userId, userId)))
      .limit(1);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const payload = parsePayload(project.payloadJson);
    const readiness = evaluateTrademarkReadiness(project.markType, payload);
    return NextResponse.json({
      projectId: project.id,
      title: project.title,
      markType: project.markType,
      readiness,
    });
  } catch (error) {
    console.error("trademark-projects/[id]/readiness GET failed", error);
    return NextResponse.json({ error: "Failed to evaluate readiness" }, { status: 500 });
  }
}
