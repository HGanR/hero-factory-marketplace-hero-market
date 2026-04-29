import { z } from "zod";

export const AssetGenRequestSchema = z.object({
  prompt: z.string().min(3).max(2000),
  category: z.enum(["vegetation", "rock", "building", "prop"]).default("prop"),
  style: z.string().min(0).max(80).optional(), // "cyberpunk", "medieval", etc.
  seed: z.number().int().nonnegative().optional(),
  maxTriangles: z.number().int().min(50).max(50000).default(5000),
  sizeMeters: z.number().min(0.1).max(50).default(2),
  /** preview = return glbBase64 only (fast, ephemeral); register = upload to IPFS + DB (durable) */
  mode: z.enum(["preview", "register"]).default("register"),
});

export type AssetGenRequest = z.infer<typeof AssetGenRequestSchema>;

/**
 * What the "AI" must output for the procedural generator.
 * Keep it strict: no freeform descriptions.
 */
export const AssetSpecSchema = z.object({
  kind: z.enum(["tree", "rock", "hut", "crate", "barrel", "lamp", "sign"]),
  seed: z.number().int().nonnegative(),
  scale: z.number().min(0.1).max(50).default(1),
  materials: z.object({
    primary: z.string().default("#6B4E2E"),
    secondary: z.string().default("#2E6B3A"),
  }),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])),
});

export type AssetSpec = z.infer<typeof AssetSpecSchema>;
