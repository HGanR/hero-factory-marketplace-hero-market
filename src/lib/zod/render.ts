import { z } from "zod";

export const Lane = z.enum(["CREATE", "STUDIO"]);
export const RenderKind = z.enum(["MOCKUP_FRONT", "MOCKUP_BACK", "FLAT", "LIFESTYLE"]);
export const StylePreset = z.enum(["MINIMAL", "STREETWEAR", "VINTAGE", "Y2K", "ATHLEISURE"]);
export const Placement = z.enum(["CENTER_CHEST", "LEFT_CHEST", "FULL_FRONT", "UPPER_BACK", "FULL_BACK"]);

export const GenerateRenderRequest = z.object({
  lane: Lane,
  projectId: z.string().min(1),
  prompt: z.string().min(3).max(1200),
  negativePrompt: z.string().max(1200).optional(),
  seed: z.number().int().nonnegative().optional(),
  garmentTemplateId: z.string().min(1),
  garmentColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  placement: Placement.default("CENTER_CHEST"),
  stylePreset: StylePreset.default("STREETWEAR"),
  kinds: z.array(RenderKind).min(1).max(4),
  sizePx: z.number().int().min(512).max(1536).default(1024),
});

export const InpaintRequest = z.object({
  projectId: z.string().min(1),
  versionId: z.string().min(1),
  baseRenderId: z.string().min(1),
  prompt: z.string().min(3).max(1200),
  maskAssetId: z.string().min(1),
  sizePx: z.number().int().min(512).max(1536).default(1024),
});

