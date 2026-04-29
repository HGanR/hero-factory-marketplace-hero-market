import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { modelPlans, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { z } from "zod";
import { BuildPlanSchema } from "@/lib/modeling/prompt-schema";
import { hashPlan } from "@/lib/modeling/canonical-plan";

async function ensureTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS model_plans (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT NOT NULL,
      trustId VARCHAR(36),
      name VARCHAR(255) NOT NULL,
      planKind VARCHAR(32) NOT NULL,
      planVersion INT NOT NULL,
      planJson TEXT NOT NULL,
      planHash VARCHAR(64),
      prompt TEXT,
      seed INT,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX model_plans_user_idx (userId),
      INDEX model_plans_trust_idx (trustId),
      INDEX model_plans_kind_idx (planKind)
    )
  `);
}

export async function GET(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = await getDb();
    await ensureTable(db);

    const { searchParams } = new URL(req.url);
    const trustId = searchParams.get("trustId");
    const kind = searchParams.get("kind");

    let query = db
      .select()
      .from(modelPlans)
      .where(eq(modelPlans.userId, userId))
      .orderBy(desc(modelPlans.updatedAt));

    const rows = await query;
    let filtered = rows;
    if (trustId) filtered = filtered.filter((r) => r.trustId === trustId);
    if (kind) filtered = filtered.filter((r) => r.planKind === kind);

    const plans = filtered.map((r) => ({
      id: r.id,
      name: r.name,
      planKind: r.planKind,
      planVersion: r.planVersion,
      prompt: r.prompt,
      trustId: r.trustId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({ plans });
  } catch (err) {
    console.error("modeling/plans GET:", err);
    return NextResponse.json({ error: "Failed to list plans" }, { status: 500 });
  }
}

const CreateSchema = {
  name: (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.length <= 255,
  planJson: (v: unknown) => typeof v === "object" && v !== null,
  prompt: (v: unknown) => v == null || typeof v === "string",
  trustId: (v: unknown) => v == null || (typeof v === "string" && v.length <= 36),
};

export async function POST(req: Request) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const planJson = body?.planJson;
    const prompt = body?.prompt ?? null;
    const trustId = body?.trustId ?? null;

    if (!CreateSchema.name(name)) return NextResponse.json({ error: "name is required (1-255 chars)" }, { status: 400 });
    if (!CreateSchema.planJson(planJson)) return NextResponse.json({ error: "planJson is required" }, { status: 400 });
    if (!CreateSchema.prompt(prompt)) return NextResponse.json({ error: "Invalid prompt" }, { status: 400 });
    if (!CreateSchema.trustId(trustId)) return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });

    const plan = BuildPlanSchema.parse(planJson);
    const seed = "seed" in plan && typeof plan.seed === "number" ? plan.seed : null;
    const planHash = hashPlan(plan);

    const db = await getDb();
    if (trustId) {
      const [trustRow] = await db
        .select({ userId: trusts.userId })
        .from(trusts)
        .where(eq(trusts.id, trustId))
        .limit(1);
      if (!trustRow) return NextResponse.json({ error: "Trust not found" }, { status: 404 });
      if (trustRow.userId !== userId)
        return NextResponse.json({ error: "No access to this trust" }, { status: 403 });
    }
    await ensureTable(db);

    await db.insert(modelPlans).values({
      userId,
      trustId: trustId || null,
      name,
      planKind: plan.kind,
      planVersion: plan.version,
      planJson: JSON.stringify(planJson),
      planHash,
      prompt: prompt || null,
      seed,
    });

    const [inserted] = await db
      .select()
      .from(modelPlans)
      .where(eq(modelPlans.userId, userId))
      .orderBy(desc(modelPlans.id))
      .limit(1);

    return NextResponse.json({ plan: inserted ?? { name, planKind: plan.kind } });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid plan", validationErrors: err.issues.map((e) => `${e.path.join(".")}: ${e.message}`) },
        { status: 400 }
      );
    }
    console.error("modeling/plans POST:", err);
    return NextResponse.json({ error: "Failed to create plan" }, { status: 500 });
  }
}
