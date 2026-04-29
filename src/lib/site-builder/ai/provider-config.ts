import { z } from "zod";

/** Safe metadata returned to clients (never includes decrypted keys). */
export type SiteBuilderAiSettingsPublic = {
  siteId: string;
  llmMode: "off" | "platform" | "byok";
  endpoint: string | null;
  model: string | null;
  hasApiKey: boolean;
  fallbackToPlatform: boolean;
  updatedAt: string | null;
};

export const PutSiteBuilderAiSettingsSchema = z.object({
  llmMode: z.enum(["off", "platform", "byok"]),
  endpoint: z.string().max(512).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  /** When omitted or empty, existing encrypted key is preserved. */
  apiKey: z.string().max(2000).optional().nullable(),
  fallbackToPlatform: z.boolean().optional().default(false),
});

export type PutSiteBuilderAiSettings = z.infer<typeof PutSiteBuilderAiSettingsSchema>;
