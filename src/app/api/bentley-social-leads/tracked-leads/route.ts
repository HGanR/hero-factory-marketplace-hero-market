import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyTrackedLeads } from "@/lib/db/schema.bentley-social-leads";
import { loadConversionAnalyticsForUser, rowToAnalytics } from "@/lib/bentley-social-leads/loadConversionAnalyticsForUser";
import { computeConversionSummary } from "@/lib/bentley-social-leads/computeConversionSummary";
import { scoreLeadPriority } from "@/lib/bentley-social-leads/scoreLeadPriority";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export const runtime = "nodejs";

const STATUSES = new Set(["new", "contacted", "booked", "closed", "lost"]);
const SOURCES = new Set(["bentley", "manual", "engagement"]);

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const includePriority = url.searchParams.get("includePriority") === "1";

  const db = await getDb();
  const rows = await db
    .select()
    .from(bentleyTrackedLeads)
    .where(eq(bentleyTrackedLeads.userId, userId))
    .orderBy(desc(bentleyTrackedLeads.updatedAt))
    .limit(200);

  if (!includePriority) {
    return NextResponse.json({ leads: rows });
  }

  const { analyticsRows } = await loadConversionAnalyticsForUser(userId, {});
  const summary = computeConversionSummary(analyticsRows);

  const leads = rows.map((r) => {
    const a = rowToAnalytics(r);
    const priority = scoreLeadPriority(a, summary);
    return { ...r, priority };
  });

  return NextResponse.json({ leads, prioritySummaryVersion: analyticsRows.length });
}

export async function POST(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    platform?: string;
    handle?: string;
    comment?: string;
    painType?: string;
    intentScore?: number;
    status?: string;
    source?: string;
    leadRecordId?: string | null;
    contentDeploymentId?: string | null;
  };

  const platform = String(body.platform ?? "").trim().slice(0, 64);
  const handle = String(body.handle ?? "").trim().slice(0, 256);
  const comment = String(body.comment ?? "").trim();
  if (!platform || !handle || comment.length < 2) {
    return NextResponse.json({ error: "platform, handle, and comment (min 2 chars) are required" }, { status: 400 });
  }

  const source = SOURCES.has(String(body.source)) ? String(body.source) : "manual";
  const status = STATUSES.has(String(body.status)) ? String(body.status) : "new";
  const painType = String(body.painType ?? "").slice(0, 128);
  const intentScore = typeof body.intentScore === "number" && Number.isFinite(body.intentScore) ? body.intentScore : 0;

  const id = randomUUID();
  const db = await getDb();

  await db.insert(bentleyTrackedLeads).values({
    id,
    userId,
    platform,
    handle,
    comment,
    painType,
    intentScore: String(intentScore),
    status,
    source,
    leadRecordId: body.leadRecordId?.trim() || null,
    contentDeploymentId: body.contentDeploymentId?.trim() || null,
    rawPayloadJson: { createdVia: "manual_api" },
  });

  const [row] = await db.select().from(bentleyTrackedLeads).where(eq(bentleyTrackedLeads.id, id)).limit(1);
  return NextResponse.json({ lead: row });
}
