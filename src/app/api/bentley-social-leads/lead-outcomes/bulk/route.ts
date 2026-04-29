import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Bulk PATCH outcomes for tracked leads (operator batch updates).
 */

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyTrackedLeads } from "@/lib/db/schema.bentley-social-leads";
import { normalizeOutcomePatch, type OutcomePatchInput } from "@/lib/bentley-social-leads/applyTrackedLeadOutcomePatch";

export const runtime = "nodejs";

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
    updates?: Array<{ id: string } & OutcomePatchInput>;
  };

  const updates = Array.isArray(body.updates) ? body.updates : [];
  if (updates.length === 0) {
    return NextResponse.json({ error: "updates array required" }, { status: 400 });
  }
  if (updates.length > 100) {
    return NextResponse.json({ error: "Max 100 updates per request" }, { status: 400 });
  }

  const db = await getDb();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const u of updates) {
    const id = u.id?.trim();
    if (!id) {
      results.push({ id: "", ok: false, error: "missing id" });
      continue;
    }
    const [row] = await db
      .select({ id: bentleyTrackedLeads.id })
      .from(bentleyTrackedLeads)
      .where(and(eq(bentleyTrackedLeads.id, id), eq(bentleyTrackedLeads.userId, userId)))
      .limit(1);
    if (!row) {
      results.push({ id, ok: false, error: "not found" });
      continue;
    }

    const { id: _drop, ...rest } = u;
    const { patch, error } = normalizeOutcomePatch(rest);
    if (error) {
      results.push({ id, ok: false, error });
      continue;
    }

    await db.update(bentleyTrackedLeads).set(patch as never).where(eq(bentleyTrackedLeads.id, id));
    results.push({ id, ok: true });
  }

  return NextResponse.json({ results });
}
