import { z } from "zod";

/** World Blueprint — structured scene graph for AI 3D world generation.
 * Source of truth for Spell-like world assembly. All dimensions in meters.
 */
const vec3 = () =>
  z.tuple([z.number(), z.number(), z.number()]);

const transformSchema = z.object({
  position: vec3().optional(),
  rotation: vec3().optional(),
  scale: z.union([z.number(), vec3()]).optional(),
});

const physicsSchema = z.object({
  collider: z.enum(["none", "box", "sphere", "mesh"]).optional(),
  mass: z.number().min(0).max(10000).optional(),
});

/** Object in scene: references asset from Oasis library by id or assetUri */
export const WorldObjectSchema = z.object({
  id: z.string().min(1).max(128),
  type: z.enum(["prop", "building", "terrain", "vegetation", "light"]).default("prop"),
  assetRef: z.union([
    z.number().int().positive(), // oasis_world_elements.id
    z.string().min(1).max(512), // assetUri path or ipfs://...
  ]),
  transform: transformSchema.optional(),
  physics: physicsSchema.optional(),
  materialOverrides: z.record(z.string(), z.unknown()).optional(),
  tags: z.array(z.string()).max(20).optional(), // e.g. ["walkable", "interactive"]
  locked: z.boolean().optional(),
});

export const terrainParamsSchema = z.object({
  heightmap: z.string().optional(),
  heightScale: z.number().min(0).max(100).optional(),
  texturePack: z.string().optional(),
  biome: z.enum(["grassland", "forest", "desert", "snow", "urban", "water", "coastal"]).optional(),
});

export const lightingSchema = z.object({
  ambient: z.number().min(0).max(2).optional(),
  directional: z
    .object({
      direction: vec3().optional(),
      intensity: z.number().min(0).max(5).optional(),
      color: z.string().optional(),
    })
    .optional(),
});

export const WorldBlueprintSchema = z
  .object({
    worldId: z.string().min(1).max(64),
    seed: z.number().int().default(0),
    biome: z.string().max(64).optional(),
    stylePreset: z.enum(["modern", "classic", "minimal", "fantasy", "scifi"]).optional(),
    terrain: terrainParamsSchema.optional(),
    objects: z.array(WorldObjectSchema).min(0).max(200),
    lighting: lightingSchema.optional(),
    spawnPoints: z.array(vec3()).max(20).optional(),
    navmeshRef: z.string().optional(),
    postProcessing: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type WorldBlueprint = z.infer<typeof WorldBlueprintSchema>;
export type WorldObject = z.infer<typeof WorldObjectSchema>;

export function validateWorldBlueprint(raw: unknown): WorldBlueprint {
  return WorldBlueprintSchema.parse(raw);
}

export function safeParseWorldBlueprint(raw: unknown) {
  return WorldBlueprintSchema.safeParse(raw);
}
