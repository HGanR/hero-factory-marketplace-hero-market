import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { buildJarvaReviewPacketMarkdown } from "@/lib/jarva/jarva-review-packet";
import { buildJarvaApplyReadiness, evaluateJarvaIntakeReadiness, evaluateJarvaReadinessFull } from "@/lib/jarva/jarva-readiness";
import { parseJarvaTrustIntake, TRUST_INTAKE_SCHEMA_VERSION } from "@/lib/jarva/trust-intake-schema";
import { mergeIntakeIntoSmartTrustDraft } from "@/lib/jarva/jarva-trust-orchestrator";
import { loadLatestJarvaIntakePayload } from "@/lib/jarva/persist-jarva-intake-draft";

const BodySchema = z.object({
  trustId: z.string().min(10).max(64),
  intake: z.unknown(),
});

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const intakeParsed = parseJarvaTrustIntake({
    ...(typeof parsed.data.intake === "object" && parsed.data.intake !== null ? parsed.data.intake : {}),
    schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
    collectedByUserId: userId,
  });
  if (!intakeParsed.ok) return NextResponse.json({ error: intakeParsed.error }, { status: 400 });

  const db = await getDb();
  const trustRows = await db
    .select({ id: trusts.id })
    .from(trusts)
    .where(and(eq(trusts.id, parsed.data.trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const draftPreview = mergeIntakeIntoSmartTrustDraft(null, intakeParsed.data);
  const mappedSummaryLines = [
    `Parties: ${Array.isArray(draftPreview.parties) ? (draftPreview.parties as unknown[]).length : 0} row(s)`,
    `Objectives length: ${String(draftPreview.objectives ?? "").length} chars`,
    `Governing state: ${String(draftPreview.governingState ?? draftPreview.jurisdiction ?? "—")}`,
  ];

  const readiness = evaluateJarvaIntakeReadiness(intakeParsed.data);
  const applyReadiness = buildJarvaApplyReadiness(intakeParsed.data);
  const readinessFull = evaluateJarvaReadinessFull(intakeParsed.data);
  const { payload: jarvaPayload } = await loadLatestJarvaIntakePayload(db, parsed.data.trustId);

  const markdown = buildJarvaReviewPacketMarkdown({
    trustId: parsed.data.trustId,
    intake: intakeParsed.data,
    mappedSummaryLines,
    readiness,
    readinessFull,
    applyReadiness,
    lineage: jarvaPayload?.lineage,
  });

  return NextResponse.json({
    format: "markdown",
    markdown,
    readiness,
    disclaimer:
      "Draft for legal/counsel review only. Not legal advice. Not a final instrument. Jurisdiction-specific review required.",
  });
}
