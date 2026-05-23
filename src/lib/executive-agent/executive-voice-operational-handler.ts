import "server-only";

import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import type { ExecutiveOrchestratorResult } from "@/lib/executive-agent/executive-agent-orchestrator";
import * as Tools from "@/lib/executive-agent/executive-agent-tools";
import {
  fetchExecutiveInboxNewMessagesToday,
  fetchJarvaActivityToday,
  fetchNewRegistrationsToday,
  fetchRealityActivityToday,
  fetchRegistrationPhoneQueue,
  fetchVisitorsToday,
} from "@/lib/executive-agent/executive-voice-operational-data";
import {
  isAffirmativeVoice,
  isNegativeVoice,
  readPendingVoiceOperationalIntent,
  resolvePhoneQueueVoiceCommand,
  resolveVoiceOperationalQuery,
  voiceOperationalToolForQuery,
  type VoiceOperationalPendingIntent,
  type VoiceOperationalQueryKind,
} from "@/lib/executive-agent/executive-voice-operational-phrases";
import {
  buildExecutiveInboxVoiceAnswer,
  buildInboxAudioDeclined,
  buildInboxAudioPlayAck,
  buildJarvaActivityVoiceAnswer,
  buildNewRegistrationsVoiceAnswer,
  buildPhoneQueueFinished,
  buildPhoneQueueStopped,
  buildRealityActivityVoiceAnswer,
  buildRegistrationPhoneQueueVoiceLine,
} from "@/lib/executive-agent/executive-voice-operational-voice";

const VOICE_OPERATIONAL_PENDING_MS = 30 * 60 * 1000;

export type VoiceOperationalHandlerResult = ExecutiveOrchestratorResult & {
  pendingVoiceIntent?: VoiceOperationalPendingIntent | { intent: string; createdAt: string } | null;
};

function buildShortCircuit(
  answer: string,
  plannerMeta: Record<string, unknown>,
): VoiceOperationalHandlerResult {
  return {
    answer,
    insights: [],
    recommendedActions: [],
    todos: [],
    charts: [],
    referencedClients: [],
    referencedAgents: [],
    requiresApproval: [],
    plannerMeta: plannerMeta as VoiceOperationalHandlerResult["plannerMeta"],
    suggestedMemoryItems: [],
    pendingVoiceIntent:
      (plannerMeta.pendingVoiceIntent as VoiceOperationalPendingIntent | undefined) ?? null,
  };
}

function isPendingFresh(createdAt: string): boolean {
  return Number.isFinite(Date.parse(createdAt)) && Date.now() - Date.parse(createdAt) < VOICE_OPERATIONAL_PENDING_MS;
}

async function handleOperationalQuery(
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  transcript: string,
  kind: VoiceOperationalQueryKind,
): Promise<VoiceOperationalHandlerResult> {
  const createdAt = new Date().toISOString();

  if (kind === "registration_phone_request") {
    const queue = await fetchRegistrationPhoneQueue(db);
    if (!queue.length) {
      return buildShortCircuit("I don't have phone numbers on file for today's pending sign-ups.", {
        reasoningMode: "deterministic",
        confidence: 1,
        proposedApprovalsCount: 0,
        voiceShortCircuit: "operational_query",
        operationalTool: "getNewRegistrationPhoneQueue",
      });
    }
    const first = queue[0]!;
    const line = buildRegistrationPhoneQueueVoiceLine({
      accountDisplayName: first.accountDisplayName,
      phone: first.phone,
      index: 1,
      total: queue.length,
    });
    return buildShortCircuit(line, {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_query",
      operationalTool: "getNewRegistrationPhoneQueue",
      pendingVoiceIntent: {
        intent: "registration_phone_queue",
        createdAt,
        userIds: queue.map((q) => q.userId),
        index: 0,
      },
      voiceOperationalData: { phoneQueueRevealed: true, queueLength: queue.length },
    });
  }

  if (kind === "jarva_activity" || kind === "smart_trust_activity") {
    const rows = await fetchJarvaActivityToday(db);
    const answer = buildJarvaActivityVoiceAnswer(rows);
    return buildShortCircuit(answer, {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_query",
      operationalTool: "getJarvaActivityToday",
      voiceOperationalData: { jarva: rows },
    });
  }

  if (kind === "reality_activity") {
    const rows = await fetchRealityActivityToday(db);
    const answer = buildRealityActivityVoiceAnswer(rows);
    return buildShortCircuit(answer, {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_query",
      operationalTool: "getRealityActivityToday",
      voiceOperationalData: { reality: rows },
    });
  }

  if (kind === "executive_inbox") {
    const messages = await fetchExecutiveInboxNewMessagesToday(db);
    const { answer, pendingAudio } = buildExecutiveInboxVoiceAnswer(messages);
    const meta: Record<string, unknown> = {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_query",
      operationalTool: "getExecutiveInboxNewMessages",
      voiceOperationalData: { inbox: messages },
    };
    if (pendingAudio) {
      meta.pendingVoiceIntent = {
        intent: "inbox_audio_confirm",
        createdAt,
        messageId: pendingAudio.messageId,
        attachmentId: pendingAudio.attachmentId,
      };
    }
    return buildShortCircuit(answer, meta);
  }

  if (kind === "new_registrations") {
    const [rows, visitorsToday] = await Promise.all([fetchNewRegistrationsToday(db), fetchVisitorsToday(db)]);
    const { answer, offerPhone } = buildNewRegistrationsVoiceAnswer(rows, visitorsToday);
    const meta: Record<string, unknown> = {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_query",
      operationalTool: "getNewRegistrationsToday",
      voiceOperationalData: { registrations: rows, visitorsToday },
    };
    if (offerPhone) {
      meta.pendingVoiceIntent = {
        intent: "registration_phone_offer",
        createdAt,
        registrationCount: rows.filter((r) => r.phoneAvailable).length,
      };
    }
    return buildShortCircuit(answer, meta);
  }

  return buildShortCircuit("I'm not sure I caught that one, Boss — try Jarva, your inbox, or new sign-ups.", {
    reasoningMode: "deterministic",
    confidence: 0.5,
    proposedApprovalsCount: 0,
    voiceShortCircuit: "operational_query",
    operationalTool: voiceOperationalToolForQuery(kind),
  });
}

async function handleInboxAudioConfirm(
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  transcript: string,
  pending: Extract<VoiceOperationalPendingIntent, { intent: "inbox_audio_confirm" }>,
): Promise<VoiceOperationalHandlerResult | null> {
  if (isAffirmativeVoice(transcript)) {
    const ctx: Tools.ExecutiveToolContext = { db, adminUserId };
    const result = await Tools.playExecutiveInboxAudioAttachment(ctx, {
      messageId: pending.messageId,
      attachmentId: pending.attachmentId,
    });
    const play = (result as { ok?: boolean; play?: { url: string; filename: string; mimeType: string } }).play;
    if (!play) {
      return buildShortCircuit("I couldn't find that voice note on file.", {
        reasoningMode: "deterministic",
        confidence: 1,
        proposedApprovalsCount: 0,
        voiceShortCircuit: "operational_followup",
      });
    }
    return buildShortCircuit(buildInboxAudioPlayAck(), {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_followup",
      voiceUiAction: {
        type: "play_inbox_audio",
        messageId: pending.messageId,
        attachmentId: pending.attachmentId,
        url: play.url,
        filename: play.filename,
        mimeType: play.mimeType,
      },
    });
  }
  if (isNegativeVoice(transcript)) {
    return buildShortCircuit(buildInboxAudioDeclined(), {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_followup",
    });
  }
  return null;
}

async function handleRegistrationPhoneOffer(
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  transcript: string,
): Promise<VoiceOperationalHandlerResult | null> {
  if (!isAffirmativeVoice(transcript)) {
    if (isNegativeVoice(transcript)) {
      return buildShortCircuit("Got it — I'll keep those numbers private.", {
        reasoningMode: "deterministic",
        confidence: 1,
        proposedApprovalsCount: 0,
        voiceShortCircuit: "operational_followup",
      });
    }
    return null;
  }
  return handleOperationalQuery(db, adminUserId, transcript, "registration_phone_request");
}

async function handlePhoneQueueNavigation(
  db: MySql2Database<typeof schema>,
  transcript: string,
  pending: Extract<VoiceOperationalPendingIntent, { intent: "registration_phone_queue" }>,
): Promise<VoiceOperationalHandlerResult | null> {
  const cmd = resolvePhoneQueueVoiceCommand(transcript);
  if (!cmd) return null;

  const queue = await fetchRegistrationPhoneQueue(db);
  const byId = new Map(queue.map((q) => [q.userId, q]));
  const ordered = pending.userIds.map((id) => byId.get(id)).filter(Boolean) as typeof queue;
  if (!ordered.length) {
    return buildShortCircuit("That queue is empty now.", {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_followup",
    });
  }

  if (cmd === "stop") {
    return buildShortCircuit(buildPhoneQueueStopped(), {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_followup",
    });
  }

  let index = pending.index;
  if (cmd === "next" || cmd === "skip") {
    index += 1;
  }

  if (index >= ordered.length) {
    return buildShortCircuit(buildPhoneQueueFinished(), {
      reasoningMode: "deterministic",
      confidence: 1,
      proposedApprovalsCount: 0,
      voiceShortCircuit: "operational_followup",
    });
  }

  const row = ordered[index]!;
  const line = buildRegistrationPhoneQueueVoiceLine({
    accountDisplayName: row.accountDisplayName,
    phone: row.phone,
    index: index + 1,
    total: ordered.length,
  });

  return buildShortCircuit(line, {
    reasoningMode: "deterministic",
    confidence: 1,
    proposedApprovalsCount: 0,
    voiceShortCircuit: "operational_followup",
    pendingVoiceIntent: {
      intent: "registration_phone_queue",
      createdAt: pending.createdAt,
      userIds: pending.userIds,
      index,
    },
    voiceOperationalData: { phoneQueueRevealed: true, queueIndex: index },
  });
}

/** Resolve voice operational follow-ups and fresh operational queries before generic orchestration. */
export async function tryExecutiveVoiceOperationalHandler(
  db: MySql2Database<typeof schema>,
  adminUserId: number,
  transcript: string,
  latestPlannerMetaJson: string | null | undefined,
): Promise<VoiceOperationalHandlerResult | null> {
  const pending = readPendingVoiceOperationalIntent(latestPlannerMetaJson);
  const pendingFresh = pending != null && isPendingFresh(pending.createdAt);

  if (pendingFresh && pending.intent === "inbox_audio_confirm") {
    const r = await handleInboxAudioConfirm(db, adminUserId, transcript, pending);
    if (r) return r;
  }

  if (pendingFresh && pending.intent === "registration_phone_offer") {
    const r = await handleRegistrationPhoneOffer(db, adminUserId, transcript);
    if (r) return r;
  }

  if (pendingFresh && pending.intent === "registration_phone_queue") {
    const r = await handlePhoneQueueNavigation(db, transcript, pending);
    if (r) return r;
  }

  const queryKind = resolveVoiceOperationalQuery(transcript);
  if (queryKind) {
    return handleOperationalQuery(db, adminUserId, transcript, queryKind);
  }

  return null;
}

export {
  handleSkipperVoiceGreeting,
} from "@/lib/executive-agent/executive-presence-voice";
