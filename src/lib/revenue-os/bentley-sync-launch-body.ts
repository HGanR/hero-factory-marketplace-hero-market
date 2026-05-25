import { z } from "zod";

/**
 * POST /api/revenue-os/bentley/sync-launch — shared schema for route + tests.
 */
export const bentleySyncLaunchBodySchema = z
  .object({
    campaignId: z.string().uuid(),
    scheduleStrategy: z.enum(["immediate", "staggered"]).default("immediate"),
    staggerMinutes: z.number().int().min(1).max(1440).optional(),
    /**
     * Admin-only: trusted `content360PlatformScheduled` meta on scheduled posts.
     * Requires `publishRoute === "content360"` and staggered scheduling.
     */
    content360PlatformSchedule: z.boolean().optional(),
    publishRoute: z.enum(["native", "content360", "manual", "export_only"]).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.content360PlatformSchedule === true) {
      if (val.publishRoute !== "content360") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'content360PlatformSchedule requires publishRoute "content360".',
          path: ["publishRoute"],
        });
      }
      if (val.scheduleStrategy !== "staggered") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'content360PlatformSchedule requires scheduleStrategy "staggered" (scheduled publishing).',
          path: ["scheduleStrategy"],
        });
      }
    }
  });

export type BentSyncLaunchBody = z.infer<typeof bentleySyncLaunchBodySchema>;
