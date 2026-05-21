"use client";

import { useCallback, useState } from "react";
import { Mic, X } from "lucide-react";
import type { ExecutiveAgentKey } from "@/lib/executive-agent/agent-intelligence-bus";
import type { ExecutiveDashboardMode, ExecutiveTimeRange } from "@/lib/executive-agent/executive-agent-chat-request";
import type { ExecutiveSubjectConfig } from "@/lib/executive-agent/executive-subject-nav";

export type SubjectChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  at: string;
};

type ChatApiResult = {
  answer?: string;
  insights?: Array<{ title: string; detail: string }>;
  error?: string;
  message?: string;
};

type Props = {
  subject: ExecutiveSubjectConfig;
  clientId: string;
  campaignId: string;
  dryRun: boolean;
  timeRange: ExecutiveTimeRange;
  busy: boolean;
  /** Subject-scoped Skipper context from workspace loader. */
  skipperWorkspaceContext?: string | null;
  onClose: () => void;
  onMessagesChange?: (messages: SubjectChatMessage[]) => void;
};

export function ExecutiveSubjectAgentChatPanel({
  subject,
  clientId,
  campaignId,
  dryRun,
  timeRange,
  busy,
  skipperWorkspaceContext,
  onClose,
  onMessagesChange,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<SubjectChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const appendMessages = useCallback(
    (next: SubjectChatMessage[]) => {
      setMessages((prev) => {
        const merged = [...prev, ...next];
        onMessagesChange?.(merged);
        return merged;
      });
    },
    [onMessagesChange]
  );

  const sendTask = useCallback(async () => {
    const p = prompt.trim();
    if (!p || sending) return;
    setSending(true);
    setError(null);
    const userMsg: SubjectChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: p,
      at: new Date().toISOString(),
    };
    appendMessages([userMsg]);
    setPrompt("");

    const delegateLine = subject.agentSlots
      .map((s) => `${s.displayName} (${s.domainLabel})`)
      .join(", ");
    const contextBlock = skipperWorkspaceContext?.trim()
      ? `[Workspace context: ${skipperWorkspaceContext.trim()}] `
      : "";
    const routedPrompt =
      subject.id === "trust_jarva"
        ? `${contextBlock}[TRUST / Jarva desk — legal-review only, no trust apply] ${p}`
        : `${contextBlock}[${subject.navLabel} — delegated: ${delegateLine}. Skipper routes; no autonomous execution.] ${p}`;

    try {
      const r = await fetch("/api/admin/executive-agent/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: routedPrompt,
          mode: "read",
          dryRun,
          selectedAgents: subject.delegateAgents as ExecutiveAgentKey[],
          selectedTimeRange: timeRange,
          dashboardMode: subject.dashboardMode as ExecutiveDashboardMode,
          ...(clientId.trim() ? { selectedClientId: clientId.trim() } : {}),
          ...(campaignId.trim() ? { selectedCampaignId: campaignId.trim() } : {}),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as ChatApiResult;
      if (!r.ok) throw new Error(j.message ?? j.error ?? "Chat failed");
      const answer = (j.answer ?? "").trim() || "No answer returned.";
      appendMessages([
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: answer,
          at: new Date().toISOString(),
        },
      ]);
      if (j.insights?.length) {
        appendMessages([
          {
            id: `i-${Date.now()}`,
            role: "system",
            text: j.insights.map((x) => `${x.title}: ${x.detail}`).join("\n"),
            at: new Date().toISOString(),
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  }, [
    prompt,
    sending,
    subject,
    dryRun,
    timeRange,
    clientId,
    campaignId,
    appendMessages,
    skipperWorkspaceContext,
  ]);

  return (
    <section
      className="mb-4 rounded-2xl border border-[#00e5ff]/28 bg-[#050b13]/92 p-4 shadow-[0_0_28px_rgba(0,229,255,0.08)] backdrop-blur-md"
      aria-label={`${subject.navLabel} agent chat`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#00e5ff]/90">
            {subject.navLabel}
          </h2>
          <p className="mt-0.5 text-[10px] text-slate-500">{subject.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {subject.agentSlots.map((slot) => (
              <div
                key={`${slot.routeKey}-${slot.domainLabel}`}
                className="rounded-lg border border-violet-500/25 bg-violet-950/25 px-2 py-1 text-center"
              >
                <div className="text-[10px] font-semibold text-slate-200">{slot.displayName}</div>
                <div className="text-[8px] font-bold uppercase tracking-[0.18em] text-violet-300/90">
                  {slot.domainLabel}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-600/60 p-1.5 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
          aria-label="Close subject chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-800/80 bg-[#02070d]/80 p-3 text-xs">
        {messages.length === 0 ? (
          <p className="text-slate-500">
            Task queue for{" "}
            <span className="text-[#00e5ff]/90">{subject.delegateAgents.join(", ")}</span> via Claude
            orchestration. Ask for reads, plans, or approval proposals — writes still require your sign-off.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "rounded-lg border border-[#00e5ff]/20 bg-[#00e5ff]/5 px-2 py-1.5 text-slate-200"
                  : m.role === "assistant"
                    ? "rounded-lg border border-slate-700/50 bg-slate-900/50 px-2 py-1.5 text-slate-300"
                    : "rounded-lg border border-amber-500/20 bg-amber-950/20 px-2 py-1.5 text-amber-100/80"
              }
            >
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {m.role === "user" ? "You" : m.role === "assistant" ? "Desk" : "Insight"}
              </span>
              <p className="mt-0.5 whitespace-pre-wrap">{m.text}</p>
            </div>
          ))
        )}
      </div>

      {error ? <p className="mt-2 text-xs text-red-300/90">{error}</p> : null}

      <div className="mt-3 flex gap-2">
        <textarea
          className="min-h-[72px] min-w-0 flex-1 rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-[#00e5ff]/50"
          placeholder={`Task for ${subject.navLabel} agents…`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendTask();
            }
          }}
          disabled={sending || busy}
        />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            title="Voice mode — wiring coming soon"
            disabled
            className="flex h-11 w-11 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/40 text-slate-600 opacity-60"
            aria-label="Activate voice mode (coming soon)"
          >
            <Mic className="h-5 w-5" />
          </button>
          <span className="max-w-[4.5rem] text-center text-[8px] uppercase tracking-wide text-slate-600">
            Voice soon
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={sending || busy || !prompt.trim()}
          onClick={() => void sendTask()}
          className="rounded-xl bg-[#00e5ff] px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-[#33b4ff] disabled:opacity-40"
        >
          {sending ? "Routing…" : "Send task to agents"}
        </button>
        <span className="self-center text-[10px] text-slate-600">
          Skipper nexus · {subject.delegateAgents.length} agent route(s)
        </span>
      </div>
    </section>
  );
}
