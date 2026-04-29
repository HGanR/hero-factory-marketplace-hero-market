/**
 * Lead signal rows for Bentley Social Command Center inbox lanes (sales-aware, not generic DMs).
 */

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyLeadHandoffs, bentleyLeadSignals } from "@/lib/db/schema";

export type LeadSignalInboxLane =
  | "high_intent"
  | "objections"
  | "trust_seeking"
  | "handoff_ready"
  | "reviewed_routed"
  | "engagement";

export type LeadSignalInboxRow = {
  id: string;
  sourcePlatform: string;
  extractedText: string;
  signalClass: string | null;
  commercialIntentScore: number;
  urgencyScore: number;
  handoffReadiness: number;
  recommendedFollowup: string;
  lane: LeadSignalInboxLane;
  handoffStatus: string | null;
  createdAt: string | null;
  /** Optional — filled by command center / explainability surfaces. */
  whyBentleySaysThis?: string;
  confidenceNote?: string;
  keySignals?: string[];
  blockerSummary?: string | null;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function laneForRow(input: {
  signalClass: string | null;
  commercialIntentScore: number;
  handoffReadiness: number;
  handoffStatus: string | null;
}): LeadSignalInboxLane {
  const hs = input.handoffStatus;
  if (hs && ["reviewed", "routed", "contacted"].includes(hs)) return "reviewed_routed";
  if (input.handoffReadiness >= 0.62 || hs === "new") return "handoff_ready";
  if (input.signalClass === "objection") return "objections";
  if (input.signalClass === "trust_seeking") return "trust_seeking";
  if (input.commercialIntentScore >= 0.65) return "high_intent";
  return "engagement";
}

export async function listLeadSignalInboxRows(params: {
  userId: string;
  clientId: string;
  trustId: string;
  limit?: number;
}): Promise<LeadSignalInboxRow[]> {
  const uid = String(params.userId).trim();
  if (!uid) return [];

  const lim = Math.min(250, Math.max(1, params.limit ?? 120));

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(bentleyLeadSignals)
      .where(
        and(
          eq(bentleyLeadSignals.userId, uid),
          eq(bentleyLeadSignals.clientId, params.clientId ?? ""),
          eq(bentleyLeadSignals.trustId, params.trustId ?? "")
        )
      )
      .orderBy(desc(bentleyLeadSignals.createdAt))
      .limit(lim);

    if (!rows.length) return [];

    const ids = rows.map((r) => r.id);
    const hoRows =
      ids.length > 0
        ? await db
            .select({
              leadSignalId: bentleyLeadHandoffs.leadSignalId,
              handoffStatus: bentleyLeadHandoffs.handoffStatus,
              createdAt: bentleyLeadHandoffs.createdAt,
            })
            .from(bentleyLeadHandoffs)
            .where(
              and(
                eq(bentleyLeadHandoffs.userId, uid),
                eq(bentleyLeadHandoffs.clientId, params.clientId ?? ""),
                eq(bentleyLeadHandoffs.trustId, params.trustId ?? ""),
                inArray(bentleyLeadHandoffs.leadSignalId, ids)
              )
            )
            .orderBy(desc(bentleyLeadHandoffs.createdAt))
        : [];

    const handoffBySignal = new Map<string, string>();
    for (const h of hoRows) {
      if (!handoffBySignal.has(h.leadSignalId)) {
        handoffBySignal.set(h.leadSignalId, h.handoffStatus);
      }
    }

    return rows.map((r) => {
      const c = r.commercialIntentScore != null ? Number(r.commercialIntentScore) : 0.5;
      const u = r.urgencyScore != null ? Number(r.urgencyScore) : 0.45;
      const h = r.handoffReadiness != null ? Number(r.handoffReadiness) : 0.5;
      const cls = r.signalClass?.trim() || null;
      const handoffStatus = handoffBySignal.get(r.id) ?? null;
      return {
        id: r.id,
        sourcePlatform: String(r.sourcePlatform ?? "").slice(0, 64) || "unknown",
        extractedText: String(r.extractedText ?? "").slice(0, 2000),
        signalClass: cls,
        commercialIntentScore: clamp01(c),
        urgencyScore: clamp01(u),
        handoffReadiness: clamp01(h),
        recommendedFollowup: String(r.recommendedFollowup ?? "").slice(0, 512),
        lane: laneForRow({
          signalClass: cls,
          commercialIntentScore: clamp01(c),
          handoffReadiness: clamp01(h),
          handoffStatus,
        }),
        handoffStatus,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : null,
      };
    });
  } catch (e) {
    console.warn("[lead-signal-inbox] query failed", e);
    return [];
  }
}

export function groupLeadSignalInboxByLane(rows: LeadSignalInboxRow[]): Record<LeadSignalInboxLane, LeadSignalInboxRow[]> {
  const empty: Record<LeadSignalInboxLane, LeadSignalInboxRow[]> = {
    high_intent: [],
    objections: [],
    trust_seeking: [],
    handoff_ready: [],
    reviewed_routed: [],
    engagement: [],
  };
  for (const r of rows) {
    empty[r.lane].push(r);
  }
  return empty;
}
