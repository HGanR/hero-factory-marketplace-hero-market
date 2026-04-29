import { z } from "zod";
import type { TrustMode } from "./types";

export const TrustModeSchema = z.union([
  z.literal("standard"),
  z.literal("private_safe"),
]) satisfies z.ZodType<TrustMode>;

export const OptionalStateSchema = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .optional();

export const TrustRecordUpdateSchema = z.object({
  trustId: z.string().min(1),

  name: z.string().trim().min(1).max(140).optional(),
  trustMode: TrustModeSchema.optional(),

  // IMPORTANT: Optional — never required in private trust mode
  governingState: OptionalStateSchema,
  situsState: OptionalStateSchema,

  executedAt: z.string().datetime().optional(), // ISO string from client
});




