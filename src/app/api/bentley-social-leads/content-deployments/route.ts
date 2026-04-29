import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  bentleyContentDeployments,
  bentleyTrackedLeads,
} from "@/lib/db/schema.bentley-social-leads";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export const runtime = "nodejs";

function parseMoney(v: string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function summarizeDeployment(
  deploymentId: string,
  leads: (typeof bentleyTrackedLeads.$inferSelect)[]
) {
  const rel = leads.filter((l) => l.contentDeploymentId === deploymentId);
  let booked = 0;
  let closed = 0;
  let lost = 0;
  let pipeline = 0;
  let closedRev = 0;
  for (const l of rel) {
    if (l.status === "booked") booked++;
    if (l.status === "closed") closed++;
    if (l.status === "lost") lost++;
    pipeline += parseMoney(l.estimatedValue != null ? String(l.estimatedValue) : null);
    closedRev += parseMoney(l.closedValue != null ? String(l.closedValue) : null);
  }
  return {
    trackedCount: rel.length,
    bookedCount: booked,
    closedCount: closed,
    lostCount: lost,
    estimatedPipeline: pipeline,
    closedRevenue: closedRev,
  };
}

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
  const includeAttribution = url.searchParams.get("includeAttribution") === "1";

  const db = await getDb();
  const rows = await db
    .select()
    .from(bentleyContentDeployments)
    .where(eq(bentleyContentDeployments.userId, userId))
    .orderBy(desc(bentleyContentDeployments.updatedAt))
    .limit(80);

  if (!includeAttribution) {
    return NextResponse.json({ deployments: rows });
  }

  const leadRows = await db
    .select()
    .from(bentleyTrackedLeads)
    .where(eq(bentleyTrackedLeads.userId, userId))
    .limit(2000);

  const deployments = rows.map((d) => ({
    ...d,
    attribution: summarizeDeployment(d.id, leadRows),
  }));

  return NextResponse.json({ deployments });
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
    title?: string;
    hook?: string;
    caption?: string;
    cta?: string;
    hashtags?: string[];
    fullExportJson?: Record<string, unknown>;
    contentEngineHash?: string | null;
    generationVariantId?: string | null;
  };

  const platform = String(body.platform ?? "instagram").trim().slice(0, 64);
  const fullExportJson = body.fullExportJson && typeof body.fullExportJson === "object" ? body.fullExportJson : {};

  const id = randomUUID();
  const db = await getDb();
  await db.insert(bentleyContentDeployments).values({
    id,
    userId,
    platform,
    title: String(body.title ?? "").slice(0, 512),
    hook: body.hook != null ? String(body.hook) : null,
    caption: body.caption != null ? String(body.caption) : null,
    cta: body.cta != null ? String(body.cta) : null,
    hashtagsJson: Array.isArray(body.hashtags) ? body.hashtags.map(String) : null,
    fullExportJson,
    contentEngineHash: body.contentEngineHash?.trim() || null,
    generationVariantId: body.generationVariantId?.trim() || null,
    status: "draft",
  });

  const [row] = await db.select().from(bentleyContentDeployments).where(eq(bentleyContentDeployments.id, id)).limit(1);
  return NextResponse.json({ deployment: row });
}
