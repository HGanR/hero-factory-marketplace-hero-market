/**
 * Pure helpers for Executive voice diagnostics (client + tests).
 */

export type ExecutiveVoiceDiagnosticsVoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error"
  | "unsupported";

export function deriveExecutiveVoiceState(input: {
  voiceUnsupported: boolean;
  micError: string | null;
  busyVoiceTurn: boolean;
  simSpeaking: boolean;
  voiceMode: boolean;
  liveListening: boolean;
  dictationBusy: boolean;
}): ExecutiveVoiceDiagnosticsVoiceState {
  if (input.voiceUnsupported) return "unsupported";
  if (input.micError) return "error";
  if (input.busyVoiceTurn) return "processing";
  if (input.simSpeaking) return "speaking";
  if (input.dictationBusy) return "listening";
  if (input.voiceMode && input.liveListening) return "listening";
  return "idle";
}

export type SpeakExecutiveAnswerPath = "self_hosted_tts" | "elevenlabs" | "openai" | "browser_speech" | "none";

const READ_TOOL_PREFIX = /^get[A-Z][a-zA-Z0-9]+$/;

export function firstSelectedReadToolFromInsights(
  insights: Array<{ title: string }> | null | undefined,
): string | null {
  if (!insights?.length) return null;
  const t = insights.find((i) => READ_TOOL_PREFIX.test(i.title.trim()));
  return t?.title.trim() ?? null;
}

/** Maps server runtime-diagnostics JSON (subset) to HUD badge labels — no secrets. */
export function connectedSystemsFromRuntimePayload(payload: Record<string, unknown> | null): string[] {
  if (!payload) return [];
  const badges = new Set<string>();
  const analytics = Boolean(payload.analyticsToolAvailable);
  const memory = Boolean(payload.memoryAvailable);
  const approvals = Boolean(payload.approvalsAvailable);
  const routines = Boolean(payload.routinesAvailable);
  const voiceId = typeof payload.skipperVoiceId === "string" && payload.skipperVoiceId.trim();
  const unified = payload.unifiedExecutiveDashboard as { analyticsEnabled?: boolean } | undefined;
  const skipper = payload.skipperUnifiedRuntime as { diagnostics?: { connectedDataSources?: string[] } } | undefined;
  const sources = skipper?.diagnostics?.connectedDataSources ?? [];

  if (analytics || unified?.analyticsEnabled) badges.add("Analytics");
  if (memory) badges.add("Memory");
  if (approvals) badges.add("Approvals");
  if (routines) badges.add("Routines");
  if (voiceId) badges.add("Voice");
  if (sources.some((s) => /crm|client/i.test(s))) badges.add("CRM");
  if (sources.some((s) => /bentley|campaign|revenue/i.test(s))) badges.add("Bentley");
  if (sources.some((s) => /agent|conversation|intelligence/i.test(s))) badges.add("Agent Network");

  return [...badges];
}

export function orchestrationLevelDisplayFromPayload(payload: Record<string, unknown> | null): string | null {
  const raw = payload?.skipperUnifiedRuntime as { orchestrationLevel?: string } | undefined;
  const lvl = raw?.orchestrationLevel?.trim();
  if (lvl === "npc") return "npc-safe";
  if (lvl === "widget") return "npc-safe";
  if (lvl === "full" || lvl === "lightweight") return lvl;
  if (payload?.executiveOrchestratorConnected) return "full";
  return lvl ?? null;
}

export function runtimeTypeDisplayFromPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  if (payload.skipperUnifiedRuntime) return "executive_admin";
  const rt = typeof payload.skipperRuntimeType === "string" ? payload.skipperRuntimeType.trim() : "";
  return rt === "executive_admin" ? "executive_admin" : null;
}
