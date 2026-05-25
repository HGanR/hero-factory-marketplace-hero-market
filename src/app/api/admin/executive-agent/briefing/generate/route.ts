import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { briefingDateUtc, buildExecutiveDailyBriefing } from "@/lib/executive-agent/executive-briefing-builder";
import { redactExecutiveBriefingJsonValue } from "@/lib/executive-agent/executive-briefing-redact";
import { upsertExecutiveBriefingForAdminDate } from "@/lib/executive-agent/executive-memory-store";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .optional();

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    let dateOverride: string | undefined;
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const raw = await req.json().catch(() => ({}));
      const body = BodySchema.parse(raw);
      dateOverride = body?.date;
    }
    const now = new Date();
    const briefingDate = dateOverride ?? briefingDateUtc(now);
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const briefing = await buildExecutiveDailyBriefing(db, adminUserId, { now, briefingDate });
    const safe = redactExecutiveBriefingJsonValue(briefing);
    const row = await upsertExecutiveBriefingForAdminDate(db, adminUserId, briefingDate, JSON.stringify(safe));
    return NextResponse.json({ briefingDate, briefing: safe, row: row ? { id: row.id, createdAt: row.createdAt } : null });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "BRIEFING_GENERATE_FAILED", message: msg }, { status: 500 });
  }
}
