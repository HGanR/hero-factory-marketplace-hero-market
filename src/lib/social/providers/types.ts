export type SocialProviderKey = "facebook" | "linkedin" | "instagram";

export type SocialConnectionSummary = {
  provider: SocialProviderKey;
  providerAccountId: string | null;
  displayName: string | null;
};

export type SocialPublishInput = {
  accessToken: string;
  content: string;
  linkUrl?: string | null;
};

export type SocialPublishResult =
  | { ok: true; externalPostId: string }
  | { ok: false; normalizedError: string; rawMessage: string };

export type SocialProvider = {
  key: SocialProviderKey;
  normalizeError: (err: unknown) => string;
  validateConnection: (
    accessToken: string
  ) => Promise<{ ok: true; summary: SocialConnectionSummary } | { ok: false; error: string }>;
  publish: (input: SocialPublishInput) => Promise<SocialPublishResult>;
};
