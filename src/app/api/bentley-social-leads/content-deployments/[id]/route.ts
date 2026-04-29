import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyContentDeployments } from "@/lib/db/schema.bentley-social-leads";

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
  const body = (await req.json().catch(() => ({}))) as {
    status?: "draft" | "posted";
    generationVariantId?: string | null;
  };

  const db = await getDb();
  const [row] = await db
    .select()
    .from(bentleyContentDeployments)
    .where(and(eq(bentleyContentDeployments.id, id), eq(bentleyContentDeployments.userId, userId)))
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const status = body.status === "posted" ? "posted" : body.status === "draft" ? "draft" : null;
  const hasGenVar = body.generationVariantId !== undefined;
  if (!status && !hasGenVar) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status) {
    patch.status = status;
    patch.postedAt = status === "posted" ? new Date() : null;
  }
  if (hasGenVar) {
    patch.generationVariantId = body.generationVariantId?.trim() || null;
  }

  await db.update(bentleyContentDeployments).set(patch as never).where(eq(bentleyContentDeployments.id, id));

  const [next] = await db.select().from(bentleyContentDeployments).where(eq(bentleyContentDeployments.id, id)).limit(1);
  return NextResponse.json({ deployment: next });
}
