/**
 * Shared persistence for Smart Trust workspace drafts (trust_drafts + trust_parties sync).
 * Used by POST /api/trusts/[trustId]/smart-trust-draft and Jarva apply flow.
 */

import crypto from "crypto";
import { and, eq, sql } from "drizzle-orm";

import type { getDb } from "@/lib/db";
import { insertAuditLog } from "@/lib/audit";
import { trustDrafts, trustParties, trusts } from "@/lib/db/schema";

export type PersistSmartTrustDraftInput = {
  db: Awaited<ReturnType<typeof getDb>>;
  userId: number;
  trustId: string;
  /** Latest row from trusts (ownership already verified by caller) */
  trustRow: { source?: string | null };
  draft: unknown;
  schemaVersion?: number;
  meta?: Record<string, unknown> | null;
  /** Audit action (stored in audit_logs.action) */
  auditAction?: string;
};

export type PersistSmartTrustDraftResult = {
  draftId: string;
  nextVersion: number;
  createdAtIso: string;
};

export async function persistSmartTrustDraft(input: PersistSmartTrustDraftInput): Promise<PersistSmartTrustDraftResult> {
  const {
    db,
    userId,
    trustId,
    trustRow,
    draft,
    schemaVersion: sv,
    meta,
    auditAction = "smart_trust_draft_saved" as string,
  } = input;

  const draftType = "smart-trust-draft";
  const schemaVersion = Math.max(1, Number(sv ?? 1));

  const encoded = JSON.stringify({
    draft: draft ?? null,
    schemaVersion,
    meta: meta ?? null,
  });

  const bytes = Buffer.byteLength(encoded, "utf8");
  if (bytes > 768 * 1024) {
    throw new Error("Payload too large");
  }

  const draftId = crypto.randomUUID();
  const createdAtIso = new Date().toISOString();

  const result = await db.transaction(async (tx) => {
    const maxRows = await tx
      .select({ maxV: sql<number>`max(${trustDrafts.version})` })
      .from(trustDrafts)
      .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, draftType)))
      .limit(1);
    const nextVersion = Number(maxRows[0]?.maxV ?? 0) + 1;

    await tx.insert(trustDrafts).values({
      id: draftId,
      trustId,
      draftType,
      schemaVersion,
      version: nextVersion,
      payloadJson: encoded,
    } as any);

    const d = draft as any;
    const parties = Array.isArray(d?.parties) ? d.parties : [];
    const pickParty = (role: string) => parties.find((p: any) => p?.role === role) ?? null;
    const grantor = pickParty("Grantor/Settlor");
    const trustee = pickParty("Trustee");

    const updateParty = async (role: "grantor" | "trustee", party: any) => {
      if (!party) return;
      const row = {
        displayName: party?.name ?? null,
        addressLine1: party?.addressLine1 ?? null,
        addressLine2: party?.addressLine2 ?? null,
        city: party?.city ?? null,
        state: party?.state ?? null,
        postalCode: party?.postalCode ?? null,
        country: party?.country ?? null,
      };
      const existing = await tx
        .select()
        .from(trustParties)
        .where(and(eq(trustParties.trustId, trustId), eq(trustParties.role, role)))
        .limit(1);

      if (existing.length > 0) {
        await tx.update(trustParties).set(row as any).where(eq(trustParties.id, String(existing[0].id)));
      } else {
        await tx.insert(trustParties).values({
          id: crypto.randomUUID(),
          trustId,
          role,
          ...row,
        } as any);
      }
    };

    await updateParty("grantor", grantor);
    await updateParty("trustee", trustee);

    await insertAuditLog(tx as any, {
      actorUserId: userId,
      action: auditAction,
      entityType: "trust",
      entityId: trustId,
      metadata: { draftId, version: nextVersion, schemaVersion, bytes },
    });

    const firmPatch = {
      firmName: d?.firmName ?? null,
      firmAddress: d?.firmAddress ?? null,
      firmPhone: d?.firmPhone ?? null,
      firmEmail: d?.firmEmail ?? null,
      source: trustRow?.source ?? null,
    };
    await tx.update(trusts).set(firmPatch as any).where(eq(trusts.id, trustId));

    return { nextVersion };
  });

  return { draftId, nextVersion: result.nextVersion, createdAtIso };
}
