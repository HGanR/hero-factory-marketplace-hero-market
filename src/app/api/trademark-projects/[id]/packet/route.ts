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
      .select()
      .from(trademarkProjects)
      .where(and(eq(trademarkProjects.id, id), eq(trademarkProjects.userId, userId)))
      .limit(1);
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const payload = parsePayload(project.payloadJson);
    const readiness = evaluateTrademarkReadiness(project.markType, payload);

    const packet = {
      packetType: "trademark-filing-prep",
      generatedAt: new Date().toISOString(),
      project: {
        id: project.id,
        title: project.title,
        markType: project.markType,
        status: project.status,
      },
      owner: {
        clientId: payload.clientId,
        workspaceId: payload.workspaceId,
        ownerName: payload.ownerName,
        ownerEntityType: payload.ownerEntityType,
        ownerAddress: payload.ownerAddress,
        jurisdiction: payload.jurisdiction,
        correspondenceEmail: payload.correspondenceEmail,
        attorneyName: payload.attorneyName,
        attorneyEmail: payload.attorneyEmail,
      },
      mark: {
        markText: payload.markText,
        drawingDescription: payload.drawingDescription,
        colorClaim: payload.colorClaim,
        disclaimerText: payload.disclaimerText,
        translationText: payload.translationText,
        transliterationText: payload.transliterationText,
        soundDescription: payload.soundDescription,
      },
      filing: {
        basis: payload.basis,
        firstUseDate: payload.firstUseDate,
        firstCommerceDate: payload.firstCommerceDate,
      },
      goodsServices: payload.goodsServices,
      assets: payload.assets.map((asset) => ({
        ...asset,
        hashAlgorithm: "sha256",
      })),
      readiness,
      disclaimer:
        "This packet is filing preparation support and not legal advice or guaranteed registrability.",
    };

    return NextResponse.json(packet, {
      headers: {
        "Content-Disposition": `attachment; filename="trademark-packet-${project.id}.json"`,
      },
    });
  } catch (error) {
    console.error("trademark-projects/[id]/packet GET failed", error);
    return NextResponse.json({ error: "Failed to generate packet" }, { status: 500 });
  }
}
