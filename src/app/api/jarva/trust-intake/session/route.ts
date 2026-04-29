import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trustDrafts, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { JarvaTrustIntakeSchema, parseJarvaTrustIntake, TRUST_INTAKE_SCHEMA_VERSION } from "@/lib/jarva/trust-intake-schema";
import { buildFieldExplainabilityMap, buildFieldSourceMap } from "@/lib/jarva/jarva-lineage";
import { buildJarvaApplyReadiness, evaluateJarvaIntakeReadiness, evaluateJarvaReadinessFull } from "@/lib/jarva/jarva-readiness";
import { JARVA_INTAKE_DRAFT_TYPE, saveJarvaIntakeDraft } from "@/lib/jarva/persist-jarva-intake-draft";

const PostBody = z.object({
  trustId: z.string().min(10).max(64),
  intake: z.unknown(),
  jarvaMode: z.enum(["assist", "build", "review"]).optional(),
});

async function loadTrustForUser(trustId: string, userId: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  return { db, row: rows[0] ?? null };
}

/** GET ?trustId= — latest saved Jarva intake draft (+ lineage) */
export async function GET(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const trustId = (req.nextUrl.searchParams.get("trustId") || "").trim();
  if (trustId.length < 10) return NextResponse.json({ error: "trustId required" }, { status: 400 });

  const { db, row } = await loadTrustForUser(trustId, userId);
  if (!row) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const rows = await db
    .select()
    .from(trustDrafts)
    .where(and(eq(trustDrafts.trustId, trustId), eq(trustDrafts.draftType, JARVA_INTAKE_DRAFT_TYPE)))
    .orderBy(sql`version desc`)
    .limit(1);

  if (rows.length === 0) {
    return NextResponse.json({
      trustId,
      intake: null,
      lineage: [],
      version: 0,
      readiness: null,
      applyReadiness: null,
      readinessFull: null,
      jarvaMode: "assist",
      fieldSources: {},
      fieldExplainability: {},
    });
  }

  let payload: any = null;
  try {
    payload = JSON.parse(String(rows[0]!.payloadJson ?? "null"));
  } catch {
    payload = null;
  }

  let readiness: ReturnType<typeof evaluateJarvaIntakeReadiness> | null = null;
  let applyReadiness: ReturnType<typeof buildJarvaApplyReadiness> | null = null;
  let readinessFull: ReturnType<typeof evaluateJarvaReadinessFull> | null = null;
  if (payload?.intake) {
    const parsed = parseJarvaTrustIntake({
      ...(typeof payload.intake === "object" && payload.intake !== null ? payload.intake : {}),
      schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
      collectedByUserId: userId,
      collectedAt: new Date().toISOString(),
    });
    if (parsed.ok) {
      readiness = evaluateJarvaIntakeReadiness(parsed.data);
      applyReadiness = buildJarvaApplyReadiness(parsed.data);
      readinessFull = evaluateJarvaReadinessFull(parsed.data);
    }
  }

  const fieldSources = buildFieldSourceMap(payload?.lineage);
  const fieldExplainability = buildFieldExplainabilityMap(payload?.lineage);

  return NextResponse.json({
    trustId,
    intake: payload?.intake ?? null,
    lineage: payload?.lineage ?? [],
    version: Number(rows[0]!.version ?? 0),
    readiness,
    applyReadiness,
    readinessFull,
    jarvaMode: (payload?.jarvaMode as "assist" | "build" | "review" | undefined) ?? "assist",
    fieldSources,
    fieldExplainability,
  });
}

/** POST — save Jarva intake snapshot (consultant work-in-progress) */
export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = parseJarvaTrustIntake({
    ...(typeof body.intake === "object" && body.intake !== null ? body.intake : {}),
    schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
    collectedByUserId: userId,
    collectedAt: new Date().toISOString(),
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { db, row } = await loadTrustForUser(body.trustId, userId);
  if (!row) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  try {
    const result = await saveJarvaIntakeDraft({
      db,
      userId,
      trustId: body.trustId,
      trustRow: row,
      intake: JarvaTrustIntakeSchema.parse(parsed.data),
      jarvaMode: body.jarvaMode,
    });

    return NextResponse.json({
      trustId: body.trustId,
      status: "saved",
      version: result.nextVersion,
      intake: JarvaTrustIntakeSchema.parse(parsed.data),
      jarvaMode: result.jarvaMode ?? "assist",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    if (msg === "Intake payload too large") return NextResponse.json({ error: msg }, { status: 413 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
