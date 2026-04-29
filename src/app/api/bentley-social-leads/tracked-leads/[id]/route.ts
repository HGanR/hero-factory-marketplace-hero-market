import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyTrackedLeads } from "@/lib/db/schema.bentley-social-leads";
import {
  normalizeOutcomePatch,
  type OutcomePatchInput,
} from "@/lib/bentley-social-leads/applyTrackedLeadOutcomePatch";

import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
export const runtime = "nodejs";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as OutcomePatchInput;

  const db = await getDb();
  const [row] = await db
    .select()
    .from(bentleyTrackedLeads)
    .where(and(eq(bentleyTrackedLeads.id, id), eq(bentleyTrackedLeads.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { patch, error } = normalizeOutcomePatch(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (Object.keys(patch).length <= 1) {
    return NextResponse.json({ lead: row });
  }

  await db.update(bentleyTrackedLeads).set(patch as never).where(eq(bentleyTrackedLeads.id, id));

  const [next] = await db.select().from(bentleyTrackedLeads).where(eq(bentleyTrackedLeads.id, id)).limit(1);
  return NextResponse.json({ lead: next });
}
