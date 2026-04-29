import { z } from "zod";

const ptJobStatusZ = z.enum([
  "draft",
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
]);

const ptJobModeZ = z.enum(["photogrammetry", "gaussian", "neural", "hybrid", "manual"]);

export const ptCreatePropertySchema = z.object({
  name: z.string().min(1).max(256),
  slug: z.string().max(128).nullable().optional(),
  description: z.string().max(16_000).nullable().optional(),
  ownerWallet: z.string().max(128).nullable().optional(),
});

export const ptPatchPropertySchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    slug: z.string().max(128).nullable().optional(),
    description: z.string().max(16_000).nullable().optional(),
    ownerWallet: z.string().max(128).nullable().optional(),
  })
  .strict();

export const ptCreateJobSchema = z.object({
  mode: ptJobModeZ.default("photogrammetry"),
  status: z.enum(["draft", "queued"]).default("draft"),
  inputAssetIds: z.array(z.number().int().positive()).default([]),
});

export const ptCreateNodeSchema = z
  .object({
    zone: z.string().min(1).max(64).default("general"),
    label: z.string().min(1).max(256),
    nodeType: z.string().min(1).max(64).default("planning"),
    sortOrder: z.number().int().default(0),
    payload: z.record(z.string(), z.unknown()).optional(),
    anchorX: z.number().finite().optional(),
    anchorY: z.number().finite().optional(),
    anchorZ: z.number().finite().optional(),
    estimatedCost: z.number().int().nonnegative().nullable().optional(),
    estimatedValueLift: z.number().int().nonnegative().nullable().optional(),
    roiPercent: z.number().int().nullable().optional(),
  })
  .strict()
  .refine(
    (d) => {
      const parts = [d.anchorX, d.anchorY, d.anchorZ].filter((v) => v !== undefined);
      return parts.length === 0 || parts.length === 3;
    },
    { message: "anchorX, anchorY, anchorZ must all be provided together", path: ["anchorX"] }
  );

export const ptPatchNodeSchema = z
  .object({
    zone: z.string().min(1).max(64).optional(),
    label: z.string().min(1).max(256).optional(),
    nodeType: z.string().min(1).max(64).optional(),
    sortOrder: z.number().int().optional(),
    payload: z.record(z.string(), z.unknown()).nullable().optional(),
    anchorX: z.number().finite().nullable().optional(),
    anchorY: z.number().finite().nullable().optional(),
    anchorZ: z.number().finite().nullable().optional(),
    estimatedCost: z.number().int().nonnegative().nullable().optional(),
    estimatedValueLift: z.number().int().nonnegative().nullable().optional(),
    roiPercent: z.number().int().nullable().optional(),
  })
  .strict()
  .refine(
    (d) => {
      const parts = [d.anchorX, d.anchorY, d.anchorZ].filter((v) => v !== undefined);
      return parts.length === 0 || parts.length === 3;
    },
    { message: "anchorX, anchorY, anchorZ must all be provided together", path: ["anchorX"] }
  );

export type PtPatchNodeInput = z.infer<typeof ptPatchNodeSchema>;

const roomAnchorZ = z.object({
  name: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const ptReconstructionJobResultSchema = z.object({
  outputUrl: z.string().min(1).max(1024),
  previewImageUrl: z.string().max(1024).optional(),
  metadataUrl: z.string().max(1024).optional(),
  format: z.enum(["glb", "gltf", "splat", "pointcloud"]),
  roomAnchors: z.array(roomAnchorZ).optional(),
  warnings: z.array(z.string()).optional(),
});

/** Public client: only status transitions (submit / cancel). */
export const ptPatchJobPublicSchema = z
  .object({
    status: ptJobStatusZ,
  })
  .strict();

/** Worker / internal: full job patch. */
export const ptPatchJobInternalSchema = z
  .object({
    status: ptJobStatusZ.optional(),
    progress: z.number().int().min(0).max(100).optional(),
    errorMessage: z.string().max(16_000).nullable().optional(),
    outputUrl: z.string().max(1024).nullable().optional(),
    inputAssetIds: z.array(z.number().int().positive()).optional(),
    resultJson: ptReconstructionJobResultSchema.nullable().optional(),
  })
  .strict();

export type PtCreatePropertyInput = z.infer<typeof ptCreatePropertySchema>;
export type PtPatchJobInternalInput = z.infer<typeof ptPatchJobInternalSchema>;
