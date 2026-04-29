import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { accountingReviewItems } from "@/lib/db/schema.pre-accounting";
import { insertAccountingAuditLog } from "./audit";

export type ReviewItemSourceType =
  | "missing_document"
  | "document_review"
  | "ledger_unresolved"
  | "form_support_gap"
  | "incomplete_quarter"
  | "handoff_deficiency"
  | "manual";

export async function listReviewItemsForProfile(profileId: number, limit = 200) {
  const db = await getDb();
  return db
    .select()
    .from(accountingReviewItems)
    .where(eq(accountingReviewItems.accountingProfileId, profileId))
    .orderBy(desc(accountingReviewItems.updatedAt))
    .limit(limit);
}

export async function countOpenBlockers(profileId: number): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(accountingReviewItems)
    .where(eq(accountingReviewItems.accountingProfileId, profileId));
  return rows.filter(
    (r) => r.severity === "blocker" && (r.status === "open" || r.status === "in_progress")
  ).length;
}

export async function countWaitingOnClient(profileId: number): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(accountingReviewItems)
    .where(eq(accountingReviewItems.accountingProfileId, profileId));
  return rows.filter((r) => r.status === "waiting_on_client").length;
}

export async function createReviewItem(
  profileId: number,
  actorId: number,
  input: {
    sourceType: ReviewItemSourceType;
    sourceId?: string | null;
    title: string;
    description?: string | null;
    severity?: "info" | "warning" | "blocker";
    status?: "open" | "in_progress" | "waiting_on_client" | "resolved" | "waived";
    assignedRole?: "client" | "reviewer" | "preparer" | "admin";
    dueAt?: Date | null;
    resolutionNotes?: string | null;
  }
) {
  const db = await getDb();
  await db.insert(accountingReviewItems).values({
    accountingProfileId: profileId,
    sourceType: input.sourceType,
    sourceId: input.sourceId ?? null,
    title: input.title.slice(0, 512),
    description: input.description ?? null,
    severity: input.severity ?? "warning",
    status: input.status ?? "open",
    assignedRole: input.assignedRole ?? "reviewer",
    dueAt: input.dueAt ?? null,
    resolutionNotes: input.resolutionNotes ?? null,
  });
  const rows = await db
    .select()
    .from(accountingReviewItems)
    .where(eq(accountingReviewItems.accountingProfileId, profileId))
    .orderBy(desc(accountingReviewItems.id))
    .limit(1);
  const created = rows[0];
  if (created) {
    await insertAccountingAuditLog({
      accountingProfileId: profileId,
      actorId,
      actionType: "review_item_created",
      entityType: "accounting_review_items",
      entityId: String(created.id),
      metadata: { sourceType: input.sourceType },
    });
  }
  return created ?? null;
}

export async function updateReviewItem(
  profileId: number,
  itemId: number,
  actorId: number,
  patch: Partial<{
    status: string;
    severity: string;
    assignedRole: string;
    resolutionNotes: string | null;
    dueAt: Date | null;
    title: string;
    description: string | null;
  }>
) {
  const db = await getDb();
  const row = await db
    .select()
    .from(accountingReviewItems)
    .where(and(eq(accountingReviewItems.id, itemId), eq(accountingReviewItems.accountingProfileId, profileId)))
    .limit(1);
  if (!row[0]) return null;

  const next: Record<string, unknown> = { ...patch };
  if (patch.status === "resolved" || patch.status === "waived") {
    next.resolvedAt = new Date();
  } else if (patch.status && patch.status !== "resolved" && patch.status !== "waived") {
    next.resolvedAt = null;
  }

  await db.update(accountingReviewItems).set(next).where(eq(accountingReviewItems.id, itemId));

  await insertAccountingAuditLog({
    accountingProfileId: profileId,
    actorId,
    actionType: "review_item_updated",
    entityType: "accounting_review_items",
    entityId: String(itemId),
    metadata: { status: patch.status },
  });

  const updated = await db.select().from(accountingReviewItems).where(eq(accountingReviewItems.id, itemId)).limit(1);
  return updated[0] ?? null;
}

/** Find open item for same source; update or create. */
export async function upsertReviewItemForDocument(
  profileId: number,
  documentId: number,
  actorId: number,
  input: {
    title: string;
    description?: string;
    severity: "info" | "warning" | "blocker";
    status: "open" | "in_progress" | "waiting_on_client";
  }
) {
  const db = await getDb();
  const key = `doc:${documentId}`;
  const existing = await db
    .select()
    .from(accountingReviewItems)
    .where(
      and(
        eq(accountingReviewItems.accountingProfileId, profileId),
        eq(accountingReviewItems.sourceType, "document_review"),
        eq(accountingReviewItems.sourceId, key)
      )
    )
    .limit(1);

  if (existing[0]) {
    return updateReviewItem(profileId, existing[0].id, actorId, {
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      status: input.status,
    });
  }

  return createReviewItem(profileId, actorId, {
    sourceType: "document_review",
    sourceId: key,
    title: input.title,
    description: input.description,
    severity: input.severity,
    status: input.status,
    assignedRole: "reviewer",
  });
}

export async function resolveReviewItemsForDocumentSource(profileId: number, documentId: number, actorId: number) {
  const db = await getDb();
  const key = `doc:${documentId}`;
  const rows = await db
    .select()
    .from(accountingReviewItems)
    .where(
      and(
        eq(accountingReviewItems.accountingProfileId, profileId),
        eq(accountingReviewItems.sourceType, "document_review"),
        eq(accountingReviewItems.sourceId, key)
      )
    );
  for (const r of rows) {
    if (r.status !== "resolved" && r.status !== "waived") {
      await updateReviewItem(profileId, r.id, actorId, { status: "resolved", resolutionNotes: "Auto-resolved: document accepted." });
    }
  }
}

const FORM_SUPPORT_KEY = (formRowId: number) => `form:${formRowId}`;

export async function upsertReviewItemForFormSupportGap(
  profileId: number,
  formRowId: number,
  actorId: number,
  input: {
    title: string;
    description?: string;
    severity: "info" | "warning" | "blocker";
    status: "open" | "in_progress" | "waiting_on_client";
  }
) {
  const db = await getDb();
  const key = FORM_SUPPORT_KEY(formRowId);
  const existing = await db
    .select()
    .from(accountingReviewItems)
    .where(
      and(
        eq(accountingReviewItems.accountingProfileId, profileId),
        eq(accountingReviewItems.sourceType, "form_support_gap"),
        eq(accountingReviewItems.sourceId, key)
      )
    )
    .limit(1);

  if (existing[0]) {
    return updateReviewItem(profileId, existing[0].id, actorId, {
      title: input.title,
      description: input.description ?? null,
      severity: input.severity,
      status: input.status,
    });
  }

  return createReviewItem(profileId, actorId, {
    sourceType: "form_support_gap",
    sourceId: key,
    title: input.title,
    description: input.description,
    severity: input.severity,
    status: input.status,
    assignedRole: "reviewer",
  });
}

export async function resolveReviewItemsForFormSupportGap(profileId: number, formRowId: number, actorId: number, note?: string) {
  const db = await getDb();
  const key = FORM_SUPPORT_KEY(formRowId);
  const rows = await db
    .select()
    .from(accountingReviewItems)
    .where(
      and(
        eq(accountingReviewItems.accountingProfileId, profileId),
        eq(accountingReviewItems.sourceType, "form_support_gap"),
        eq(accountingReviewItems.sourceId, key)
      )
    );
  for (const r of rows) {
    if (r.status !== "resolved" && r.status !== "waived") {
      await updateReviewItem(profileId, r.id, actorId, {
        status: "resolved",
        resolutionNotes: note ?? "Support gap cleared or waived.",
      });
    }
  }
}
