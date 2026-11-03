import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { executiveAgentMemoryItems, executiveAgentApprovals, marketplaceUsers, entityOnboardings } from "@/lib/db/schema";
import { insertExecutiveApproval } from "./executive-agent-approvals-store";
import { insertExecutiveAgentAuditLog } from "./executive-agent-audit";
import { getPendingAccounts, getApprovedAccounts } from "./executive-agent-tools";
import { EXECUTIVE_MRR_PER_APPROVED_ACCOUNT, EXECUTIVE_ACCOUNT_SETUP_VALUE } from "./executive-revenue-value";
import { decodeTelemetryFeedCursor, listTelemetryEventsFromDb } from "@/app/api/admin/executive-agent/telemetry/feed/telemetry-feed-route-handler";
import { runRevenueLoopCore, type RevenueLoopState } from "./revenue-loop-core";

const stableId = (key: string) => createHash("sha256").update("skipper-revenue-v1:" + key).digest("hex").slice(0, 32);
const initial: RevenueLoopState = { forwardCursor: null, catchUpCursor: null, lastRunAt: null };

/** Existing memory table stores archived internal checkpoints/receipts, hidden from active prompt memory. No migration. */
export async function runRevenueLoop(adminUserId: number, now = new Date()) {
  const db = await getDb();
  const stateId = stableId(`state:${adminUserId}`);
  await db.insert(executiveAgentMemoryItems).values({
    id: stateId, adminUserId, memoryType: "system_note", source: "system",
    subjectType: "revenue_loop_state", title: "Revenue loop checkpoint v1", summary: JSON.stringify(initial), archivedAt: now,
  }).onDuplicateKeyUpdate({ set: { id: stateId } });
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(executiveAgentMemoryItems)
      .where(and(eq(executiveAgentMemoryItems.id, stateId), eq(executiveAgentMemoryItems.adminUserId, adminUserId)))
      .limit(1).for("update");
    if (!row) throw new Error("Revenue loop checkpoint unavailable");
    const state = JSON.parse(row.summary) as RevenueLoopState;
    if (![state.forwardCursor, state.catchUpCursor].every(c => c === null || typeof c === "string") ||
      !(state.lastRunAt === null || (typeof state.lastRunAt === "string" && Number.isFinite(Date.parse(state.lastRunAt))))) {
      throw new Error("Invalid revenue loop checkpoint; operator inspection required");
    }
    const result = await runRevenueLoopCore(state, {
      catalog: [{ id: "membership", verifiedPricing: true, monthlyUsd: EXECUTIVE_MRR_PER_APPROVED_ACCOUNT, mock: false, paymentVerificationBlocked: false }],
      readPage: (cursor, fixedNow) => listTelemetryEventsFromDb(tx as unknown as Parameters<typeof listTelemetryEventsFromDb>[0], decodeTelemetryFeedCursor(cursor), 100, fixedNow),
      hasReceipt: async id => {
        const [receipt] = await tx.select({ id: executiveAgentMemoryItems.id }).from(executiveAgentMemoryItems)
          .where(eq(executiveAgentMemoryItems.id, stableId(`event:${adminUserId}:${id}`))).limit(1);
        return Boolean(receipt);
      },
      saveReceipt: async id => {
        await tx.insert(executiveAgentMemoryItems).values({ id: stableId(`event:${adminUserId}:${id}`), adminUserId,
          memoryType: "system_note", source: "system", subjectType: "revenue_event_receipt", subjectId: id,
          title: "Telemetry receipt v1", summary: "Observed, not executed", archivedAt: now });
      },
      reconcileSources: async () => {
        const ctx = { db: tx as unknown as Parameters<typeof getPendingAccounts>[0]["db"], adminUserId };
        const pending = await getPendingAccounts(ctx);
        const approved = await getApprovedAccounts(ctx);
        const accounts = await tx.select({ id: marketplaceUsers.id }).from(marketplaceUsers)
          .where(eq(marketplaceUsers.isApproved, false)).limit(1001);
        const intakes = await tx.select({ id: entityOnboardings.id }).from(entityOnboardings)
          .where(and(eq(entityOnboardings.isRevoked, false), eq(entityOnboardings.onboardingStatus, "submitted"))).limit(1001);
        if (accounts.length > 1000 || intakes.length > 1000) throw new Error("Reconciliation budget exceeded; checkpoint unchanged");
        return { pending: pending.pendingAllTime, approved: approved.approvedActive, reviews: [
          ...accounts.map(a => ({ kind: "pending_membership" as const, subjectId: String(a.id), evidence: "marketplace_users.isApproved=false; review eligibility only" })),
          ...intakes.map(a => ({ kind: "completed_intake" as const, subjectId: String(a.id), evidence: "entity_onboardings.onboardingStatus=submitted, isRevoked=false; next-step history not verified" })),
        ] };
      },
      propose: async review => {
        // Stable IDs are durable dedup across retries, overlapping runs, rejection and execution.
        const id = stableId(`review:${adminUserId}:${review.kind}:${review.subjectId}`);
        const [existing] = await tx.select({ id: executiveAgentApprovals.id }).from(executiveAgentApprovals)
          .where(eq(executiveAgentApprovals.id, id)).limit(1);
        if (existing) return false;
        await insertExecutiveApproval(tx as unknown as Parameters<typeof insertExecutiveApproval>[0], {
          id, adminUserId, proposedAction: "recordRevenueOpportunityReview", targetType: review.kind, targetId: review.subjectId,
          payloadJson: JSON.stringify({ schemaVersion: "skipper-proposal-v1", mode: "write_request", source: "revenue_loop",
            category: "operations", review, service: "membership", priceModel: { monthlyUsd: EXECUTIVE_MRR_PER_APPROVED_ACCOUNT, setupUsd: EXECUTIVE_ACCOUNT_SETUP_VALUE },
            billingVerified: false, description: "Record an internal review only; no account approval, next-step offer, outreach, billing or publishing." }),
        });
        await insertExecutiveAgentAuditLog(tx as unknown as Parameters<typeof insertExecutiveAgentAuditLog>[0], {
          id: randomUUID(), adminUserId, prompt: null, toolName: "revenue_loop.propose", actionType: "write_request", targetType: review.kind,
          targetId: review.subjectId, inputJson: null, outputJson: JSON.stringify({ approvalId: id }), approvalStatus: "pending",
        });
        return true;
      },
      saveState: async next => {
        await tx.update(executiveAgentMemoryItems).set({ summary: JSON.stringify(next), updatedAt: now })
          .where(eq(executiveAgentMemoryItems.id, stateId));
      },
    }, now);
    if (!result.skipped) {
      await tx.insert(executiveAgentMemoryItems).values({ id: randomUUID(), adminUserId, memoryType: "system_note", source: "system", subjectType: "revenue_loop_briefing", title: "Revenue review snapshot " + now.toISOString().slice(0,10), summary: JSON.stringify({ source: "revenue_loop", ...result }) });
      await insertExecutiveAgentAuditLog(tx as unknown as Parameters<typeof insertExecutiveAgentAuditLog>[0], {
        id: randomUUID(), adminUserId, prompt: null, toolName: "revenue_loop.read_and_reconcile", actionType: "read", targetType: "telemetry",
        inputJson: null, outputJson: JSON.stringify(result), approvalStatus: "not_required",
      });
    }
    return result;
  });
}
