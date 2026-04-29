import { z } from "zod";

/** All dimensions stored in meters. Clamp to avoid GPU blowups. */
const DIM_MAX_M = 200;
const DIM_MIN_M = 0.1;

const dim = () => z.number().positive().min(DIM_MIN_M).max(DIM_MAX_M);
const doorsWindows = () => z.number().int().min(0).max(20);

const StyleSchema = z.enum(["modern", "classic", "minimal"]);

/** Parsed plans always store meters. No units field stored. */
const RoomPlanSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("room"),
    w: dim().default(8),
    d: dim().default(6),
    h: dim().default(3),
    doors: doorsWindows().default(1),
    windows: doorsWindows().default(2),
    style: StyleSchema.default("modern"),
    seed: z.number().int().optional(),
  })
  .strict();

const FootprintSchema = z.object({
  w: dim(),
  d: dim(),
});

const OfficeHQPlanSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("office_hq"),
    floors: z.number().int().min(1).max(4).default(1),
    footprint: FootprintSchema.default({ w: 12, d: 10 }),
    rooms: z.array(z.string()).max(20).default(["reception", "conference", "vault"]),
    style: StyleSchema.default("modern"),
    seed: z.number().int().optional(),
  })
  .strict();

const ConferenceRoomPlanSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("conference_room"),
    w: dim().default(6),
    d: dim().default(5),
    h: dim().default(3),
    tableSeats: z.number().int().min(2).max(40).default(8),
    style: StyleSchema.default("modern"),
    seed: z.number().int().optional(),
  })
  .strict();

const PodiumPlanSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("podium"),
    w: dim().default(0.6),
    d: dim().default(0.4),
    h: dim().default(1.1),
    hasPlaque: z.boolean().default(true),
    style: StyleSchema.default("classic"),
    seed: z.number().int().optional(),
  })
  .strict();

const PlacementAnchorSchema = z.enum(["center", "near_wall", "on_table", "near_door"]);

/** wallThickness must be < min(w,d)/2 and >= 0.2 */
const VaultRoomPlanSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("vault_room"),
    w: dim().default(4),
    d: dim().default(4),
    h: dim().default(3),
    wallThickness: z.number().positive().min(0.2).max(2),
    hasTable: z.boolean().default(true),
    style: StyleSchema.default("classic"),
    seed: z.number().int().optional(),
  })
  .strict()
  .refine(
    (p) => p.wallThickness < Math.min(p.w, p.d) / 2,
    { message: "wallThickness must be < min(w,d)/2" }
  );

const AtomicBuildPlanSchema = z.discriminatedUnion("kind", [
  RoomPlanSchema,
  OfficeHQPlanSchema,
  ConferenceRoomPlanSchema,
  PodiumPlanSchema,
  VaultRoomPlanSchema,
]);

const ScenePlanSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("scene"),
    seed: z.number().int().default(0),
    objects: z
      .array(
        z
          .object({
            id: z.string().min(1).max(128),
            label: z.string().min(1).max(120).optional(),
            locked: z.boolean().optional(),
            plan: AtomicBuildPlanSchema,
            transform: z
              .object({
                position: z.tuple([z.number(), z.number(), z.number()]).optional(),
                rotationY: z.number().optional(),
                scale: z.number().positive().optional(),
              })
              .strict()
              .optional(),
            placement: z
              .object({
                mode: z.literal("auto"),
                anchor: PlacementAnchorSchema,
              })
              .strict()
              .optional(),
          })
          .strict()
      )
      .min(1)
      .max(50),
  })
  .strict();

export const BuildPlanSchema = z.discriminatedUnion("kind", [
  RoomPlanSchema,
  OfficeHQPlanSchema,
  ConferenceRoomPlanSchema,
  PodiumPlanSchema,
  VaultRoomPlanSchema,
  ScenePlanSchema,
]);

export type BuildPlan = z.infer<typeof BuildPlanSchema>;
export type AtomicBuildPlan = z.infer<typeof AtomicBuildPlanSchema>;
export type RoomPlan = z.infer<typeof RoomPlanSchema>;
export type OfficeHQPlan = z.infer<typeof OfficeHQPlanSchema>;
export type ConferenceRoomPlan = z.infer<typeof ConferenceRoomPlanSchema>;
export type PodiumPlan = z.infer<typeof PodiumPlanSchema>;
export type VaultRoomPlan = z.infer<typeof VaultRoomPlanSchema>;
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

export const BUILD_PLAN_KINDS = ["room", "office_hq", "conference_room", "podium", "vault_room", "scene"] as const;
export type BuildPlanKind = (typeof BUILD_PLAN_KINDS)[number];

export const DIM_MAX_METERS = DIM_MAX_M;
