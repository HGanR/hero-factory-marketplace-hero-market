import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialEngagementRules } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { parseCreateRuleBody, rulePreviewSummary } from "@/lib/social/engagement/engagement-rule-validation";

const Create = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1).max(200),
  conditionsJson: z.unknown(),
  actionsJson: z.unknown(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/revenue-os/inbox/rules?clientId=
 */
export async function GET(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clientId = (new URL(req.url).searchParams.get("clientId") || "").trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId required" }, { status: 400 });
  }
  const db = await getDb();
  const rows = await db
    .select()
    .from(socialEngagementRules)
    .where(and(eq(socialEngagementRules.userId, String(userId)), eq(socialEngagementRules.clientId, clientId)))
    .orderBy(desc(socialEngagementRules.updatedAt));
  const items = rows.map((r) => {
    const c = (r.conditionsJson ?? {}) as Parameters<typeof rulePreviewSummary>[0];
    const a = (r.actionsJson ?? {}) as Parameters<typeof rulePreviewSummary>[1];
    const summary = rulePreviewSummary(c, a);
    return {
      id: r.id,
      name: r.name,
      clientId: r.clientId,
      isActive: r.isActive,
      conditionsJson: r.conditionsJson,
      actionsJson: r.actionsJson,
      conditionsLine: summary.conditionsLine,
      actionsLine: summary.actionsLine,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
  return NextResponse.json({ items });
}

/**
 * POST /api/revenue-os/inbox/rules
 */
export async function POST(req: NextRequest) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = await req.json().catch(() => ({}));
  const p = Create.safeParse(raw);
  if (!p.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const v = parseCreateRuleBody(p.data);
  if ("error" in v) {
    return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const id = randomUUID();
  const db = await getDb();
  await db.insert(socialEngagementRules).values({
    id,
    userId: String(userId),
    clientId: p.data.clientId.trim(),
    name: p.data.name.trim(),
    conditionsJson: v.conditions,
    actionsJson: v.actions,
    isActive: p.data.isActive ?? true,
  });
  return NextResponse.json({ ok: true, id });
}
