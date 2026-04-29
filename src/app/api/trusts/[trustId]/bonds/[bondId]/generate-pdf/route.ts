import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  exhibits,
  trustBondholderRegister,
  trustDebtInstruments,
  trustDocuments,
  trusts,
} from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { and, eq, sql } from "drizzle-orm";
import { sha256Buffer } from "@/lib/files/hash";
import { writeExhibitFile } from "@/lib/files/storage";
import { v4 as uuidv4 } from "uuid";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";

function runPythonGenerate(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), "scripts", "generate_bond_certificate_pdf.py");
    const p = spawn("python3", [scriptPath, inputPath, outputPath], { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += String(d)));

    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`PDF generator failed (code ${code}): ${stderr}`));
    });
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ trustId: string; bondId: string }> }) {
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }

  try {
    const { trustId, bondId } = await ctx.params;

    const db = await getDb();
    const trustRows = await db.select().from(trusts).where(and(eq(trusts.id, trustId), eq(trusts.userId, userId))).limit(1);
    if (trustRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Trust not found" } }, { status: 404 });
    }
    const trust = trustRows[0];

    const bondRows = await db
      .select()
      .from(trustDebtInstruments)
      .where(and(eq(trustDebtInstruments.id, bondId), eq(trustDebtInstruments.trustId, trustId)))
      .limit(1);
    if (bondRows.length === 0) {
      return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Bond not found" } }, { status: 404 });
    }
    const bond: any = bondRows[0];

    const registerRows = await db
      .select()
      .from(trustBondholderRegister)
      .where(and(eq(trustBondholderRegister.debtInstrumentId, bondId), eq(trustBondholderRegister.trustId, trustId)))
      .limit(1);
    const holderName = registerRows[0]?.holderName || "—";

    const ppmDocRows = bond.ppmDocumentId
      ? await db.select().from(trustDocuments).where(eq(trustDocuments.id, bond.ppmDocumentId)).limit(1)
      : [];
    const ppmTitle = ppmDocRows[0]?.title ?? "—";

    const payload = {
      title: "Bond Certificate (Evidence of Indebtedness)",
      trustId: trust.id,
      trustName: trust.name || "Trust",
      bondNumber: bond.bondNumber,
      issuedAt: bond.createdAt ? new Date(bond.createdAt as any).toISOString().slice(0, 10) : "",
      holderName,
      principalAmountUSD: bond.principalAmount,
      interestRatePct: bond.interestRate,
      interestType: bond.interestType,
      paymentFrequency: bond.paymentFrequencyMonths
        ? bond.paymentFrequencyMonths === 1
          ? "monthly"
          : bond.paymentFrequencyMonths === 3
          ? "quarterly"
          : "annual"
        : "",
      maturityDate: bond.maturityDate,
      seniority: bond.seniority,
      callable: bond.callable ? "Yes" : "No",
      governingLaw: bond.governingLaw || "",
      ppmDocumentId: bond.ppmDocumentId || "",
      ppmTitle,
      collateralDescription: bond.revenueSourceDescription || "",
      documentHash: "", // will be filled from executed document if present
    };

    if (bond.bondInstrumentDocumentId) {
      const docRows = await db.select().from(trustDocuments).where(eq(trustDocuments.id, bond.bondInstrumentDocumentId)).limit(1);
      const doc = docRows[0] as any;
      if (doc?.canonicalHashSha256) payload.documentHash = String(doc.canonicalHashSha256);
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "bondpdf-"));
    const inputJson = path.join(tmpDir, "payload.json");
    const outputPdf = path.join(tmpDir, "bond_certificate.pdf");

    await fs.writeFile(inputJson, JSON.stringify(payload, null, 2), "utf-8");

    try {
      await runPythonGenerate(inputJson, outputPdf);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: { code: "INTERNAL_ERROR", message: e?.message || "Failed to generate bond PDF" } },
        { status: 500 }
      );
    }

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

    const pdfDocType = "Bond Certificate (PDF)";
    const maxRows = await db
      .select({ maxV: sql<number>`max(${trustDocuments.version})` })
      .from(trustDocuments)
      .where(and(eq(trustDocuments.trustId, trustId), eq(trustDocuments.docType, pdfDocType)))
      .limit(1);
    const nextV = Number(maxRows[0]?.maxV ?? 0) + 1;

    const pdfDocId = uuidv4();
    await db.insert(trustDocuments).values({
      id: pdfDocId,
      trustId,
      docType: pdfDocType,
      title: `Bond Certificate ${bond.bondNumber} (PDF)`,
      version: nextV,
      classification: "demandable",
      disclosureState: "not_shared",
      proofState: "hashed",
      contentJson: JSON.stringify({
        bondId,
        bondNumber: bond.bondNumber,
        exhibitId,
        fileName: stored.fileName,
        fileHash,
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

    return NextResponse.json({
      ok: true,
      exhibitId,
      fileName: stored.fileName,
      fileHash,
      pdfDocId,
    });
  } catch (error: any) {
    console.error("Generate bond PDF error:", error);
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: error?.message || "Failed to generate bond PDF" } },
      { status: 500 }
    );
  }
}
