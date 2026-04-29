import type { getDb } from "@/lib/db";
import type { ChatContext } from "@/lib/npc/llm-bridge";
import { loadLatestJarvaIntakePayload } from "@/lib/jarva/persist-jarva-intake-draft";
import { buildJarvaApplyReadiness, evaluateJarvaIntakeReadiness, evaluateJarvaReadinessFull } from "@/lib/jarva/jarva-readiness";
import { parseJarvaTrustIntake, TRUST_INTAKE_SCHEMA_VERSION } from "@/lib/jarva/trust-intake-schema";
import { buildJarvaProceduralInputFromChat } from "@/lib/jarva/jarva-chat-procedural-input";
import { computeJarvaDocumentAssemblyHints, type JarvaDocumentAssemblyHints } from "@/lib/jarva/jarva-document-assembly-hints";
import type { JarvaEntryRoute } from "@/lib/jarva/jarva-entry-router";
import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";
import { buildWorkspaceSummaryForTrust } from "@/lib/trusts/build-workspace-summary";

export type JarvaDocumentAssemblyHintsFallbackParams = {
  db: Awaited<ReturnType<typeof getDb>>;
  userId: number;
  trustId: string;
  context: ChatContext;
  jarvaWorkflowPath?: JarvaWorkflowPath | null;
  jarvaEntryRoute?: JarvaEntryRoute | null;
  priorSessionUserMessageCount: number;
};

/**
 * When Jarva chat sync did not run or did not emit hints, derive advisory document-assembly hints from:
 * persisted Jarva intake draft + server workspace summary (same signals as the primary path).
 * Returns null if intake or workspace summary cannot be loaded or parsed — never guess.
 */
export async function computeJarvaDocumentAssemblyHintsFallback(
  params: JarvaDocumentAssemblyHintsFallbackParams
): Promise<JarvaDocumentAssemblyHints | null> {
  const { db, userId, trustId, context, jarvaWorkflowPath, jarvaEntryRoute, priorSessionUserMessageCount } = params;
  if (!String(trustId ?? "").trim()) return null;

  const { payload } = await loadLatestJarvaIntakePayload(db, trustId);
  const rawIntake = payload?.intake;
  if (!rawIntake || typeof rawIntake !== "object") return null;

  const parsed = parseJarvaTrustIntake({
    ...(rawIntake as Record<string, unknown>),
    schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
    collectedByUserId: userId,
    collectedAt: new Date().toISOString(),
  });
  if (!parsed.ok) return null;

  const intake = parsed.data;
  const readiness = evaluateJarvaIntakeReadiness(intake);
  const applyReadiness = buildJarvaApplyReadiness(intake);
  const readinessFull = evaluateJarvaReadinessFull(intake);

  const workspaceSummary = await buildWorkspaceSummaryForTrust(db, trustId, userId);
  if (!workspaceSummary) return null;

  const proceduralInput = buildJarvaProceduralInputFromChat(context, {
    completenessPct: applyReadiness.completenessPercent,
    coreOk: readiness.ok,
    workspaceSummary,
    readinessFull,
    applyReadiness,
  });
  const proceduralWithJarva = {
    ...proceduralInput,
    jarvaEntryRoute: jarvaEntryRoute ?? undefined,
    priorSessionUserMessageCount,
    jarvaWorkflowPath: jarvaWorkflowPath ?? undefined,
  };

  return computeJarvaDocumentAssemblyHints({
    workProduct: workspaceSummary.workProduct,
    proceduralInput: proceduralWithJarva,
    intakeReadinessOk: readiness.ok,
    completenessPercent: applyReadiness.completenessPercent,
    applyReadinessBlockers: applyReadiness.blockers,
  });
}
