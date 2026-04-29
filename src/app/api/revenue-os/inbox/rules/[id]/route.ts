import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { getAuthedUserId } from "@/lib/api/auth";
import { getDb } from "@/lib/db";
import { socialEngagementRules } from "@/lib/db/schema";
import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
import { validateRulePayload } from "@/lib/social/engagement/engagement-rule-validation";

const Patch = z.object({
  name: z.string().min(1).max(200).optional(),
  conditionsJson: z.unknown().optional(),
  actionsJson: z.unknown().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/revenue-os/inbox/rules/:id
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await enforceRevenueOsApiAccess(req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const raw = await req.json().catch(() => ({}));
  const p = Patch.safeParse(raw);
  if (!p.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }
  const db = await getDb();
  const ex = await db
    .select()
    .from(socialEngagementRules)
    .where(and(eq(socialEngagementRules.id, id), eq(socialEngagementRules.userId, String(userId))))
    .limit(1);
  if (!ex[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const set: Record<string, unknown> = {};
  if (p.data.name != null) {
    set.name = p.data.name.trim();
  }
  if (p.data.isActive != null) {
    set.isActive = p.data.isActive;
  }
  if (p.data.conditionsJson != null && p.data.actionsJson != null) {
    const v = validateRulePayload(p.data.conditionsJson, p.data.actionsJson);
    if ("error" in v) {
      return NextResponse.json({ error: v.error }, { status: 400 });
    }
    set.conditionsJson = v.conditions;
    set.actionsJson = v.actions;
  } else if (p.data.conditionsJson != null || p.data.actionsJson != null) {
    return NextResponse.json({ error: "Send both conditionsJson and actionsJson together" }, { status: 400 });
  }
  if (Object.keys(set).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }
  set.updatedAt = new Date();
  await db.update(socialEngagementRules).set(set as never).where(eq(socialEngagementRules.id, id));
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/revenue-os/inbox/rules/:id
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await enforceRevenueOsApiAccess(_req);
  if (gate) return gate;
  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const db = await getDb();
  await db
    .delete(socialEngagementRules)
    .where(and(eq(socialEngagementRules.id, id), eq(socialEngagementRules.userId, String(userId))));
  return NextResponse.json({ ok: true });
}
