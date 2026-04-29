import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { modelPlans } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { z } from "zod";
import { BuildPlanSchema } from "@/lib/modeling/prompt-schema";
import { hashPlan } from "@/lib/modeling/canonical-plan";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const db = await getDb();
    const [row] = await db.select().from(modelPlans).where(eq(modelPlans.id, id)).limit(1);
    if (!row) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (row.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const planJson = JSON.parse(row.planJson);
    return NextResponse.json({
      id: row.id,
      name: row.name,
      planKind: row.planKind,
      planVersion: row.planVersion,
      planJson,
      planHash: row.planHash ?? null,
      prompt: row.prompt,
      seed: row.seed,
      trustId: row.trustId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  } catch (err) {
    console.error("modeling/plans/[id] GET:", err);
    return NextResponse.json({ error: "Failed to load plan" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const db = await getDb();

    const [existing] = await db.select().from(modelPlans).where(eq(modelPlans.id, id)).limit(1);
    if (!existing) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (existing.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || name.length > 255) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      const updatedAt = body.updatedAt != null ? String(body.updatedAt) : null;
      if (updatedAt && existing.updatedAt && String(existing.updatedAt) !== updatedAt) {
        return NextResponse.json(
          { error: "Plan was updated elsewhere", code: "CONFLICT" },
          { status: 409 }
        );
      }
      updates.name = name;
    }

    if (body.planJson !== undefined) {
      const plan = BuildPlanSchema.parse(body.planJson);
      updates.planJson = JSON.stringify(body.planJson);
      updates.planKind = plan.kind;
      updates.planVersion = plan.version;
      updates.planHash = hashPlan(plan);
      updates.seed = "seed" in plan && typeof plan.seed === "number" ? plan.seed : null;
    }

    if (Object.keys(updates).length === 0) {
      const planJson = JSON.parse(existing.planJson);
      return NextResponse.json({ plan: { ...existing, planJson } });
    }

    await db.update(modelPlans).set(updates as Record<string, unknown>).where(eq(modelPlans.id, id));

    const [updated] = await db.select().from(modelPlans).where(eq(modelPlans.id, id)).limit(1);
    const planJson = JSON.parse(updated!.planJson);
    return NextResponse.json({ plan: { ...updated, planJson } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid plan", validationErrors: err.issues.map((e) => `${e.path.join(".")}: ${e.message}`) },
        { status: 400 }
      );
    }
    console.error("modeling/plans/[id] PUT:", err);
    return NextResponse.json({ error: "Failed to update plan" }, { status: 500 });
  }
}
