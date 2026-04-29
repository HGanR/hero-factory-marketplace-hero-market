import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4D — Ingest comments/replies as CSV (same columns as SLI CSV) tagged as post-response data.
 * Reuses LeadRawRecord → lead_records; operator runs analysis via POST /bentley-social-leads/runs as usual.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leadRecords, leadUploads } from "@/lib/db/schema.bentley-social-leads";
import {
  buildBentleyCsvImportPayload,
  buildCsvImportBatchMeta,
  leadRawRecordToNormalizedLead,
  mergeEngagementProvenance,
  mergeRawPayloadWithCsvImport,
  parseValidateCsvImport,
} from "@/lib/bentley-social-leads/import";
import { markUploadParsed } from "@/lib/bentley-social-leads/persistLeadAnalysis";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    csvText?: string;
    filename?: string;
    contentDeploymentId?: string | null;
  };

  const csvText = typeof body.csvText === "string" ? body.csvText : "";
  const filename = body.filename?.trim() || "engagement-import.csv";
  const contentDeploymentId = typeof body.contentDeploymentId === "string" ? body.contentDeploymentId.trim() : null;

  const parsed = parseValidateCsvImport(csvText);
  if (parsed.validRows.length === 0) {
    return NextResponse.json(
      {
        error:
          parsed.summary.fileMessages.some((m) => m.severity === "error")
            ? "CSV import: no valid rows (file error or all rows failed validation)."
            : "CSV import: no valid rows — check required columns platform and commentText.",
      },
      { status: 400 }
    );
  }

  const importedAt = new Date().toISOString();
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
      importKind: "engagement_post_response",
      contentDeploymentId: contentDeploymentId ?? undefined,
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
    const rawPayloadJson = mergeRawPayloadWithCsvImport(
      mergeEngagementProvenance(
        {},
        { ingestionKind: "engagement_post_response", contentDeploymentId }
      ),
      bentley
    );
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
    ok: true,
    uploadId,
    parsedCount: parsed.validRows.length,
    sourceType: "csv_sli",
    importKind: "engagement_post_response",
    meta: {
      csvImport: batchMeta,
      parseSummary: parsed.summary,
      invalidRows: parsed.invalidRows,
    },
    nextStep: "POST /api/bentley-social-leads/runs with { uploadId } to classify and sync tracked leads.",
  });
}
