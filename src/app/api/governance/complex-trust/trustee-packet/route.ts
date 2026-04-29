import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { trusts, resolutions, minutes, minuteBooks, deedProperties, deedParties, exhibits } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { eq, and } from "drizzle-orm";
import { writeExhibitFile } from "@/lib/files/storage";
import { sha256Buffer } from "@/lib/files/hash";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";

function runPythonGenerate(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "generate_trustee_packet_pdf.py");
    const p = spawn("python3", [scriptPath, inputPath, outputPath], { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));

    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PDF generator failed (code ${code}): ${stderr}`));
    });
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { trustId, entityId, assetId } = body as { trustId: string; entityId?: string; assetId?: string };

    if (!trustId) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "trustId is required" } },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Fetch trust
    const trustRows = await db.select().from(trusts).where(eq(trusts.id, trustId)).limit(1);
    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Trust not found" } }, { status: 404 });
    }

    const trust = trustRows[0];

    // Fetch minute book
    const minuteBookRows = await db
      .select()
      .from(minuteBooks)
      .where(eq(minuteBooks.trustId, trustId))
      .limit(1);

    let allResolutions: any[] = [];
    let allMinutes: any[] = [];
    let annualReview: any = null;

    if (minuteBookRows.length > 0) {
      const minuteBook = minuteBookRows[0];

      // Fetch all approved/locked minutes
      allMinutes = await db
        .select()
        .from(minutes)
        .where(
          and(
            eq(minutes.minuteBookId, minuteBook.id),
            eq(minutes.status, "approved")
          )
        )
        .orderBy(minutes.actionDate);

      // Fetch all resolutions
      if (allMinutes.length > 0) {
        const minutesIds = allMinutes.map((m) => m.id);
        const resolutionRows = await db
          .select()
          .from(resolutions)
          .where(eq(resolutions.minutesId, minutesIds[0])); // Simplified - would need IN clause for multiple

        // Filter by entityId or assetId if specified
        if (entityId) {
          // Filter resolutions that relate to this entity
          // (This would require additional metadata - simplified for now)
        }

        allResolutions = resolutionRows;

        // Find latest annual review (check by title pattern)
        for (const min of allMinutes.reverse()) {
          const allResForMin = await db
            .select()
            .from(resolutions)
            .where(eq(resolutions.minutesId, min.id));

          const reviewRes = allResForMin.find(
            (r) =>
              r.title.toLowerCase().includes("annual") ||
              r.title.toLowerCase().includes("fiduciary review")
          );

          if (reviewRes) {
            annualReview = {
              minutes: min,
              resolution: reviewRes,
            };
            break;
          }
        }
      }
    }

    // Build governance chain
    const governanceChain = allResolutions.map((res) => {
      const min = allMinutes.find((m) => m.id === res.minutesId);
      return {
        resolution: {
          id: res.id,
          title: res.title,
          resolutionType: res.resolutionType,
          effectiveDate: res.effectiveDate,
          expirationDate: res.expirationDate,
        },
        minutes: min
          ? {
              id: min.id,
              title: min.title,
              actionDate: min.actionDate,
              status: min.status,
            }
          : null,
      };
    });

    // Prepare payload for PDF generation
    const payload = {
      title: "Trustee Packet",
      generatedAt: new Date().toISOString(),
      trust: {
        id: trust.id,
        name: trust.name,
        trustType: trust.trustType,
        trustMode: trust.trustMode,
        jurisdictionState: trust.jurisdictionState,
        situsState: trust.situsState,
        publicId: trust.publicId,
      },
      annualReview: annualReview
        ? {
            date: annualReview.minutes.actionDate,
            resolutionTitle: annualReview.resolution.title,
          }
        : null,
      resolutions: allResolutions.map((r) => ({
        id: r.id,
        title: r.title,
        resolutionType: r.resolutionType,
        effectiveDate: r.effectiveDate,
        expirationDate: r.expirationDate,
        status: r.status,
      })),
      governanceChain,
      filterContext: {
        entityId: entityId || null,
        assetId: assetId || null,
      },
    };

    // Temp files
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "trustee-pkt-"));
    const inputJson = path.join(tmpDir, "payload.json");
    const outputPdf = path.join(tmpDir, "trustee_packet.pdf");

    await fs.writeFile(inputJson, JSON.stringify(payload, null, 2), "utf-8");

    // Generate PDF via ReportLab script
    try {
      await runPythonGenerate(inputJson, outputPdf);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "Failed to generate trustee packet PDF" } },
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
      minutesId: null,
      resolutionId: null,
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

    return NextResponse.json({ ok: true, exhibitId, fileName: stored.fileName, fileHash });
  } catch (error: any) {
    console.error("Generate trustee packet error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to generate trustee packet" } },
      { status: 500 }
    );
  }
}
