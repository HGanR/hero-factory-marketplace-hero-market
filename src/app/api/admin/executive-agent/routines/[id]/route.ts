import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { EXECUTIVE_ROUTINE_CADENCES } from "@/lib/db/schema";
import { computeNextExecutiveRoutineRunAt, updateExecutiveRoutineForAdmin } from "@/lib/executive-agent/executive-routine-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PatchBodySchema = z.object({
  enabled: z.boolean().optional(),
  cadence: z.enum(EXECUTIVE_ROUTINE_CADENCES).optional(),
  configJson: z.string().max(100_000).optional(),
  nextRunAt: z.string().datetime().optional(),
});

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  }
  try {
    const body = PatchBodySchema.parse(await req.json());
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const patch: {
      enabled?: boolean;
      cadence?: (typeof EXECUTIVE_ROUTINE_CADENCES)[number];
      configJson?: string;
      nextRunAt?: Date;
    } = {};
    if (body.enabled !== undefined) patch.enabled = body.enabled;
    if (body.cadence !== undefined) patch.cadence = body.cadence;
    if (body.configJson !== undefined) patch.configJson = body.configJson;
    if (body.nextRunAt !== undefined) patch.nextRunAt = new Date(body.nextRunAt);
    const row = await updateExecutiveRoutineForAdmin(db, id.trim(), adminUserId, patch);
    if (!row) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ routine: row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "ROUTINES_PATCH_FAILED", message: msg }, { status: 500 });
  }
}
