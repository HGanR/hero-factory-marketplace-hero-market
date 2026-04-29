import { enforceRevenueOsApiAccess } from "@/lib/revenue-os-api-access";
/**
 * Phase 4H — Persist and list generation variants (A/B/C) with unified context snapshots.
 */

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { requireUserId } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { bentleyGenerationVariants } from "@/lib/db/schema.bentley-social-leads";

export const runtime = "nodejs";

const TAGS = new Set(["A", "B", "C", "D", "E", "control", "default"]);

export async function GET(req: NextRequest) {
  const __rosGate = await enforceRevenueOsApiAccess(req);
  if (__rosGate) return __rosGate;
  let userId: number;
  try {
    userId = requireUserId(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const experimentGroupId = url.searchParams.get("experimentGroupId")?.trim();
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));

  const db = await getDb();
  const conditions = [eq(bentleyGenerationVariants.userId, userId)];
  if (experimentGroupId) conditions.push(eq(bentleyGenerationVariants.experimentGroupId, experimentGroupId));

  const rows = await db
    .select()
    .from(bentleyGenerationVariants)
    .where(and(...conditions))
    .orderBy(desc(bentleyGenerationVariants.createdAt))
    .limit(limit);

  return NextResponse.json({ variants: rows });
}

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
    experimentGroupId?: string;
    variantTag?: string;
    engineKind?: string;
    title?: string;
    unifiedContextSnapshot?: Record<string, unknown>;
    generatedOutput?: Record<string, unknown>;
  };

  const snap = body.unifiedContextSnapshot && typeof body.unifiedContextSnapshot === "object" ? body.unifiedContextSnapshot : null;
  const out = body.generatedOutput && typeof body.generatedOutput === "object" ? body.generatedOutput : null;
  if (!snap || !out) {
    return NextResponse.json({ error: "unifiedContextSnapshot and generatedOutput are required" }, { status: 400 });
  }

  const experimentGroupId = (body.experimentGroupId ?? randomUUID()).trim().slice(0, 36);
  const rawTag = String(body.variantTag ?? "A").trim().slice(0, 16) || "A";
  const variantTag = TAGS.has(rawTag.toLowerCase()) ? rawTag.toUpperCase().slice(0, 8) : rawTag.slice(0, 16);
  const engineKind = String(body.engineKind ?? "content_engine").trim().slice(0, 32) || "content_engine";
  const title = String(body.title ?? "").trim().slice(0, 512);

  const id = randomUUID();
  const db = await getDb();

  await db.insert(bentleyGenerationVariants).values({
    id,
    userId,
    experimentGroupId,
    variantTag,
    engineKind,
    title,
    unifiedContextSnapshotJson: snap,
    generatedOutputJson: out,
  });

  const [row] = await db.select().from(bentleyGenerationVariants).where(eq(bentleyGenerationVariants.id, id)).limit(1);
  return NextResponse.json({ variant: row });
}
