import { NextRequest, NextResponse } from "next/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import { briefingDateUtc } from "@/lib/executive-agent/executive-briefing-builder";
import { redactExecutiveBriefingJsonValue } from "@/lib/executive-agent/executive-briefing-redact";
import { getExecutiveBriefingForAdminDate } from "@/lib/executive-agent/executive-memory-store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dateParam = req.nextUrl.searchParams.get("date")?.trim();
  const briefingDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : briefingDateUtc();
  try {
    const db = (await getDb()) as MySql2Database<typeof schema>;
    const row = await getExecutiveBriefingForAdminDate(db, adminUserId, briefingDate);
    if (!row) {
      return NextResponse.json({ briefingDate, briefing: null, row: null });
    }
    let briefing: unknown = null;
    try {
      briefing = JSON.parse(row.summaryJson) as unknown;
      briefing = redactExecutiveBriefingJsonValue(briefing);
    } catch {
      briefing = null;
    }
    return NextResponse.json({
      briefingDate,
      briefing,
      row: { id: row.id, createdAt: row.createdAt },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "BRIEFING_TODAY_FAILED", message: msg }, { status: 500 });
  }
}
