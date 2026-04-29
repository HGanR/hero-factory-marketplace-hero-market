/**
 * Trust Records Collateral Pool Detail API
 * GET: Get pool with assets
 * PATCH: Update pool
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  trusts,
  trustCollateralPools,
  trustCollateralPoolAssets,
} from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ poolId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { poolId } = await ctx.params;
  if (!poolId) return NextResponse.json({ error: "Invalid poolId" }, { status: 400 });

  const db = await getDb();
  const [pool] = await db
    .select()
    .from(trustCollateralPools)
    .where(eq(trustCollateralPools.id, poolId))
    .limit(1);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, pool.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const assets = await db
    .select()
    .from(trustCollateralPoolAssets)
    .where(eq(trustCollateralPoolAssets.poolId, poolId));

  return NextResponse.json({
    ok: true,
    pool: {
      id: pool.id,
      trustId: pool.trustId,
      name: pool.name,
      description: pool.description,
      coverageRatio: pool.coverageRatio ? Number(pool.coverageRatio) : null,
      haircutMethod: pool.haircutMethod,
      valuationDate: pool.valuationDate?.toISOString().slice(0, 10),
      totalEstimatedValue: pool.totalEstimatedValue ? Number(pool.totalEstimatedValue) : null,
      createdAt: pool.createdAt?.toISOString(),
      updatedAt: pool.updatedAt?.toISOString(),
    },
    assets: assets.map((a) => ({
      id: a.id,
      poolId: a.poolId,
      assetId: a.assetId,
      allocatedValue: a.allocatedValue ? Number(a.allocatedValue) : null,
      lienPosition: a.lienPosition,
      notes: a.notes,
      createdAt: a.createdAt?.toISOString(),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ poolId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { poolId } = await ctx.params;
  if (!poolId) return NextResponse.json({ error: "Invalid poolId" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const [pool] = await db
    .select()
    .from(trustCollateralPools)
    .where(eq(trustCollateralPools.id, poolId))
    .limit(1);
  if (!pool) return NextResponse.json({ error: "Pool not found" }, { status: 404 });

  const [trust] = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, pool.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (!trust) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  const allowed = [
    "name",
    "description",
    "coverageRatio",
    "haircutMethod",
    "valuationDate",
    "totalEstimatedValue",
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) updates[key] = body[key];
  }
  if (body.coverageRatio != null) updates.coverageRatio = String(body.coverageRatio);
  if (body.totalEstimatedValue != null) updates.totalEstimatedValue = String(body.totalEstimatedValue);
  if (body.valuationDate === null) updates.valuationDate = null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, pool });
  }

  await db
    .update(trustCollateralPools)
    .set(updates as any)
    .where(eq(trustCollateralPools.id, poolId));

  const [updated] = await db
    .select()
    .from(trustCollateralPools)
    .where(eq(trustCollateralPools.id, poolId))
    .limit(1);

  return NextResponse.json({
    ok: true,
    pool: {
      id: updated.id,
      trustId: updated.trustId,
      name: updated.name,
      description: updated.description,
      coverageRatio: updated.coverageRatio ? Number(updated.coverageRatio) : null,
      haircutMethod: updated.haircutMethod,
      valuationDate: updated.valuationDate?.toISOString().slice(0, 10),
      totalEstimatedValue: updated.totalEstimatedValue ? Number(updated.totalEstimatedValue) : null,
      createdAt: updated.createdAt?.toISOString(),
      updatedAt: updated.updatedAt?.toISOString(),
    },
  });
}
