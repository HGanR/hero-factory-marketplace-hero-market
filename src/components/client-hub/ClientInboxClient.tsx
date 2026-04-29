"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import type { InboxRow } from "@/lib/revenue-os/client-hub-types";
import { ClientPrimaryActionBar } from "./ClientPrimaryActionBar";
import { ClientStatusBadge } from "./ClientStatusBadge";

type Props = {
  clientId: string;
  initialInbox: InboxRow[];
};

type Action =
  | "mark_qualified"
  | "assign_followup"
  | "create_task"
  | "schedule_booking"
  | "add_note";

function contactLabel(row: InboxRow): string {
  const c = row.contact;
  if (!c) return "Unknown lead";
  const n = [c.firstName, c.lastName].filter(Boolean).join(" ");
  if (n.trim()) return n;
  if (c.email) return c.email;
  if (c.company) return c.company;
  return "Contact";
}

export function ClientInboxClient({ clientId, initialInbox }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialInbox[0]?.conversation.id ?? null);
  const [working, setWorking] = useState(false);

  const selected = useMemo(
    () => initialInbox.find((r) => r.conversation.id === selectedId) ?? null,
    [initialInbox, selectedId],
  );

  const runAction = useCallback(
    async (action: Action) => {
      if (!selected) return;
      const convId = selected.conversation.id;
      let text: string | undefined;
      let dueAt: string | undefined;
      if (action === "assign_followup" || action === "create_task" || action === "add_note") {
        const p = window.prompt(
          action === "assign_followup" ? "Follow-up notes" : action === "create_task" ? "Task title" : "Note",
        );
        if (!p?.trim()) {
          toast.error("Text is required");
          return;
        }
        text = p.trim();
        if (action === "create_task") {
          const d = window.prompt("Optional due date (ISO or any text)", "");
          if (d?.trim()) dueAt = d.trim();
        }
      }
      if (action === "schedule_booking") {
        const t = window.prompt("When should we book? (date, time, or free text)", "");
        if (!t?.trim()) {
          toast.error("A time or description is required");
          return;
        }
        dueAt = t.trim();
      }

      setWorking(true);
      try {
        const r = await fetch(
          `/api/revenue-os/clients/${encodeURIComponent(clientId)}/inbox/conversations/${encodeURIComponent(
            convId,
          )}/action`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action, text, dueAt }),
          },
        );
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        if (!r.ok) {
          toast.error(d.error || "Action failed");
          return;
        }
        toast.success("Saved to CRM for this client");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Request failed");
      } finally {
        setWorking(false);
      }
    },
    [clientId, selected],
  );

  const mailto = selected?.contact?.email
    ? `mailto:${encodeURIComponent(String(selected.contact.email))}`
    : null;

  return (
    <div className="grid min-h-[420px] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/50">
        <p className="border-b border-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Conversations
        </p>
        <ul className="max-h-[520px] divide-y divide-white/5 overflow-y-auto">
          {initialInbox.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-slate-500">No conversations for this client yet.</li>
          ) : (
            initialInbox.map((row) => {
              const active = row.conversation.id === selectedId;
              return (
                <li key={row.conversation.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.conversation.id)}
                    className={`w-full px-3 py-2.5 text-left text-sm transition ${
                      active ? "bg-cyan-500/10 text-cyan-100" : "text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <p className="line-clamp-1 font-medium">{row.conversation.subject || contactLabel(row)}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">
                      {row.conversation.lastMessageAt
                        ? new Date(row.conversation.lastMessageAt).toLocaleString()
                        : "—"}{" "}
                      · {row.conversation.channel}
                    </p>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
      <div className="flex flex-col rounded-xl border border-white/10 bg-slate-900/50">
        <p className="border-b border-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Detail
        </p>
        {selected ? (
          <div className="flex flex-1 flex-col p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ClientStatusBadge status={selected.conversation.status || "open"} />
              {selected.conversation.unreadCount > 0 ? (
                <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-100">
                  {selected.conversation.unreadCount} unread
                </span>
              ) : null}
            </div>
            <p className="text-lg font-semibold text-slate-100">{contactLabel(selected)}</p>
            {selected.contact?.email ? <p className="text-sm text-cyan-200/90">{selected.contact.email}</p> : null}
            {selected.contact?.company ? <p className="text-sm text-slate-500">{selected.contact.company}</p> : null}
            <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">Source site</dt>
                <dd className="text-slate-200">{selected.sourceSiteName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Source agent</dt>
                <dd className="text-slate-200">{selected.sourceAgentName || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Lead source</dt>
                <dd className="text-slate-200">{selected.contact?.leadSource || "—"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-slate-400">Last message</p>
            <p className="line-clamp-4 text-sm text-slate-200">
              {selected.conversation.lastMessagePreview || "—"}
            </p>
            <div className="mt-auto pt-6">
              <ClientPrimaryActionBar>
                {mailto ? (
                  <a
                    href={mailto}
                    className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-1.5 text-xs text-cyan-100"
                  >
                    Send / reply
                  </a>
                ) : null}
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void runAction("mark_qualified")}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
                >
                  Mark qualified
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void runAction("create_task")}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
                >
                  Create task
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void runAction("schedule_booking")}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
                >
                  Schedule booking
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void runAction("assign_followup")}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
                >
                  Assign follow-up
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void runAction("add_note")}
                  className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-500/30"
                >
                  Add note
                </button>
              </ClientPrimaryActionBar>
            </div>
          </div>
        ) : (
          <p className="p-6 text-sm text-slate-500">Select a conversation to view lead context.</p>
        )}
      </div>
    </div>
  );
}
