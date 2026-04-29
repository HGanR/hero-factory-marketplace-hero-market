import { createWriteStream, existsSync } from "fs";
import { mkdir } from "fs/promises";
import { finished } from "node:stream/promises";
import path from "path";
import archiver from "archiver";
import { getDb } from "@/lib/db";
import { accountingDocumentRecords, taxPreparerHandoffs } from "@/lib/db/schema.pre-accounting";
import { eq } from "drizzle-orm";
import { insertAccountingAuditLog } from "./audit";

export type HandoffPayload = {
  disclaimer: string;
  generatedAt: string;
  profileSummary: Record<string, unknown>;
  readiness: Record<string, unknown> | null;
  documents: Array<Record<string, unknown>>;
  probableForms: Array<Record<string, unknown>> | null;
  quarterlyBreakdown?: Record<string, unknown> | null;
  unresolvedLedgerSummary?: Record<string, unknown> | null;
};

function humanSummary(payload: HandoffPayload): string {
  const lines = [
    "TAX PREPARER HANDOFF PACKET (DRAFT)",
    "===================================",
    "",
    payload.disclaimer,
    "",
    `Generated: ${payload.generatedAt}`,
    "",
    "PROFILE (SUMMARY)",
    JSON.stringify(payload.profileSummary, null, 2),
    "",
  ];
  if (payload.readiness) {
    lines.push("READINESS", JSON.stringify(payload.readiness, null, 2), "");
  }
  lines.push("DOCUMENTS INDEX", JSON.stringify(payload.documents, null, 2), "");
  if (payload.quarterlyBreakdown) {
    lines.push("QUARTERLY", JSON.stringify(payload.quarterlyBreakdown, null, 2), "");
  }
  if (payload.unresolvedLedgerSummary) {
    lines.push("UNRESOLVED / REVIEW", JSON.stringify(payload.unresolvedLedgerSummary, null, 2), "");
  }
  if (payload.probableForms && payload.probableForms.length > 0) {
    lines.push(
      "PROBABLE FORMS (DISCUSSION — NOT A DETERMINATION)",
      JSON.stringify(payload.probableForms, null, 2)
    );
  }
  return lines.join("\n");
}

export async function buildAndStoreHandoffZip(input: {
  userId: number;
  profileId: number;
  handoffId: number;
  payload: HandoffPayload;
  /** Document record ids to include as files in the ZIP (subset of uploaded files). */
  zipDocumentIds: number[];
}): Promise<{ bundleUrl: string; storageKey: string }> {
  const { userId, profileId, handoffId, payload, zipDocumentIds } = input;
  const zipSet = new Set(zipDocumentIds);
  const relDir = path.join("uploads", "accounting-handoffs", String(userId), String(handoffId));
  const absDir = path.join(process.cwd(), "public", relDir);
  await mkdir(absDir, { recursive: true });
  const zipName = "handoff-bundle.zip";
  const absZip = path.join(absDir, zipName);
  const storageKey = `/${relDir.replace(/\\/g, "/")}/${zipName}`;

  const db = await getDb();
  const docs = await db
    .select()
    .from(accountingDocumentRecords)
    .where(eq(accountingDocumentRecords.accountingProfileId, profileId));

  const output = createWriteStream(absZip);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err: Error) => {
    throw err;
  });
  archive.pipe(output);
  archive.append(JSON.stringify(payload, null, 2), { name: "packet-summary.json" });
  archive.append(humanSummary(payload), { name: "packet-summary.txt" });
  for (const d of docs) {
    if (!d.storageKey || !zipSet.has(d.id)) continue;
    const rel = d.storageKey.replace(/^\//, "");
    const fp = path.join(process.cwd(), "public", rel);
    if (!existsSync(fp)) continue;
    const safe = d.documentName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "document";
    archive.file(fp, { name: `documents/${d.id}-${safe}` });
  }
  await archive.finalize();
  await finished(output);

  await db
    .update(taxPreparerHandoffs)
    .set({
      bundleStorageKey: storageKey,
      exportedFileUrl: storageKey,
      packetStatus: "exported",
    })
    .where(eq(taxPreparerHandoffs.id, handoffId));

  await insertAccountingAuditLog({
    accountingProfileId: profileId,
    actorId: userId,
    actionType: "handoff_packet_exported",
    entityType: "tax_preparer_handoffs",
    entityId: String(handoffId),
    metadata: { bundleUrl: storageKey },
  });

  return { bundleUrl: storageKey, storageKey };
}
