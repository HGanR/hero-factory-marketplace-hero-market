/**
 * Zod validators for venue interior nodes.
 */
import { z } from "zod";

export const NODE_TYPES = [
  "voice_room",
  "event_stage",
  "seminar_room",
  "chat_room",
  "concert_hall",
  "custom",
] as const;

export const ACCESS_TYPES = ["public", "private", "token_gated", "owner_only"] as const;

export const createVenueNodeSchema = z.object({
  placementId: z.string().min(1, "placementId required").max(64),
  title: z.string().min(1, "title required").max(120),
  slug: z.string().max(80).optional(),
  nodeType: z.enum(NODE_TYPES).default("voice_room"),
  description: z.string().optional(),
  posX: z.number().default(0),
  posY: z.number().default(0),
  posZ: z.number().default(0),
  rotY: z.number().default(0),
  accessType: z.enum(ACCESS_TYPES).default("public"),
});

export const updateVenueNodeSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  slug: z.string().max(80).optional().nullable(),
  nodeType: z.enum(NODE_TYPES).optional(),
  description: z.string().optional().nullable(),
  posX: z.number().optional(),
  posY: z.number().optional(),
  posZ: z.number().optional(),
  rotY: z.number().optional(),
  isActive: z.boolean().optional(),
  accessType: z.enum(ACCESS_TYPES).optional(),
});

export type CreateVenueNodeInput = z.infer<typeof createVenueNodeSchema>;
export type UpdateVenueNodeInput = z.infer<typeof updateVenueNodeSchema>;
