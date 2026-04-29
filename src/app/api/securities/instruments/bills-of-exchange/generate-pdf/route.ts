import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { exhibits, trustDocuments, trusts, clients, instruments } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { and, eq, sql } from "drizzle-orm";
import { sha256Buffer } from "@/lib/files/hash";
import { writeExhibitFile } from "@/lib/files/storage";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { computeInstrumentHash } from "@/lib/instruments/hash";
import { notarizeInstrumentAsWitness } from "@/lib/instruments/witness-adapter";

function runPythonGenerate(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "generate_bill_of_exchange_pdf.py");
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
    const {
      trustId,
      clientId,
      workspaceLabel,
      version,
      billNumber,
      drawer,
      drawee,
      payee,
      amount,
      currency,
      issueDate,
      dueDate,
      jurisdictionState,
      placeOfIssue,
      placeOfPayment,
      signatureName,
      signatureTitle,
      signatureText,
      signatureDate,
      signatureImageDataUrl,
    } = body;

    if (!trustId || !clientId || !billNumber || !drawer || !drawee || !payee || !amount) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const db = await getDb();
    const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Trust not found" } }, { status: 404 });
    }

    const clientRows = await db.select().from(clients).where(and(eq(clients.id, clientId), eq(clients.userId, userId))).limit(1);
    if (clientRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Client not found" } }, { status: 404 });
    }

    const payload = {
      title: "Bill of Exchange",
      trustId,
      clientId,
      workspaceLabel: workspaceLabel || "",
      version: version || "domestic",
      billNumber,
      drawer,
      drawee,
      payee,
      amount: `${amount} ${currency || ""}`.trim(),
      issueDate: issueDate || "",
      dueDate: dueDate || "",
      jurisdictionState: jurisdictionState || "",
      placeOfIssue: placeOfIssue || "",
      placeOfPayment: placeOfPayment || "",
      signatureName: signatureName || "",
      signatureTitle: signatureTitle || "",
      signatureText: signatureText || "",
      signatureDate: signatureDate || "",
      signatureImageDataUrl: signatureImageDataUrl || "",
    };

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "boe-"));
    const inputJson = path.join(tmpDir, "payload.json");
    const outputPdf = path.join(tmpDir, "bill_of_exchange.pdf");
    await fs.writeFile(inputJson, JSON.stringify(payload, null, 2), "utf-8");
    await runPythonGenerate(inputJson, outputPdf);

    const pdfBytes = await fs.readFile(outputPdf);
    const fileHash = sha256Buffer(pdfBytes);
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

    const docType = `Bill of Exchange (${payload.version || "domestic"})`;
    const maxRows = await db
      .select({ maxV: sql<number>`max(${trustDocuments.version})` })
      .from(trustDocuments)
      .where(and(eq(trustDocuments.trustId, trustId), eq(trustDocuments.docType, docType)))
      .limit(1);
    const nextV = Number(maxRows[0]?.maxV ?? 0) + 1;

    const docId = uuidv4();
    await db.insert(trustDocuments).values({
      id: docId,
      trustId,
      docType,
      title: `${docType} ${billNumber}`,
      version: nextV,
      classification: "demandable",
      disclosureState: "not_shared",
      proofState: "hashed",
      contentJson: JSON.stringify({
        trustId,
        clientId,
        workspaceLabel,
        exhibitId,
        fileName: stored.fileName,
        fileHash,
        payload,
        instrumentId: null,
      }),
      canonicalHashSha256: fileHash,
      archiveId: null,
      anchorTx: null,
    } as any);

    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }

    const instrumentId = uuidv4();
    const createdAt = new Date();
    const instrumentHash = computeInstrumentHash({
      trustId,
      entityId: null,
      instrumentType: "ASSIGNMENT",
      concreteId: docId,
      createdAt,
    });
    await db.insert(instruments).values({
      id: instrumentId,
      trustId,
      entityId: null,
      instrumentType: "ASSIGNMENT",
      status: "executed",
      authorityResolutionId: null,
      concreteId: docId,
      concreteType: "BILL_OF_EXCHANGE",
      instrumentHash,
      executedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });

    const witness = await notarizeInstrumentAsWitness(instrumentId);
    await db
      .update(trustDocuments)
      .set({
        anchorTx: witness.txHash,
        proofState: "anchored",
        contentJson: JSON.stringify({
          trustId,
          clientId,
          workspaceLabel,
          exhibitId,
          fileName: stored.fileName,
          fileHash,
          payload,
          instrumentId,
          witness,
        }),
      })
      .where(eq(trustDocuments.id, docId));

    return NextResponse.json({
      ok: true,
      exhibitId,
      fileName: stored.fileName,
      fileHash,
      docId,
      instrumentId,
      witness,
      downloadUrl: `/api/exhibits/${exhibitId}/download`,
    });
  } catch (error: any) {
    console.error("Generate bill of exchange PDF error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to generate PDF" } },
      { status: 500 }
    );
  }
}
