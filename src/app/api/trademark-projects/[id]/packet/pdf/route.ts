import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts } from "pdf-lib";
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

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();
    const left = 56;
    let y = height - 72;

    const line = (text: string, size = 11, bold = false, indent = 0) => {
      const x = left + indent;
      const safe = text.length > 95 ? text.slice(0, 92) + "..." : text;
      page.drawText(safe, { x, y, size, font: bold ? fontBold : font });
      y -= size + 4;
    };

    page.drawText("TRADEMARK FILING PREPARATION PACKET", {
      x: left,
      y,
      size: 16,
      font: fontBold,
    });
    y -= 22;

    line(`Project: ${project.title}`, 12, true);
    line(`Mark Type: ${String(project.markType).toUpperCase()}`, 11);
    line(`Generated: ${new Date().toISOString().slice(0, 19).replace("T", " ")}`, 10);
    line(`Readiness Score: ${readiness.score} • ${readiness.filingReady ? "Filing Ready" : "Needs Work"}`, 10);
    y -= 12;

    page.drawText("1. Owner & Correspondence", { x: left, y, size: 13, font: fontBold });
    y -= 18;
    if (payload.clientId) line(`Client ID: ${payload.clientId}`, 10);
    if (payload.workspaceId) line(`Workspace ID: ${payload.workspaceId}`, 10);
    line(`Owner: ${payload.ownerName || "(not set)"}`, 10);
    line(`Entity Type: ${payload.ownerEntityType || "(not set)"}`, 10);
    line(`Address: ${payload.ownerAddress || "(not set)"}`, 10);
    line(`Jurisdiction: ${payload.jurisdiction || "(not set)"}`, 10);
    line(`Correspondence Email: ${payload.correspondenceEmail || "(not set)"}`, 10);
    if (payload.attorneyName || payload.attorneyEmail) {
      line(`Attorney: ${payload.attorneyName || ""} ${payload.attorneyEmail || ""}`, 10);
    }
    y -= 10;

    page.drawText("2. Mark Representation", { x: left, y, size: 13, font: fontBold });
    y -= 18;
    if (project.markType === "standard" && payload.markText) {
      line(`Standard Character Mark: ${payload.markText}`, 10);
    }
    if (project.markType === "special") {
      if (payload.drawingDescription) line(`Drawing Description: ${payload.drawingDescription}`, 10);
      if (payload.colorClaim) line(`Color Claim: ${payload.colorClaim}`, 10);
    }
    if (project.markType === "sound" && payload.soundDescription) {
      line(`Sound Mark Description: ${payload.soundDescription}`, 10);
    }
    if (payload.disclaimerText) line(`Disclaimer: ${payload.disclaimerText}`, 10);
    if (payload.translationText) line(`Translation: ${payload.translationText}`, 10);
    if (payload.transliterationText) line(`Transliteration: ${payload.transliterationText}`, 10);
    y -= 10;

    page.drawText("3. Filing Basis", { x: left, y, size: 13, font: fontBold });
    y -= 18;
    line(`Basis: ${payload.basis === "use" ? "Use in Commerce (1a)" : payload.basis === "intent" ? "Intent to Use (1b)" : "Other"}`, 10);
    if (payload.basis === "use") {
      if (payload.firstUseDate) line(`First Use Date: ${payload.firstUseDate}`, 10);
      if (payload.firstCommerceDate) line(`First Commerce Date: ${payload.firstCommerceDate}`, 10);
    }
    y -= 10;

    page.drawText("4. Goods/Services", { x: left, y, size: 13, font: fontBold });
    y -= 18;
    if (payload.goodsServices.length === 0) {
      line("(No entries)", 10);
    } else {
      for (const gs of payload.goodsServices) {
        line(`Class ${gs.classNo}: ${gs.description || "(no description)"}`, 10, false, 8);
      }
    }
    y -= 10;

    page.drawText("5. Assets", { x: left, y, size: 13, font: fontBold });
    y -= 18;
    if (payload.assets.length === 0) {
      line("(No assets uploaded)", 10);
    } else {
      for (const a of payload.assets) {
        line(`${a.kind}: ${a.fileName} (SHA256: ${a.sha256.slice(0, 16)}...)`, 9, false, 8);
      }
    }
    y -= 10;

    page.drawText("6. Readiness Check", { x: left, y, size: 13, font: fontBold });
    y -= 18;
    if (readiness.blockers.length > 0) {
      line("Blockers:", 10, true);
      for (const b of readiness.blockers) {
        line(`  • ${b.message}`, 9, false, 8);
      }
    }
    if (readiness.warnings.length > 0) {
      line("Warnings:", 10, true);
      for (const w of readiness.warnings) {
        line(`  • ${w.message}`, 9, false, 8);
      }
    }
    if (readiness.blockers.length === 0 && readiness.warnings.length === 0) {
      line("No blockers or warnings.", 10);
    }
    y -= 16;

    page.drawText(
      "This packet is filing preparation support only. Not legal advice. No guarantee of registrability.",
      { x: left, y, size: 9, font }
    );

    const pdfBytes = await pdfDoc.save();
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="trademark-packet-${project.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("trademark-projects/[id]/packet/pdf GET failed", error);
    return NextResponse.json({ error: "Failed to generate PDF packet" }, { status: 500 });
  }
}
