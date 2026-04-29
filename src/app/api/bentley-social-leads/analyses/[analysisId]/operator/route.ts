import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { leadAnalyses, leadRecords } from "@/lib/db/schema.bentley-social-leads";
import { OPERATOR_STATUS_VALUES } from "@/lib/bentley-social-leads/types";
import type { WeakSpotTag } from "@/lib/bentley-social-leads/types";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export const runtime = "nodejs";

type Params = { params: Promise<{ analysisId: string }> };

const ALLOWED_STATUS = new Set<string>(OPERATOR_STATUS_VALUES);
const ALLOWED_PRIORITY = new Set(["low", "normal", "high", "urgent"]);

const VALID_LEAD_TYPES = new Set<string>([
  "local_service_business",
  "storefront",
  "clinic",
  "creator_brand",
  "solo_operator",
  "agency",
  "contractor",
]);

const VALID_READINESS = new Set(["low", "moderate", "high"]);

const FEEDBACK_VALUES = new Set<string>(["correct", "partially_correct", "incorrect"]);

const VALID_WEAK_SPOTS = new Set<string>([
  "no_website",
  "weak_cta",
  "dm_booking_only",
  "no_booking_system",
  "low_trust_signals",
  "inconsistent_branding",
  "no_lead_capture",
  "manual_follow_up_risk",
  "weak_offer_clarity",
  "no_reviews_visible",
  "no_email_capture",
  "outdated_site",
]);

function normalizeWeakSpotOverride(v: unknown): WeakSpotTag[] | null {
  if (v === undefined) return null;
  if (v === null) return null;
  if (!Array.isArray(v)) return null;
  const out: WeakSpotTag[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    if (VALID_WEAK_SPOTS.has(x)) out.push(x as WeakSpotTag);
  }
  return out;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { analysisId } = await params;
  const body = (await req.json()) as {
    operatorStatus?: string;
    operatorPriority?: string;
    operatorNotes?: string | null;
    manuallyReviewed?: boolean;
    operatorOverrideLeadType?: string | null;
    operatorOverrideCommercialReadiness?: string | null;
    operatorOverrideBestOfferAngle?: string | null;
    operatorOverrideWeakSpotsJson?: string[] | null;
    operatorOverrideLeadTypeReason?: string | null;
    operatorOverrideCommercialReadinessReason?: string | null;
    operatorOverrideBestOfferAngleReason?: string | null;
    operatorOverrideWeakSpotsReason?: string | null;
    operatorFeedbackLeadType?: string | null;
    operatorFeedbackCommercialReadiness?: string | null;
    operatorFeedbackWeakSpots?: string | null;
    operatorFeedbackBestOfferAngle?: string | null;
  };

  const db = await getDb();
  const [row] = await db
    .select({ id: leadAnalyses.id, leadRecordId: leadAnalyses.leadRecordId })
    .from(leadAnalyses)
    .innerJoin(leadRecords, eq(leadAnalyses.leadRecordId, leadRecords.id))
    .where(and(eq(leadAnalyses.id, analysisId), eq(leadRecords.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: {
    updatedAt: Date;
    operatorStatus?: string;
    operatorPriority?: string;
    operatorNotes?: string | null;
    manuallyReviewedAt?: Date | null;
    operatorOverrideLeadType?: string | null;
    operatorOverrideCommercialReadiness?: string | null;
    operatorOverrideBestOfferAngle?: string | null;
    operatorOverrideWeakSpotsJson?: string[] | null;
    operatorOverrideLeadTypeReason?: string | null;
    operatorOverrideCommercialReadinessReason?: string | null;
    operatorOverrideBestOfferAngleReason?: string | null;
    operatorOverrideWeakSpotsReason?: string | null;
    operatorFeedbackLeadType?: string | null;
    operatorFeedbackCommercialReadiness?: string | null;
    operatorFeedbackWeakSpots?: string | null;
    operatorFeedbackBestOfferAngle?: string | null;
  } = { updatedAt: new Date() };

  if (body.operatorStatus !== undefined) {
    const legacy: Record<string, string> = {
      in_progress: "reviewing",
      done: "shortlisted",
      snoozed: "revisit_later",
      discarded: "not_a_fit",
    };
    const normalized = legacy[body.operatorStatus] ?? body.operatorStatus;
    if (!ALLOWED_STATUS.has(normalized)) {
      return NextResponse.json({ error: "Invalid operatorStatus" }, { status: 400 });
    }
    updates.operatorStatus = normalized;
  }
  if (body.operatorPriority !== undefined) {
    if (!ALLOWED_PRIORITY.has(body.operatorPriority)) {
      return NextResponse.json({ error: "Invalid operatorPriority" }, { status: 400 });
    }
    updates.operatorPriority = body.operatorPriority;
  }
  if (body.operatorNotes !== undefined) {
    updates.operatorNotes = body.operatorNotes;
  }
  if (body.manuallyReviewed === true) {
    updates.manuallyReviewedAt = new Date();
  }

  if (body.operatorOverrideLeadType !== undefined) {
    const v = body.operatorOverrideLeadType;
    if (v === null || v === "") {
      updates.operatorOverrideLeadType = null;
    } else if (!VALID_LEAD_TYPES.has(v)) {
      return NextResponse.json({ error: "Invalid operatorOverrideLeadType" }, { status: 400 });
    } else {
      updates.operatorOverrideLeadType = v;
    }
  }

  if (body.operatorOverrideCommercialReadiness !== undefined) {
    const v = body.operatorOverrideCommercialReadiness;
    if (v === null || v === "") {
      updates.operatorOverrideCommercialReadiness = null;
    } else if (!VALID_READINESS.has(v)) {
      return NextResponse.json({ error: "Invalid operatorOverrideCommercialReadiness" }, { status: 400 });
    } else {
      updates.operatorOverrideCommercialReadiness = v;
    }
  }

  if (body.operatorOverrideBestOfferAngle !== undefined) {
    const v = body.operatorOverrideBestOfferAngle;
    if (v === null || (typeof v === "string" && v.trim() === "")) {
      updates.operatorOverrideBestOfferAngle = null;
    } else if (typeof v === "string") {
      updates.operatorOverrideBestOfferAngle = v.trim().slice(0, 8000);
    } else {
      return NextResponse.json({ error: "Invalid operatorOverrideBestOfferAngle" }, { status: 400 });
    }
  }

  if (body.operatorOverrideWeakSpotsJson !== undefined) {
    const v = body.operatorOverrideWeakSpotsJson;
    if (v === null) {
      updates.operatorOverrideWeakSpotsJson = null;
    } else if (Array.isArray(v)) {
      updates.operatorOverrideWeakSpotsJson = normalizeWeakSpotOverride(v);
    } else {
      return NextResponse.json({ error: "Invalid operatorOverrideWeakSpotsJson" }, { status: 400 });
    }
  }

  const setFeedback = (raw: unknown): string | null | undefined => {
    if (raw === undefined) return undefined;
    if (raw === null || raw === "") return null;
    const s = String(raw);
    if (!FEEDBACK_VALUES.has(s)) return "__bad__";
    return s;
  };

  if (body.operatorFeedbackLeadType !== undefined) {
    const x = setFeedback(body.operatorFeedbackLeadType);
    if (x === "__bad__") return NextResponse.json({ error: "Invalid operatorFeedbackLeadType" }, { status: 400 });
    updates.operatorFeedbackLeadType = x === undefined ? undefined : x;
  }
  if (body.operatorFeedbackCommercialReadiness !== undefined) {
    const x = setFeedback(body.operatorFeedbackCommercialReadiness);
    if (x === "__bad__")
      return NextResponse.json({ error: "Invalid operatorFeedbackCommercialReadiness" }, { status: 400 });
    updates.operatorFeedbackCommercialReadiness = x === undefined ? undefined : x;
  }
  if (body.operatorFeedbackWeakSpots !== undefined) {
    const x = setFeedback(body.operatorFeedbackWeakSpots);
    if (x === "__bad__") return NextResponse.json({ error: "Invalid operatorFeedbackWeakSpots" }, { status: 400 });
    updates.operatorFeedbackWeakSpots = x === undefined ? undefined : x;
  }
  if (body.operatorFeedbackBestOfferAngle !== undefined) {
    const x = setFeedback(body.operatorFeedbackBestOfferAngle);
    if (x === "__bad__")
      return NextResponse.json({ error: "Invalid operatorFeedbackBestOfferAngle" }, { status: 400 });
    updates.operatorFeedbackBestOfferAngle = x === undefined ? undefined : x;
  }

  const trimReason = (v: string | null | undefined): string | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    if (typeof v === "string") return v.trim().slice(0, 4000);
    return null;
  };

  if (body.operatorOverrideLeadTypeReason !== undefined) {
    const t = trimReason(body.operatorOverrideLeadTypeReason);
    updates.operatorOverrideLeadTypeReason = t === undefined ? undefined : t;
  }
  if (body.operatorOverrideCommercialReadinessReason !== undefined) {
    const t = trimReason(body.operatorOverrideCommercialReadinessReason);
    updates.operatorOverrideCommercialReadinessReason = t === undefined ? undefined : t;
  }
  if (body.operatorOverrideBestOfferAngleReason !== undefined) {
    const t = trimReason(body.operatorOverrideBestOfferAngleReason);
    updates.operatorOverrideBestOfferAngleReason = t === undefined ? undefined : t;
  }
  if (body.operatorOverrideWeakSpotsReason !== undefined) {
    const t = trimReason(body.operatorOverrideWeakSpotsReason);
    updates.operatorOverrideWeakSpotsReason = t === undefined ? undefined : t;
  }

  await db.update(leadAnalyses).set(updates).where(eq(leadAnalyses.id, analysisId));

  const [updated] = await db.select().from(leadAnalyses).where(eq(leadAnalyses.id, analysisId)).limit(1);
  return NextResponse.json({ analysis: updated });
}
