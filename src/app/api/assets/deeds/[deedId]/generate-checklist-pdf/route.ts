import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deeds, deedProperties, deedParties } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { getTransferToolAvailability } from "@/lib/deeds/transfer-tools";
import archiver from "archiver";

function runPythonGenerate(scriptName: string, inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const localScript = path.resolve(process.cwd(), "scripts", scriptName);
    const repoScript = path.resolve(process.cwd(), "..", "scripts", scriptName);
    const scriptPath = fsSync.existsSync(localScript) ? localScript : repoScript;
    const p = spawn("python3", [scriptPath, inputPath, outputPath], { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));

    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PDF generator failed (code ${code}): ${stderr}`));
    });
  });
}

async function handleGenerate(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
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
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "zip").toLowerCase();

    const [propertyRows, partyRows] = await Promise.all([
      deed.propertyId ? db.select().from(deedProperties).where(eq(deedProperties.id, deed.propertyId)).limit(1) : Promise.resolve([]),
      db.select().from(deedParties).where(eq(deedParties.deedId, deedId)),
    ]);

    const property = propertyRows[0] || null;
    const availability = getTransferToolAvailability(property?.state || "");

    const checklist = [
      "Confirm deed type fits state law and intended transfer.",
      "Verify current vesting and grantor names match title.",
      "Confirm legal description from prior deed or recorder.",
      "Check lender/title/HOA requirements and obtain consent if needed.",
      "Confirm notary and witness requirements for the county/state.",
      "Prepare transfer tax exemption or consideration statement if applicable.",
      "Route for internal approval and execution packet.",
    ];

    const recordingInstructions = [
      "Execute deed with required notarization/witnesses.",
      "Record with county recorder where property is located.",
      "Obtain stamped copy and store in the trust records.",
      "Notify insurer and update property records as required.",
    ];
    if (availability.rules.recorderDirectoryUrl) {
      recordingInstructions.push(`Recorder directory: ${availability.rules.recorderDirectoryUrl}`);
    }

    const citations = [
      ...(availability.rules.todDeed.citations ?? []),
      ...(availability.rules.ladyBirdDeed.citations ?? []),
    ];

    const payload = {
      title: "Deed Prep Checklist + Recording Instructions",
      deedType: deed.deedType,
      state: property?.state || "",
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
      })),
      checklist,
      recordingInstructions,
      citations,
    };

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "deed-checklist-"));
    const inputJson = path.join(tmpDir, "payload.json");
    const checklistPdf = path.join(tmpDir, "checklist.pdf");
    const coverPdf = path.join(tmpDir, "recording-cover-sheet.pdf");

    await fs.writeFile(inputJson, JSON.stringify(payload, null, 2), "utf-8");

    try {
      await runPythonGenerate("generate_deed_checklist_pdf.py", inputJson, checklistPdf);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "Failed to generate checklist PDF" } },
        { status: 500 }
      );
    }

    const coverPayload = {
      title: "Recording Cover Sheet (Draft)",
      deedType: deed.deedType,
      preparedFor: deed.trustId ? `Trust ${deed.trustId}` : deed.entityId ? `Entity ${deed.entityId}` : "",
      returnTo: partyRows.find((p) => p.role === "GRANTOR")?.displayName || "",
      property: payload.property,
      grantors: partyRows.filter((p) => p.role === "GRANTOR").map((p) => p.displayName),
      grantees: partyRows.filter((p) => p.role === "GRANTEE").map((p) => p.displayName),
    };
    const coverJson = path.join(tmpDir, "cover-payload.json");
    await fs.writeFile(coverJson, JSON.stringify(coverPayload, null, 2), "utf-8");

    try {
      await runPythonGenerate("generate_deed_cover_sheet_pdf.py", coverJson, coverPdf);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "Failed to generate cover sheet PDF" } },
        { status: 500 }
      );
    }

    if (format === "pdf") {
      const pdfBytes = await fs.readFile(checklistPdf);

      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Deed-Prep-Checklist-${deedId}.pdf"`,
        },
      });
    }

    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver("zip", { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      archive.on("end", () => resolve(Buffer.concat(chunks)));
      archive.on("error", reject);
      archive.file(checklistPdf, { name: "Deed-Prep-Checklist.pdf" });
      archive.file(coverPdf, { name: "Recording-Cover-Sheet.pdf" });
      archive.finalize().catch(reject);
    });

    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }

    return new NextResponse(Buffer.from(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="Deed-Prep-Packet-${deedId}.zip"`,
      },
    });
  } catch (error: any) {
    console.error("Generate checklist PDF error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to generate checklist PDF" } },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  return handleGenerate(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ deedId: string }> }) {
  return handleGenerate(req, ctx);
}
