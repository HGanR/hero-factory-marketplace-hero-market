/**
 * Persist extracted lead signals to `bentley_lead_signals` (bounded, user-scoped).
 */

import crypto from "crypto";
import { getDb } from "@/lib/db";
import { bentleyLeadSignals } from "@/lib/db/schema";
import type { ExtractedLeadSignal } from "@/lib/revenue-os/lead-signal-extractor";

export type InsertLeadSignalsInput = {
  userId: string;
  clientId: string;
  trustId: string;
  signals: ExtractedLeadSignal[];
};

export type InsertLeadSignalsResult = {
  ids: string[];
};

function toDecimalString(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return String(Math.min(1, Math.max(0, n)));
}

/**
 * Inserts one row per signal. Empty input yields `{ ids: [] }`.
 */
export async function insertLeadSignals(input: InsertLeadSignalsInput): Promise<InsertLeadSignalsResult> {
  const { userId, clientId, trustId, signals } = input;
  if (!signals.length) {
    return { ids: [] };
  }

  const db = await getDb();
  const ids: string[] = [];
  const uid = String(userId);
  const cid = (clientId ?? "").trim();
  const tid = (trustId ?? "").trim();

  for (const s of signals) {
    const id = crypto.randomUUID();
    await db.insert(bentleyLeadSignals).values({
      id,
      userId: uid,
      clientId: cid,
      trustId: tid,
      sourcePlatform: String(s.sourcePlatform ?? "").slice(0, 64),
      sourceType: String(s.sourceType ?? "comment").slice(0, 48),
      sourceRef: s.sourceRef != null ? String(s.sourceRef).slice(0, 512) : null,
      topic: s.topic != null ? String(s.topic).slice(0, 256) : null,
      hookType: s.hookType != null ? String(s.hookType).slice(0, 64) : null,
      angle: s.angle != null ? String(s.angle).slice(0, 512) : null,
      sentimentScore: toDecimalString(s.sentimentScore),
      commercialIntentScore: toDecimalString(s.commercialIntentScore),
      urgencyScore: toDecimalString(s.urgencyScore),
      handoffReadiness: toDecimalString(s.handoffReadiness),
      extractedText: String(s.extractedText ?? "").slice(0, 65000),
      extractedEntitiesJson: s.extractedEntitiesJson,
      recommendedFollowup: String(s.recommendedFollowup ?? "").slice(0, 512),
      experimentId: s.experimentId != null ? String(s.experimentId).slice(0, 36) : null,
      experimentVariantId: s.experimentVariantId != null ? String(s.experimentVariantId).slice(0, 36) : null,
      signalClass: String(s.signalClass ?? "unknown").slice(0, 48),
    });
    ids.push(id);
  }

  return { ids };
}
