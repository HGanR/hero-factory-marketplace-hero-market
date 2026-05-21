import { z } from "zod";

/** v1 Claude WEBSITE sales intake — structured fields only; no Trust/Bentley/Content360. */
export const WebsiteIntakeContactSchema = z.object({
  email: z.string().email().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  website: z.string().trim().max(500).optional(),
});

export const WebsiteIntakeSocialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(32),
  url: z.string().trim().min(1).max(500),
});

export const ClaudeWebsiteIntakeSchema = z.object({
  businessName: z.string().trim().max(200).optional(),
  businessType: z.string().trim().max(120).optional(),
  industry: z.string().trim().max(120).optional(),
  niche: z.string().trim().max(120).optional(),
  targetAudience: z.string().trim().max(500).optional(),
  desiredPages: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  websiteGoals: z.array(z.string().trim().min(1).max(300)).max(15).optional(),
  colorPreferences: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  stylePreferences: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  primaryCTA: z.string().trim().max(200).optional(),
  contactInfo: WebsiteIntakeContactSchema.optional(),
  socialLinks: z.array(WebsiteIntakeSocialLinkSchema).max(12).optional(),
  bookingNeeded: z.boolean().optional(),
  ecommerceNeeded: z.boolean().optional(),
  trustSignals: z.array(z.string().trim().min(1).max(200)).max(15).optional(),
  referenceSites: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  launchUrgency: z.enum(["low", "normal", "high", "rush"]).optional(),
});

export type ClaudeWebsiteIntake = z.infer<typeof ClaudeWebsiteIntakeSchema>;

export type WebsiteIntakeContact = z.infer<typeof WebsiteIntakeContactSchema>;

export type WebsiteIntakeSocialLink = z.infer<typeof WebsiteIntakeSocialLinkSchema>;

/** Normalized WEBSITE intake profile for Skipper + Site Builder routing. */
export type WebsiteIntakeNormalized = {
  businessName: string | null;
  businessType: string | null;
  industry: string | null;
  niche: string | null;
  targetAudience: string | null;
  desiredPages: string[];
  websiteGoals: string[];
  colorPreferences: string[];
  stylePreferences: string[];
  primaryCTA: string | null;
  contactInfo: WebsiteIntakeContact | null;
  socialLinks: WebsiteIntakeSocialLink[];
  bookingNeeded: boolean | null;
  ecommerceNeeded: boolean | null;
  trustSignals: string[];
  referenceSites: string[];
  launchUrgency: "low" | "normal" | "high" | "rush" | null;
};

export const WEBSITE_INTAKE_READINESS_TIERS = ["weak", "medium", "strong"] as const;

export type WebsiteIntakeReadinessTier = (typeof WEBSITE_INTAKE_READINESS_TIERS)[number];

export type WebsiteIntakeReadiness = {
  tier: WebsiteIntakeReadinessTier;
  score: number;
  fulfillmentReady: boolean;
  missingFields: string[];
  presentFields: string[];
};

export type WebsiteIntakePackage = {
  normalized: WebsiteIntakeNormalized;
  readiness: WebsiteIntakeReadiness;
  skipperSummary: string;
  siteBuilderBrief: string;
};

/** Persisted on handoff snapshot — no deploy/publish flags. */
export type WebsiteIntakeSnapshot = {
  normalized: WebsiteIntakeNormalized;
  readiness: WebsiteIntakeReadiness;
  skipperSummary: string;
  siteBuilderBrief: string;
};
