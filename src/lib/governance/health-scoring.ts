/**
 * Governance Health Scoring for Complex Trusts
 * 
 * Provides passive, read-only indicators of governance compliance status.
 */

import { getDb } from "@/lib/db";
import { trusts, resolutions, minutes, minuteBooks } from "@/lib/db/schema";
import { eq, and, gte, desc } from "drizzle-orm";

export type HealthStatus = "healthy" | "warning" | "critical";

export interface HealthIssue {
  severity: "critical" | "warning";
  category: string;
  message: string;
  actionUrl?: string;
}

export interface GovernanceHealthScore {
  status: HealthStatus;
  score: number; // 0-100
  issues: HealthIssue[];
  lastReviewDate: string | null;
  nextReviewDue: string | null;
}

/**
 * Calculate governance health score for a Complex Trust
 */
export async function calculateGovernanceHealth(trustId: string): Promise<GovernanceHealthScore> {
  const db = await getDb();

  // Fetch trust
  const trustRows = await db.select().from(trusts).where(eq(trusts.id, trustId)).limit(1);
  if (trustRows.length === 0) {
    throw new Error("Trust not found");
  }

  const trust = trustRows[0];

  // Only calculate for Complex Trusts
  if (trust.trustMode !== "complex" && !trust.complexTrustMode) {
    return {
      status: "healthy",
      score: 100,
      issues: [],
      lastReviewDate: null,
      nextReviewDue: null,
    };
  }

  const issues: HealthIssue[] = [];
  let score = 100;

  // 1. Check for annual trustee review (should be within last 12 months)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const minuteBookRows = await db
    .select()
    .from(minuteBooks)
    .where(eq(minuteBooks.trustId, trustId))
    .limit(1);

  let lastReviewDate: string | null = null;
  if (minuteBookRows.length > 0) {
    const minuteBook = minuteBookRows[0];
    const reviewMinutes = await db
      .select()
      .from(minutes)
      .where(
        and(
          eq(minutes.minuteBookId, minuteBook.id),
          eq(minutes.status, "approved")
        )
      )
      .orderBy(desc(minutes.actionDate))
      .limit(10);

        // Look for annual fiduciary review resolutions
        // Note: We'll need to add "ANNUAL_FIDUCIARY_REVIEW" to the resolutionType enum or use a different approach
        // For now, check by title pattern
        for (const min of reviewMinutes) {
          const resRows = await db
            .select()
            .from(resolutions)
            .where(eq(resolutions.minutesId, min.id))
            .limit(10);

          // Check if any resolution title contains "annual" or "fiduciary review"
          const annualReviewRes = resRows.find(
            (r) =>
              r.title.toLowerCase().includes("annual") ||
              r.title.toLowerCase().includes("fiduciary review")
          );

          if (annualReviewRes) {
            lastReviewDate = min.actionDate?.toISOString() || null;
            break;
          }
        }
  }

  if (!lastReviewDate || new Date(lastReviewDate) < oneYearAgo) {
    issues.push({
      severity: "critical",
      category: "Annual Review",
      message: "Missing annual trustee review (should be completed within last 12 months)",
      actionUrl: `/trust-records/${trustId}/governance/minutes/new?resolutionType=ANNUAL_FIDUCIARY_REVIEW`,
    });
    score -= 30;
  }

  // 2. Check for income accumulation without acknowledgment
  // (This would require tracking income accumulation actions - simplified for now)
  // TODO: Implement when income tracking is available

  // 3. Check for entity actions without recent trust approvals
  // (This would require tracking entity ownership and actions - simplified for now)
  // TODO: Implement when entity ownership tracking is available

  // 4. Check for outdated resolutions (expired or near expiration)
  if (minuteBookRows.length > 0) {
    const minuteBook = minuteBookRows[0];
    const allResolutions = await db
      .select()
      .from(resolutions)
      .innerJoin(minutes, eq(resolutions.minutesId, minutes.id))
      .where(
        and(
          eq(minutes.minuteBookId, minuteBook.id),
          eq(resolutions.status, "approved")
        )
      );

    const now = new Date();
    for (const row of allResolutions) {
      const res = row.resolutions;
      if (res.expirationDate) {
        const expiration = new Date(res.expirationDate);
        const daysUntilExpiration = Math.floor((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilExpiration < 0) {
          issues.push({
            severity: "critical",
            category: "Expired Resolution",
            message: `Resolution "${res.title}" expired on ${expiration.toLocaleDateString()}`,
            actionUrl: `/trust-records/${trustId}/governance/resolutions/${res.id}`,
          });
          score -= 15;
        } else if (daysUntilExpiration < 30) {
          issues.push({
            severity: "warning",
            category: "Expiring Resolution",
            message: `Resolution "${res.title}" expires in ${daysUntilExpiration} days`,
            actionUrl: `/trust-records/${trustId}/governance/resolutions/${res.id}`,
          });
          score -= 5;
        }
      }
    }
  }

  // Determine overall status
  let status: HealthStatus = "healthy";
  if (score < 70) {
    status = "critical";
  } else if (score < 90) {
    status = "warning";
  }

  // Calculate next review due date
  const nextReviewDue = lastReviewDate
    ? new Date(new Date(lastReviewDate).setFullYear(new Date(lastReviewDate).getFullYear() + 1)).toISOString()
    : null;

  return {
    status,
    score: Math.max(0, score),
    issues,
    lastReviewDate,
    nextReviewDue,
  };
}
