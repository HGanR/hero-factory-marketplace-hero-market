/**
 * Public API shape for connected social accounts (GET /api/social/accounts).
 * Not related to `ContentPlatformId` (strategy/generation chips).
 */

import type { SocialPlatform } from "./config";
import { normalizeAccountPlatformToSocialPlatform } from "./platform-identity";

export type SocialAccountPublic = {
  id: string;
  /** Raw `social_accounts.platform` as stored (backward compatible). */
  platform: string;
  /**
   * Canonical `SocialPlatform` from normalizing `platform`.
   * Prefer for matching posting targets; `null` when the stored value cannot be mapped.
   */
  platformCanonical: SocialPlatform | null;
  displayName: string | null;
  externalAccountId: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};

/** Legacy alias — same as {@link SocialAccountPublic}. */
export type SocialAccountLite = SocialAccountPublic;

function iso(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  if (d instanceof Date) return d.toISOString();
  return typeof d === "string" ? d : null;
}

export function mapSocialAccountRowToPublicApi(row: {
  id: string;
  platform: string;
  displayName: string | null;
  externalAccountId: string | null;
  expiresAt: Date | string | null;
  createdAt: Date | string | null;
}): SocialAccountPublic {
  return {
    id: row.id,
    platform: row.platform,
    platformCanonical: normalizeAccountPlatformToSocialPlatform(row.platform),
    displayName: row.displayName,
    externalAccountId: row.externalAccountId,
    expiresAt: iso(row.expiresAt),
    createdAt: iso(row.createdAt),
  };
}
