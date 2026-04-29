import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getAuthedUserId } from "@/lib/api/auth";
import { modelPlans, trustScenePlanRecords, trusts } from "@/lib/db/schema";
import { BuildPlanSchema } from "@/lib/modeling/prompt-schema";
import { hashPlan } from "@/lib/modeling/canonical-plan";

async function ensureTable(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS trust_scene_plan_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      trustId VARCHAR(36) NOT NULL,
      userId INT NOT NULL,
      planId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      notes TEXT,
      metadataJson TEXT NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
      INDEX trust_scene_plan_records_trust_idx (trustId),
      INDEX trust_scene_plan_records_user_idx (userId),
      INDEX trust_scene_plan_records_plan_idx (planId)
    )
  `);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await params;
  if (!trustId || trustId.length < 10) {
    return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });
  }

  try {
    const db = await getDb();
    await ensureTable(db);

    const [trustRow] = await db
      .select({ id: trusts.id })
      .from(trusts)
      .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
      .limit(1);
    if (!trustRow) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

    const rows = await db
      .select()
      .from(trustScenePlanRecords)
      .where(eq(trustScenePlanRecords.trustId, trustId))
      .orderBy(desc(trustScenePlanRecords.createdAt));

    const records = rows.map((r) => ({
      id: r.id,
      title: r.title,
      notes: r.notes,
      planId: r.planId,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      metadata: JSON.parse(r.metadataJson || "{}"),
    }));

    return NextResponse.json({ records });
  } catch (err) {
    console.error("trust-records scene-plans GET:", err);
    return NextResponse.json({ error: "Failed to list scene plans" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ trustId: string }> }
) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { trustId } = await params;
  if (!trustId || trustId.length < 10) {
    return NextResponse.json({ error: "Invalid trustId" }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const planId = Number(body?.planId);
    const title = String(body?.title ?? "").trim();
    const notes = body?.notes == null ? null : String(body.notes);

    if (!Number.isFinite(planId) || planId <= 0) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }
    if (title.length > 255) {
      return NextResponse.json({ error: "title is too long" }, { status: 400 });
    }

    const db = await getDb();
    await ensureTable(db);

    const [trustRow] = await db
      .select({ id: trusts.id })
      .from(trusts)
      .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
      .limit(1);
    if (!trustRow) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

    const [planRow] = await db
      .select()
      .from(modelPlans)
      .where(eq(modelPlans.id, planId))
      .limit(1);
    if (!planRow) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    if (planRow.userId !== userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const parsedPlan = BuildPlanSchema.parse(JSON.parse(planRow.planJson));
    if (parsedPlan.kind !== "scene") {
      return NextResponse.json({ error: "Only scene plans can be filed" }, { status: 400 });
    }

    const resolvedPlanHash = planRow.planHash ?? hashPlan(parsedPlan);
    const metadata = {
      planId: planRow.id,
      planHash: resolvedPlanHash,
      planKind: "scene" as const,
      planVersion: planRow.planVersion,
      seed: planRow.seed ?? parsedPlan.seed ?? 0,
      createdFrom: "modeling" as const,
      createdAtIso: new Date().toISOString(),
    };

    await db.insert(trustScenePlanRecords).values({
      trustId,
      userId,
      planId: planRow.id,
      title: title || planRow.name,
      notes,
      metadataJson: JSON.stringify(metadata),
    });

    const [created] = await db
      .select()
      .from(trustScenePlanRecords)
      .where(and(eq(trustScenePlanRecords.trustId, trustId), eq(trustScenePlanRecords.planId, planRow.id)))
      .orderBy(desc(trustScenePlanRecords.id))
      .limit(1);

    return NextResponse.json({
      record: {
        id: created?.id,
        trustId,
        planId: planRow.id,
        title: created?.title ?? (title || planRow.name),
        notes: created?.notes ?? notes,
        createdAt: created?.createdAt ?? new Date(),
        metadata,
      },
    });
  } catch (err) {
    console.error("trust-records scene-plans POST:", err);
    return NextResponse.json({ error: "Failed to file scene plan" }, { status: 500 });
  }
}

