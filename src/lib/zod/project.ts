import { z } from "zod";

export const LaneSchema = z.enum(["CREATE", "STUDIO"]);

export const CreateProjectSchema = z.object({
  lane: LaneSchema.default("CREATE"),
  name: z.string().min(1).max(120),
  ownerId: z.string().min(1).max(120).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  lane: LaneSchema.optional(),
});

