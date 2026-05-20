"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { ExecutiveSttInputMode } from "@/lib/voices/stt-provider";

export type ExecutivePromptOverlaysStatus = "ready" | "missing_table" | "unavailable";

export type ExecutiveVoiceDiagnostics = {
  lastTranscript: string | null;
  voiceState: "idle" | "listening" | "processing" | "speaking" | "error" | "unsupported";
  lastResponse: string | null;
  voiceShortCircuit: "greeting" | "analytics_clarification" | "none";
  pendingVoiceIntent: string | null;
  selectedTool: string | null;
  orchestrationLevel: string | null;
  runtimeType: string | null;
  voiceProvider: string | null;
  voiceHealth: string | null;
  sttProvider: "openai" | "browser_speech_recognition" | "self_hosted_stt" | "none";
  sttHealth: string | null;
  sttHttpStatus: number | null;
  sttAudioBlobSize: number | null;
  sttTranscript: string | null;
  sttConfidence: number | null;
  sttError: string | null;
  connectedSystems: string[];
  lastError: string | null;
  speechRecognitionMs: number | null;
  orchestratorMs: number | null;
  ttsMs: number | null;
  promptOverlaysStatus: ExecutivePromptOverlaysStatus;
  browserSttStatusLabel: string;
  selfHostedSttStatusLabel: string;
  openAiSttStatusLabel: string;
  ttsProvider: string | null;
  ttsHealth: string | null;
  effectiveStt: "openai" | "browser_speech_recognition" | "self_hosted_stt" | "none";
  effectiveTts: "elevenlabs" | "self_hosted_tts" | "openai" | "browser_speech" | "none";
  sttDevHint: string | null;
  browserSttRoutingNote: string | null;
};

const SECRET_KEY = /(apikey|api_key|authorization|bearer|secret|password|token|openai)/i;

function redactForExport(d: ExecutiveVoiceDiagnostics): ExecutiveVoiceDiagnostics {
  const safe = { ...d };
  if (safe.lastError && SECRET_KEY.test(safe.lastError)) {
    safe.lastError = "[redacted]";
  }
  if (safe.sttError && SECRET_KEY.test(safe.sttError)) {
    safe.sttError = "[redacted]";
  }
  return safe;
}

function stateDotClass(state: ExecutiveVoiceDiagnostics["voiceState"]): string {
  if (state === "error" || state === "unsupported") return "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.55)]";
  if (state === "processing") return "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]";
  if (state === "speaking" || state === "listening") return "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]";
  return "bg-slate-500";
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 border-b border-[#00e5ff]/12 py-1.5 font-mono text-[10px] leading-snug text-slate-300 last:border-0">
      <span className="w-[44%] shrink-0 uppercase tracking-wide text-[#00b7ff]/70">{label}</span>
      <span className="min-w-0 flex-1 break-words text-slate-100/95">{value}</span>
    </div>
  );
}

export function VoiceCommandDiagnosticsPanel({
  data,
  defaultCollapsed = false,
  voiceSttInputMode,
  voiceSessionId,
  voicePendingAnalytics,
  onTestSttHealth,
  onTestSelfHostedStt,
  sttTestBusy,
  sttTestTranscript,
}: {
  data: ExecutiveVoiceDiagnostics;
  defaultCollapsed?: boolean;
  /** Mirrors ExecutiveAgentDashboard voice input selector (Auto / Browser / Self-hosted). */
  voiceSttInputMode?: ExecutiveSttInputMode;
  voiceSessionId?: string | null;
  voicePendingAnalytics?: { intent: string; createdAt: string } | null;
  onTestSttHealth?: () => void | Promise<void>;
  onTestSelfHostedStt?: () => void | Promise<void>;
  sttTestBusy?: boolean;
  sttTestTranscript?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  const json = useMemo(() => {
    const base = redactForExport(data);
    const voiceContext = {
      voiceSttInputMode: voiceSttInputMode ?? null,
      voiceSessionId: voiceSessionId ?? null,
      voicePendingAnalytics: voicePendingAnalytics ?? null,
    };
    return JSON.stringify({ ...base, voiceContext }, null, 2);
  }, [data, voiceSttInputMode, voiceSessionId, voicePendingAnalytics]);

  const copyJson = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      /* ignore */
    }
  }, [json]);

  return (
    <section className="relative z-[1] rounded-xl border border-[#00e5ff]/35 bg-[#050b13]/95 shadow-[0_0_24px_rgba(0,229,255,0.08),inset_0_1px_0_0_rgba(0,229,255,0.06)] backdrop-blur-md">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between gap-2 border-b border-[#00e5ff]/20 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 text-[#00e5ff]/90" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-[#00e5ff]/90" />
          )}
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00e5ff]/95">Voice diagnostics HUD</h3>
        </div>
        <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
          <span className={`h-2 w-2 rounded-full ${stateDotClass(data.voiceState)}`} />
          <span className="font-mono uppercase text-[#00b7ff]/90">{data.voiceState}</span>
        </span>
      </button>
      {!collapsed ? (
        <div className="space-y-2 p-3">
          {data.browserSttRoutingNote ? (
            <div className="rounded-lg border border-[#00e5ff]/25 bg-[#02070d]/80 px-2 py-1.5 text-[10px] leading-snug text-[#00e5ff]/95">
              {data.browserSttRoutingNote}
            </div>
          ) : null}
          {data.sttDevHint ? (
            <div className="rounded-lg border border-amber-500/35 bg-amber-950/25 px-2 py-1.5 text-[10px] leading-snug text-amber-100/95">
              {data.sttDevHint}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!onTestSttHealth}
              onClick={() => void onTestSttHealth?.()}
              className="rounded-lg border border-[#00e5ff]/40 bg-[#02070d]/60 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#00e5ff] hover:bg-[#050b13] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Test STT health
            </button>
            <button
              type="button"
              disabled={!onTestSelfHostedStt || sttTestBusy}
              onClick={() => void onTestSelfHostedStt?.()}
              className="rounded-lg border border-[#00b7ff]/40 bg-[#02070d]/60 px-2.5 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-[#00b7ff] hover:bg-[#050b13] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {sttTestBusy ? "Recording…" : "Test STT clip"}
            </button>
          </div>
          {sttTestTranscript != null && sttTestTranscript !== "" ? (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/15 px-2 py-1.5">
              <div className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/80">STT test transcript</div>
              <p className="font-mono text-[10px] leading-snug text-emerald-50/95">{sttTestTranscript}</p>
            </div>
          ) : null}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/15 px-2 py-1.5">
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-200/75">Voice session context</div>
            <Row label="Voice session id" value={voiceSessionId?.trim() ? voiceSessionId : "—"} />
            <Row label="Voice input mode" value={voiceSttInputMode ?? "—"} />
            <Row
              label="Pending analytics"
              value={
                voicePendingAnalytics ? `${voicePendingAnalytics.intent} @ ${voicePendingAnalytics.createdAt}` : "—"
              }
            />
          </div>
          <div className="rounded-lg border border-[#00e5ff]/15 bg-[#02070d]/70 px-2 py-1.5">
            <Row label="Browser STT" value={data.browserSttStatusLabel} />
            <Row label="OpenAI STT" value={data.openAiSttStatusLabel} />
            <Row label="Self-hosted STT" value={data.selfHostedSttStatusLabel} />
            <Row label="STT provider (routing)" value={data.sttProvider} />
            <Row label="STT health" value={data.sttHealth?.trim() ? data.sttHealth : "—"} />
            <Row label="Effective STT" value={data.effectiveStt} />
            <Row label="TTS provider" value={data.ttsProvider?.trim() ? data.ttsProvider : "—"} />
            <Row label="TTS health" value={data.ttsHealth?.trim() ? data.ttsHealth : "—"} />
            <Row label="Effective TTS" value={data.effectiveTts} />
            <Row label="Prompt overlays DB" value={data.promptOverlaysStatus} />
            <Row label="Last transcript" value={data.lastTranscript?.trim() ? data.lastTranscript : "—"} />
            <Row label="Voice state" value={data.voiceState} />
            <Row
              label="Last response"
              value={
                data.lastResponse?.trim()
                  ? `${data.lastResponse.slice(0, 420)}${data.lastResponse.length > 420 ? "…" : ""}`
                  : "—"
              }
            />
            <Row label="Voice short-circuit" value={data.voiceShortCircuit} />
            <Row label="Pending voice intent" value={data.pendingVoiceIntent ?? "null"} />
            <Row label="Selected tool" value={data.selectedTool ?? "—"} />
            <Row label="Orchestration level" value={data.orchestrationLevel ?? "—"} />
            <Row label="Voice provider" value={data.voiceProvider ?? "none"} />
            <Row label="Voice health" value={data.voiceHealth ?? "—"} />
            <Row label="STT HTTP status" value={data.sttHttpStatus != null ? String(data.sttHttpStatus) : "—"} />
            <Row label="STT audio bytes" value={data.sttAudioBlobSize != null ? String(data.sttAudioBlobSize) : "—"} />
            <Row label="STT transcript" value={data.sttTranscript?.trim() ? data.sttTranscript : "—"} />
            <Row label="STT confidence" value={data.sttConfidence != null ? String(data.sttConfidence) : "—"} />
            <Row label="STT error" value={data.sttError?.trim() ? (SECRET_KEY.test(data.sttError) ? "[redacted]" : data.sttError) : "—"} />
            <Row label="Runtime type" value={data.runtimeType ?? "—"} />
          </div>
          <div>
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#00b7ff]/60">Connected systems</div>
            <div className="flex flex-wrap gap-1">
              {data.connectedSystems.length ? (
                data.connectedSystems.map((b) => (
                  <span
                    key={b}
                    className="rounded border border-[#00e5ff]/30 bg-[#02070d]/50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#00e5ff]/90"
                  >
                    {b}
                  </span>
                ))
              ) : (
                <span className="text-[10px] text-slate-500">—</span>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-rose-500/25 bg-rose-950/15 px-2 py-1.5">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-rose-300/75">Last voice error</div>
            <p className="mt-1 font-mono text-[10px] leading-snug text-rose-100/90">
              {data.lastError && !SECRET_KEY.test(data.lastError) ? data.lastError : data.lastError ? "[redacted]" : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-700/50 bg-[#02070d]/60 px-2 py-1.5 font-mono text-[10px] text-slate-400">
            <div className="flex justify-between gap-2">
              <span className="text-slate-500">STT ms</span>
              <span className="text-[#00e5ff]/90">{data.speechRecognitionMs ?? "—"}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-slate-500">Orchestrator ms</span>
              <span className="text-[#00e5ff]/90">{data.orchestratorMs ?? "—"}</span>
            </div>
            <div className="mt-1 flex justify-between gap-2">
              <span className="text-slate-500">TTS ms</span>
              <span className="text-[#00e5ff]/90">{data.ttsMs ?? "—"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void copyJson()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#00e5ff]/35 bg-[#02070d]/50 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#00e5ff] hover:bg-[#050b13]/80"
          >
            <Copy className="h-3 w-3" />
            Copy diagnostics JSON
          </button>
        </div>
      ) : null}
    </section>
  );
}
