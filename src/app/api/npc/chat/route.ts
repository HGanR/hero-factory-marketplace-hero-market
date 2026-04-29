import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { ensureClientsTitleColumn } from "@/lib/db/clients-ensure";
import { clients, trustDrafts, trusts } from "@/lib/db/schema";
import { getAuthedUserId } from "@/lib/api/auth";
import { insertAuditLog } from "@/lib/audit";
import { buildNpcResponse } from "@/lib/npc/engine";
import { generateLlmResponse, type ChatContext } from "@/lib/npc/llm-bridge";
import {
  addMessage,
  createSession,
  getKnowledgeForNpc,
  getNpcByNpcId,
  getNpcRowByNpcId,
  getSessionBySessionId,
  getMessagesForSession,
  incrementSessionMessageCount,
  updateSessionJarvaWorkflowPath,
} from "@/lib/npc/db";
import { checkRateLimit } from "@/lib/npc/rate-limit";
import { buildJarvaProceduralInputFromChat } from "@/lib/jarva/jarva-chat-procedural-input";
import { computeJarvaDocumentAssemblyHints } from "@/lib/jarva/jarva-document-assembly-hints";
import { computeJarvaDocumentAssemblyHintsFallback } from "@/lib/jarva/jarva-document-assembly-hints-fallback";
import {
  evaluateJarvaProceduralStep,
  formatProceduralJarvaBanner,
  getJarvaProceduralContextPatch,
  type JarvaProceduralInput,
  type JarvaProceduralStep,
} from "@/lib/jarva/jarva-procedural-engine";
import { buildJarvaNextUiActionBundleFromJarvaState } from "@/lib/jarva/jarva-next-ui-actions";
import { buildJarvaNextActions, filterJarvaNextActionsForProceduralStep } from "@/lib/jarva/jarva-next-actions";
import type { WorkspaceSummaryPayload } from "@/lib/trusts/build-workspace-summary";
import { classifyJarvaEntry, formatJarvaEntryRouterReply } from "@/lib/jarva/jarva-entry-router";
import { formatJarvaWorkflowLaneLabel } from "@/lib/jarva/jarva-chat-ui-actions";
import { parseJarvaLaneControlMessage } from "@/lib/jarva/jarva-lane-control";
import {
  JARVA_WORKFLOW_TRANSCRIPT_SUPPRESS,
  parseJarvaWorkflowPathFromStorage,
  resolveEffectiveJarvaWorkflowPath,
  sessionTranscriptFallbackSuppressed,
  shouldPersistJarvaWorkflowPath,
  type JarvaWorkflowPath,
  type JarvaWorkflowPathSource,
} from "@/lib/jarva/jarva-workflow-path";

const ChatContextSchema = z.object({
  source: z.enum(["trust-records", "smart-trust", "ecclesiastical", "oasis-world", "unknown"]).optional(),
  trustId: z.string().max(64).optional(),
  workspaceId: z.string().max(64).optional(),
  clientId: z.string().max(64).optional(),
  clientName: z.string().max(200).optional(),
  clientTitle: z.string().max(80).optional(),
  trustName: z.string().max(200).optional(),
  entityId: z.string().max(64).optional(),
  currentStep: z.string().max(200).optional(),
  stepFocus: z.string().max(300).optional(),
  moduleType: z.string().max(80).optional(),
  completionPct: z.number().min(0).max(100).optional(),
  blockers: z.array(z.string().max(200)).max(20).optional(),
  advisories: z.array(z.string().max(200)).max(20).optional(),
  workspaceStatus: z.string().max(80).optional(),
  workspaceCounts: z
    .object({
      parties: z.number().int().min(0).max(100000).optional(),
      beneficiaries: z.number().int().min(0).max(100000).optional(),
      assets: z.number().int().min(0).max(100000).optional(),
    })
    .optional(),
  /** Trust Records workspace summary checklist (optional; improves procedural gating when present). */
  workspaceChecklist: z
    .object({
      partiesAndRoles: z.boolean().optional(),
      beneficiaries: z.boolean().optional(),
      assetsAndFundingPlan: z.boolean().optional(),
    })
    .optional(),
  /** From workspace summary workProduct — server-authoritative when from apply/summary API. */
  issuedAssetCertificateCount: z.number().int().min(0).max(100000).optional(),
  securitiesCertificatesIssuedCount: z.number().int().min(0).max(100000).optional(),
  securityOfferingCount: z.number().int().min(0).max(100000).optional(),
  securityOfferingDraftCount: z.number().int().min(0).max(100000).optional(),
  securityOfferingFinalizedCount: z.number().int().min(0).max(100000).optional(),
  securitiesCertificatesIssuedActiveCount: z.number().int().min(0).max(100000).optional(),
  bondInstrumentCount: z.number().int().min(0).max(100000).optional(),
  bondPreIssuanceCount: z.number().int().min(0).max(100000).optional(),
  bondIssuedCount: z.number().int().min(0).max(100000).optional(),
  securityOfferingCancelledCount: z.number().int().min(0).max(100000).optional(),
  securityOfferingErrorCount: z.number().int().min(0).max(100000).optional(),
  securitiesCertificatesVoidedOrReplacedCount: z.number().int().min(0).max(100000).optional(),
  bondClosedCount: z.number().int().min(0).max(100000).optional(),
  bondVoidedCount: z.number().int().min(0).max(100000).optional(),
  hasDraftOffering: z.boolean().optional(),
  hasFinalizedOffering: z.boolean().optional(),
  hasIssuedSecuritiesCertificate: z.boolean().optional(),
  hasIssuedWorkflowAssetCertificate: z.boolean().optional(),
  hasActiveBondWorkflow: z.boolean().optional(),
  hasIssuedBond: z.boolean().optional(),
  playbookId: z.string().max(80).optional(),
  fieldFocus: z.object({ key: z.string().max(100), label: z.string().max(200) }).optional(),
});

function jarvaAppendixStepMilestone(step: JarvaProceduralStep): string {
  if (step === "certificate") {
    return "\n\n**Certificate milestone:** Jarva does not issue certificates automatically. Use Trust Records → Settings (certificate prefix / seal) and Issue → Certificates when your workflow requires issuance.";
  }
  if (step === "review") {
    return "\n\n**Review milestone:** Proceed to internal review packet / export (DRAFT material for counsel — not legal advice or a final client deliverable).";
  }
  if (step === "specialty_guidance") {
    return "\n\n**Specialty workflow:** Use existing Trust Records tabs (Issue, Certificates, Bonds, Estate, securities) — outputs remain **DRAFT** for counsel review.";
  }
  return "";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const npcId = String(body?.npcId || "").trim();
  const message = String(body?.message || "").trim();
  let sessionId = body?.sessionId ? String(body.sessionId) : null;

  if (!npcId) {
    return NextResponse.json({ error: "Missing npcId" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const laneControl = npcId === "trust-advisor" ? parseJarvaLaneControlMessage(message) : null;

  const userId = await getAuthedUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfterSec: rateLimit.retryAfterSec,
      },
      {
        status: 429,
        headers: rateLimit.retryAfterSec
          ? { "Retry-After": String(rateLimit.retryAfterSec) }
          : undefined,
      }
    );
  }

  // Parse and validate context (summary-only, no raw drafts)
  let context: ChatContext | undefined;
  if (body.context && typeof body.context === "object") {
    const parsed = ChatContextSchema.safeParse(body.context);
    if (parsed.success) {
      context = parsed.data as ChatContext;
    }
  }

  // If trustId in context, verify user has access (server-side auth)
  let db = null as Awaited<ReturnType<typeof getDb>> | null;
  if (context?.trustId) {
    db = await getDb();
    const trustRows = await db
      .select({ id: trusts.id, userId: trusts.userId, clientId: trusts.clientId, name: trusts.name })
      .from(trusts)
      .where(eq(trusts.id, context.trustId))
      .limit(1);
    if (trustRows.length === 0) {
      return NextResponse.json({ error: "Trust not found" }, { status: 404 });
    }
    if (trustRows[0]!.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // DB-authoritative enrichment for trust + client linkage
    const trustRow = trustRows[0]!;
    context = {
      ...context,
      trustId: trustRow.id,
      workspaceId: context?.workspaceId || trustRow.id,
      trustName: context?.trustName || trustRow.name || undefined,
      clientId: context?.clientId || trustRow.clientId || undefined,
    };
  }

  // If clientId present (from request or trust enrichment), resolve full client record for Jarva.
  if (context?.clientId) {
    if (!db) db = await getDb();
    await ensureClientsTitleColumn();
    const clientRows = await db
      .select({
        id: clients.id,
        userId: clients.userId,
        firstName: clients.firstName,
        middleName: clients.middleName,
        lastName: clients.lastName,
        suffix: clients.suffix,
        title: clients.title,
        email: clients.email,
        phone: clients.phone,
        addressLine1: clients.addressLine1,
        addressLine2: clients.addressLine2,
        city: clients.city,
        state: clients.state,
        postalCode: clients.postalCode,
        country: clients.country,
      })
      .from(clients)
      .where(and(eq(clients.id, context.clientId), eq(clients.userId, userId)))
      .limit(1);
    if (clientRows.length > 0) {
      const row = clientRows[0] as Record<string, unknown>;
      const clientName = [row.firstName, row.middleName, row.lastName, row.suffix]
        .filter((part) => Boolean(part && String(part).trim()))
        .map((part) => String(part).trim())
        .join(" ");
      const clientRecord = {
        fullName: clientName,
        firstName: row.firstName,
        middleName: row.middleName,
        lastName: row.lastName,
        suffix: row.suffix,
        title: row.title && String(row.title).trim() ? String(row.title) : undefined,
        email: row.email,
        phone: row.phone,
        address: row.addressLine1
          ? [
              row.addressLine1,
              row.addressLine2,
              [row.city, row.state, row.postalCode].filter(Boolean).join(", "),
              row.country,
            ]
            .filter(Boolean)
            .join("; ")
          : undefined,
        addressLine1: row.addressLine1,
        addressLine2: row.addressLine2,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        country: row.country,
      };
      context = {
        ...context,
        clientId: String(row.id),
        clientName: (context?.clientName as string) || clientName || undefined,
        clientRecord,
      } as ChatContext & { clientRecord?: typeof clientRecord };
    }
  }

  const profile = await getNpcByNpcId(npcId);
  const npcRow = await getNpcRowByNpcId(npcId);
  if (!profile || !npcRow) {
    return NextResponse.json({ error: "NPC not found" }, { status: 404 });
  }

  let session = sessionId ? await getSessionBySessionId(sessionId) : null;
  if (!session) {
    sessionId = randomUUID();
    await createSession({
      sessionId,
      npcRowId: npcRow.id,
      npcNpcId: npcId,
      userId,
    });
    session = await getSessionBySessionId(sessionId);
  }

  if (!session) {
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
  sessionId = session.sessionId;

  const sessionMessagesForEntry = await getMessagesForSession(session.id);
  const userMessagesForEntry = sessionMessagesForEntry.filter((m) => m.role === "user");
  const laneUiNote =
    laneControl != null
      ? `[Workflow lane: ${laneControl.action === "set" ? laneControl.path : "clear"}]`
      : message;
  const combinedForJarvaEntry = [...userMessagesForEntry.map((m) => m.content), laneUiNote].join("\n");
  const jarvaEntryRoute = npcId === "trust-advisor" ? classifyJarvaEntry(combinedForJarvaEntry) : null;

  const rawJarvaWorkflowPathFromSession =
    npcId === "trust-advisor"
      ? ((session as { jarvaWorkflowPath?: string | null }).jarvaWorkflowPath ?? null)
      : null;
  const transcriptFallbackSuppressed = sessionTranscriptFallbackSuppressed(rawJarvaWorkflowPathFromSession);
  const stickyJarvaPathBefore =
    npcId === "trust-advisor" ? parseJarvaWorkflowPathFromStorage(rawJarvaWorkflowPathFromSession) : null;

  let laneControlApplied = false;
  let jarvaWorkflowPath: JarvaWorkflowPath | null = null;
  let jarvaWorkflowPathSource: JarvaWorkflowPathSource | null = null;

  if (npcId === "trust-advisor") {
    if (laneControl) {
      laneControlApplied = true;
      try {
        if (laneControl.action === "clear") {
          await updateSessionJarvaWorkflowPath(sessionId, JARVA_WORKFLOW_TRANSCRIPT_SUPPRESS);
        } else {
          await updateSessionJarvaWorkflowPath(sessionId, laneControl.path);
        }
      } catch {
        /* non-fatal */
      }
      jarvaWorkflowPath = laneControl.action === "set" ? laneControl.path : null;
      jarvaWorkflowPathSource = laneControl.action === "set" ? "lane_control" : "lane_clear";
    } else {
      const effectiveJarvaWorkflow = resolveEffectiveJarvaWorkflowPath({
        currentMessage: message,
        combinedUserText: combinedForJarvaEntry,
        stickyPath: stickyJarvaPathBefore,
        transcriptFallbackSuppressed,
      });
      jarvaWorkflowPath = effectiveJarvaWorkflow.path;
      jarvaWorkflowPathSource = effectiveJarvaWorkflow.source;
    }
  }
  const priorSessionUserMessageCount = userMessagesForEntry.length;

  /** Jarva runs before NPC/LLM so procedural context + filtered next questions match the banner. */
  let jarvaPayload: Record<string, unknown> = {};
  let jarvaProceduralExtras: {
    jarvaIntakeCompletenessPct?: number;
    jarvaIntakeCoreComplete?: boolean;
  } = {};
  /** Full procedural input after Jarva sync (trust-workflow signals + intake); drives NPC context + banner. */
  let resolvedJarvaProceduralInput: JarvaProceduralInput | undefined;
  let jarvaDocumentAssemblyHints: ReturnType<typeof computeJarvaDocumentAssemblyHints> | undefined;
  let jarvaAppendix = "";
  const jarvaIntakeSync = body?.jarvaIntakeSync !== false;
  if (context?.trustId && npcId === "trust-advisor" && jarvaIntakeSync) {
    try {
      const { loadLatestJarvaIntakePayload, saveJarvaIntakeDraft } = await import("@/lib/jarva/persist-jarva-intake-draft");
      const { extractJarvaIntakeFromChat, mergeJarvaIntakeBases } = await import("@/lib/jarva/jarva-intake-from-chat");
      const { appendJarvaLineage, defaultMappedHintsFromFieldKeys } = await import("@/lib/jarva/jarva-lineage");
      const { listPopulatedJarvaIntakeFieldKeys, parseJarvaTrustIntake, TRUST_INTAKE_SCHEMA_VERSION } =
        await import("@/lib/jarva/trust-intake-schema");
      const { evaluateJarvaIntakeReadiness, buildJarvaApplyReadiness, evaluateJarvaReadinessFull } = await import(
        "@/lib/jarva/jarva-readiness"
      );
      const { runJarvaTrustApply } = await import("@/lib/jarva/run-jarva-apply");

      const rawMode = body?.jarvaMode;
      const jarvaMode: "assist" | "build" | "review" =
        rawMode === "build" || rawMode === "review" || rawMode === "assist" ? rawMode : "assist";

      const ldb = db ?? (await getDb());
      const { payload: prevPayload } = await loadLatestJarvaIntakePayload(ldb, context.trustId);
      const prevIntake = prevPayload?.intake ?? null;

      const sessionMessages = await getMessagesForSession(session.id);
      const msgsForHistory =
        sessionMessages.length > 0 && sessionMessages[sessionMessages.length - 1]?.role === "npc"
          ? sessionMessages.slice(0, -1)
          : sessionMessages;
      const recentTurns = msgsForHistory.slice(-12).map((m) => ({
        role: (m.role === "user" ? "user" : "npc") as "user" | "npc",
        content: m.content,
      }));
      const userMessages = sessionMessages.filter((m) => m.role === "user");
      const lastUserRow = userMessages[userMessages.length - 1];

      let smartSnap: Record<string, unknown> | null = null;
      const smartRows = await ldb
        .select()
        .from(trustDrafts)
        .where(and(eq(trustDrafts.trustId, context.trustId), eq(trustDrafts.draftType, "smart-trust-draft")))
        .orderBy(sql`version desc`)
        .limit(1);
      if (smartRows.length > 0) {
        try {
          const raw = JSON.parse(String(smartRows[0]!.payloadJson ?? "null"));
          const d = raw?.draft && typeof raw.draft === "object" ? raw.draft : raw;
          smartSnap = d && typeof d === "object" ? (d as Record<string, unknown>) : null;
        } catch {
          smartSnap = null;
        }
      }

      const extracted = await extractJarvaIntakeFromChat({
        message,
        recentHistory: recentTurns,
        trustId: context.trustId,
        clientId: context.clientId,
        currentIntake: prevIntake ?? undefined,
        smartTrustDraftSnapshot: smartSnap,
      });
      const mergedRaw = mergeJarvaIntakeBases(prevIntake, extracted.intakePatch);
      const mergedParsed = parseJarvaTrustIntake({
        ...mergedRaw,
        schemaVersion: TRUST_INTAKE_SCHEMA_VERSION,
        collectedByUserId: userId,
        collectedAt: new Date().toISOString(),
      });
      if (!mergedParsed.ok) {
        jarvaPayload = { jarvaIntakeError: mergedParsed.error };
      } else {
        const intake = mergedParsed.data;
        const fieldConfidence: Record<string, "high" | "medium" | "low"> = {};
        for (const fk of extracted.fieldKeys) {
          fieldConfidence[fk] = extracted.confidence[fk] ?? "medium";
        }

        let lineage = appendJarvaLineage(prevPayload?.lineage, {
          at: new Date().toISOString(),
          messageSnippet: message.slice(0, 280),
          extractedFieldKeys: extracted.fieldKeys,
          targets: ["jarva_intake"],
          sourceMessageId: lastUserRow?.id,
          npcSessionId: sessionId,
          sourceRole: "user",
          applyKind: "chat_extraction",
          mappedDestinationHints: defaultMappedHintsFromFieldKeys(extracted.fieldKeys),
          fieldConfidence,
        });

        const trustRows = await ldb
          .select()
          .from(trusts)
          .where(and(eq(trusts.id, context.trustId), eq(trusts.userId, userId)))
          .limit(1);
        if (trustRows.length === 0) {
          jarvaPayload = { jarvaIntakeError: "Trust not found for Jarva sync" };
        } else {
          const readiness = evaluateJarvaIntakeReadiness(intake);
          const applyReadiness = buildJarvaApplyReadiness(intake);
          const readinessFull = evaluateJarvaReadinessFull(intake);
          const nextActions = buildJarvaNextActions(intake, { workflowPath: jarvaWorkflowPath });
          const completenessPct = applyReadiness.completenessPercent;
          jarvaProceduralExtras = {
            jarvaIntakeCompletenessPct: completenessPct,
            jarvaIntakeCoreComplete: readiness.ok,
          };

          const autoApplyRequested = body?.jarvaAutoApply === true;
          const autoApply =
            jarvaMode !== "review" && readiness.ok && (jarvaMode === "build" || autoApplyRequested);

          let applied = false;
          let trustRecordsVersion: number | undefined;
          let workspaceSummary: WorkspaceSummaryPayload | undefined;

          if (jarvaMode === "review") {
            const proceduralInput = buildJarvaProceduralInputFromChat(context, {
              completenessPct,
              coreOk: readiness.ok,
              workspaceSummary: undefined,
              readinessFull,
              applyReadiness,
            });
            const proceduralWithJarva: JarvaProceduralInput = {
              ...proceduralInput,
              jarvaEntryRoute: jarvaEntryRoute ?? undefined,
              priorSessionUserMessageCount,
              jarvaWorkflowPath: jarvaWorkflowPath ?? undefined,
            };
            resolvedJarvaProceduralInput = proceduralWithJarva;
            const proceduralEval = evaluateJarvaProceduralStep(proceduralWithJarva);
            const nextActionsFiltered = filterJarvaNextActionsForProceduralStep(
              proceduralEval.step,
              nextActions,
              intake,
              jarvaWorkflowPath
            );

            jarvaPayload = {
              jarvaReviewOnly: true,
              jarvaMode,
              jarvaIntakeCompletenessPct: completenessPct,
              jarvaIntakePreview: intake,
              jarvaReadiness: readiness,
              jarvaApplyReadiness: applyReadiness,
              jarvaReadinessFull: readinessFull,
              jarvaNextActions: nextActionsFiltered,
              jarvaExtractedFieldKeys: extracted.fieldKeys,
              jarvaExtractedConfidence: extracted.confidence,
            };
            jarvaAppendix += `\n\n---\n**Jarva — review mode (DRAFT — no intake/workspace writes)**\n${readinessFull.narrative}\n`;
            jarvaAppendix += jarvaAppendixStepMilestone(proceduralEval.step);
            if (nextActionsFiltered.nextQuestionItems?.length) {
              jarvaAppendix += `\n**Suggested next questions (${proceduralEval.title}):**\n${nextActionsFiltered.nextQuestionItems
                .slice(0, 6)
                .map((i) => `• [${i.category}] ${i.question}`)
                .join("\n")}`;
            } else if (nextActionsFiltered.nextQuestions.length) {
              jarvaAppendix += `\n**Suggested next questions (${proceduralEval.title}):**\n${nextActionsFiltered.nextQuestions
                .slice(0, 4)
                .map((q) => `• ${q}`)
                .join("\n")}`;
            }
          } else {
            await saveJarvaIntakeDraft({
              db: ldb,
              userId,
              trustId: context.trustId,
              trustRow: trustRows[0]!,
              intake,
              lineage,
              jarvaMode,
              auditAction: "jarva_trust_intake_from_chat",
            });

            if (autoApply) {
              const applyResult = await runJarvaTrustApply({
                db: ldb,
                userId,
                trustId: context.trustId,
                intake,
                syncTrustRecords: body?.jarvaSyncTrustRecords !== false,
              });
              if (applyResult.ok) {
                applied = true;
                trustRecordsVersion = applyResult.trustRecordsVersion;
                workspaceSummary = applyResult.workspaceSummary;
                lineage = appendJarvaLineage(lineage, {
                  at: new Date().toISOString(),
                  messageSnippet: "(apply)",
                  extractedFieldKeys: listPopulatedJarvaIntakeFieldKeys(intake),
                  targets: ["jarva_intake", "smart_trust_draft", "trust_records_state"],
                  applyKind: "auto_apply",
                  actorUserId: userId,
                  mappedDestinationHints: [
                    "smart_trust_draft",
                    "trust_records_state",
                    ...defaultMappedHintsFromFieldKeys(extracted.fieldKeys),
                  ],
                  note: "Jarva merged intake into Smart Trust draft and Trust Records store (drafts for review). Workspace summary refreshed.",
                });
                await saveJarvaIntakeDraft({
                  db: ldb,
                  userId,
                  trustId: context.trustId,
                  trustRow: trustRows[0]!,
                  intake,
                  lineage,
                  jarvaMode,
                  auditAction: "jarva_lineage_after_apply",
                });
              }
            }

            const proceduralInput = buildJarvaProceduralInputFromChat(context, {
              completenessPct,
              coreOk: readiness.ok,
              workspaceSummary,
              readinessFull,
              applyReadiness,
            });
            const proceduralWithJarva: JarvaProceduralInput = {
              ...proceduralInput,
              jarvaEntryRoute: jarvaEntryRoute ?? undefined,
              priorSessionUserMessageCount,
              jarvaWorkflowPath: jarvaWorkflowPath ?? undefined,
            };
            resolvedJarvaProceduralInput = proceduralWithJarva;
            const proceduralEval = evaluateJarvaProceduralStep(proceduralWithJarva);
            const nextActionsFiltered = filterJarvaNextActionsForProceduralStep(
              proceduralEval.step,
              nextActions,
              intake,
              jarvaWorkflowPath
            );

            jarvaPayload = {
              jarvaIntakeUpdated: true,
              jarvaMode,
              jarvaIntakeCompletenessPct: completenessPct,
              jarvaReadyToApply: readiness.ok,
              jarvaAutoApplied: applied,
              jarvaTrustRecordsVersion: trustRecordsVersion,
              jarvaWorkspaceSummary: workspaceSummary,
              jarvaReadiness: readiness,
              jarvaApplyReadiness: applyReadiness,
              jarvaReadinessFull: readinessFull,
              jarvaNextActions: nextActionsFiltered,
              jarvaMissing: applyReadiness.missing,
              jarvaBlockers: applyReadiness.blockers,
              jarvaExtractedFieldKeys: extracted.fieldKeys,
              jarvaExtractedNotes: extracted.notes,
              jarvaFollowUps: extracted.followUps,
              jarvaExtractedConfidence: extracted.confidence,
            };

            jarvaAppendix += `\n\n---\n**Jarva (DRAFT workspace aid — not legal advice)**\n${readinessFull.narrative}\n`;
            jarvaAppendix += jarvaAppendixStepMilestone(proceduralEval.step);
            if (nextActionsFiltered.nextQuestionItems?.length) {
              jarvaAppendix += `\n**Next questions (${proceduralEval.title}):**\n${nextActionsFiltered.nextQuestionItems
                .slice(0, 6)
                .map((i) => `• [${i.category}] ${i.question}`)
                .join("\n")}`;
            } else if (nextActionsFiltered.nextQuestions.length) {
              jarvaAppendix += `\n**Next questions (${proceduralEval.title}):**\n${nextActionsFiltered.nextQuestions
                .slice(0, 4)
                .map((q) => `• ${q}`)
                .join("\n")}`;
            }
            if (nextActionsFiltered.warnings.length) {
              jarvaAppendix += `\n\n**Warnings:** ${nextActionsFiltered.warnings.slice(0, 2).join(" ")}`;
            }
          }

          if (resolvedJarvaProceduralInput) {
            jarvaDocumentAssemblyHints = computeJarvaDocumentAssemblyHints({
              workProduct: workspaceSummary?.workProduct,
              proceduralInput: resolvedJarvaProceduralInput,
              intakeReadinessOk: readiness.ok,
              completenessPercent: completenessPct,
              applyReadinessBlockers: applyReadiness.blockers,
            });
            jarvaPayload = { ...jarvaPayload, jarvaDocumentAssemblyHints };
            if (jarvaDocumentAssemblyHints.lines.length) {
              jarvaAppendix += `\n\n**Document assembly (advisory — DRAFT only; not legal approval; does not auto-generate files):**\n${jarvaDocumentAssemblyHints.lines
                .map((l) => `• ${l}`)
                .join("\n")}`;
            }
          }
        }
      }
    } catch (e) {
      jarvaPayload = { jarvaIntakeError: e instanceof Error ? e.message : "jarva_sync_failed" };
    }
  }

  /** Advisory hints when sync did not emit them — persisted intake + server workspace summary only. */
  if (npcId === "trust-advisor" && context?.trustId && jarvaDocumentAssemblyHints == null) {
    try {
      const ldb = db ?? (await getDb());
      const fb = await computeJarvaDocumentAssemblyHintsFallback({
        db: ldb,
        userId,
        trustId: context.trustId,
        context: context as ChatContext,
        jarvaWorkflowPath: jarvaWorkflowPath ?? null,
        jarvaEntryRoute: jarvaEntryRoute ?? null,
        priorSessionUserMessageCount,
      });
      if (fb) {
        jarvaDocumentAssemblyHints = fb;
        jarvaPayload = { ...jarvaPayload, jarvaDocumentAssemblyHints: fb, jarvaDocumentAssemblyHintsFromFallback: true };
        if (fb.lines.length) {
          jarvaAppendix += `\n\n**Document assembly (advisory — DRAFT only; not legal approval; does not auto-generate files):**\n${fb.lines
            .map((l) => `• ${l}`)
            .join("\n")}`;
        }
      }
    } catch {
      /* best-effort — omit hints rather than weak signals */
    }
  }

  const proceduralInputForNpc: JarvaProceduralInput = {
    ...(resolvedJarvaProceduralInput ??
      ({
        trustId: context?.trustId,
        clientId: context?.clientId,
        workspaceCounts: context?.workspaceCounts,
        completionPct: context?.completionPct,
        workspaceChecklist: context?.workspaceChecklist,
        issuedAssetCertificateCount: context?.issuedAssetCertificateCount,
        securitiesCertificatesIssuedCount: context?.securitiesCertificatesIssuedCount,
        securityOfferingCount: context?.securityOfferingCount,
        securityOfferingDraftCount: context?.securityOfferingDraftCount,
        securityOfferingFinalizedCount: context?.securityOfferingFinalizedCount,
        securitiesCertificatesIssuedActiveCount: context?.securitiesCertificatesIssuedActiveCount,
        bondInstrumentCount: context?.bondInstrumentCount,
        bondPreIssuanceCount: context?.bondPreIssuanceCount,
        bondIssuedCount: context?.bondIssuedCount,
        securityOfferingCancelledCount: context?.securityOfferingCancelledCount,
        securityOfferingErrorCount: context?.securityOfferingErrorCount,
        securitiesCertificatesVoidedOrReplacedCount: context?.securitiesCertificatesVoidedOrReplacedCount,
        bondClosedCount: context?.bondClosedCount,
        bondVoidedCount: context?.bondVoidedCount,
        hasDraftOffering: context?.hasDraftOffering,
        hasFinalizedOffering: context?.hasFinalizedOffering,
        hasIssuedSecuritiesCertificate: context?.hasIssuedSecuritiesCertificate,
        hasIssuedWorkflowAssetCertificate: context?.hasIssuedWorkflowAssetCertificate,
        hasActiveBondWorkflow: context?.hasActiveBondWorkflow,
        hasIssuedBond: context?.hasIssuedBond,
        ...jarvaProceduralExtras,
      } as JarvaProceduralInput)),
    ...(npcId === "trust-advisor"
      ? {
          jarvaEntryRoute: jarvaEntryRoute ?? undefined,
          priorSessionUserMessageCount,
          jarvaWorkflowPath: jarvaWorkflowPath ?? undefined,
        }
      : {}),
  };

  const contextForNpc: ChatContext | undefined =
    npcId === "trust-advisor"
      ? ({
          ...(context ?? {}),
          ...getJarvaProceduralContextPatch(proceduralInputForNpc),
          ...(jarvaEntryRoute
            ? {
                jarvaEntryIntent: jarvaEntryRoute.intent,
                jarvaTrustStyleHint: jarvaEntryRoute.trustStyle,
              }
            : {}),
          jarvaWorkflowPathSource: jarvaWorkflowPathSource ?? undefined,
          ...(jarvaDocumentAssemblyHints ? { jarvaDocumentAssemblyHints } : {}),
        } as ChatContext)
      : context;

  // Primary path: local knowledge + rules (no external APIs required)
  const knowledge = await getKnowledgeForNpc(npcRow.id);
  const messageForNpc = laneControl != null ? "[Workflow lane]" : message;
  let response = buildNpcResponse({ message: messageForNpc, profile, knowledge, context: contextForNpc });

  const jarvaFrontDoorReply =
    npcId === "trust-advisor" && jarvaEntryRoute && !laneControlApplied
      ? formatJarvaEntryRouterReply({
          message: messageForNpc,
          combinedUserText: combinedForJarvaEntry,
          entryRoute: jarvaEntryRoute,
          hasTrustId: Boolean(context?.trustId?.trim()),
          isFirstSessionMessage: priorSessionUserMessageCount === 0,
        })
      : null;

  if (jarvaFrontDoorReply) {
    response = {
      ...response,
      text: jarvaFrontDoorReply,
      source: "rule",
      intent: "help",
    };
  }

  if (laneControlApplied && laneControl) {
    response = {
      ...response,
      text:
        laneControl.action === "set"
          ? `Workflow lane set to **${formatJarvaWorkflowLaneLabel(laneControl.path)}**. Ask Jarva anything to continue (DRAFT — not legal advice).`
          : `Workflow lane cleared. Jarva will use general intake routing until you pick a lane again (DRAFT — not legal advice).`,
      source: "rule",
      intent: "help",
    };
  }

  // Optional enhancement: if LLM configured, improve rule-based fallbacks (never required)
  if (response.source === "rule" && response.intent === "unknown" && !jarvaFrontDoorReply && !laneControlApplied) {
    try {
      const llmResponse = await generateLlmResponse({ message: messageForNpc, profile, knowledge, context: contextForNpc });
      if (llmResponse?.text) {
        response = {
          ...llmResponse,
          suggestions: llmResponse.suggestions?.length ? llmResponse.suggestions : response.suggestions,
        };
      }
    } catch {
      // Keep rule-based response if LLM fails; platform works without external APIs.
    }
  }

  const userMessageContent =
    laneControl != null
      ? `[Workflow lane: ${laneControl.action === "set" ? laneControl.path : "clear"}]`
      : message;
  await addMessage({
    sessionRowId: session.id,
    role: "user",
    content: userMessageContent,
    intent: response.intent,
  });

  let responseText = response.text;
  if (jarvaAppendix) {
    responseText += jarvaAppendix;
  }

  if (npcId === "trust-advisor") {
    const jarvaProcedural = evaluateJarvaProceduralStep(proceduralInputForNpc);
    responseText = `${formatProceduralJarvaBanner(jarvaProcedural)}\n\n${responseText}`;
    jarvaPayload = {
      ...jarvaPayload,
      jarvaProceduralStep: jarvaProcedural.step,
      jarvaProceduralTitle: jarvaProcedural.title,
      jarvaProceduralIndex: jarvaProcedural.stepIndex,
      jarvaProceduralTotalSteps: jarvaProcedural.totalSteps,
      jarvaProceduralBlockers: jarvaProcedural.blockers,
      ...(jarvaEntryRoute
        ? {
            jarvaEntryIntent: jarvaEntryRoute.intent,
            jarvaNeedsTrustTypeChoice: jarvaEntryRoute.needsTrustTypeChoice,
            jarvaTrustStyleHint: jarvaEntryRoute.trustStyle,
          }
        : {}),
      jarvaWorkflowPath: jarvaWorkflowPath ?? null,
      jarvaWorkflowPathSource: jarvaWorkflowPathSource ?? null,
      jarvaNextUiActionBundle: buildJarvaNextUiActionBundleFromJarvaState({
        lane: jarvaWorkflowPath ?? null,
        proceduralStep: jarvaProcedural.step,
        proceduralTitle: jarvaProcedural.title,
        documentAssemblyHints: jarvaDocumentAssemblyHints,
      }),
    };
  }

  if (npcId === "trust-advisor" && !laneControlApplied) {
    const persistPath = shouldPersistJarvaWorkflowPath({
      source: jarvaWorkflowPathSource,
      path: jarvaWorkflowPath,
      hadStickyBefore: Boolean(stickyJarvaPathBefore),
    });
    if (persistPath) {
      try {
        await updateSessionJarvaWorkflowPath(sessionId, persistPath);
      } catch {
        /* non-fatal */
      }
    }
  }

  await addMessage({
    sessionRowId: session.id,
    role: "npc",
    content: responseText,
    intent: response.intent,
    responseSource: response.source,
  });
  await incrementSessionMessageCount(sessionId, 2);

  try {
    const auditDb = await getDb();
    await insertAuditLog(auditDb as any, {
      actorUserId: userId,
      action: "NPC_MESSAGE_SENT",
      entityType: "npc_session",
      entityId: sessionId,
      metadata: {
        npcId,
        source: context?.source,
        trustId: context?.trustId ? "[redacted]" : undefined,
      },
    });
  } catch {
    // Non-fatal
  }

  return NextResponse.json({
    response: responseText,
    mood: response.mood,
    source: response.source,
    suggestions: response.suggestions,
    intent: response.intent,
    sessionId,
    ...jarvaPayload,
  });
}
