import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { accountingProfiles, taxFormCandidates } from "@/lib/db/schema.pre-accounting";
import { insertAccountingAuditLog } from "@/lib/accounting/pre-accounting/server/audit";
import {
  resolveReviewItemsForFormSupportGap,
  upsertReviewItemForFormSupportGap,
} from "@/lib/accounting/pre-accounting/server/review-items";
import { enrichFormCandidatesForProfile } from "@/lib/accounting/pre-accounting/server/form-candidate-enrichment";

export const runtime = "nodejs";

const REVIEWER_STATUSES = new Set(["pending_review", "supporting_attached", "needs_followup", "cleared"]);
const GAP_STATUSES = new Set(["open", "resolved", "waived", "still_missing"]);

function parseMissingJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function normalizeAttachedIds(raw: unknown): string {
  if (!Array.isArray(raw)) return JSON.stringify([]);
  const nums = raw.filter((x): x is number => typeof x === "number" && Number.isFinite(x)).map((n) => Math.floor(n));
  return JSON.stringify(nums);
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const userId = await getAuthedUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const formId = Number((await ctx.params).id);
    if (!Number.isFinite(formId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const body = (await request.json()) as {
      reviewerStatus?: string;
      reviewerNotes?: string;
      supportGapStatus?: string;
      supportGapNote?: string | null;
      attachedDocumentIdsJson?: number[] | null;
    };
    const patch: {
      reviewerStatus?: string;
      reviewerNotes?: string | null;
      supportGapStatus?: string;
      supportGapNote?: string | null;
      attachedDocumentIdsJson?: string | null;
    } = {};
    if (typeof body.reviewerStatus === "string" && REVIEWER_STATUSES.has(body.reviewerStatus)) {
      patch.reviewerStatus = body.reviewerStatus;
    }
    if (typeof body.reviewerNotes === "string") {
      patch.reviewerNotes = body.reviewerNotes.slice(0, 8000);
    }
    if (typeof body.supportGapStatus === "string" && GAP_STATUSES.has(body.supportGapStatus)) {
      patch.supportGapStatus = body.supportGapStatus;
    }
    if (body.supportGapNote !== undefined) {
      patch.supportGapNote = body.supportGapNote ? String(body.supportGapNote).slice(0, 8000) : null;
    }
    if (body.attachedDocumentIdsJson !== undefined) {
      patch.attachedDocumentIdsJson =
        body.attachedDocumentIdsJson === null ? null : normalizeAttachedIds(body.attachedDocumentIdsJson);
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    const db = await getDb();
    const lookup = await db
      .select({ profileId: taxFormCandidates.accountingProfileId })
      .from(taxFormCandidates)
      .where(eq(taxFormCandidates.id, formId))
      .limit(1);
    if (!lookup[0]) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const profileId = lookup[0].profileId;
    const own = await db
      .select()
      .from(accountingProfiles)
      .where(and(eq(accountingProfiles.id, profileId), eq(accountingProfiles.userId, userId)))
      .limit(1);
    if (!own[0]) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.update(taxFormCandidates).set(patch).where(eq(taxFormCandidates.id, formId));

    await insertAccountingAuditLog({
      accountingProfileId: profileId,
      actorId: userId,
      actionType: "tax_form_candidate_updated",
      entityType: "tax_form_candidates",
      entityId: String(formId),
      metadata: { reviewerStatus: patch.reviewerStatus, supportGapStatus: patch.supportGapStatus },
    });

    try {
      await enrichFormCandidatesForProfile(profileId);
    } catch (e) {
      console.error("[enrich after form PATCH]", e);
    }

    const updated = await db.select().from(taxFormCandidates).where(eq(taxFormCandidates.id, formId)).limit(1);
    const updatedRow = updated[0];
    if (updatedRow) {
      const missing = parseMissingJson(updatedRow.missingSupportJson);
      const sg = updatedRow.supportGapStatus ?? "open";
      const gapClosed =
        missing.length === 0 || sg === "resolved" || sg === "waived";
      if (!gapClosed) {
        await upsertReviewItemForFormSupportGap(profileId, formId, userId, {
          title: `Form support gap: ${updatedRow.displayName}`,
          description:
            [missing.slice(0, 5).join("; "), updatedRow.supportGapNote].filter(Boolean).join(" — ") || undefined,
          severity: sg === "still_missing" ? "blocker" : "warning",
          status: "open",
        });
      } else {
        await resolveReviewItemsForFormSupportGap(profileId, formId, userId, updatedRow.supportGapNote ?? undefined);
      }
    }

    return NextResponse.json({ ok: true, formCandidate: updated[0] ?? null });
  } catch (e) {
    console.error("[form-candidate PATCH]", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
