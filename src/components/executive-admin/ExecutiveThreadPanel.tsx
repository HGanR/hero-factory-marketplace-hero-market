"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ExecutiveOperationalThreadDetailDto,
  ExecutiveOperationalThreadDto,
} from "@/lib/executive-agent/executive-conversation-threads";

type Props = {
  threadId: string | null;
  onSkipperContext?: (context: string | null) => void;
  onCreateThread?: () => void;
};

export function ExecutiveThreadPanel({ threadId, onSkipperContext, onCreateThread }: Props) {
  const [detail, setDetail] = useState<ExecutiveOperationalThreadDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [messageKind, setMessageKind] = useState<
    "discussion" | "operational_note" | "question" | "decision_request" | "owner_annotation"
  >("discussion");

  const load = useCallback(async () => {
    if (!threadId) {
      setDetail(null);
      onSkipperContext?.(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/executive-agent/threads/${threadId}/messages`, {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json().catch(() => ({}))) as ExecutiveOperationalThreadDetailDto & {
        error?: string;
      };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Load failed (${r.status})`);
        setDetail(null);
        onSkipperContext?.(null);
        return;
      }
      setDetail(j);
      onSkipperContext?.(j.skipperThreadContext);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setDetail(null);
      onSkipperContext?.(null);
    } finally {
      setLoading(false);
    }
  }, [threadId, onSkipperContext]);

  useEffect(() => {
    void load();
  }, [load]);

  const postMessage = async () => {
    if (!threadId || !draft.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/admin/executive-agent/threads/${threadId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: draft.trim(),
          messageKind,
          ownerOnly: messageKind === "owner_annotation",
          isPinned: messageKind === "operational_note" && draft.includes("[pin]"),
        }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) {
        setError(j.error ?? `Post failed (${r.status})`);
        return;
      }
      setDraft("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPosting(false);
    }
  };

  if (!threadId) {
    return (
      <section className="rounded-2xl border border-slate-700/50 bg-slate-950/50 p-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Operational thread
        </h2>
        <p className="mt-2 text-xs text-slate-500">Select a thread or start a new internal discussion.</p>
        {onCreateThread ? (
          <button
            type="button"
            onClick={onCreateThread}
            className="mt-3 rounded-full border border-violet-500/40 px-3 py-1.5 text-[10px] font-semibold uppercase text-violet-200 hover:bg-violet-950/30"
          >
            New thread
          </button>
        ) : null}
      </section>
    );
  }

  const thread: ExecutiveOperationalThreadDto | undefined = detail?.thread;

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-[#050b13]/88 p-4 backdrop-blur-md">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/90">
            {thread?.title ?? "Thread"}
          </h2>
          {thread ? (
            <p className="mt-0.5 text-[10px] text-slate-500">
              {thread.status} · {thread.priority}
              {thread.decisionNeeded ? " · decision needed" : ""}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[9px] uppercase text-cyan-400/90"
        >
          Refresh
        </button>
      </div>
      {thread?.pinnedNoteText ? (
        <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
          <span className="text-[9px] font-semibold uppercase text-amber-400/80">Pinned note</span>
          <p className="mt-1 whitespace-pre-wrap">{thread.pinnedNoteText}</p>
        </div>
      ) : null}
      {thread?.memorySummary ? (
        <p className="mb-2 text-[10px] leading-snug text-slate-500">
          <span className="text-slate-600">Memory: </span>
          {thread.memorySummary}
        </p>
      ) : null}
      {error ? <p className="mb-2 text-xs text-amber-200">{error}</p> : null}
      {loading ? <p className="text-xs text-slate-500">Loading messages…</p> : null}
      <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto">
        {(detail?.messages ?? []).map((m) => (
          <li
            key={m.id}
            className={`rounded-lg border px-2 py-1.5 text-xs ${
              m.ownerOnly
                ? "border-slate-700/80 bg-slate-900/60 text-slate-400 italic"
                : "border-slate-800/80 bg-slate-950/50 text-slate-200"
            }`}
          >
            <div className="flex justify-between text-[9px] uppercase text-slate-500">
              <span>{m.messageKind}</span>
              <span>{new Date(m.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap">{m.bodyText}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
        <select
          value={messageKind}
          onChange={(e) =>
            setMessageKind(
              e.target.value as
                | "discussion"
                | "operational_note"
                | "question"
                | "decision_request"
                | "owner_annotation"
            )
          }
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] text-slate-300"
        >
          <option value="discussion">Discussion</option>
          <option value="operational_note">Operational note</option>
          <option value="question">Question</option>
          <option value="decision_request">Decision request</option>
          <option value="owner_annotation">Owner-only annotation</option>
        </select>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Internal note — human-authored only"
          className="min-h-[48px] flex-1 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-200"
        />
        <button
          type="button"
          disabled={posting || !draft.trim()}
          onClick={() => void postMessage()}
          className="rounded-full border border-violet-500/40 px-3 py-1.5 text-[10px] font-semibold uppercase text-violet-200 disabled:opacity-40"
        >
          Post
        </button>
      </div>
      <p className="mt-2 text-[9px] text-slate-600">
        No autonomous replies. Skipper reads thread context only.
      </p>
    </section>
  );
}
