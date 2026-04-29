import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { accountingDocumentRecords, accountingProfiles } from "@/lib/db/schema.pre-accounting";
import { insertAccountingAuditLog } from "@/lib/accounting/pre-accounting/server/audit";
import { enrichFormCandidatesForProfile } from "@/lib/accounting/pre-accounting/server/form-candidate-enrichment";
import { normalizeLinkedFormCodesJson } from "@/lib/accounting/pre-accounting/document-helpers";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const form = await request.formData();
    const file = form.get("file");
    const accountingProfileId = Number(form.get("accountingProfileId"));
    const documentTag = String(form.get("documentTag") ?? "bank_statement").slice(0, 64);
    const taxYear = Number(form.get("taxYear") ?? new Date().getFullYear());
    const quarterLabel = form.get("quarterLabel");
    const notes = form.get("notes");
    const documentName = String(form.get("documentName") ?? "").trim();
    const reportType = form.get("reportType");
    const ledgerContextJson = form.get("ledgerContextJson");
    const linkedFormCodesJson = form.get("linkedFormCodesJson");

    if (!(file instanceof File) || !Number.isFinite(accountingProfileId)) {
      return NextResponse.json({ error: "file and accountingProfileId required" }, { status: 400 });
    }

    const db = await getDb();
    const prof = await db
      .select()
      .from(accountingProfiles)
      .where(and(eq(accountingProfiles.id, accountingProfileId), eq(accountingProfiles.userId, userId)))
      .limit(1);
    if (!prof[0]) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ error: "file too large (max 25MB)" }, { status: 400 });
    }

    const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "upload";
    const relDir = path.join("uploads", "accounting-documents", String(userId), String(accountingProfileId));
    const absDir = path.join(process.cwd(), "public", relDir);
    await mkdir(absDir, { recursive: true });
    const fname = `${randomUUID()}-${safe}`;
    const absPath = path.join(absDir, fname);
    await writeFile(absPath, buf);

    const storageKey = `/${relDir.replace(/\\/g, "/")}/${fname}`;
    const publicUrl = storageKey;
    const name = documentName || file.name || "document";

    const rt = typeof reportType === "string" && reportType ? reportType.slice(0, 64) : null;
    const ledgerCtx =
      typeof ledgerContextJson === "string" && ledgerContextJson.trim() ? ledgerContextJson.slice(0, 4000) : null;
    const linkedCodes =
      typeof linkedFormCodesJson === "string" ? normalizeLinkedFormCodesJson(linkedFormCodesJson) : null;

    await db.insert(accountingDocumentRecords).values({
      accountingProfileId,
      documentName: name,
      documentTag,
      fileUrl: publicUrl,
      storageKey,
      mimeType: file.type || null,
      reportingPeriodLabel: null,
      quarterLabel: typeof quarterLabel === "string" && quarterLabel ? quarterLabel.slice(0, 8) : null,
      taxYear,
      status: "uploaded",
      notes: typeof notes === "string" ? notes.slice(0, 4000) : null,
      reportType: rt,
      ledgerContextJson: ledgerCtx,
      linkedFormCodesJson: linkedCodes,
      includeInHandoff: true,
    });

    const insertedRows = await db
      .select()
      .from(accountingDocumentRecords)
      .where(eq(accountingDocumentRecords.accountingProfileId, accountingProfileId))
      .orderBy(desc(accountingDocumentRecords.id))
      .limit(1);

    const inserted = insertedRows[0];
    if (inserted) {
      await insertAccountingAuditLog({
        accountingProfileId,
        actorId: userId,
        actionType: "document_uploaded",
        entityType: "accounting_document_records",
        entityId: String(inserted.id),
        metadata: { documentTag, storageKey },
      });
      try {
        await enrichFormCandidatesForProfile(accountingProfileId);
      } catch (enrichErr) {
        console.error("[enrichFormCandidatesForProfile]", enrichErr);
      }
    }

    return NextResponse.json({ ok: true, document: inserted ?? null });
  } catch (e) {
    console.error("[pre-accounting documents POST]", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
