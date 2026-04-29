import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";

import type { getDb } from "@/lib/db";
import { insertAuditLog } from "@/lib/audit";
import { trustDrafts, trusts } from "@/lib/db/schema";
import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import { JarvaTrustIntakeSchema, parseJarvaTrustIntake, TRUST_INTAKE_SCHEMA_VERSION } from "@/lib/jarva/trust-intake-schema";
import type { JarvaLineageEntry } from "@/lib/jarva/jarva-lineage";

export const JARVA_INTAKE_DRAFT_TYPE = "jarva-trust-intake";

export type JarvaMode = "assist" | "build" | "review";

export type JarvaIntakeDraftPayload = {
  intake: JarvaTrustIntake;
  schemaVersion: number;
  lineage?: JarvaLineageEntry[];
  /** Consultant-selected Jarva operator mode (stored with intake draft for continuity). */
  jarvaMode?: JarvaMode;
};

/**
 * Pure merge rules for lineage / mode when saving — mirrors saveJarvaIntakeDraft (for unit tests and callers).
 */
export function mergeJarvaIntakeSaveMetadata(
  prevPayload: JarvaIntakeDraftPayload | null | undefined,
  incoming: { lineage?: JarvaLineageEntry[]; jarvaMode?: JarvaMode }
): { lineageMerged: JarvaLineageEntry[]; jarvaModeMerged: JarvaMode | undefined } {
  const lineageMerged =
    incoming.lineage !== undefined ? incoming.lineage : (prevPayload?.lineage ?? []);
  const jarvaModeMerged =
    incoming.jarvaMode !== undefined ? incoming.jarvaMode : prevPayload?.jarvaMode;
  return { lineageMerged, jarvaModeMerged };
}

export async function loadLatestJarvaIntakePayload(
  db: Awaited<ReturnType<typeof getDb>>,
  trustId: string
): Promise<{ payload: JarvaIntakeDraftPayload | null; version: number }> {
  const rows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, JARVA_INTAKE_DRAFT_TYPE)))
    .orderBy(sql`version desc`)
    .limit(1);
  if (rows.length === 0) return { payload: null, version: 0 };
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(String(rows[0]!.payloadJson ?? "null"));
  } catch {
    parsed = null;
  }
  const p = parsed as JarvaIntakeDraftPayload | null;
  if (!p?.intake) return { payload: null, version: Number(rows[0]!.version ?? 0) };
  return { payload: p, version: Number(rows[0]!.version ?? 0) };
}

export async function saveJarvaIntakeDraft(params: {
  db: Awaited<ReturnType<typeof getDb>>;
  userId: number;
  trustId: string;
  trustRow: { source?: string | null };
  intake: JarvaTrustIntake;
  /** When omitted, previous draft lineage is preserved (manual session saves must not wipe chat audit). */
  lineage?: JarvaLineageEntry[];
  auditAction?: string;
  jarvaMode?: JarvaMode;
}): Promise<{ draftId: string; nextVersion: number; jarvaMode?: JarvaMode }> {
  const { db, userId, trustId, intake, lineage, auditAction = "jarva_trust_intake_saved", jarvaMode } = params;

  const prev = await loadLatestJarvaIntakePayload(db, trustId);
  const { lineageMerged, jarvaModeMerged } = mergeJarvaIntakeSaveMetadata(prev.payload, { lineage, jarvaMode });

  const payload: JarvaIntakeDraftPayload = {
    intake,
    schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
    lineage: lineageMerged,
    ...(jarvaModeMerged ? { jarvaMode: jarvaModeMerged } : {}),
  };

  const encoded = JSON.stringify(payload);
  if (Buffer.byteLength(encoded, "utf8") > 512 * 1024) {
    throw new Error("Intake payload too large");
  }

  const draftId = crypto.randomUUID();
  const result = await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDrafts.version})` })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, JARVA_INTAKE_DRAFT_TYPE)))
      .limit(1);
    const nextVersion = Number(maxRows[0]?.maxV ?? 0) + 1;

    await tx.insert(trustDrafts).values({
      id: draftId,
      trustId,
      draftType: JARVA_INTAKE_DRAFT_TYPE,
      schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
      version: nextVersion,
      payloadJson: encoded,
    } as any);

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: auditAction,
      entityType: "trust",
      entityId: trustId,
      metadata: { draftId, version: nextVersion, lineageEntries: lineageMerged.length },
    });

    return { nextVersion };
  });

  return { draftId, nextVersion: result.nextVersion, jarvaMode: jarvaModeMerged };
}

/** Merge raw object into JarvaTrustIntake via parse (strips invalid) */
export function coerceIntakePayload(raw: Record<string, unknown>, userId: number): JarvaTrustIntake {
  const parsed = parseJarvaTrustIntake({
    ...raw,
    schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
    collectedByUserId: userId,
    collectedAt: new Date().toISOString(),
  });
  if (!parsed.ok) {
    return JarvaTrustIntakeSchema.parse({
      schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
      collectedByUserId: userId,
      collectedAt: new Date().toISOString(),
    });
  }
  return parsed.data;
}
