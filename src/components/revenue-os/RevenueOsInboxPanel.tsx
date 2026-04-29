"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveSocialEngagementCapabilities } from "@/lib/social/engagement/social-engagement-capabilities";
import { RevenueOsInboxRulesPanel } from "@/components/revenue-os/RevenueOsInboxRulesPanel";

const ACC = "#a78bfa";

type ThreadRow = {
  id: string;
  provider: string;
  sourceType: string;
  status: string;
  requiresManual: boolean;
  lastMessageAt: string | null;
  preview: string;
  messageCount: number;
  campaignName: string | null;
  socialAccountId: string;
  metadataJson: unknown;
  labelSlugs?: string[];
  lastAssignedRole?: string | null;
  hasOpenAssignment?: boolean;
  badges?: {
    isManual: boolean;
    hasLabels: boolean;
    isAssigned: boolean;
    isHighSignal: boolean;
    needsManualAttention: boolean;
  };
};

type InboxReplyGovernancePayload = {
  canReplyNow: boolean;
  requiresApproval: boolean;
  reason: string;
  effectiveActorMode: "direct" | "approval_queue" | "manual_only";
};

type Detail = {
  thread: ThreadRow & { metadataJson: unknown; socialAccountId: string; id: string };
  messages: Array<{
    id: string;
    direction: string;
    authorDisplay: string | null;
    messageText: string | null;
    createdAt: string | null;
  }>;
  campaignName: string | null;
  suggestions: Array<{ id: string; suggestedText: string | null; rationaleJson: unknown; status: string }>;
  canCommentReplyInApp?: boolean;
  replyGovernance?: InboxReplyGovernancePayload;
  debug?: {
    provider: string;
    sourceType: string;
    externalThreadId: string;
    socialAccountId: string;
    hasGraphParentCommentId: boolean;
  };
  labels?: { id: string; slug: string; displayName: string }[];
  assignments?: Array<{ id: string; assignedUserId: string; assignedRole: string | null; createdAt: string | null }>;
  accountFlags?: Record<string, unknown> | null;
};

export function RevenueOsInboxPanel({ clientId }: { clientId: string }) {
  const [subview, setSubview] = useState<"threads" | "rules">("threads");
  const [items, setItems] = useState<ThreadRow[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [capSummary, setCapSummary] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sugEdit, setSugEdit] = useState("");
  const [meUserId, setMeUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [diag, setDiag] = useState<{
    newThreadsInPeriod: number;
    totalThreads: number;
    messagesInPeriod: number;
    lastIngestByProvider: { provider: string; lastMessageAt: string | null }[];
    lastIngestByAccount: { socialAccountId: string; provider: string; lastMessageAt: string | null }[];
    recentIngestErrors: { at: string; message: string; count?: number; provider?: string; errorCode?: string }[];
    devSeededThreadCount?: number;
    note: string;
    days: number;
  } | null>(null);
  const [insight, setInsight] = useState<{
    byIntent: Record<string, { count: number; examples: { id: string; preview: string }[] }>;
    bySourceType?: Record<string, { count: number; examples: { id: string; preview: string }[] }>;
    topQuestionsThisWeek: { id: string; preview: string }[];
    commonObjections: { id: string; preview: string }[];
    highIntentThreads: { id: string; preview: string }[];
    negativeOrUnhappyExamples?: { id: string; preview: string }[];
    needsManualAttentionCount?: number;
    messagesInPeriod?: number;
    rulesFiredInPeriod?: number;
  } | null>(null);

  const load = useCallback(async () => {
    if (!clientId) return;
    setErr(null);
    try {
      const r = await fetch(`/api/revenue-os/inbox/threads?clientId=${encodeURIComponent(clientId)}&limit=80`);
      const j = (await r.json()) as { items?: ThreadRow[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "load failed");
      setItems(j.items ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }, [clientId]);

  const loadInsight = useCallback(async () => {
    if (!clientId) return;
    try {
      const r = await fetch(`/api/revenue-os/inbox/insights?clientId=${encodeURIComponent(clientId)}&days=7`);
      const j = (await r.json()) as {
        byIntent?: Record<string, { count: number; examples: { id: string; preview: string }[] }>;
        bySourceType?: Record<string, { count: number; examples: { id: string; preview: string }[] }>;
        topQuestionsThisWeek?: { id: string; preview: string }[];
        commonObjections?: { id: string; preview: string }[];
        highIntentThreads?: { id: string; preview: string }[];
        negativeOrUnhappyExamples?: { id: string; preview: string }[];
        needsManualAttentionCount?: number;
        messagesInPeriod?: number;
        rulesFiredInPeriod?: number;
      };
      if (r.ok) {
        setInsight({
          byIntent: j.byIntent ?? {},
          bySourceType: j.bySourceType,
          topQuestionsThisWeek: j.topQuestionsThisWeek ?? [],
          commonObjections: j.commonObjections ?? [],
          highIntentThreads: j.highIntentThreads ?? [],
          negativeOrUnhappyExamples: j.negativeOrUnhappyExamples,
          needsManualAttentionCount: j.needsManualAttentionCount,
          messagesInPeriod: j.messagesInPeriod,
          rulesFiredInPeriod: j.rulesFiredInPeriod,
        });
      }
    } catch {
      setInsight(null);
    }
  }, [clientId]);

  const loadDiagnostics = useCallback(async () => {
    if (!clientId) return;
    try {
      const r = await fetch(
        `/api/revenue-os/inbox/diagnostics?clientId=${encodeURIComponent(clientId)}&days=7`
      );
      const j = (await r.json()) as {
        days?: number;
        newThreadsInPeriod?: number;
        totalThreads?: number;
        messagesInPeriod?: number;
        lastIngestByProvider?: { provider: string; lastMessageAt: string | null }[];
        lastIngestByAccount?: { socialAccountId: string; provider: string; lastMessageAt: string | null }[];
        recentIngestErrors?: { at: string; message: string; count?: number; provider?: string; errorCode?: string }[];
        devSeededThreadCount?: number;
        note?: string;
        error?: string;
      };
      if (r.ok) {
        setDiag({
          days: j.days ?? 7,
          newThreadsInPeriod: j.newThreadsInPeriod ?? 0,
          totalThreads: j.totalThreads ?? 0,
          messagesInPeriod: j.messagesInPeriod ?? 0,
          lastIngestByProvider: j.lastIngestByProvider ?? [],
          lastIngestByAccount: j.lastIngestByAccount ?? [],
          recentIngestErrors: j.recentIngestErrors ?? [],
          devSeededThreadCount: j.devSeededThreadCount,
          note: j.note ?? "",
        });
      }
    } catch {
      setDiag(null);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadInsight();
  }, [loadInsight]);

  useEffect(() => {
    if (subview === "threads") {
      void loadDiagnostics();
    }
  }, [loadDiagnostics, subview]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/revenue-os/inbox/me");
        const j = (await r.json()) as { userId?: string };
        if (r.ok && j.userId) {
          setMeUserId(String(j.userId));
        }
      } catch {
        setMeUserId(null);
      }
    })();
  }, []);

  useEffect(() => {
    if (!sel) {
      setDetail(null);
      return;
    }
    let c = true;
    void (async () => {
      try {
        const r = await fetch(`/api/revenue-os/inbox/threads/${encodeURIComponent(sel)}`);
        const j = (await r.json()) as Detail;
        if (!r.ok || !c) return;
        setDetail(j);
        setReplyText("");
        setSugEdit(j.suggestions?.[0]?.suggestedText ?? "");
        setActionErr(null);
        const cap = resolveSocialEngagementCapabilities({
          provider: j.thread.provider,
          flagsOverride: (j.accountFlags ?? null) as never,
          socialAccount: null,
          sourceType: j.thread.sourceType as "comment" | "dm" | "mention" | "unknown",
        });
        const capLine = [cap.canReplyComments && "comment reply", cap.canSendDMs && "DM send", cap.requiresManualForReplies && "manual path"]
          .filter(Boolean)
          .join(" · ");
        setCapSummary((capLine || cap.reasons[0]) ?? "Capability defaults — connect account with flags for accuracy.");
      } catch {
        if (c) setDetail(null);
      }
    })();
    return () => {
      c = false;
    };
  }, [sel]);

  const summary = useMemo(() => {
    const nNew = items.filter((i) => i.status === "new").length;
    const wait = items.filter((i) => i.status === "waiting" || i.status === "triaged").length;
    const manual = items.filter((i) => i.status === "manual_only" || i.requiresManual).length;
    const byProv = items.reduce<Record<string, number>>((m, i) => {
      m[i.provider] = (m[i.provider] || 0) + 1;
      return m;
    }, {});
    return { nNew, wait, manual, byProv };
  }, [items]);

  const canComposeInboxReply = (d: Detail | null) => {
    if (!d) return false;
    const m = d.replyGovernance?.effectiveActorMode;
    if (m === "direct" || m === "approval_queue") {
      return true;
    }
    // Backward compat: older payload without governance
    return Boolean(d.canCommentReplyInApp);
  };

  async function markTriage(status: "triaged" | "resolved") {
    if (!sel) return;
    const r = await fetch(`/api/revenue-os/inbox/threads/${encodeURIComponent(sel)}/triage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (r.ok) {
      void load();
    }
  }

  async function copySuggestion() {
    const t = sugEdit || detail?.suggestions?.[0]?.suggestedText;
    if (t) {
      await navigator.clipboard.writeText(t).catch(() => {});
      setToast("Copied to clipboard");
    }
  }

  async function postNote() {
    if (!sel || !sugEdit.trim()) return;
    setActionErr(null);
    const r = await fetch("/api/revenue-os/inbox/add-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: sel, text: sugEdit.trim() }),
    });
    if (r.ok) {
      setToast("Saved as note");
      if (sel) {
        const dr = await fetch(`/api/revenue-os/inbox/threads/${encodeURIComponent(sel)}`);
        if (dr.ok) {
          setDetail((await dr.json()) as Detail);
        }
      }
    } else {
      setActionErr("Note failed");
    }
  }

  async function acceptBentley() {
    if (!sel || !detail?.suggestions[0]) return;
    setActionErr(null);
    const r = await fetch("/api/revenue-os/inbox/suggestion/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: sel,
        suggestionId: detail.suggestions[0].id,
        textOverride: sugEdit || null,
      }),
    });
    if (r.ok) {
      setToast("Bentley suggestion saved as note");
      void load();
      if (sel) {
        const dr = await fetch(`/api/revenue-os/inbox/threads/${encodeURIComponent(sel)}`);
        if (dr.ok) {
          setDetail((await dr.json()) as Detail);
        }
      }
    } else {
      setActionErr("Accept failed");
    }
  }

  async function dismissBentley() {
    if (!sel || !detail?.suggestions[0]) return;
    setActionErr(null);
    const r = await fetch("/api/revenue-os/inbox/suggestion/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: sel, suggestionId: detail.suggestions[0].id, dismiss: true }),
    });
    if (r.ok && sel) {
      setToast("Suggestion dismissed");
      const dr = await fetch(`/api/revenue-os/inbox/threads/${encodeURIComponent(sel)}`);
      if (dr.ok) {
        setDetail((await dr.json()) as Detail);
      }
    } else {
      setActionErr("Dismiss failed");
    }
  }

  async function sendReply() {
    if (!sel || !detail) return;
    setActionErr(null);
    const r = await fetch("/api/revenue-os/inbox/reply-comment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: sel,
        socialAccountId: detail.thread.socialAccountId,
        replyText: replyText.trim(),
        messageId: null,
      }),
    });
    const j = (await r.json()) as {
      ok?: boolean;
      error?: string;
      reason?: string;
      platformReplyId?: string;
      heldForApproval?: boolean;
    };
    if (j.ok) {
      if (j.heldForApproval) {
        setToast("Reply held for approval — saved as thread note, not sent to Graph");
      } else {
        setToast("Comment reply sent (audited)");
      }
      setReplyText("");
      void load();
      const dr = await fetch(`/api/revenue-os/inbox/threads/${encodeURIComponent(sel)}`);
      if (dr.ok) {
        setDetail((await dr.json()) as Detail);
      }
    } else {
      setActionErr(j.error ?? j.reason ?? "Reply failed");
    }
  }

  async function assignSelf() {
    if (!sel || !meUserId) return;
    setActionErr(null);
    const r = await fetch("/api/revenue-os/inbox/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: sel, assignedUserId: meUserId, assignedRole: "owner" }),
    });
    if (r.ok) {
      void load();
      const dr = await fetch(`/api/revenue-os/inbox/threads/${encodeURIComponent(sel)}`);
      if (dr.ok) {
        setDetail((await dr.json()) as Detail);
      }
    } else {
      setActionErr("Assign failed");
    }
  }

  return (
    <div
      id="smart-inbox"
      className="rounded-2xl border border-violet-500/30 bg-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.12)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: ACC }}>
            Smart Inbox
          </h2>
          <p className="text-xs text-slate-400 max-w-3xl">
            Governed engagement. Comment replies are manual operator actions, capability-gated, audited, and never auto-sent from rules.
            No blind DM or reply automation.
          </p>
        </div>
        <div className="flex gap-1 text-[11px] shrink-0">
          <button
            type="button"
            onClick={() => setSubview("threads")}
            className={`rounded border px-2 py-1 ${subview === "threads" ? "border-violet-500/50 bg-slate-900" : "border-slate-800 text-slate-500"}`}
            data-testid="inbox-tab-threads"
          >
            Inbox
          </button>
          <button
            type="button"
            onClick={() => setSubview("rules")}
            className={`rounded border px-2 py-1 ${subview === "rules" ? "border-violet-500/50 bg-slate-900" : "border-slate-800 text-slate-500"}`}
            data-testid="inbox-tab-rules"
          >
            Rules
          </button>
        </div>
      </div>
      {toast ? (
        <p className="text-xs text-cyan-200/90 mb-2" role="status" data-testid="inbox-toast">
          {toast}
        </p>
      ) : null}
      {err && <p className="text-sm text-red-400 mb-2">{err}</p>}
      {actionErr && <p className="text-sm text-amber-300/90 mb-2">{actionErr}</p>}

      {subview === "rules" ? (
        <div className="mt-2">
          <RevenueOsInboxRulesPanel clientId={clientId} />
        </div>
      ) : (
        <>
          {insight ? (
            <div className="mb-4 rounded border border-white/10 p-3 text-[10px] text-slate-300 space-y-1" data-testid="inbox-insights">
              <div className="text-slate-200 font-medium">This week (light signals)</div>
              <p className="text-slate-500">
                Messages in period: {insight.messagesInPeriod ?? "—"} · rules fired: {insight.rulesFiredInPeriod ?? "—"} · needs manual
                attention: {insight.needsManualAttentionCount ?? "—"}
              </p>
              {insight.topQuestionsThisWeek.length ? (
                <p>
                  <span className="text-slate-500">Top questions: </span>
                  {insight.topQuestionsThisWeek.map((x) => x.preview).join(" · ")}
                </p>
              ) : null}
              {insight.commonObjections.length ? (
                <p>
                  <span className="text-slate-500">Objections: </span>
                  {insight.commonObjections.map((x) => x.preview).join(" · ")}
                </p>
              ) : null}
              {insight.negativeOrUnhappyExamples && insight.negativeOrUnhappyExamples.length > 0 ? (
                <p>
                  <span className="text-slate-500">Negative (sample): </span>
                  {insight.negativeOrUnhappyExamples.map((x) => x.preview).join(" · ")}
                </p>
              ) : null}
              {Object.keys(insight.byIntent).length ? (
                <p className="text-slate-500">
                  Top intents:{" "}
                  {Object.entries(insight.byIntent)
                    .map(([k, v]) => `${k} (${v.count})`)
                    .join(" · ")}
                </p>
              ) : null}
              {insight.bySourceType && Object.keys(insight.bySourceType).length ? (
                <p className="text-slate-500">
                  Source types:{" "}
                  {Object.entries(insight.bySourceType)
                    .map(([k, v]) => `${k} (${v.count})`)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
          ) : null}

          {diag ? (
            <div className="mb-3 rounded border border-slate-800 bg-slate-950/50 p-2 text-[10px] text-slate-400 space-y-1" data-testid="inbox-diagnostics">
              <div className="text-slate-300 font-medium">Ingest diagnostics (last {diag.days}d)</div>
              <p>
                New threads: {diag.newThreadsInPeriod} · total threads: {diag.totalThreads} · messages: {diag.messagesInPeriod}
              </p>
              {diag.lastIngestByProvider.length ? (
                <p>
                  <span className="text-slate-500">By provider: </span>
                  {diag.lastIngestByProvider.map((x) => `${x.provider} @ ${x.lastMessageAt ?? "—"}`).join(" · ")}
                </p>
              ) : null}
              {diag.lastIngestByAccount.length ? (
                <p className="line-clamp-2" title={diag.lastIngestByAccount.map((a) => a.socialAccountId).join(", ")}>
                  <span className="text-slate-500">By account: </span>
                  {diag.lastIngestByAccount.length} account(s) with last activity
                </p>
              ) : null}
              {typeof diag.devSeededThreadCount === "number" && diag.devSeededThreadCount > 0 ? (
                <p className="text-slate-500" data-testid="inbox-diag-dev-seed-hint">
                  Dev-seeded threads (dev-thread-* id): {diag.devSeededThreadCount} — treat as sample, not live provider sync.
                </p>
              ) : null}
              {diag.recentIngestErrors.length > 0 ? (
                <ul className="text-amber-200/85 space-y-0.5 list-disc pl-4" data-testid="inbox-diag-ingest-errors">
                  {diag.recentIngestErrors.slice(0, 6).map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      [{e.provider ?? "?"} · {e.errorCode ?? "?"} · ×{e.count ?? 1}] {e.message.slice(0, 180)}
                      {e.message.length > 180 ? "…" : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-slate-600">{diag.note}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 text-[11px] text-slate-300 mb-4">
            <span className="rounded border border-white/10 px-2 py-0.5">New: {summary.nNew}</span>
            <span className="rounded border border-white/10 px-2 py-0.5">Triage / waiting: {summary.wait}</span>
            <span className="rounded border border-amber-500/30 px-2 py-0.5 text-amber-200/90">Manual / blocked: {summary.manual}</span>
            <span className="text-slate-500">
              By provider: {Object.entries(summary.byProv)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </span>
            <button
              type="button"
              onClick={() => {
                void load();
                void loadDiagnostics();
                void loadInsight();
              }}
              className="ml-auto text-cyan-400 text-xs underline"
            >
              Refresh
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">No threads yet. Use the dev seed (non-production) to sample data.</p>
          ) : (
            <div className="grid lg:grid-cols-[1fr_360px] gap-3">
              <ul className="space-y-2 max-h-[400px] overflow-y-auto pr-1" data-testid="inbox-thread-list">
                {items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      data-testid={`inbox-row-${it.id}`}
                      onClick={() => setSel(it.id)}
                      className={`w-full text-left rounded border px-2 py-2 text-[11px] ${
                        sel === it.id ? "border-violet-500/60 bg-slate-900" : "border-slate-800 bg-slate-950/50"
                      }`}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-200 capitalize">{it.provider}</span>
                        <span className="text-slate-500">{it.sourceType}</span>
                      </div>
                      <div className="text-slate-400 line-clamp-2 mt-0.5">{it.preview || "—"}</div>
                      <div className="text-[10px] text-slate-600 mt-1 flex flex-wrap gap-1">
                        <span>
                          {it.status} · {it.messageCount} msg
                        </span>
                        {it.badges?.isHighSignal ? <span className="text-rose-300/80">· high signal</span> : null}
                        {it.badges?.needsManualAttention ? <span className="text-amber-200/80">· attention</span> : null}
                        {it.requiresManual || it.status === "manual_only" ? (
                          <span className="text-amber-300/90">· manual</span>
                        ) : null}
                        {it.labelSlugs && it.labelSlugs.length > 0 ? (
                          <span className="text-cyan-300/80" data-testid="inbox-label-badges">
                            · {it.labelSlugs.join(", ")}
                          </span>
                        ) : null}
                        {it.hasOpenAssignment ? (
                          <span className="text-violet-300/80" data-testid="inbox-assigned-badge">
                            · assigned{it.lastAssignedRole ? ` (${it.lastAssignedRole})` : ""}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="rounded border border-slate-800 bg-slate-950/80 p-3 text-xs space-y-2 min-h-[200px]">
                {!detail ? (
                  <p className="text-slate-500">Select a thread.</p>
                ) : (
                  <>
                    <p className="text-slate-500">
                      {detail.campaignName ? <span className="text-slate-300">Campaign: {detail.campaignName}</span> : "No campaign link"}
                    </p>
                    {detail.labels && detail.labels.length > 0 ? (
                      <p className="text-[10px] text-slate-300" data-testid="inbox-labels-row">
                        <span className="text-slate-500">Labels: </span>
                        {detail.labels.map((l) => l.displayName).join(", ")}
                      </p>
                    ) : null}
                    {detail.assignments && detail.assignments.length > 0 ? (
                      <ul className="text-[10px] text-slate-300" data-testid="inbox-assignments">
                        <li className="text-slate-500">Assignments</li>
                        {detail.assignments.map((a) => (
                          <li key={a.id}>
                            {a.assignedUserId} {a.assignedRole ? `· ${a.assignedRole}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="text-[10px] text-slate-500">Capabilities (account flags when synced): {capSummary}</p>
                    {detail.debug ? (
                      <div
                        className="text-[9px] text-slate-500 border border-slate-800 rounded p-1.5 space-y-0.5"
                        data-testid="inbox-admin-debug"
                      >
                        <p className="text-slate-400 font-medium">Thread / source</p>
                        <p>
                          Provider: {detail.debug.provider} · source: {detail.debug.sourceType} · social account:{" "}
                          {detail.debug.socialAccountId}
                        </p>
                        <p className="break-all">External thread: {detail.debug.externalThreadId}</p>
                        <p>Graph parent id in metadata: {detail.debug.hasGraphParentCommentId ? "yes" : "no"}</p>
                      </div>
                    ) : null}
                    {detail.replyGovernance ? (
                      <div className="text-[10px] space-y-0.5 border-l-2 border-cyan-500/40 pl-2" data-testid="inbox-reply-governance">
                        <p className="text-cyan-200/90">
                          Reply:{" "}
                          {detail.replyGovernance.effectiveActorMode === "direct"
                            ? "can post now (Graph)"
                            : detail.replyGovernance.effectiveActorMode === "approval_queue"
                              ? "approval required — queue draft only; manual only; no auto-send"
                              : "manual / native only"}
                        </p>
                        {detail.replyGovernance.requiresApproval ? (
                          <p className="text-amber-200/80">Approval required before a platform send. Drafts go to thread notes.</p>
                        ) : null}
                        <p className="text-slate-500">{detail.replyGovernance.reason}</p>
                      </div>
                    ) : null}
                    <p className="text-[10px] text-cyan-200/80" data-testid="inbox-reply-gate">
                      In-app comment reply:{" "}
                      {detail.canCommentReplyInApp
                        ? "Graph send is allowed for this thread (operator-authorized, audited)"
                        : "not available for immediate Graph send — see governance above"}
                    </p>
                    <ul className="space-y-2 max-h-48 overflow-y-auto border-t border-slate-800 pt-2">
                      {detail.messages.map((m) => (
                        <li key={m.id} className="text-slate-300" data-testid="inbox-message">
                          <span className="text-slate-500">[{m.direction}]</span> {m.messageText}
                        </li>
                      ))}
                    </ul>
                    {detail.suggestions[0] ? (
                      <div className="rounded border border-violet-500/30 p-2 bg-violet-950/20" data-testid="inbox-bentley-card">
                        <p className="text-[10px] text-violet-200/80 font-medium">Bentley (deterministic)</p>
                        <textarea
                          className="w-full mt-1 rounded border border-slate-700 bg-slate-900/80 p-1 text-[11px] text-slate-200"
                          rows={3}
                          value={sugEdit}
                          onChange={(e) => setSugEdit(e.target.value)}
                        />
                        <div className="flex flex-wrap gap-1 mt-2">
                          <button
                            type="button"
                            onClick={() => void copySuggestion()}
                            className="text-[10px] text-cyan-400 underline"
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            onClick={() => void postNote()}
                            className="text-[10px] text-slate-200 underline"
                          >
                            Save as note
                          </button>
                          <button
                            type="button"
                            onClick={() => void acceptBentley()}
                            className="text-[10px] text-violet-300 underline"
                          >
                            Use suggestion (note)
                          </button>
                          <button type="button" onClick={() => void dismissBentley()} className="text-[10px] text-slate-500 underline">
                            Dismiss
                          </button>
                        </div>
                        {canComposeInboxReply(detail) ? (
                          <p className="text-[9px] text-slate-500 mt-1">Paste into the reply area below (or native tools). Manual only; no auto-send.</p>
                        ) : null}
                      </div>
                    ) : null}
                    {canComposeInboxReply(detail) ? (
                      <div className="space-y-1" data-testid="inbox-reply-box">
                        <p className="text-[10px] text-slate-500">
                          {detail.replyGovernance?.effectiveActorMode === "approval_queue"
                            ? "Queue comment draft (saves as note; not sent to Graph — approval path)"
                            : "Reply to comment (governed operator action — audited, manual only)"}
                        </p>
                        <textarea
                          className="w-full rounded border border-violet-500/30 bg-slate-900/80 p-2 text-[11px] text-slate-200"
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => void sendReply()}
                          disabled={!replyText.trim()}
                          className="rounded border border-violet-500/50 px-2 py-1 text-[10px] text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {detail.replyGovernance?.effectiveActorMode === "approval_queue"
                            ? "Queue for approval (note)"
                            : "Send comment reply"}
                        </button>
                      </div>
                    ) : (
                      <p className="text-[10px] text-amber-200/80" data-testid="inbox-reply-blocked">
                        {detail.replyGovernance?.reason ||
                          "No in-app comment reply for this thread — use native app or copy the draft above. Operator actions are still audited when you use native tools."}
                      </p>
                    )}
                    {meUserId ? (
                      <div className="flex flex-wrap gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => void assignSelf()}
                          className="rounded border border-white/15 px-2 py-1 text-[10px]"
                        >
                          Assign to me
                        </button>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void markTriage("triaged")}
                        className="rounded border border-white/15 px-2 py-1 text-[10px]"
                      >
                        Mark triaged
                      </button>
                      <button
                        type="button"
                        onClick={() => void markTriage("resolved")}
                        className="rounded border border-white/15 px-2 py-1 text-[10px]"
                      >
                        Resolve
                      </button>
                    </div>
                    <p className="text-[10px] text-amber-200/80" data-testid="inbox-manual-only-notice">
                      DM send is not offered here when unsupported — the capability layer and metadata must both allow a path before in-app
                      send.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
