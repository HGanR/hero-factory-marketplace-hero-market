import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { marketplaceUsers, entityOnboardings, executiveAgentMemoryItems } from "@/lib/db/schema";
import type { ExecutiveActionExecutor } from "./executive-action-executors";

const payloadSchema = z.object({ review: z.object({
  kind: z.enum(["pending_membership", "completed_intake"]),
  subjectId: z.string().regex(/^[1-9]\d*$/), evidence: z.string().max(1000),
}) });

/** Only records an internal human review. It never approves accounts or invokes providers. */
export const recordRevenueOpportunityReview: ExecutiveActionExecutor = async (ctx, raw) => {
  const payload = payloadSchema.safeParse(raw);
  if (!payload.success) return { ok: false, status: "failed", message: "Invalid revenue review." };
  const review = payload.data.review;
  const subjectId = Number(review.subjectId);
  if (!Number.isSafeInteger(subjectId)) return { ok: false, status: "failed", message: "Invalid subject ID." };
  const rows = review.kind === "pending_membership"
    ? await ctx.db.select({ id: marketplaceUsers.id }).from(marketplaceUsers)
      .where(and(eq(marketplaceUsers.id, subjectId), eq(marketplaceUsers.isApproved, false))).limit(1)
    : await ctx.db.select({ id: entityOnboardings.id }).from(entityOnboardings)
      .where(and(eq(entityOnboardings.id, subjectId), eq(entityOnboardings.onboardingStatus, "submitted"), eq(entityOnboardings.isRevoked, false))).limit(1);
  if (!rows.length) return { ok: false, status: "failed", message: "Opportunity is no longer current; no review recorded." };
  await ctx.db.insert(executiveAgentMemoryItems).values({ id: randomUUID(), adminUserId: ctx.adminUserId,
    memoryType: "decision", source: "approval", subjectType: review.kind, subjectId: review.subjectId,
    title: "Revenue opportunity reviewed", summary: "Human-approved internal review recorded. No account approval, contact, charge, or publication occurred. " + review.evidence });
  return { ok: true, status: "executed", message: "Internal review recorded. No account approval, contact, charge, or publication occurred." };
};
