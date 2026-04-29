import { z } from "zod";

export const EntityTypeSchema = z.enum([
  "Trust",
  "LLC",
  "LP",
  "HoldingCo",
  "Bank",
  "RealEstate",
  "IP",
  "Other",
]);

export const EntityNodeDataSchema = z.object({
  label: z.string().min(1),
  entityType: EntityTypeSchema,
  subtitle: z.string().optional(),
});

export const EntityMapNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: EntityNodeDataSchema,
});

export const EntityMapEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  label: z.string().optional(),
  animated: z.boolean().optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

export const EntityMapUpsertSchema = z.object({
  title: z.string().min(1).max(255),
  nodes: z.array(EntityMapNodeSchema),
  edges: z.array(EntityMapEdgeSchema),
});

export type EntityMapUpsertInput = z.infer<typeof EntityMapUpsertSchema>;
