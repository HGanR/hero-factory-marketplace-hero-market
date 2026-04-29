import { z } from "zod";

export const VersionKindSchema = z.enum(["GENERATE", "INPAINT", "VARIANT"]);

export const CreateVersionSchema = z.object({
  kind: VersionKindSchema.default("GENERATE"),
  prompt: z.string().max(1200).optional(),
  negativePrompt: z.string().max(1200).optional(),
  seed: z.number().int().nonnegative().optional(),
  modelVersion: z.string().max(120).optional(),
  params: z.record(z.string(), z.unknown()).optional(),
});

