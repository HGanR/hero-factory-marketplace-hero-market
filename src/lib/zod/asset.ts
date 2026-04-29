import { z } from "zod";

export const AssetTypeSchema = z.enum(["GARMENT_TEMPLATE", "LOGO", "REFERENCE", "BRAND_KIT", "MASK"]);

export const CreateAssetSchema = z.object({
  type: AssetTypeSchema,
  name: z.string().min(1).max(120),
  url: z.string().min(1),
  ownerId: z.string().min(1).max(120).optional(),
  metadataJson: z.record(z.string(), z.unknown()).optional(),
});

