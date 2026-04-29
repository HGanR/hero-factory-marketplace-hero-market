import { z } from "zod";

export const TrademarkMarkTypeSchema = z.enum(["standard", "special", "sound"]);
export const TrademarkBasisSchema = z.enum(["use", "intent", "other"]);

export const TrademarkAssetSchema = z.object({
  id: z.string(),
  kind: z.enum(["drawing", "audio", "specimen", "context", "other"]),
  fileName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  sha256: z.string(),
  uri: z.string(),
  uploadedAt: z.string(),
});

export const TrademarkGoodsServiceSchema = z.object({
  id: z.string(),
  classNo: z.string().min(1),
  description: z.string().min(1),
  specimenAssetIds: z.array(z.string()).default([]),
});

export const TrademarkProjectPayloadSchema = z.object({
  clientId: z.string().default(""),
  workspaceId: z.string().default(""),
  ownerName: z.string().default(""),
  ownerEntityType: z.string().default(""),
  ownerAddress: z.string().default(""),
  jurisdiction: z.string().default(""),
  correspondenceEmail: z.string().default(""),
  attorneyName: z.string().default(""),
  attorneyEmail: z.string().default(""),

  markText: z.string().default(""),
  drawingDescription: z.string().default(""),
  colorClaim: z.string().default(""),
  disclaimerText: z.string().default(""),
  translationText: z.string().default(""),
  transliterationText: z.string().default(""),
  soundDescription: z.string().default(""),

  basis: TrademarkBasisSchema.default("intent"),
  firstUseDate: z.string().default(""),
  firstCommerceDate: z.string().default(""),

  goodsServices: z.array(TrademarkGoodsServiceSchema).default([]),
  assets: z.array(TrademarkAssetSchema).default([]),
});

export const TrademarkProjectUpsertSchema = z.object({
  title: z.string().min(1).max(255),
  markType: TrademarkMarkTypeSchema,
  payload: TrademarkProjectPayloadSchema,
});

export type TrademarkProjectPayload = z.infer<typeof TrademarkProjectPayloadSchema>;
export type TrademarkProjectUpsertInput = z.infer<typeof TrademarkProjectUpsertSchema>;
