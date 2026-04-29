/**
 * Standing Resolution Scope Guardrails for Complex Trusts
 * 
 * Enforces that standing resolutions are:
 * - Narrower in scope
 * - Time-limited
 * - Periodically reaffirmed
 */

import { getDb } from "@/lib/db";
import { resolutions, minutes, minuteBooks } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export interface StandingResolutionCheck {
  valid: boolean;
  reason?: string;
  requiresReaffirmation: boolean;
  daysUntilExpiration?: number;
}

/**
 * Validate if a standing resolution can be used for an action
 */
export async function validateStandingResolution(
  resolutionId: string,
  actionAmount?: number
): Promise<StandingResolutionCheck> {
  const db = await getDb();

  const resolutionRows = await db
    .select({
      resolution: resolutions,
      minutes: minutes,
      minuteBook: minuteBooks,
    })
    .from(resolutions)
    .innerJoin(minutes, eq(resolutions.minutesId, minutes.id))
    .innerJoin(minuteBooks, eq(minutes.minuteBookId, minuteBooks.id))
    .where(eq(resolutions.id, resolutionId))
    .limit(1);

  if (resolutionRows.length === 0) {
    return {
      valid: false,
      reason: "Resolution not found",
      requiresReaffirmation: false,
    };
  }

  const { resolution, minutes: min, minuteBook } = resolutionRows[0];

  // Check if it's actually a standing resolution
  if (!resolution.isStanding) {
    return {
      valid: false,
      reason: "Resolution is not a standing resolution",
      requiresReaffirmation: false,
    };
  }

  // Check if resolution is approved
  if (resolution.status !== "approved") {
    return {
      valid: false,
      reason: "Resolution is not approved",
      requiresReaffirmation: false,
    };
  }

  // Check if parent minutes are approved/locked
  if (!["approved", "locked"].includes(min.status || "")) {
    return {
      valid: false,
      reason: "Parent minutes are not approved/locked",
      requiresReaffirmation: false,
    };
  }

  // Check expiration date
  const now = new Date();
  if (resolution.expirationDate) {
    const expiration = new Date(resolution.expirationDate);
    if (expiration < now) {
      return {
        valid: false,
        reason: `Resolution expired on ${expiration.toLocaleDateString()}`,
        requiresReaffirmation: true,
        daysUntilExpiration: 0,
      };
    }
    const daysUntilExpiration = Math.floor((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiration < 30) {
      return {
        valid: true,
        reason: `Resolution expires in ${daysUntilExpiration} days`,
        requiresReaffirmation: true,
        daysUntilExpiration,
      };
    }
  }

  // Check monetary threshold (if action has an amount)
  if (actionAmount !== undefined && resolution.maxDollarThreshold) {
    const threshold = Number(resolution.maxDollarThreshold);
    if (actionAmount > threshold) {
      return {
        valid: false,
        reason: `Action amount ($${actionAmount.toLocaleString()}) exceeds standing resolution threshold ($${threshold.toLocaleString()})`,
        requiresReaffirmation: false,
      };
    }
  }

  // Check annual reaffirmation requirement
  if (resolution.requiresAnnualReaffirmation && resolution.lastReaffirmedAt) {
    const lastReaffirmed = new Date(resolution.lastReaffirmedAt);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (lastReaffirmed < oneYearAgo) {
      return {
        valid: false,
        reason: `Resolution requires annual reaffirmation. Last reaffirmed: ${lastReaffirmed.toLocaleDateString()}`,
        requiresReaffirmation: true,
      };
    }
  } else if (resolution.requiresAnnualReaffirmation && !resolution.lastReaffirmedAt) {
    return {
      valid: false,
      reason: "Resolution requires annual reaffirmation but has never been reaffirmed",
      requiresReaffirmation: true,
    };
  }

  return {
    valid: true,
    requiresReaffirmation: false,
  };
}

/**
 * Actions that can NEVER be covered by standing resolutions (must be specific)
 */
export const STANDING_RESOLUTION_BLOCKED_ACTIONS = [
  "APPOINT_TRUSTEE",
  "REMOVE_TRUSTEE",
  "AMEND_TRUST",
  "CHANGE_SITUS",
  "SALE_LLC_INTEREST",
  "GUARANTEE_FOR_LLC",
  "PLEDGE_ASSETS",
  "LOAN_TAKEN_BY_TRUST",
] as const;

/**
 * Check if an action can be covered by a standing resolution
 */
export function canUseStandingResolutionForAction(action: string): boolean {
  return !STANDING_RESOLUTION_BLOCKED_ACTIONS.includes(action as any);
}
