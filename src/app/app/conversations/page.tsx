"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ChevronLeft,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Voicemail,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Conversation = {
  id: string;
  contactId: string | null;
  channel: string;
  status: string;
  subject: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  createdAt: string | null;
  contact: { firstName: string; lastName: string; email: string; phone: string };
  messageCount: number;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  channel: string;
  content: string | null;
  subject: string | null;
  callLogId: string | null;
  createdAt: string | null;
  call?: {
    fromNumber?: string;
    toNumber?: string;
    duration?: number;
    recordingUrl?: string;
    transcript?: string;
    status?: string;
  } | null;
};

const CHANNEL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sms: MessageSquare,
  email: Mail,
  call: Phone,
  voicemail: Voicemail,
  note: FileText,
};

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (d.getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function contactDisplay(c: Conversation["contact"]) {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (c.email) return c.email;
  if (c.phone) return c.phone;
  return "Unknown";
}

function ConversationsContent() {
  const searchParams = useSearchParams();
  const contactIdParam = searchParams?.get("contactId");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = [c.contact.firstName, c.contact.lastName].filter(Boolean).join(" ").toLowerCase();
      const email = (c.contact.email ?? "").toLowerCase();
      const phone = (c.contact.phone ?? "").replace(/\D/g, "");
      const qDigits = q.replace(/\D/g, "");
      return (
        name.includes(q) ||
        email.includes(q) ||
        (c.contact.phone ?? "").toLowerCase().includes(q) ||
        (qDigits.length >= 4 && phone.includes(qDigits)) ||
        (c.subject ?? "").toLowerCase().includes(q) ||
        (c.lastMessagePreview ?? "").toLowerCase().includes(q)
      );
    });
  }, [conversations, searchQuery]);

  async function loadConversations() {
    try {
      const params = new URLSearchParams();
      if (channelFilter) params.set("channel", channelFilter);
      if (contactIdParam) params.set("contactId", contactIdParam);
      const res = await fetch(`/api/app/conversations?${params.toString()}`, {
        credentials: "include",
      });
      if (res.ok) {
        const d = await res.json();
        const list = d.conversations ?? [];
        setConversations(list);
        if (contactIdParam && list.length > 0) {
          const match = list.find((c: Conversation) => c.contactId === contactIdParam);
          if (match) {
            loadThread(match.id);
            return;
          }
        }
        if (list.length > 0) loadThread(list[0].id);
      }
    } catch {
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }

  async function loadThread(id: string) {
    setSelectedId(id);
    try {
      const res = await fetch(`/api/app/conversations/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json();
      setConversation(d.conversation);
      setMessages(d.messages ?? []);
      setReplyContent("");
    } catch {
      toast.error("Failed to load thread");
      setSelectedId(null);
    }
  }

  async function sendReply() {
    if (!selectedId || !replyContent.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/app/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: replyContent.trim(),
          channel: conversation?.channel ?? "note",
        }),
      });
      if (!res.ok) throw new Error("Send failed");
      const d = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: d.message?.id ?? d.id ?? "",
          direction: "outbound",
          channel: d.message?.channel ?? "note",
          content: replyContent.trim(),
          subject: null,
          callLogId: null,
          createdAt: d.message?.createdAt ?? new Date().toISOString(),
        },
      ]);
      setReplyContent("");
      loadConversations(); // refresh list for lastMessageAt
    } catch {
      toast.error("Failed to send");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, [channelFilter, contactIdParam]);

  return (
    <div className="flex h-screen flex-col bg-black text-white">
      <div className="border-b border-white/10 bg-black/80 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Conversations</h1>
            <p className="text-sm text-white/60">Unified inbox • Email, SMS, calls, notes</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts, email, phone…"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            />
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
            >
              <option value="">All channels</option>
              <option value="sms">SMS</option>
              <option value="email">Email</option>
              <option value="call">Calls</option>
              <option value="voicemail">Voicemail</option>
              <option value="note">Notes</option>
            </select>
            <Link href="/app/dashboard">
              <Button variant="outline" size="sm" className="border-white/15 text-white/80">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conversation list */}
        <div
          className={`w-full border-r border-white/10 bg-black/40 md:w-80 shrink-0 flex flex-col ${
            selectedId ? "hidden md:flex" : ""
          }`}
        >
          {loading ? (
            <div className="flex flex-1 items-center justify-center text-white/50">Loading…</div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <MessageSquare className="h-12 w-12 text-white/20" />
              <p className="text-sm text-white/60">
                {conversations.length === 0 ? "No conversations yet" : "No matches for your search"}
              </p>
              {conversations.length === 0 && (
                <>
                  <p className="text-xs text-white/40">
                    Inbound calls, SMS, and emails will appear here when Twilio is connected
                  </p>
                  <Link href="/app/voice-agents">
                    <Button variant="outline" size="sm" className="border-cyan-500/50 text-cyan-300">
                      Set up Voice Agents
                    </Button>
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.map((c) => {
                const Icon = CHANNEL_ICONS[c.channel] ?? MessageSquare;
                const isSelected = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => loadThread(c.id)}
                    className={`flex w-full items-center gap-3 border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                      isSelected ? "bg-cyan-500/10 border-l-2 border-l-cyan-500" : ""
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <Icon className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-medium">{contactDisplay(c.contact)}</div>
                        {c.unreadCount > 0 && (
                          <span className="shrink-0 rounded-full bg-cyan-500 px-2 py-0.5 text-xs font-semibold text-black">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-white/60">
                        {c.lastMessagePreview || c.subject || `${c.channel} • ${c.messageCount} messages`}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-white/50">
                      {formatTime(c.lastMessageAt ?? c.createdAt)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Thread view */}
        <div
          className={`flex flex-1 flex-col min-w-0 ${selectedId ? "flex" : "hidden md:flex"}`}
        >
          {!selectedId ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-white/50">
              <MessageSquare className="h-16 w-16 text-white/10" />
              <p>Select a conversation</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center gap-3 border-b border-white/10 bg-black/60 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="md:hidden rounded-lg p-2 hover:bg-white/10"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {conversation ? contactDisplay(conversation.contact) : "—"}
                  </div>
                  <div className="text-xs text-white/60">
                    {conversation?.channel ?? "—"} • {conversation?.messageCount ?? 0} messages
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                        m.direction === "outbound"
                          ? "bg-cyan-600/80 text-white"
                          : "bg-white/10 text-white"
                      }`}
                    >
                      {m.channel === "call" && m.call ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-xs opacity-80">
                            <Phone className="h-3 w-3" />
                            {m.call.fromNumber} → {m.call.toNumber}
                            {m.call.duration != null && (
                              <span>• {m.call.duration}s</span>
                            )}
                          </div>
                          {m.call.transcript && (
                            <div className="mt-2 text-sm border-t border-white/20 pt-2">
                              {m.call.transcript}
                            </div>
                          )}
                          {m.call.recordingUrl && (
                            <a
                              href={m.call.recordingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-block text-xs text-cyan-300 hover:underline"
                            >
                              Listen to recording
                            </a>
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{m.content ?? ""}</div>
                      )}
                      <div
                        className={`mt-1 text-xs ${
                          m.direction === "outbound" ? "text-cyan-200/80" : "text-white/50"
                        }`}
                      >
                        {formatTime(m.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply input */}
              <div className="border-t border-white/10 bg-black/60 p-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message…"
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendReply();
                      }
                    }}
                    className="flex-1 bg-white/5 border-white/15 text-white placeholder:text-white/40"
                  />
                  <Button
                    onClick={sendReply}
                    disabled={!replyContent.trim() || sending}
                    className="bg-cyan-600 hover:bg-cyan-500 shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white">Loading…</div>}>
      <ConversationsContent />
    </Suspense>
  );
}
