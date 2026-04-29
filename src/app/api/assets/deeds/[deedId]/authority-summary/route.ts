import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedProperties, deedParties, deedExecutions, deedRecordings, exhibits, resolutions, minutes } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import { writeExhibitFile } from "@/lib/files/storage";
import { sha256Buffer } from "@/lib/files/hash";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";

function runPythonGenerate(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "generate_authority_summary_pdf.py");
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

    const db = await getDb();

    const deedRows = await db.select().from(deeds).where(eq(deeds.id, deedId)).limit(1);
    if (deedRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Deed not found" } }, { status: 404 });
    }

    const deed = deedRows[0];

    // Fetch all related data
    const [propertyRows, partyRows, executionRows, recordingRows, resolutionRows, minutesRows] = await Promise.all([
      deed.propertyId ? db.select().from(deedProperties).where(eq(deedProperties.id, deed.propertyId)).limit(1) : Promise.resolve([]),
      db.select().from(deedParties).where(eq(deedParties.deedId, deedId)),
      deed.executionId ? db.select().from(deedExecutions).where(eq(deedExecutions.id, deed.executionId)).limit(1) : Promise.resolve([]),
      deed.recordingId ? db.select().from(deedRecordings).where(eq(deedRecordings.id, deed.recordingId)).limit(1) : Promise.resolve([]),
      deed.approvingResolutionId
        ? db.select().from(resolutions).where(eq(resolutions.id, deed.approvingResolutionId)).limit(1)
        : Promise.resolve([]),
      deed.approvingMinutesId ? db.select().from(minutes).where(eq(minutes.id, deed.approvingMinutesId)).limit(1) : Promise.resolve([]),
    ]);

    const property = propertyRows[0] || null;
    const execution = executionRows[0] || null;
    const recording = recordingRows[0] || null;
    const resolution = resolutionRows[0] || null;
    const minutesRecord = minutesRows[0] || null;

    // Fetch exhibits
    const exhibitIds = [
      deed.draftPdfExhibitId,
      deed.executedPdfExhibitId,
      recording?.recordingReceiptExhibitId,
    ].filter(Boolean) as string[];
    const exhibitRows = exhibitIds.length > 0
      ? await Promise.all(exhibitIds.map((id) => db.select().from(exhibits).where(eq(exhibits.id, id)).limit(1)))
      : [];

    const payload = {
      title: "Deed Authority Summary",
      generatedAt: new Date().toISOString(),
      deed: {
        id: deed.id,
        deedType: deed.deedType,
        status: deed.status,
        createdAt: deed.createdAt,
        finalHash: deed.finalHash,
        lockedAt: deed.lockedAt,
      },
      property: property
        ? {
            street1: property.street1,
            city: property.city,
            state: property.state,
            county: property.county,
            parcelNumber: property.parcelNumber,
          }
        : null,
      parties: partyRows.map((p) => ({
        role: p.role,
        displayName: p.displayName,
        capacityLine: p.capacityLine,
      })),
      execution: execution
        ? {
            method: execution.method,
            signDate: execution.signDate,
            notarized: execution.notarized,
            notaryName: execution.notaryName,
            notaryState: execution.notaryState,
          }
        : null,
      recording: recording
        ? {
            status: recording.status,
            instrumentNumber: recording.instrumentNumber,
            recordedAt: recording.recordedAt,
            county: recording.county,
            state: recording.state,
          }
        : null,
      approval: {
        resolution: resolution
          ? {
              id: resolution.id,
              title: resolution.title,
              resolutionType: resolution.resolutionType,
              effectiveDate: resolution.effectiveDate,
            }
          : null,
        minutes: minutesRecord
          ? {
              id: minutesRecord.id,
              title: minutesRecord.title,
              actionDate: minutesRecord.actionDate,
              status: minutesRecord.status,
            }
          : null,
      },
      exhibits: exhibitRows.map((e) => e[0]).filter(Boolean).map((ex) => ({
        fileName: ex.fileName,
        hash: ex.hash,
        fileType: ex.fileType,
      })),
    };

    // Temp files
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "authsum-"));
    const inputJson = path.join(tmpDir, "payload.json");
    const outputPdf = path.join(tmpDir, "authority_summary.pdf");

    await fs.writeFile(inputJson, JSON.stringify(payload, null, 2), "utf-8");

    // Generate PDF via ReportLab script
    try {
      await runPythonGenerate(inputJson, outputPdf);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "Failed to generate authority summary PDF" } },
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

    // Cleanup temp files
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }

    return NextResponse.json({ ok: true, exhibitId, fileName: stored.fileName });
  } catch (error: any) {
    console.error("Generate authority summary error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to generate authority summary" } },
      { status: 500 }
    );
  }
}
