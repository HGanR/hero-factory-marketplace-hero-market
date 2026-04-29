/**
 * Idempotent DB row for Bentley-generated campaigns — keyed by `bentleyRunId`.
 */

import crypto from "crypto";
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";

export type BentleyGenerationPayload = {
  campaign: CampaignResponse;
  /** Content strategy platform labels (questionnaire). */
  platforms: string[];
  /** OAuth posting targets (canonical). */
  postingPlatforms?: string[];
  /** Dashboard / intake — used for optional auto-generated post images. */
  tone?: string;
  imageStyle?: string;
  syncedAt: string;
};

export type EnsureCampaignFromBentleyInput = {
  userId: string;
  clientId: string;
  bentleyRunId: string;
  campaign: CampaignResponse;
  platforms: string[];
  postingPlatforms?: string[];
  businessName?: string;
  tone?: string;
  imageStyle?: string;
};

export type EnsureCampaignFromBentleyResult = {
  id: string;
  created: boolean;
};

function campaignDisplayName(input: EnsureCampaignFromBentleyInput): string {
  const bn = input.businessName?.trim();
  if (bn) return `${bn.slice(0, 120)} — Bentley`;
  const offer = input.campaign.offerStatement?.trim() ?? "";
  if (offer) return offer.slice(0, 200);
  return "Bentley campaign";
}

export async function ensureCampaignFromBentley(
  db: MySql2Database<typeof schema>,
  input: EnsureCampaignFromBentleyInput
): Promise<EnsureCampaignFromBentleyResult> {
  const bentleyRunId = input.bentleyRunId.trim();
  if (!bentleyRunId) {
    throw new Error("bentleyRunId is required");
  }

  const tone = input.tone?.trim();
  const imageStyle = input.imageStyle?.trim();
  const generation: BentleyGenerationPayload = {
    campaign: input.campaign,
    platforms: [...(input.platforms ?? [])],
    postingPlatforms: input.postingPlatforms ? [...input.postingPlatforms] : undefined,
    ...(tone ? { tone } : {}),
    ...(imageStyle ? { imageStyle } : {}),
    syncedAt: new Date().toISOString(),
  };

  const name = campaignDisplayName(input).slice(0, 200);
  const objective = (input.campaign.offerStatement ?? "").trim().slice(0, 200) || null;
  const clientId = input.clientId.trim();

  const existing = await db
    .select({ id: schema.campaigns.id, userId: schema.campaigns.userId })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.bentleyRunId, bentleyRunId))
    .limit(1);

  const row = existing[0];
  if (row) {
    if (String(row.userId) !== String(input.userId)) {
      throw new Error("Bentley run id is already bound to another user");
    }
    await db
      .update(schema.campaigns)
      .set({
        clientId,
        name,
        objective,
        bentleyGenerationJson: generation,
        updatedAt: new Date(),
      })
      .where(eq(schema.campaigns.id, row.id));
    return { id: row.id, created: false };
  }

  const id = crypto.randomUUID();
  await db.insert(schema.campaigns).values({
    id,
    userId: String(input.userId),
    clientId,
    name,
    objective,
    status: "DRAFT",
    bentleyRunId,
    bentleyGenerationJson: generation,
  });

  return { id, created: true };
}
