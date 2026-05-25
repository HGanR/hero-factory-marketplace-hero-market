import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { EXECUTIVE_ROUTINE_CADENCES, EXECUTIVE_ROUTINE_TYPES } from "@/lib/db/schema";
import {
  computeNextExecutiveRoutineRunAt,
  createExecutiveRoutine,
  listExecutiveRoutinesForAdmin,
} from "@/lib/executive-agent/executive-routine-store";
import { ensureDefaultDailyBriefingRoutine, ensureSkipperLearningDigestRoutine } from "@/lib/executive-agent/executive-routine-runner";
import { z } from "zod";

export const dynamic = "force-dynamic";

const PostBodySchema = z.object({
  routineType: z.enum(EXECUTIVE_ROUTINE_TYPES),
  cadence: z.enum(EXECUTIVE_ROUTINE_CADENCES).optional(),
  enabled: z.boolean().optional(),
  configJson: z.string().max(100_000).optional(),
});

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = (await getDb()) as MySql2Database<typeof schema>;
    if (req.nextUrl.searchParams.get("seedDailyBriefing") === "1") {
      await ensureDefaultDailyBriefingRoutine(db, adminUserId);
    }
    if (req.nextUrl.searchParams.get("seedSkipperLearningDigest") === "1") {
      await ensureSkipperLearningDigestRoutine(db, adminUserId);
    }
    const routines = await listExecutiveRoutinesForAdmin(db, adminUserId);
    return NextResponse.json({ routines });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "ROUTINES_LIST_FAILED", message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = PostBodySchema.parse(await req.json());
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const now = new Date();
    const cadence = body.cadence ?? "daily";
    const r = await createExecutiveRoutine(db, {
      adminUserId,
      routineType: body.routineType,
      cadence,
      enabled: body.enabled ?? true,
      configJson: body.configJson ?? "{}",
      nextRunAt: computeNextExecutiveRoutineRunAt(cadence, now),
    });
    if (!r.ok) {
      return NextResponse.json({ error: "DUPLICATE_ROUTINE", routine: r.row }, { status: 409 });
    }
    return NextResponse.json({ routine: r.row });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "ROUTINES_CREATE_FAILED", message: msg }, { status: 500 });
  }
}
