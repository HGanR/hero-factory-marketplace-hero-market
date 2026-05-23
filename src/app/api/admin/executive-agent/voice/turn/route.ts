import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExecutiveAdminUserId } from "@/lib/admin/get-executive-admin-user-id";
import { getDb } from "@/lib/db";
import type { ExecutiveOrchestratorResult } from "@/lib/executive-agent/executive-agent-orchestrator";
import { runExecutiveOrchestrator } from "@/lib/executive-agent/executive-agent-orchestrator";
import {
  getExecutiveVoiceSessionForAdmin,
  getLatestExecutiveVoiceTurnForSession,
  insertExecutiveVoiceTurn,
  persistExecutiveVoiceSessionStart,
} from "@/lib/executive-agent/executive-agent-voice-store";
import { VoiceTurnBodySchema } from "@/lib/executive-agent/executive-agent-voice-request";
import { insertExecutiveQuestionHistory } from "@/lib/executive-agent/executive-question-history-store";
import { insertSkipperLearningEvent } from "@/lib/executive-agent/skipper-learning-store";
import { startExecutiveVoiceSessionPayload } from "@/lib/executive-agent/executive-voice-provider";
import {
  buildAnalyticsClarificationResponse,
  buildVoiceAnalyticsFollowUpPrompt,
  isSkipperGreeting,
  isTodayAnalyticsQuestion,
  resolveAnalyticsFollowUpCategory,
} from "@/lib/executive-agent/executive-voice-phrases";
import {
  buildVoiceInterruptAcknowledgement,
  handleSkipperVoiceGreeting,
  isVoiceAcknowledgementRequest,
  isVoiceInterruptDuringBriefing,
} from "@/lib/executive-agent/executive-presence-voice";
import { tryExecutiveVoiceOperationalHandler } from "@/lib/executive-agent/executive-voice-operational-handler";
import { enrichVoiceAnswerWithAmbientAwareness } from "@/lib/executive-agent/executive-voice-ambient-awareness";

export const dynamic = "force-dynamic";

const VOICE_ANALYTICS_PENDING_MS = 30 * 60 * 1000;

function buildVoiceShortCircuitResult(
  answer: string,
  plannerMeta: ExecutiveOrchestratorResult["plannerMeta"],
): ExecutiveOrchestratorResult {
  return {
    answer,
    insights: [],
    recommendedActions: [],
    todos: [],
    charts: [],
    referencedClients: [],
    referencedAgents: [],
    requiresApproval: [],
    plannerMeta,
    suggestedMemoryItems: [],
  };
}

function readPendingAnalyticsClarification(
  plannerMetaJson: string | null | undefined,
): { createdAt: string } | null {
  if (!plannerMetaJson?.trim()) return null;
  try {
    const o = JSON.parse(plannerMetaJson) as {
      pendingVoiceIntent?: { intent?: string; createdAt?: string };
    };
    const pi = o.pendingVoiceIntent;
    if (pi?.intent === "analytics_clarification" && typeof pi.createdAt === "string") {
      return { createdAt: pi.createdAt };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function POST(req: NextRequest) {
  const adminUserId = await getExecutiveAdminUserId(req);
  if (adminUserId == null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = VoiceTurnBodySchema.parse(await req.json());
    const db = await getDb();
    let sessionId = body.sessionId?.trim();
    if (!sessionId) {
      const payload = startExecutiveVoiceSessionPayload({ provider: "browser_stt" });
      await persistExecutiveVoiceSessionStart(db, adminUserId, payload);
      sessionId = payload.sessionId;
    }
    const sess = await getExecutiveVoiceSessionForAdmin(db, sessionId, adminUserId);
    if (!sess) {
      return NextResponse.json({ error: "SESSION_NOT_FOUND" }, { status: 404 });
    }
    if (sess.status !== "active") {
      return NextResponse.json({ error: "SESSION_ENDED" }, { status: 410 });
    }
    if (new Date(sess.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 410 });
    }

    const transcript = body.transcript.trim();

    let result: ExecutiveOrchestratorResult;

    if (isSkipperGreeting(transcript)) {
      const latestTurn = await getLatestExecutiveVoiceTurnForSession(db, sessionId, adminUserId);
      const greeting = handleSkipperVoiceGreeting(transcript, { isFreshSession: latestTurn == null });
      result = buildVoiceShortCircuitResult(greeting.answer, {
        reasoningMode: "deterministic",
        confidence: 1,
        proposedApprovalsCount: 0,
        voiceShortCircuit: greeting.voiceShortCircuit,
        greetingOnly: greeting.greetingOnly,
        freshSession: greeting.freshSession,
      });
    } else if (isVoiceInterruptDuringBriefing(transcript) || isVoiceAcknowledgementRequest(transcript)) {
      result = buildVoiceShortCircuitResult(buildVoiceInterruptAcknowledgement(), {
        reasoningMode: "deterministic",
        confidence: 1,
        proposedApprovalsCount: 0,
        voiceShortCircuit: "voice_acknowledgement",
      });
    } else {
      const latestTurn = await getLatestExecutiveVoiceTurnForSession(db, sessionId, adminUserId);
      const pending = readPendingAnalyticsClarification(latestTurn?.plannerMetaJson ?? null);
      const pendingFresh =
        pending != null &&
        Number.isFinite(Date.parse(pending.createdAt)) &&
        Date.now() - Date.parse(pending.createdAt) < VOICE_ANALYTICS_PENDING_MS;

      const followCategory = pendingFresh ? resolveAnalyticsFollowUpCategory(transcript) : null;

      if (followCategory) {
        result = await runExecutiveOrchestrator(db, {
          adminUserId,
          prompt: buildVoiceAnalyticsFollowUpPrompt(followCategory),
          mode: body.mode,
          selectedClientId: body.selectedClientId ?? null,
          selectedCampaignId: body.selectedCampaignId ?? null,
          requestedTool: "getPlatformAnalyticsSummary",
          dryRun: body.dryRun,
          selectedAgents: body.selectedAgents ?? null,
          selectedTimeRange: body.selectedTimeRange ?? null,
          dashboardMode: body.dashboardMode ?? null,
          source: "voice",
        });
      } else if (isTodayAnalyticsQuestion(transcript)) {
        const createdAt = new Date().toISOString();
        result = buildVoiceShortCircuitResult(buildAnalyticsClarificationResponse(), {
          reasoningMode: "deterministic",
          confidence: 1,
          proposedApprovalsCount: 0,
          voiceShortCircuit: "analytics_clarification",
          pendingVoiceIntent: { intent: "analytics_clarification", createdAt },
        });
      } else {
        const operational = await tryExecutiveVoiceOperationalHandler(
          db,
          adminUserId,
          transcript,
          latestTurn?.plannerMetaJson ?? null,
        );
        if (operational) {
          result = operational;
        } else {
          result = await runExecutiveOrchestrator(db, {
            adminUserId,
            prompt: transcript,
            mode: body.mode,
            selectedClientId: body.selectedClientId ?? null,
            selectedCampaignId: body.selectedCampaignId ?? null,
            requestedTool: null,
            dryRun: body.dryRun,
            selectedAgents: body.selectedAgents ?? null,
            selectedTimeRange: body.selectedTimeRange ?? null,
            dashboardMode: body.dashboardMode ?? null,
            source: "voice",
          });
        }
      }
    }

    const shortCircuit = result.plannerMeta.voiceShortCircuit;
    if (
      shortCircuit !== "fresh_greeting" &&
      shortCircuit !== "presence_greeting" &&
      shortCircuit !== "analytics_clarification" &&
      shortCircuit !== "voice_acknowledgement" &&
      !String(shortCircuit ?? "").startsWith("operational_")
    ) {
      const ambient = await enrichVoiceAnswerWithAmbientAwareness(db, adminUserId, result.answer, {
        audit: false,
      });
      if (ambient.ambientAppended) {
        result = {
          ...result,
          answer: ambient.answer,
          plannerMeta: {
            ...result.plannerMeta,
            ambientVoiceBriefing: true,
            ambientPresenceMode: ambient.presenceMode,
          },
        };
      }
    }

    const turnId = await insertExecutiveVoiceTurn(db, {
      sessionId,
      adminUserId,
      transcriptText: body.transcript,
      responseText: result.answer,
      plannerMeta: { ...(result.plannerMeta as Record<string, unknown>) },
      proposedApprovalsCount: result.plannerMeta.proposedApprovalsCount,
      orchestratorSource: "voice",
    });

    try {
      await insertExecutiveQuestionHistory(db, {
        adminUserId,
        source: "voice",
        question: body.transcript,
        answer: result.answer,
        selectedAgents: body.selectedAgents ?? null,
        selectedTimeRange: body.selectedTimeRange ?? null,
        dashboardMode: body.dashboardMode ?? null,
        plannerMeta: { ...(result.plannerMeta as Record<string, unknown>) },
      });
    } catch {
      /* non-fatal */
    }

    try {
      await insertSkipperLearningEvent(db, {
        adminUserId,
        eventType: "voice_command",
        source: "voice",
        payload: { transcript: transcript.slice(0, 2000), sessionId },
      });
    } catch {
      /* non-fatal — table may not exist until migration */
    }

    const pendingVoiceIntent = result.plannerMeta.pendingVoiceIntent ?? null;

    return NextResponse.json({
      turnId,
      sessionId,
      pendingVoiceIntent,
      ...result,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_REQUEST", issues: e.flatten() }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "VOICE_TURN_FAILED", message: msg }, { status: 500 });
  }
}
