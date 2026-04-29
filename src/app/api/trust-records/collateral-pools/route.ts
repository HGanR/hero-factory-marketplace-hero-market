/**
 * Trust Records Collateral Pools API
 * GET: List collateral pools for a trust
 * POST: Create collateral pool
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { trusts, trustCollateralPools } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const trustId = searchParams.get("trustId");
  if (!trustId) return NextResponse.json({ error: "trustId is required" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const pools = await db
    .select()
    .from(trustCollateralPools)
    .where(eq(trustCollateralPools.trustId, trustId))
    .orderBy(desc(trustCollateralPools.createdAt));

  return NextResponse.json({
    ok: true,
    trustId,
    pools: pools.map((p) => ({
      id: p.id,
      trustId: p.trustId,
      name: p.name,
      description: p.description,
      coverageRatio: p.coverageRatio ? Number(p.coverageRatio) : null,
      haircutMethod: p.haircutMethod,
      valuationDate: p.valuationDate?.toISOString().slice(0, 10),
      totalEstimatedValue: p.totalEstimatedValue ? Number(p.totalEstimatedValue) : null,
      createdAt: p.createdAt?.toISOString(),
      updatedAt: p.updatedAt?.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    trustId: string;
    name: string;
    description?: string;
    coverageRatio?: number;
    haircutMethod?: string;
    valuationDate?: string;
    totalEstimatedValue?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trustId, name } = body;
  if (!trustId) return NextResponse.json({ error: "trustId is required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const id = uuidv4();
  await db.insert(trustCollateralPools).values({
    id,
    trustId,
    name: name.trim(),
    description: body.description ?? null,
    coverageRatio: body.coverageRatio != null ? String(body.coverageRatio) : null,
    haircutMethod: body.haircutMethod ?? null,
    valuationDate: body.valuationDate ? new Date(body.valuationDate) : null,
    totalEstimatedValue: body.totalEstimatedValue != null ? String(body.totalEstimatedValue) : null,
  });

  const [created] = await db
    .select()
    .from(trustCollateralPools)
    .where(eq(trustCollateralPools.id, id))
    .limit(1);

  return NextResponse.json(
    {
      ok: true,
      pool: {
        id: created.id,
        trustId: created.trustId,
        name: created.name,
        description: created.description,
        coverageRatio: created.coverageRatio ? Number(created.coverageRatio) : null,
        haircutMethod: created.haircutMethod,
        valuationDate: created.valuationDate?.toISOString().slice(0, 10),
        totalEstimatedValue: created.totalEstimatedValue ? Number(created.totalEstimatedValue) : null,
        createdAt: created.createdAt?.toISOString(),
      },
    },
    { status: 201 }
  );
}
