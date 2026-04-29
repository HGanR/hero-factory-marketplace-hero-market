import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db";
import { trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { buildJarvaProceduralInputFromChat } from "@/lib/jarva/jarva-chat-procedural-input";
import { computeJarvaDocumentAssemblyHints } from "@/lib/jarva/jarva-document-assembly-hints";
import {
  buildJarvaAdvisoryPackets,
  buildJarvaAdvisoryPacketsMarkdownBundle,
  type JarvaAdvisoryPacket,
} from "@/lib/jarva/jarva-document-packets";
import { lateStepStructuralBlockers } from "@/lib/jarva/jarva-procedural-engine";
import { buildJarvaApplyReadiness, evaluateJarvaIntakeReadiness, evaluateJarvaReadinessFull } from "@/lib/jarva/jarva-readiness";
import { buildJarvaReviewPacketMarkdown } from "@/lib/jarva/jarva-review-packet";
import { mergeIntakeIntoSmartTrustDraft } from "@/lib/jarva/jarva-trust-orchestrator";
import { parseJarvaTrustIntake, TRUST_INTAKE_SCHEMA_VERSION } from "@/lib/jarva/trust-intake-schema";
import { loadLatestJarvaIntakePayload } from "@/lib/jarva/persist-jarva-intake-draft";
import { buildWorkspaceSummaryForTrust } from "@/lib/trusts/build-workspace-summary";
import type { ChatContext } from "@/lib/npc/llm-bridge";

const BodySchema = z.object({
  trustId: z.string().min(10).max(64),
  /** When true and trust-review readiness applies, include full `buildJarvaReviewPacketMarkdown` output in the response. */
  includeFullReviewPacketMarkdown: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const userId = await getAuthedUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { trustId, includeFullReviewPacketMarkdown } = parsed.data;

  const db = await getDb();
  const trustRows = await db
    .select({ id: trusts.id })
    .from(trusts)
    .where(and(eq(trusts.id, trustId), eq(trusts.userId, userId)))
    .limit(1);
  if (trustRows.length === 0) return NextResponse.json({ error: "Trust not found" }, { status: 404 });

  const { payload } = await loadLatestJarvaIntakePayload(db, trustId);
  const rawIntake = payload?.intake;
  if (!rawIntake || typeof rawIntake !== "object") {
    return NextResponse.json(
      { error: "No persisted Jarva intake for this trust — save intake from chat or Trust Records first." },
      { status: 409 }
    );
  }

  const intakeParsed = parseJarvaTrustIntake({
    ...(rawIntake as Record<string, unknown>),
    schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
    collectedByUserId: userId,
    collectedAt: new Date().toISOString(),
  });
  if (!intakeParsed.ok) return NextResponse.json({ error: intakeParsed.error }, { status: 400 });

  const intake = intakeParsed.data;
  const readiness = evaluateJarvaIntakeReadiness(intake);
  const applyReadiness = buildJarvaApplyReadiness(intake);
  const readinessFull = evaluateJarvaReadinessFull(intake);

  const workspaceSummary = await buildWorkspaceSummaryForTrust(db, trustId, userId);
  if (!workspaceSummary) {
    return NextResponse.json({ error: "Workspace summary unavailable" }, { status: 500 });
  }

  const ctx: ChatContext = { trustId };
  const proceduralInput = buildJarvaProceduralInputFromChat(ctx, {
    completenessPct: applyReadiness.completenessPercent,
    coreOk: readiness.ok,
    workspaceSummary,
    readinessFull,
    applyReadiness,
  });

  const hints = computeJarvaDocumentAssemblyHints({
    workProduct: workspaceSummary.workProduct,
    proceduralInput,
    intakeReadinessOk: readiness.ok,
    completenessPercent: applyReadiness.completenessPercent,
    applyReadinessBlockers: applyReadiness.blockers,
  });

  const structuralBlockers = lateStepStructuralBlockers(proceduralInput);

  const packets: JarvaAdvisoryPacket[] = buildJarvaAdvisoryPackets({
    trustId,
    intake,
    hints,
    workProduct: workspaceSummary.workProduct,
    readiness,
    readinessFull,
    applyReadiness,
    structuralBlockers,
  });

  const bundleMarkdown = buildJarvaAdvisoryPacketsMarkdownBundle(packets);

  let fullReviewPacketMarkdown: string | undefined;
  if (includeFullReviewPacketMarkdown && hints.trustReviewPacketReady) {
    const draftPreview = mergeIntakeIntoSmartTrustDraft(null, intake);
    const mappedSummaryLines = [
      `Parties: ${Array.isArray(draftPreview.parties) ? (draftPreview.parties as unknown[]).length : 0} row(s)`,
      `Objectives length: ${String(draftPreview.objectives ?? "").length} chars`,
      `Governing state: ${String(draftPreview.governingState ?? draftPreview.jurisdiction ?? "—")}`,
    ];
    fullReviewPacketMarkdown = buildJarvaReviewPacketMarkdown({
      trustId,
      intake,
      mappedSummaryLines,
      readiness,
      readinessFull,
      applyReadiness,
      lineage: payload?.lineage,
    });
  }

  return NextResponse.json({
    format: "json",
    hints,
    packets,
    bundleMarkdown,
    packetCount: packets.length,
    ...(fullReviewPacketMarkdown ? { fullReviewPacketMarkdown } : {}),
    disclaimer:
      "Advisory draft packets only — DRAFT — not legal advice — not auto-finalized — counsel and platform gates apply.",
  });
}
