import { getDb } from "@/lib/db";
import { minuteBooks, resolutions, minutes } from "@/lib/db/schema";
import { eq, and, or } from "drizzle-orm";

export type ActionIntent = {
  domain: "BANKING" | "CONTRACTS";
  category: string;
  amount?: number;
  counterparty?: string;
  trustId?: string;
  entityId?: string;
};

function within(amount: number | undefined, max: unknown): boolean {
  if (amount == null) return true;
  if (typeof max !== "number") return true;
  return amount <= max;
}

function allowedCounterparty(cp: string | undefined, allowlist: unknown): boolean {
  if (!cp) return true;
  if (!Array.isArray(allowlist)) return true;
  return allowlist.includes(cp);
}

function allowedCategory(category: string, categories: unknown): boolean {
  if (!Array.isArray(categories)) return false;
  return categories.includes(category);
}

export async function findApplicableStandingResolution(intent: ActionIntent) {
  if (!intent.trustId && !intent.entityId) return null;

  const db = await getDb();

  const minuteBookRows = await db
    .select()
    .from(minuteBooks)
    .where(intent.trustId ? eq(minuteBooks.trustId, intent.trustId) : eq(minuteBooks.entityId, intent.entityId!))
    .limit(1);

  if (minuteBookRows.length === 0) return null;

  const minuteBook = minuteBookRows[0];

  // Only approved/locked standing resolutions
  const standingResolutions = await db
    .select({
      resolution: resolutions,
      minutes: minutes,
    })
    .from(resolutions)
    .innerJoin(minutes, eq(resolutions.minutesId, minutes.id))
    .where(
      and(
        eq(resolutions.isStanding, true),
        eq(resolutions.status, "approved"),
        eq(minutes.minuteBookId, minuteBook.id),
        or(eq(minutes.status, "approved"), eq(minutes.status, "locked"))
      )
    )
    .limit(50);

  for (const { resolution } of standingResolutions) {
    const scope = resolution.standingScope ? JSON.parse(resolution.standingScope as string) : null;
    if (!scope) continue;
    if (scope.domain !== intent.domain) continue;
    if (!allowedCategory(intent.category, scope.categories)) continue;
    if (!within(intent.amount, scope.maxAmount)) continue;
    if (!allowedCounterparty(intent.counterparty, scope.counterparties)) continue;

    // Optional expiration
    if (scope.expiresAt) {
      const exp = new Date(scope.expiresAt);
      if (Number.isFinite(exp.getTime()) && exp < new Date()) continue;
    }

    return resolution;
  }

  return null;
}
