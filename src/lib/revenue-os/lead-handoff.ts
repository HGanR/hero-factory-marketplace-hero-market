/**
 * Lead handoff records linking bentley_lead_signals → operator workflow.
 */

import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bentleyLeadHandoffs, bentleyLeadSignals } from "@/lib/db/schema";

export type HandoffStatus = "new" | "reviewed" | "routed" | "contacted" | "closed" | "archived";

export async function createLeadHandoff(params: {
  userId: string;
  clientId: string;
  trustId: string;
  leadSignalId: string;
  recommendedFollowup?: string;
  bentleyNextResponseMode?: string | null;
  handoffNote?: string | null;
  /** Minimum handoff_readiness on signal to create (default 0.55). */
  handoffReadinessThreshold?: number;
}): Promise<{ id: string } | null> {
  try {
    const db = await getDb();
    const sig = await db
      .select()
      .from(bentleyLeadSignals)
      .where(
        and(
          eq(bentleyLeadSignals.id, params.leadSignalId),
          eq(bentleyLeadSignals.userId, params.userId),
          eq(bentleyLeadSignals.clientId, params.clientId ?? ""),
          eq(bentleyLeadSignals.trustId, params.trustId ?? "")
        )
      )
      .limit(1);
    if (!sig[0]) return null;

    const threshold = params.handoffReadinessThreshold ?? 0.55;
    if (sig[0].handoffReadiness != null) {
      const hr = Number(sig[0].handoffReadiness);
      if (!Number.isFinite(hr) || hr < threshold) return null;
    }

    const open = await db
      .select({ id: bentleyLeadHandoffs.id })
      .from(bentleyLeadHandoffs)
      .where(
        and(
          eq(bentleyLeadHandoffs.leadSignalId, params.leadSignalId),
          inArray(bentleyLeadHandoffs.handoffStatus, ["new", "reviewed", "routed", "contacted"])
        )
      )
      .limit(1);
    if (open[0]) {
      return { id: open[0].id };
    }

    const id = crypto.randomUUID();
    await db.insert(bentleyLeadHandoffs).values({
      id,
      leadSignalId: params.leadSignalId,
      userId: params.userId,
      clientId: params.clientId,
      trustId: params.trustId,
      handoffStatus: "new",
      ownerUserId: null,
      handoffNote: params.handoffNote?.slice(0, 8000) ?? null,
      recommendedFollowup: (params.recommendedFollowup ?? sig[0].recommendedFollowup ?? "").slice(0, 512),
      bentleyNextResponseMode: params.bentleyNextResponseMode?.slice(0, 128) ?? null,
    });
    return { id };
  } catch (e) {
    console.error("[lead-handoff] create failed", e);
    return null;
  }
}

export async function updateLeadHandoffStatus(params: {
  userId: string;
  clientId: string;
  trustId: string;
  handoffId: string;
  status: HandoffStatus;
  ownerUserId?: string | null;
  handoffNote?: string | null;
}): Promise<boolean> {
  try {
    const db = await getDb();
    await db
      .update(bentleyLeadHandoffs)
      .set({
        handoffStatus: params.status,
        ...(params.ownerUserId !== undefined ? { ownerUserId: params.ownerUserId } : {}),
        ...(params.handoffNote !== undefined
          ? { handoffNote: params.handoffNote?.slice(0, 8000) ?? null }
          : {}),
      })
      .where(
        and(
          eq(bentleyLeadHandoffs.id, params.handoffId),
          eq(bentleyLeadHandoffs.userId, params.userId),
          eq(bentleyLeadHandoffs.clientId, params.clientId ?? ""),
          eq(bentleyLeadHandoffs.trustId, params.trustId ?? "")
        )
      );
    return true;
  } catch (e) {
    console.error("[lead-handoff] update failed", e);
    return false;
  }
}

export type LeadHandoffSummary = {
  totalOpen: number;
  byStatus: Record<string, number>;
  recentIds: string[];
};

export async function fetchLeadHandoffSummary(params: {
  userId: string;
  clientId: string;
  trustId: string;
}): Promise<LeadHandoffSummary> {
  const empty: LeadHandoffSummary = { totalOpen: 0, byStatus: {}, recentIds: [] };
  try {
    const db = await getDb();
    const rows = await db
      .select({
        id: bentleyLeadHandoffs.id,
        status: bentleyLeadHandoffs.handoffStatus,
      })
      .from(bentleyLeadHandoffs)
      .where(
        and(
          eq(bentleyLeadHandoffs.userId, params.userId),
          eq(bentleyLeadHandoffs.clientId, params.clientId ?? ""),
          eq(bentleyLeadHandoffs.trustId, params.trustId ?? "")
        )
      )
      .orderBy(desc(bentleyLeadHandoffs.createdAt))
      .limit(200);

    const byStatus: Record<string, number> = {};
    let open = 0;
    const recentIds: string[] = [];
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      if (["new", "reviewed", "routed", "contacted"].includes(r.status)) open += 1;
      if (recentIds.length < 12) recentIds.push(r.id);
    }
    return { totalOpen: open, byStatus, recentIds };
  } catch {
    return empty;
  }
}

export async function countOpenHandoffs(params: {
  userId: string;
  clientId: string;
  trustId: string;
}): Promise<number> {
  const s = await fetchLeadHandoffSummary(params);
  return s.totalOpen;
}
