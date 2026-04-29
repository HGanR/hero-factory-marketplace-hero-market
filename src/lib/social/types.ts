/**
 * Shared types for social platform adapters.
 */

export type PublishInput = {
  caption: string;
  assetUrl?: string;
  /** From `campaign_assets.creative_type` when publishing with media. */
  assetCreativeType?: string | null;
  linkUrl?: string;
  hashtags?: string[];
};

export type PublishResult = {
  platformPostId: string;
};

export type SocialAccount = {
  id: string;
  userId: string;
  clientId: string;
  platform: string;
  authType: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  externalAccountId?: string | null;
  scopes?: string | null;
  displayName?: string | null;
};

export interface SocialAdapter {
  publish(account: SocialAccount, input: PublishInput): Promise<PublishResult>;
}
