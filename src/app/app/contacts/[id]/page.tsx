"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Contact = {
  id: string;
  userId: number | null;
  workspaceId: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  leadSource: string | null;
  tags: string | null;
  customFields: unknown;
  createdAt: string;
  updatedAt: string;
};

type Conversation = {
  id: string;
  channel: string;
  status: string | null;
  subject: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt?: string;
  updatedAt?: string;
};

type TimelineItem =
  | {
      type: "message";
      id: string;
      createdAt: string;
      conversationId: string;
      channel: string;
      direction: string;
      status: string | null;
      subject: string | null;
      content: string | null;
      callLogId: string | null;
      metadata: unknown;
      threadChannel: string;
    }
  | {
      type: "call";
      id: string;
      createdAt: string;
      conversationId: string | null;
      fromNumber: string;
      toNumber: string;
      direction: string;
      status: string | null;
      duration: number | null;
      transcript: string | null;
      recordingUrl: string | null;
      twilioCallSid: string | null;
      voiceAgentId: string | null;
      metadata: unknown;
    };

function nameOf(c: Contact) {
  const n = `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim();
  return n || c.phone || c.email || "Contact";
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString();
}

function TasksWidget({ contactId }: { contactId: string }) {
  const [items, setItems] = useState<{ id: string; title: string; priority?: string; dueAt?: string; due?: string; description?: string }[]>([]);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/app/tasks?status=open&contactId=${encodeURIComponent(contactId)}`,
        { credentials: "include", cache: "no-store" }
      );
      const j = await r.json();
      setItems(j.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    const t = title.trim();
    if (!t) return;
    await fetch("/api/app/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ contactId, title: t, priority: "normal" }),
    });
    setTitle("");
    await load();
  }

  async function complete(id: string) {
    await fetch(`/api/app/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "completed" }),
    });
    await load();
  }

  useEffect(() => {
    load();
  }, [contactId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Tasks</h2>
          <p className="mt-1 text-xs text-white/60">Open follow-ups for this contact.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-60"
        >
          Refresh
        </button>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task title…"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
        />
        <button
          onClick={create}
          disabled={!title.trim()}
          className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
        >
          Add
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="text-sm text-white/60">Loading…</div>
        ) : null}
        {!loading && items.length === 0 ? (
          <div className="text-sm text-white/60">No open tasks.</div>
        ) : null}

        {items.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{t.title}</div>
                <div className="mt-1 text-xs text-white/60">
                  Priority: {(t.priority ?? "normal").toUpperCase()}
                  {t.dueAt ? ` • Due: ${new Date(t.dueAt).toLocaleString()}` : ""}
                </div>
              </div>
              <button
                onClick={() => complete(t.id)}
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
              >
                Complete
              </button>
            </div>
            {t.description ? (
              <div className="mt-2 whitespace-pre-wrap text-sm text-white/80">
                {t.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ContactProfilePage() {
  const params = useParams();
  const contactId = params?.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);

  const [company, setCompany] = useState("");
  const [leadSource, setLeadSource] = useState("");
  const [tags, setTags] = useState("");
  const [customFieldsText, setCustomFieldsText] = useState("{}");

  const [error, setError] = useState<string | null>(null);

  async function loadContact() {
    setError(null);
    const r = await fetch(`/api/app/contacts/${contactId}`, { credentials: "include", cache: "no-store" });
    if (!r.ok) {
      setError(r.status === 404 ? "Contact not found." : "Failed to load contact.");
      return;
    }
    const j = await r.json();
    setContact(j.contact);
    setConversations(j.conversations ?? []);

    setCompany(j.contact?.company ?? "");
    setLeadSource(j.contact?.leadSource ?? "");
    setTags(j.contact?.tags ?? "");
    setCustomFieldsText(JSON.stringify(j.contact?.customFields ?? {}, null, 2));
  }

  async function loadTimeline(cursor: string | null) {
    const url = new URL(`/api/app/contacts/${contactId}/timeline`, window.location.origin);
    url.searchParams.set("limit", "50");
    if (cursor) url.searchParams.set("before", cursor);

    const r = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json();

    const items = (j.items ?? []) as TimelineItem[];
    const isFirst = !cursor;
    setTimeline((prev) => (isFirst ? items : [...prev, ...items]));
    setNextCursor(j.nextCursor ?? null);
  }

  async function save() {
    setSaving(true);
    setError(null);

    let parsedCustom: unknown = null;
    try {
      parsedCustom = JSON.parse(customFieldsText || "{}");
    } catch {
      setSaving(false);
      setError("customFields must be valid JSON.");
      return;
    }

    const r = await fetch(`/api/app/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        company,
        leadSource,
        tags,
        customFields: parsedCustom,
      }),
    });

    setSaving(false);

    if (!r.ok) {
      setError("Failed to save changes.");
      return;
    }

    await loadContact();
  }

  const primaryConversation = useMemo(() => {
    const sms = conversations.find((c) => (c.channel ?? "").toLowerCase() === "sms");
    return sms ?? conversations[0] ?? null;
  }, [conversations]);

  useEffect(() => {
    if (!contactId) return;
    loadContact();
  }, [contactId]);

  useEffect(() => {
    if (!contact) return;
    setTimeline([]);
    setNextCursor(null);
    loadTimeline(null);
  }, [contact?.id]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {contact ? nameOf(contact) : "Loading…"}
            </h1>
            <div className="mt-1 text-sm text-white/60">
              {contact?.email ? `Email: ${contact.email}` : null}
              {contact?.email && contact?.phone ? " • " : null}
              {contact?.phone ? `Phone: ${contact.phone}` : null}
            </div>
            <div className="mt-1 text-xs text-white/45">Contact ID: {contactId}</div>
          </div>

          <div className="flex items-center gap-2">
            {primaryConversation ? (
              <Link
                href={`/app/conversations?contactId=${encodeURIComponent(contactId)}`}
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
              >
                Open conversation →
              </Link>
            ) : (
              <Link
                href="/app/conversations"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
              >
                Start conversation →
              </Link>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left column: editable fields */}
          <div className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-base font-semibold">Profile</h2>
              <p className="mt-1 text-xs text-white/60">Edit core fields and save.</p>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <div className="text-xs text-white/60">Company</div>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                    placeholder="Company"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-white/60">Lead source</div>
                  <input
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                    placeholder="Lead source"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-white/60">Tags (text)</div>
                  <textarea
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="mt-1 min-h-[70px] w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35"
                    placeholder="comma,separated,tags (or JSON later)"
                  />
                </label>

                <label className="block">
                  <div className="text-xs text-white/60">Custom fields (JSON)</div>
                  <textarea
                    value={customFieldsText}
                    onChange={(e) => setCustomFieldsText(e.target.value)}
                    className="mt-1 min-h-[160px] w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs text-white outline-none"
                  />
                </label>

                <button
                  onClick={save}
                  disabled={saving || !contact}
                  className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <TasksWidget contactId={contactId} />

            {/* Sidebar conversations */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h2 className="text-base font-semibold">Threads</h2>
              <p className="mt-1 text-xs text-white/60">Conversations for this contact.</p>

              <div className="mt-3 space-y-2">
                {conversations.map((c) => (
                  <Link
                    key={c.id}
                    href={`/app/conversations?contactId=${encodeURIComponent(contactId)}`}
                    className="block rounded-xl border border-white/10 bg-black/30 p-3 hover:bg-black/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {(c.channel ?? "thread").toUpperCase()}
                      </div>
                      {c.unreadCount > 0 ? (
                        <span className="rounded-full bg-cyan-300 px-2 py-0.5 text-xs font-semibold text-black">
                          {c.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-white/60">
                      {c.lastMessagePreview ?? c.subject ?? "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">
                      {c.lastMessageAt
                        ? new Date(c.lastMessageAt).toLocaleString()
                        : "—"}
                    </div>
                  </Link>
                ))}

                {conversations.length === 0 ? (
                  <div className="text-sm text-white/60">No conversations yet.</div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right column: timeline */}
          <div className="rounded-2xl border border-white/10 bg-white/5 lg:col-span-8">
            <div className="border-b border-white/10 p-4">
              <h2 className="text-base font-semibold">Timeline</h2>
              <p className="mt-1 text-xs text-white/60">
                Merged messages and call events (newest first).
              </p>
            </div>

            <div className="max-h-[70vh] space-y-3 overflow-auto p-4">
              {timeline.map((it) => {
                if (it.type === "call") {
                  return (
                    <div
                      key={`call-${it.id}`}
                      className="rounded-2xl border border-white/10 bg-black/30 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold">
                          CALL • {(it.direction ?? "inbound").toUpperCase()} •{" "}
                          {(it.status ?? "—").toUpperCase()}
                        </div>
                        <div className="text-xs text-white/50">{fmt(it.createdAt)}</div>
                      </div>
                      <div className="mt-1 text-xs text-white/60">
                        From: {it.fromNumber} → To: {it.toNumber}
                        {typeof it.duration === "number"
                          ? ` • Duration: ${it.duration}s`
                          : ""}
                      </div>
                      {it.twilioCallSid ? (
                        <div className="mt-1 text-[11px] text-white/45">
                          SID: {it.twilioCallSid}
                        </div>
                      ) : null}
                      {it.transcript ? (
                        <div className="mt-2 whitespace-pre-wrap text-sm text-white/90">
                          {it.transcript}
                        </div>
                      ) : null}
                      {it.recordingUrl ? (
                        <div className="mt-2">
                          <a
                            href={it.recordingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-cyan-300 hover:text-cyan-200"
                          >
                            Recording →
                          </a>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                const inbound = (it.direction ?? "inbound") === "inbound";
                return (
                  <div
                    key={`msg-${it.id}`}
                    className={[
                      "rounded-2xl border p-3",
                      inbound
                        ? "border-white/10 bg-black/30"
                        : "border-white/15 bg-white text-black",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={
                          inbound ? "text-xs text-white/60" : "text-xs text-black/70"
                        }
                      >
                        MSG • {(it.channel ?? "sms").toUpperCase()} •{" "}
                        {(it.direction ?? "").toUpperCase()}
                      </div>
                      <div
                        className={
                          inbound ? "text-xs text-white/50" : "text-xs text-black/60"
                        }
                      >
                        {fmt(it.createdAt)}
                      </div>
                    </div>
                    {it.subject ? (
                      <div
                        className={
                          inbound
                            ? "mt-1 text-sm font-semibold"
                            : "mt-1 text-sm font-semibold"
                        }
                      >
                        {it.subject}
                      </div>
                    ) : null}
                    <div
                      className={
                        inbound
                          ? "mt-2 whitespace-pre-wrap text-sm text-white/90"
                          : "mt-2 whitespace-pre-wrap text-sm text-black"
                      }
                    >
                      {it.content ?? "—"}
                    </div>
                  </div>
                );
              })}

              {timeline.length === 0 ? (
                <div className="text-sm text-white/60">No timeline items yet.</div>
              ) : null}

              {nextCursor ? (
                <button
                  onClick={() => loadTimeline(nextCursor)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
                >
                  Load more
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
