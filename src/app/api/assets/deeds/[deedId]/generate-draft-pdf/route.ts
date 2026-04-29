import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedProperties, deedParties, resolutions, minutes, exhibits } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { assertDeedHasApprovedAuthority } from "@/lib/deeds/gating";
import { sha256Buffer } from "@/lib/files/hash";
import { writeExhibitFile } from "@/lib/files/storage";
import { insertAuditLog } from "@/lib/audit";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";

function runPythonGenerate(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "generate_deed_pdf.py");
    const p = spawn("python3", [scriptPath, inputPath, outputPath], { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));

    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PDF generator failed (code ${code}): ${stderr}`));
    });
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { deedId } = await ctx.params;

    // Gate: resolution+minutes must be approved/locked
    const gate = await assertDeedHasApprovedAuthority(deedId);
    if (!gate.ok) {
      return NextResponse.json(
        { ok: false, error: { code: gate.code, message: gate.message } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const deedRows = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
    if (deedRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Deed not found" } }, { status: 404 });
    }

    const deed = deedRows[0];

    // Enforce "exactly one of trustId/entityId"
    if ((deed.trustId && deed.entityId) || (!deed.trustId && !deed.entityId)) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Deed must have exactly one of trustId or entityId" } },
        { status: 400 }
      );
    }

    // Locking rule: cannot generate PDF for locked deeds
    if (deed.lockedAt) {
      return NextResponse.json(
        { ok: false, error: { code: "LOCKED", message: "Deed is locked and cannot be modified" } },
        { status: 409 }
      );
    }

    // Fetch related data
    const [propertyRows, partyRows, resolutionRows, minutesRows] = await Promise.all([
      deed.propertyId ? db.select().from(deedProperties).where(eq(deedProperties.id, deed.propertyId)).limit(1) : Promise.resolve([]),
      db.select().from(deedParties).where(eq(deedParties.deedId, deedId)),
      deed.approvingResolutionId
        ? db.select().from(resolutions).where(eq(resolutions.id, deed.approvingResolutionId)).limit(1)
        : Promise.resolve([]),
      deed.approvingMinutesId ? db.select().from(minutes).where(eq(minutes.id, deed.approvingMinutesId)).limit(1) : Promise.resolve([]),
    ]);

    const property = propertyRows[0] || null;
    const resolution = resolutionRows[0] || null;
    const minutesRecord = minutesRows[0] || null;

    const contextLabel = deed.trustId ? `Trust ${deed.trustId}` : deed.entityId ? `Entity ${deed.entityId}` : "—";

    const payload = {
      title: "Draft Deed Packet (Not Recordable Form)",
      deedType: deed.deedType,
      contextLabel,
      property: property
        ? {
            street1: property.street1,
            city: property.city,
            state: property.state,
            postalCode: property.postalCode,
            county: property.county,
            parcelNumber: property.parcelNumber,
            legalDescription: property.legalDescription,
          }
        : {},
      parties: partyRows.map((p) => ({
        role: p.role,
        displayName: p.displayName,
        address: p.address,
        capacityLine: p.capacityLine,
      })),
      approval: {
        resolutionId: resolution?.id,
        resolutionTitle: resolution?.title,
        minutesId: minutesRecord?.id,
      },
    };

    // Temp files
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "deedpdf-"));
    const inputJson = path.join(tmpDir, "payload.json");
    const outputPdf = path.join(tmpDir, "deed.pdf");

    await fs.writeFile(inputJson, JSON.stringify(payload, null, 2), "utf-8");

    // Generate PDF via ReportLab script
    try {
      await runPythonGenerate(inputJson, outputPdf);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "Failed to generate deed PDF" } },
        { status: 500 }
      );
    }

    const pdfBytes = await fs.readFile(outputPdf);
    const fileHash = sha256Buffer(pdfBytes);

    // Store PDF and create Exhibit
    const stored = await writeExhibitFile({ fileHash, ext: "pdf", bytes: pdfBytes });

    const exhibitId = uuidv4();
    await db.insert(exhibits).values({
      id: exhibitId,
      minutesId: deed.approvingMinutesId || null,
      resolutionId: deed.approvingResolutionId || null,
      fileName: stored.fileName,
      fileType: "application/pdf",
      storagePath: stored.storagePath,
      hash: fileHash,
      uploadedBy: userId,
      uploadedAt: new Date(),
    });

    await db
      .update(deeds)
      .set({
        draftPdfExhibitId: exhibitId,
        status: deed.status === "draft" ? "approved" : deed.status,
      })
      .where(eq(deeds.id, deedId));

    // Audit log
    await insertAuditLog(db, {
      actorUserId: userId,
      action: "GENERATE_DRAFT_PDF",
      entityType: "deed",
      entityId: deedId,
      metadata: {
        draftPdfExhibitId: exhibitId,
        fileHash,
      },
    });

    // Cleanup temp files
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }

    return NextResponse.json({ ok: true, draftPdfExhibitId: exhibitId });
  } catch (error: any) {
    console.error("Generate draft PDF error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to generate draft PDF" } },
      { status: 500 }
    );
  }
}
