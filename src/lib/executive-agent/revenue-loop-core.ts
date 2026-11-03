/** Propose-only coordinator. All persistence supplied by one database transaction. */
export type RevenueEvent = { id: string; eventType: string; createdAt: string };
export type RevenueLoopState = { forwardCursor: string | null; catchUpCursor: string | null; lastRunAt: string | null };
export type RevenueReview = {
  kind: "pending_membership" | "completed_intake";
  subjectId: string;
  evidence: string;
};
export interface RevenueLoopDependencies {
  catalog: { id: string; verifiedPricing: boolean; monthlyUsd: number | null; mock: boolean; paymentVerificationBlocked: boolean }[];
  readPage(cursor: string | null, now: Date): Promise<{ events: RevenueEvent[]; nextCursor: string | null }>;
  hasReceipt(eventId: string): Promise<boolean>;
  saveReceipt(eventId: string): Promise<void>;
  reconcileSources(): Promise<{ pending: number; approved: number; reviews: RevenueReview[] }>;
  propose(review: RevenueReview): Promise<boolean>;
  saveState(state: RevenueLoopState): Promise<void>;
}
export async function runRevenueLoopCore(state: RevenueLoopState, deps: RevenueLoopDependencies, now: Date) {
  if (state.lastRunAt && now.getTime() - Date.parse(state.lastRunAt) < 86_400_000) {
    return { skipped: true, reason: "daily_cadence" };
  }
  let newEvents = 0;
  const drain = async (start: string | null) => {
    let cursor = start;
    for (let page = 0; page < 100; page++) {
      const result = await deps.readPage(cursor, now);
      if (result.events.length === 0) return cursor;
      if (!result.nextCursor || result.nextCursor === cursor) throw new Error("Telemetry cursor did not advance");
      for (const event of result.events) {
        if (!(await deps.hasReceipt(event.id))) {
          // Receipts are operational deduplication, never approval to execute.
          await deps.saveReceipt(event.id);
          newEvents++;
        }
      }
      cursor = result.nextCursor;
    }
    throw new Error("Telemetry page budget exceeded; checkpoint unchanged");
  };
  const forwardCursor = await drain(state.forwardCursor);
  // Independent persisted checkpoint, never a rewind from the forward cursor.
  await drain(state.catchUpCursor);
  const reconciled = await deps.reconcileSources();
  let proposed = 0;
  const membership = deps.catalog.find(s => s.id === "membership" && s.verifiedPricing && !s.mock && !s.paymentVerificationBlocked && typeof s.monthlyUsd === "number" && Number.isFinite(s.monthlyUsd) && s.monthlyUsd > 0);
  if (membership) for (const review of reconciled.reviews) if (await deps.propose(review)) proposed++;
  const catchUpCursor = Buffer.from(JSON.stringify({ c: new Date(now.getTime() - 30_000).toISOString(), i: "" })).toString("base64url");
  await deps.saveState({ forwardCursor, catchUpCursor, lastRunAt: now.toISOString() });
  return {
    skipped: false, newEvents, proposed,
    metrics: { source: "database", pendingAccounts: reconciled.pending, approvedActiveAccounts: reconciled.approved },
    billing: { verifiedCollectedRevenue: null, membershipChargingVerified: false },
    notice: "Account counts are not collections. Review proposals do not approve accounts, contact members, or charge money. Source reconciliation covers current actionable state; the telemetry feed remains best-effort.",
  };
}
