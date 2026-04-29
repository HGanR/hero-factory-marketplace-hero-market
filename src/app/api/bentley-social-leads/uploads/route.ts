import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Bentley Social Lead Intelligence — upload + parse leads (analysis-only; no outreach).
 */

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leadRecords, leadUploads } from "@/lib/db/schema.bentley-social-leads";
import {
  buildBentleyCsvImportPayload,
  buildCsvImportBatchMeta,
  leadRawRecordToNormalizedLead,
  mergeRawPayloadWithCsvImport,
  parseValidateCsvImport,
} from "@/lib/bentley-social-leads/import";
import { normalizeLeadRecord } from "@/lib/bentley-social-leads/normalizeLeadRecord";
import { parseLeadUpload, type SourceType } from "@/lib/bentley-social-leads/parseLeadUpload";
import { markUploadParsed } from "@/lib/bentley-social-leads/persistLeadAnalysis";

export const runtime = "nodejs";

const MAX_ROWS = 200;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

function jsonErr(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return jsonErr("Unauthorized", 401);
  }

  const db = await getDb();
  const rows = await db
    .select({
      id: leadUploads.id,
      filename: leadUploads.filename,
      sourceType: leadUploads.sourceType,
      uploadedAt: leadUploads.uploadedAt,
      parsedCount: leadUploads.parsedCount,
      status: leadUploads.status,
    })
    .from(leadUploads)
    .where(eq(leadUploads.userId, userId))
    .orderBy(desc(leadUploads.uploadedAt))
    .limit(50);

  return NextResponse.json({ uploads: rows });
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return jsonErr("Unauthorized", 401);
  }

  const contentType = req.headers.get("content-type") || "";

  let sourceType: SourceType = "csv";
  let filename = "upload";
  let buffer: Buffer | null = null;
  let textFallback: string | null = null;

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      sourceType?: SourceType | "csv_sli";
      text?: string;
      filename?: string;
      csvText?: string;
    };
    if (body.sourceType === "csv_sli") {
      const csvText = typeof body.csvText === "string" ? body.csvText : "";
      filename = body.filename?.trim() || "bentley-sli-import.csv";
      const importedAt = new Date().toISOString();
      const parsed = parseValidateCsvImport(csvText);
      if (parsed.validRows.length === 0) {
        return jsonErr(
          parsed.summary.fileMessages.some((m) => m.severity === "error")
            ? "CSV import: no valid rows (file error or all rows failed validation)."
            : "CSV import: no valid rows — check required columns platform and commentText.",
          400
        );
      }
      const uploadId = randomUUID();
      const db = await getDb();
      const batchMeta = buildCsvImportBatchMeta({
        fileName: filename,
        importedAt,
        totalRowsAttempted: parsed.summary.totalDataRows,
        validRowsImported: parsed.validRows.length,
        invalidRowsSkipped: parsed.invalidRows.length,
      });
      await db.insert(leadUploads).values({
        id: uploadId,
        userId,
        filename,
        sourceType: "csv_sli",
        parsedCount: 0,
        status: "pending",
        rawMetaJson: {
          importKind: "bentley_csv_sli",
          csvImport: batchMeta,
          parseSummary: parsed.summary,
          invalidRowSample: parsed.invalidRows.slice(0, 20),
        },
      });

      for (const v of parsed.validRows) {
        const normalized = leadRawRecordToNormalizedLead(v.record);
        const bentley = buildBentleyCsvImportPayload(v.record, {
          fileName: filename,
          importedAt,
          rowNumber: v.rowNumber,
        });
        const rawPayloadJson = mergeRawPayloadWithCsvImport({}, bentley);
        const recordId = randomUUID();
        await db.insert(leadRecords).values({
          id: recordId,
          uploadId,
          userId,
          businessName: normalized.businessName,
          platform: normalized.platform,
          handle: normalized.handle,
          profileUrl: normalized.profileUrl || null,
          email: normalized.email,
          websiteUrl: normalized.websiteUrl,
          notes: normalized.notes,
          rawPayloadJson,
          normalizedPayloadJson: normalized as unknown as Record<string, unknown>,
        });
      }

      await markUploadParsed(db, uploadId, parsed.validRows.length);

      return NextResponse.json({
        uploadId,
        parsedCount: parsed.validRows.length,
        sourceType: "csv_sli",
        meta: {
          csvImport: batchMeta,
          parseSummary: parsed.summary,
          invalidRows: parsed.invalidRows,
        },
      });
    }

    sourceType = (body.sourceType as SourceType) ?? "paste";
    textFallback = body.text ?? "";
    filename = body.filename?.trim() || "paste.txt";
    if (sourceType !== "paste" && sourceType !== "txt") {
      return jsonErr("JSON upload supports sourceType paste, txt, or csv_sli.", 400);
    }
  } else {
    const form = await req.formData();
    const st = form.get("sourceType");
    sourceType = (typeof st === "string" ? st : "csv") as SourceType;
    const file = form.get("file");
    filename = typeof form.get("filename") === "string" ? String(form.get("filename")) : "upload";
    if (file instanceof Blob) {
      if (file.size > MAX_FILE_BYTES) return jsonErr("File too large (max 12MB).", 400);
      buffer = Buffer.from(await file.arrayBuffer());
      if (typeof (file as File).name === "string" && (file as File).name) {
        filename = (file as File).name;
      }
    }
    const paste = form.get("text");
    if (typeof paste === "string" && paste.trim()) textFallback = paste;
  }

  let parsed;
  try {
    parsed = await parseLeadUpload(sourceType, buffer, textFallback, filename);
  } catch (e) {
    console.error("[bentley-sli] parse error", e);
    return jsonErr("Failed to parse upload.", 400);
  }

  const rows = parsed.rows.slice(0, MAX_ROWS);
  if (rows.length === 0) {
    return jsonErr("No lead rows found. Check CSV headers or paste format.", 400);
  }

  const uploadId = randomUUID();
  const db = await getDb();

  await db.insert(leadUploads).values({
    id: uploadId,
    userId,
    filename,
    sourceType,
    parsedCount: 0,
    status: "pending",
    rawMetaJson: { ...parsed.meta, rowCount: rows.length },
  });

  for (const raw of rows) {
    const normalized = normalizeLeadRecord(raw);
    const recordId = randomUUID();
    await db.insert(leadRecords).values({
      id: recordId,
      uploadId,
      userId,
      businessName: normalized.businessName,
      platform: normalized.platform,
      handle: normalized.handle,
      profileUrl: normalized.profileUrl || null,
      email: normalized.email,
      websiteUrl: normalized.websiteUrl,
      notes: normalized.notes,
      rawPayloadJson: raw as Record<string, unknown>,
      normalizedPayloadJson: normalized as unknown as Record<string, unknown>,
    });
  }

  await markUploadParsed(db, uploadId, rows.length);

  return NextResponse.json({
    uploadId,
    parsedCount: rows.length,
    meta: parsed.meta,
  });
}
