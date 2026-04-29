/**
 * Phase 4I — Build optimization bias from a saved generation variant row.
 */

import { and, eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { bentleyGenerationVariants } from "@/lib/db/schema.bentley-social-leads";
import { extractScalingSignals } from "@/lib/generation-memory/extractScalingSignals";
import type { VariantOptimizationBias } from "@/lib/revenue-os/unified-generation-types";

const MAX_BULLETS = 8;
const BULLET_LEN = 240;

function bulletsFromSnapshot(snap: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const brief = typeof snap.campaignBrief === "string" ? snap.campaignBrief.trim() : "";
  if (brief) lines.push(`Campaign brief: ${brief.slice(0, BULLET_LEN)}`);
  const notes = typeof snap.userNotesOriginal === "string" ? snap.userNotesOriginal.trim() : "";
  if (notes) lines.push(`User notes excerpt: ${notes.slice(0, BULLET_LEN)}`);
  const genRules = snap.generationRules;
  if (genRules && typeof genRules === "object") {
    lines.push(`Generation rules: ${JSON.stringify(genRules).slice(0, 400)}`);
  }
  return lines.filter(Boolean).slice(0, MAX_BULLETS);
}

export async function loadVariantCloneBiasForUser(
  userId: number,
  variantId: string
): Promise<VariantOptimizationBias | null> {
  const id = variantId.trim();
  if (!id) return null;

  const db = await getDb();
  const [row] = await db
    .select()
    .from(bentleyGenerationVariants)
    .where(and(eq(bentleyGenerationVariants.id, id), eq(bentleyGenerationVariants.userId, userId)))
    .limit(1);

  if (!row) return null;

  const snap = row.unifiedContextSnapshotJson as Record<string, unknown>;
  const gen = row.generatedOutputJson as Record<string, unknown>;
  const signals = extractScalingSignals(snap, gen);
  const referenceSnapshotBullets = bulletsFromSnapshot(snap);

  return {
    schemaVersion: 1,
    sourceVariantId: row.id,
    experimentGroupId: row.experimentGroupId,
    variantTag: row.variantTag,
    operatorHints: [
      `Reference variant ${row.variantTag} (${row.id.slice(0, 8)}…).`,
      "Mirror hook structure, CTA directness, and offer clarity from the reference.",
      "Vary wording — do not copy verbatim; keep the same strategic angles.",
    ].join(" "),
    painThemes: signals.painThemes,
    ctaAngles: signals.ctaAngles,
    offerAngles: signals.offerAngles,
    referenceSnapshotBullets,
  };
}
