"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  Globe,
  HelpCircle,
  MapPin,
  Map,
  MessageSquare,
  Settings2,
  Table2,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { COMMON_LANGUAGES } from "@/lib/i18n/common-languages";
import {
  INDUSTRY_MAPPER_GROUPS,
  parseIndustriesJson,
  stringifyIndustries,
  type IndustryKey,
} from "@/lib/agents/industry-mapper";
import { AgentCapabilitiesPanel } from "@/components/agents/AgentCapabilitiesPanel";

type Agent = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  avatarImageUrl?: string | null;
  avatarAltText?: string | null;
};

/** From `/api/npc/list` — `id` and `npcId` are the public stable key. */
type PlatformNpcListItem = {
  id: string;
  npcId?: string;
  name: string;
  role: string;
  title?: string | null;
  avatarEmoji?: string;
};

function publicNpcKey(n: { id?: string; npcId?: string }): string {
  return (n.npcId?.trim() || n.id || "").trim();
}

type KnowledgeItem = {
  id: string;
  type: string;
  displayName?: string;
  contentOrPointer?: string | null;
};

type Site = { id: string; name?: string | null; domain?: string | null; slug?: string | null };

const TEMPLATES = [
  {
    id: "trust-consultant",
    name: "Trust Consultant Agent",
    description: "Answers trust questions, collects client facts, routes to next steps.",
    systemPrompt: `You are a Trust Consultant AI for a private client services platform.
Goals:
- Educate and clarify: trust types (revocable/irrevocable/grantor/non-grantor/private/ecclesiastical)
- Collect required facts safely (state/jurisdiction, assets, beneficiaries, trustees, goals)
- Never give legal advice; provide education + suggest professional review
- Always propose next best action in the platform (documents, workflow, scheduling)

Style:
- concise, structured, confident
- ask 1–3 focused questions at a time
- summarize what you learned and what's next`,
  },
  {
    id: "lead-qualifier",
    name: "Lead Qualifier",
    description: "Qualifies leads, tags intent, creates tasks for follow-up.",
    systemPrompt: `You qualify leads for a consultant.
Ask about:
- goal, timeline, budget, location, urgency
- preferred communication
Output:
- a short summary + recommended next action`,
  },
  {
    id: "website-concierge",
    name: "Website Concierge",
    description: "Answers about services, pricing ranges, and routes to booking/contact.",
    systemPrompt: `You are a concierge for a consultant's website.
- Explain services clearly
- Offer next steps: book a call, submit intake, view resources
- If asked pricing, provide ranges and clarify variables`,
  },
];

function cx(...s: Array<string | false | undefined | null>) {
  return s.filter(Boolean).join(" ");
}

type Voice = {
  id: string;
  name: string;
  description: string;
  provider: string;
  providerVoiceId: string;
  language: string;
  accent: string;
  gender: string;
  highQuality: boolean;
  isCustom?: boolean;
};

const ENROLLMENT_SCRIPTS = [
  "Hi, this is a voice sample for TroothHertz. Today is a great day to build systems that help people. I can speak clearly, confidently, and at a natural pace. Please confirm your name, your email address, and the best time to follow up. If you have questions, I'm here to help.",
  "For quality testing: one, two, three, four, five. My phone number is 555-123-4567. I can pronounce common names like Jordan, Alexis, Christopher, and Monique. I can also read websites like troothhurtz dot app, and I can handle dates like February twenty-fourth, twenty twenty-six.",
  "When I speak, I can sound warm and friendly, or direct and professional. I can pause naturally, emphasize key words, and ask clear questions. This recording is used only to create a private voice for my account, and I understand it should not be used to imitate another person.",
];

function VoiceTab({
  selectedVoiceId,
  selectedVoiceProvider,
  onSelect,
  onSave,
  hasSelection,
}: {
  selectedVoiceId: string | null;
  selectedVoiceProvider: string | null;
  onSelect: (id: string, provider: string) => void;
  onSave: () => void;
  hasSelection: boolean;
}) {
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState("all");
  const [accent, setAccent] = useState("all");
  const [gender, setGender] = useState("all");
  const [highQualityOnly, setHighQualityOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const [customConsent, setCustomConsent] = useState(false);
  const [customRecordings, setCustomRecordings] = useState<Blob[]>([]);
  const [customRecording, setCustomRecording] = useState(false);
  const [customCreating, setCustomCreating] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (language !== "all") params.set("language", language);
    if (accent !== "all") params.set("accent", accent);
    if (gender !== "all") params.set("gender", gender);
    if (highQualityOnly) params.set("highQualityOnly", "true");
    if (search.trim()) params.set("search", search.trim());
    setLoading(true);
    fetch(`/api/app/voices?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        setVoices(j.voices ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [language, accent, gender, highQualityOnly, search]);

  async function previewVoice(v: Voice) {
    if (previewingId) return;
    setPreviewingId(v.id);
    try {
      const r = await fetch("/api/app/voices/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ voiceId: v.providerVoiceId, provider: (v as Voice & { isCustom?: boolean }).isCustom ? "elevenlabs" : "openai" }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(j?.error ?? "Preview not available. Set OPENAI_API_KEY for TTS.");
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } finally {
      setPreviewingId(null);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (chunks.length) setCustomRecordings((r) => [...r, new Blob(chunks, { type: "audio/webm" })]);
        setCustomRecording(false);
      };
      recorder.start();
      setCustomRecording(true);
      setTimeout(() => recorder.stop(), 45000);
    } catch (e) {
      alert("Microphone access required for recording.");
      setCustomRecording(false);
    }
  }

  async function createCustomVoice() {
    if (!customConsent || customRecordings.length < 1) {
      alert("Agree to consent and record at least one clip.");
      return;
    }
    setCustomCreating(true);
    try {
      const form = new FormData();
      form.append("name", "My Voice");
      form.append("consent", "true");
      form.append("consentText", "I own this voice or have explicit permission to use it. I will not use it to imitate another person.");
      customRecordings.forEach((blob, i) => {
        const ext = blob instanceof File
          ? (blob.name.match(/\.(\w+)$/)?.[1] ?? "mp3")
          : blob.type.includes("wav") ? "wav" : blob.type.includes("webm") ? "webm" : "mp3";
        form.append("file", blob, `clip-${i}.${ext}`);
      });
      const r = await fetch("/api/app/voices", { method: "POST", credentials: "include", body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Failed to create voice");
      onSelect(j.voiceId, j.provider ?? "elevenlabs");
      setCustomRecordings([]);
      setCustomConsent(false);
      setMode("preset");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create voice");
    } finally {
      setCustomCreating(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="text-sm font-semibold">Voice Selection</div>
      <p className="text-xs text-white/60">
        Pick a preset voice or record your own. Used for webchat read-aloud and voice calls when connected.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("preset")}
          className={cx(
            "rounded-xl px-3 py-2 text-sm",
            mode === "preset" ? "bg-cyan-500/30 border border-cyan-400/50" : "border border-white/10 bg-black/20"
          )}
        >
          Preset voices
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={cx(
            "rounded-xl px-3 py-2 text-sm",
            mode === "custom" ? "bg-cyan-500/30 border border-cyan-400/50" : "border border-white/10 bg-black/20"
          )}
        >
          Use my voice
        </button>
      </div>

      {mode === "custom" ? (
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
          <div className="text-xs text-white/60">Record 1–3 clips (30–45 sec each). Quiet room, consistent mic distance.</div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={customConsent}
              onChange={(e) => setCustomConsent(e.target.checked)}
            />
            <span className="text-xs">
              I own this voice or have explicit permission to use it. I will not use it to imitate another person.
            </span>
          </label>
          <div className="space-y-1 text-xs text-white/50">
            {ENROLLMENT_SCRIPTS.map((script, i) => (
              <div key={i} className="p-2 rounded border border-white/5 bg-black/20">
                Clip {i + 1}: {script.slice(0, 80)}…
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              type="button"
              onClick={startRecording}
              disabled={customRecording || customRecordings.length >= 3}
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm disabled:opacity-50"
            >
              {customRecording ? "Recording…" : `Record clip ${customRecordings.length + 1}`}
            </button>
            <label className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm cursor-pointer hover:opacity-90">
              Upload MP3/WAV
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/webm"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (!files.length) return;
                  setCustomRecordings((r) => [...r, ...files].slice(0, 3));
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={createCustomVoice}
              disabled={!customConsent || customRecordings.length < 1 || customCreating}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
            >
              {customCreating ? "Creating…" : "Create voice"}
            </button>
            {customRecordings.length > 0 && (
              <span className="text-xs text-white/50">{customRecordings.length} clip(s) ready</span>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Languages</option>
          <option value="English">English</option>
        </select>
        <select
          value={accent}
          onChange={(e) => setAccent(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Accents</option>
          <option value="American">American</option>
          <option value="British">British</option>
        </select>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        >
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="neutral">Neutral</option>
        </select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={highQualityOnly}
            onChange={(e) => setHighQualityOnly(e.target.checked)}
          />
          <span className="text-xs text-white/60">High Quality Only</span>
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voices..."
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-white/60">Loading voices…</div>
      ) : (
        <>
          <div className="text-xs text-white/50">{voices.length} voices found</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-auto">
            {voices.map((v) => {
              const isSelected = selectedVoiceId === v.id || selectedVoiceId === v.providerVoiceId;
              return (
                <div
                  key={v.id}
                  onClick={() => onSelect(v.providerVoiceId, v.provider)}
                  className={cx(
                    "rounded-xl border p-3 cursor-pointer transition-colors",
                    isSelected
                      ? "border-cyan-400 bg-cyan-500/20"
                      : "border-white/10 bg-black/20 hover:bg-white/5"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{v.name}</div>
                      <div className="text-xs text-white/60 mt-0.5">{v.description}</div>
                      <div className="text-xs text-white/40 mt-1">
                        {v.language} | {v.accent} | {v.gender}
                        {v.highQuality ? (
                          <span className="ml-2 rounded-full bg-cyan-500/30 px-1.5 py-0.5 text-[10px]">HQ</span>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewVoice(v);
                      }}
                      disabled={!!previewingId}
                      className="flex-shrink-0 w-8 h-8 rounded-full border border-white/20 bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-50"
                    >
                      {previewingId === v.id ? (
                        <span className="text-xs">…</span>
                      ) : (
                        <span className="text-cyan-400">▶</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onSave}
              disabled={!hasSelection}
              className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
            >
              Save Voice
            </button>
            {hasSelection ? (
              <span className="text-xs text-white/50">
                Selected: {selectedVoiceId} ({selectedVoiceProvider})
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

const BINDING_KEY = "smart_trust_platform_binding_v1";

function AddNoteForm({
  selectedId,
  onAdded,
}: {
  selectedId: string;
  onAdded: () => void;
}) {
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd() {
    const text = content.trim();
    if (!text || !selectedId) return;
    setAdding(true);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "note",
          content: text,
          title: title.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(j?.error ?? "Failed to add note.");
        return;
      }
      setContent("");
      setTitle("");
      onAdded();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-2">
      <input
        type="text"
        placeholder="Title (optional, e.g. FAQ: Banking hours)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40"
      />
      <textarea
        placeholder="Note or FAQ content…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40 resize-none"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={adding || !content.trim() || !selectedId}
        className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50 hover:bg-cyan-400"
      >
        {adding ? "Adding…" : "Add Note / FAQ"}
      </button>
    </div>
  );
}

type SourceType = "faq" | "web_crawler" | "tables" | null;

function AddSourceSection({
  selectedId,
  onAdded,
}: {
  selectedId: string;
  onAdded: () => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalSource, setModalSource] = useState<SourceType>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          disabled={!selectedId}
          className="flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Source
          <ChevronDown className={`h-4 w-4 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 z-10 min-w-[200px] rounded-xl border border-white/15 bg-black/95 shadow-xl py-1">
            <button
              type="button"
              onClick={() => {
                setModalSource("faq");
                setDropdownOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/10"
            >
              <HelpCircle className="h-4 w-4 text-amber-400" />
              FAQs
            </button>
            <button
              type="button"
              onClick={() => {
                setModalSource("web_crawler");
                setDropdownOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/10"
            >
              <Globe className="h-4 w-4 text-emerald-400" />
              Web Crawler
            </button>
            <button
              type="button"
              onClick={() => {
                setModalSource("tables");
                setDropdownOpen(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/10"
            >
              <Table2 className="h-4 w-4 text-blue-400" />
              Tables
            </button>
          </div>
        )}
      </div>

      {modalSource === "faq" && (
        <AddFaqModal
          agentId={selectedId}
          onClose={() => setModalSource(null)}
          onAdded={() => {
            onAdded();
            setModalSource(null);
          }}
        />
      )}
      {modalSource === "web_crawler" && (
        <AddWebCrawlerModal
          agentId={selectedId}
          onClose={() => setModalSource(null)}
          onAdded={() => {
            onAdded();
            setModalSource(null);
          }}
        />
      )}
      {modalSource === "tables" && (
        <AddTablesModal
          agentId={selectedId}
          onClose={() => setModalSource(null)}
          onAdded={() => {
            onAdded();
            setModalSource(null);
          }}
        />
      )}
    </>
  );
}

function AddFaqModal({
  agentId,
  onClose,
  onAdded,
}: {
  agentId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<{ q: string; a: string }[]>([{ q: "", a: "" }]);
  const [adding, setAdding] = useState(false);

  function addPair() {
    setItems((prev) => [...prev, { q: "", a: "" }]);
  }
  function removePair(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    const pairs = items.filter((p) => p.q.trim() && p.a.trim());
    if (!pairs.length || !agentId) return;
    setAdding(true);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "faq",
          title: title.trim() || "FAQs",
          items: pairs,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j?.error ?? "Failed to add FAQs");
        return;
      }
      toast.success("FAQs added to knowledge base");
      onAdded();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-black p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-amber-400" />
          Add FAQs
        </h3>
        <p className="mt-1 text-xs text-white/60">
          Add question-answer pairs. The agent will use these to answer matching questions.
        </p>
        <div className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Source title (e.g. Product FAQs)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40"
          />
          {items.map((pair, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                placeholder="Question"
                value={pair.q}
                onChange={(e) => setItems((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i], q: e.target.value };
                  return next;
                })}
                className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40"
              />
              <input
                type="text"
                placeholder="Answer"
                value={pair.a}
                onChange={(e) => setItems((prev) => {
                  const next = [...prev];
                  next[i] = { ...next[i], a: e.target.value };
                  return next;
                })}
                className="flex-1 rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40"
              />
              <button
                type="button"
                onClick={() => removePair(i)}
                disabled={items.length <= 1}
                className="rounded-lg border border-red-500/30 px-2 text-red-400 hover:bg-red-500/10 disabled:opacity-30"
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" onClick={addPair} className="text-xs text-cyan-400 hover:text-cyan-300">
            + Add another Q&A
          </button>
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={adding || !items.some((p) => p.q.trim() && p.a.trim())}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add FAQs"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddWebCrawlerModal({
  agentId,
  onClose,
  onAdded,
}: {
  agentId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSubmit() {
    const u = url.trim();
    if (!u || !agentId) return;
    setAdding(true);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type: "web_crawler", url: u }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j?.error ?? "Failed to add URL");
        return;
      }
      if (j.type === "faq") {
        toast.success(`Generated ${j.count ?? 0} FAQs from URL and added to knowledge base`);
      } else if (j.note) {
        toast.success("Page content added. " + j.note);
      } else {
        toast.success("Added to knowledge base");
      }
      onAdded();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-black p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-400" />
          Web Crawler — Generate FAQ from URL
        </h3>
        <p className="mt-1 text-xs text-white/60">
          Paste a URL. We&apos;ll fetch the page, extract content, and generate FAQs for the agent&apos;s knowledge base.
        </p>
        <div className="mt-4">
          <input
            type="url"
            placeholder="https://example.com/faq or https://yoursite.com/docs"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40"
          />
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={adding || !url.trim()}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {adding ? "Fetching & generating FAQ…" : "Generate FAQ from URL"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddTablesModal({
  agentId,
  onClose,
  onAdded,
}: {
  agentId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [csvInput, setCsvInput] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleSubmit() {
    const t = title.trim() || "Table";
    const lines = csvInput.trim().split("\n").filter(Boolean);
    if (!lines.length || !agentId) return;
    setAdding(true);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/knowledge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type: "tables",
          title: t,
          rawCsv: csvInput.trim(),
          rows: lines.map((line) => line.split(",").map((c) => c.trim())),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j?.error ?? "Failed to add table");
        return;
      }
      toast.success("Table added to knowledge base");
      onAdded();
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-black p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Table2 className="h-5 w-5 text-blue-400" />
          Add Table
        </h3>
        <p className="mt-1 text-xs text-white/60">
          Paste CSV data (comma-separated). First row can be column headers. The agent will use this for lookups.
        </p>
        <div className="mt-4 space-y-3">
          <input
            type="text"
            placeholder="Table title (e.g. Pricing tiers)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40"
          />
          <textarea
            placeholder={"Column A, Column B, Column C\nValue 1, Value 2, Value 3"}
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/40 font-mono resize-none"
          />
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/5">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={adding || !csvInput.trim()}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add Table"}
          </button>
        </div>
      </div>
    </div>
  );
}

function loadWorkspaceFromBinding(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BINDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { trustId?: string | null };
    return typeof parsed?.trustId === "string" && parsed.trustId.trim()
      ? parsed.trustId.trim()
      : null;
  } catch {
    return null;
  }
}

function AgentsPageContent() {
  const searchParams = useSearchParams();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [platformNpcs, setPlatformNpcs] = useState<PlatformNpcListItem[]>([]);
  const [platformNpcsLoading, setPlatformNpcsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [tab, setTab] = useState<
    "prompt" | "knowledge" | "tools" | "capabilities" | "industry" | "voice" | "deploy"
  >("prompt");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "paused">("draft");
  const [agentAvatarImageUrl, setAgentAvatarImageUrl] = useState("");
  const [agentAvatarAltText, setAgentAvatarAltText] = useState("AI agent avatar");
  const [agentAvatarUploading, setAgentAvatarUploading] = useState(false);

  const [toolCrm, setToolCrm] = useState(true);
  const [toolTasks, setToolTasks] = useState(true);
  const [toolAutomations, setToolAutomations] = useState(true);
  const [toolSiteContext, setToolSiteContext] = useState(true);

  const [consultantId, setConsultantId] = useState<string>("");
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [widgetKey, setWidgetKey] = useState<string>("");
  const [allowedDomains, setAllowedDomains] = useState<string>("");
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentText, setConsentText] = useState(
    "This chat may be recorded and stored for follow-up. By continuing you agree."
  );
  const [retentionDays, setRetentionDays] = useState(90);

  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [voiceProvider, setVoiceProvider] = useState<string | null>(null);
  const [llmEndpoint, setLlmEndpoint] = useState("");
  const [llmApiKey, setLlmApiKey] = useState(""); // local only; leave blank to keep existing
  const [model, setModel] = useState("");
  const [language, setLanguage] = useState("");
  const [industriesSelected, setIndustriesSelected] = useState<IndustryKey[]>([]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [knowledgeUploading, setKnowledgeUploading] = useState(false);
  const [knowledgeDragOver, setKnowledgeDragOver] = useState(false);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);

  const [testInput, setTestInput] = useState("");
  const [testDebugRetrieval, setTestDebugRetrieval] = useState(false);
  const [testDebugChunks, setTestDebugChunks] = useState<
    { id: string; score: number; preview: string }[] | null
  >(null);
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [collabEmail, setCollabEmail] = useState("");
  const [collabSuggestions, setCollabSuggestions] = useState<{ id: number; email: string; username: string }[]>([]);
  const [collabInviting, setCollabInviting] = useState(false);
  const [collaborators, setCollaborators] = useState<{ userId: number; email: string; username: string }[]>([]);
  const [origin, setOrigin] = useState("");
  const [testLog, setTestLog] = useState<Array<{ role: "user" | "assistant"; text: string }>>([
    { role: "assistant", text: "Pick or create an agent, then test it here." },
  ]);

  const [buildingKeyInput, setBuildingKeyInput] = useState("");
  const [buildingWorldId, setBuildingWorldId] = useState<string | null>(null);
  const [buildingBuildingId, setBuildingBuildingId] = useState<string | null>(null);
  const [buildingLinkLoading, setBuildingLinkLoading] = useState(false);
  const [buildingKeyGenLoading, setBuildingKeyGenLoading] = useState(false);
  const [buildingKeyGenWorld, setBuildingKeyGenWorld] = useState("green-terrain");
  const [buildingKeyGenBuilding, setBuildingKeyGenBuilding] = useState("nexus-corporate-tower");
  const [buildingKeyGenerated, setBuildingKeyGenerated] = useState<string | null>(null);

  const selectedAgent = useMemo(() => agents.find((a) => a.id === selectedId) ?? null, [agents, selectedId]);

  const TROO_TOWN_BUILDINGS = [
    { id: "nexus-corporate-tower", name: "Nexus Corporate Tower" },
    { id: "meridian-tower", name: "Meridian Tower" },
    { id: "apex-tower", name: "Apex Tower" },
    { id: "troothhertz-tower", name: "TroothHertz Tower" },
  ];

  async function loadAgents() {
    const url = workspaceId
      ? `/api/app/agents?workspaceId=${encodeURIComponent(workspaceId)}`
      : "/api/app/agents";
    const r = await fetch(url, { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    setAgents(j.items ?? []);
    if (!selectedId && (j.items?.[0]?.id ?? null)) setSelectedId(j.items[0].id);
  }

  async function loadAgent(id: string) {
    const r = await fetch(`/api/app/agents/${encodeURIComponent(id)}`, { credentials: "include" });
    const j = await r.json().catch(() => ({}));
    if (!j?.item) return;

    const item = j.item;
    setName(item.name ?? "");
    setDescription(item.description ?? "");
    setSystemPrompt(item.systemPrompt ?? "");
    setStatus((item.status ?? "draft") as "draft" | "active" | "paused");

    const tools = item.toolsJson ?? {};
    setToolCrm(!!tools.crm);
    setToolTasks(!!tools.tasks);
    setToolAutomations(!!tools.automations);
    setToolSiteContext(!!tools.siteContext);

    setConsultantId(item.consultantId ?? "");
    setWidgetKey(item.widgetKey ?? "");
    setSelectedSiteId(item.siteId ?? "");
    setAllowedDomains(item.allowedDomains ?? "");
    setConsentRequired(!!item.consentRequired);
    setConsentText(item.consentText ?? "This chat may be recorded and stored for follow-up. By continuing you agree.");
    setRetentionDays([7, 30, 90, 365].includes(item.retentionDays) ? item.retentionDays : 90);
    setBuildingWorldId(item.buildingWorldId ?? null);
    setBuildingBuildingId(item.buildingBuildingId ?? null);
    setBuildingKeyInput("");
    setBuildingKeyGenerated(null);
    setVoiceId(item.voiceId ?? null);
    setVoiceProvider(item.voiceProvider ?? null);
    setLlmEndpoint(item.llmEndpoint ?? "");
    setLlmApiKey(""); // never display stored key
    setModel(item.model ?? "");
    setLanguage(item.language ?? "");
    setIndustriesSelected(parseIndustriesJson(item.industriesJson ?? null));
    setAgentAvatarImageUrl(item.avatarImageUrl ?? "");
    setAgentAvatarAltText(item.avatarAltText ?? "AI agent avatar");
    loadKnowledge(id);
  }

  async function uploadAgentAvatar(file: File) {
    if (!selectedId) {
      alert("Select an agent first.");
      return;
    }
    setAgentAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("altText", agentAvatarAltText.trim() || "AI agent avatar");
      const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/avatar-profile`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.avatarImageUrl) {
        toast.error(j?.error ?? "Avatar upload failed");
        return;
      }
      setAgentAvatarImageUrl(j.avatarImageUrl);
      await loadAgents();
      toast.success("Agent avatar uploaded");
    } finally {
      setAgentAvatarUploading(false);
    }
  }

  async function loadKnowledge(agentId: string) {
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(agentId)}/knowledge`, {
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      setKnowledgeItems(j.items ?? []);
    } catch {
      setKnowledgeItems([]);
    }
  }

  function triggerKnowledgeBrowse() {
    if (!selectedId) {
      alert("Select an agent first.");
      return;
    }
    if (knowledgeUploading) return;
    knowledgeFileInputRef.current?.click();
  }

  function handleKnowledgeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) uploadKnowledgePdf(f);
  }

  async function uploadKnowledgePdf(file: File) {
    if (!selectedId) {
      alert("Select an agent first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are accepted.");
      return;
    }
    setKnowledgeUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/knowledge`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        alert(j?.error ?? "Upload failed.");
        return;
      }
      await loadKnowledge(selectedId);
    } finally {
      setKnowledgeUploading(false);
    }
  }

  async function removeKnowledgeItem(kid: string) {
    if (!selectedId) return;
    try {
      const r = await fetch(
        `/api/app/agents/${encodeURIComponent(selectedId)}/knowledge/${encodeURIComponent(kid)}`,
        { method: "DELETE", credentials: "include" }
      );
      if (r.ok) await loadKnowledge(selectedId);
    } catch {
      /* ignore */
    }
  }

  async function createAgentFromTemplate(tplId: string) {
    const tpl = TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;

    const r = await fetch("/api/app/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: tpl.name,
        description: tpl.description,
        systemPrompt: tpl.systemPrompt,
        status: "draft",
        workspaceId: workspaceId || null,
        toolsJson: { crm: true, tasks: true, automations: true, siteContext: true },
        avatarImageUrl: agentAvatarImageUrl.trim() || null,
        avatarAltText: agentAvatarAltText.trim() || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (j?.id) {
      await loadAgents();
      setSelectedId(j.id);
      setTab("prompt");
    }
  }

  async function saveAgent() {
    if (!selectedId) return;

    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      systemPrompt,
      status,
      toolsJson: { crm: toolCrm, tasks: toolTasks, automations: toolAutomations, siteContext: toolSiteContext },
      consultantId: consultantId || null,
      voiceId: voiceId || null,
      voiceProvider: voiceProvider || null,
      workspaceId: workspaceId || null,
      llmEndpoint: llmEndpoint.trim() || null,
      model: model.trim() || null,
      language: language.trim() || null,
      industriesJson: industriesSelected.length > 0 ? stringifyIndustries(industriesSelected) : null,
      avatarImageUrl: agentAvatarImageUrl.trim() || null,
      avatarAltText: agentAvatarAltText.trim() || null,
    };
    if (llmApiKey.trim()) body.llmApiKey = llmApiKey.trim();

    const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast.error(j?.error ?? "Save failed. Try again.");
      return;
    }
    await loadAgents();
    toast.success("Saved. Your agent is stored in your account and will appear in the list.");
  }

  async function createBlankAgent() {
    const r = await fetch("/api/app/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        name: "New Agent",
        description: "",
        systemPrompt: "You are a helpful assistant.",
        status: "draft",
        workspaceId: workspaceId || null,
        toolsJson: { crm: true, tasks: true, automations: false, siteContext: true },
        avatarImageUrl: agentAvatarImageUrl.trim() || null,
        avatarAltText: agentAvatarAltText.trim() || null,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (j?.id) {
      await loadAgents();
      setSelectedId(j.id);
      setTab("prompt");
    }
  }

  async function deleteAgent() {
    if (!selectedId) return;
    const ok = confirm("Delete this agent? This cannot be undone.");
    if (!ok) return;

    await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    setSelectedId(null);
    setName("");
    setDescription("");
    setSystemPrompt("");
    setAgentAvatarImageUrl("");
    setAgentAvatarAltText("AI agent avatar");
    setWidgetKey("");
    setSelectedSiteId("");
    setLlmEndpoint("");
    setLlmApiKey("");
    setModel("");
    await loadAgents();
  }

  async function loadSitesForConsultant(cid: string) {
    if (!cid) {
      setSites([]);
      return;
    }
    const r = await fetch(
      `/api/app/consultant-sites?consultantId=${encodeURIComponent(cid)}`,
      { credentials: "include" }
    );
    const j = await r.json().catch(() => ({}));
    setSites(j.items ?? j.sites ?? []);
  }

  async function bindToSite() {
    if (!selectedId) return;
    if (!selectedSiteId) {
      alert("Select a site first.");
      return;
    }
    const domains = allowedDomains
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/bind-site`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        siteId: selectedSiteId,
        allowedDomains: domains,
        consentRequired,
        consentText: consentText.trim() || null,
        retentionDays: retentionDays,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (j?.widgetKey) setWidgetKey(j.widgetKey);
  }

  async function generateBuildingApiKey() {
    if (buildingKeyGenLoading) return;
    setBuildingKeyGenLoading(true);
    setBuildingKeyGenerated(null);
    try {
      const r = await fetch(
        `/api/worlds/${encodeURIComponent(buildingKeyGenWorld)}/buildings/${encodeURIComponent(buildingKeyGenBuilding)}/api-key`,
        { method: "POST", credentials: "include" }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j?.error ?? "Failed to generate API key");
        return;
      }
      const key = j.apiKey;
      setBuildingKeyGenerated(key);
      setBuildingKeyInput(key);
      await navigator.clipboard.writeText(key);
      toast.success("API key copied to clipboard");
    } catch {
      toast.error("Failed to generate API key");
    } finally {
      setBuildingKeyGenLoading(false);
    }
  }

  async function bindToBuilding() {
    const key = buildingKeyInput.trim();
    if (!key || !selectedId || buildingLinkLoading) return;
    setBuildingLinkLoading(true);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/bind-building`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiKey: key }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j?.error ?? "Failed to link agent");
        return;
      }
      setBuildingWorldId(j.worldId ?? null);
      setBuildingBuildingId(j.buildingId ?? null);
      toast.success("Agent linked to building");
    } catch {
      toast.error("Failed to link agent");
    } finally {
      setBuildingLinkLoading(false);
    }
  }

  async function sendTest() {
    const text = testInput.trim();
    if (!text || !selectedId) return;

    const historyForRequest = testLog.map((m) => ({
      role: m.role,
      content: m.text,
    }));
    setTestLog((l) => [...l, { role: "user", text }]);
    setTestInput("");
    setTestDebugChunks(null);

    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          debugRetrieval: testDebugRetrieval,
          history: historyForRequest,
        }),
      });
      const j = await r.json().catch(() => ({}));
      const reply = j?.reply ?? "No response. Is the LLM configured?";
      setTestLog((l) => [...l, { role: "assistant", text: reply }]);
      if (testDebugRetrieval && Array.isArray(j?.debug?.selectedChunks)) {
        setTestDebugChunks(j.debug.selectedChunks);
      }
    } catch {
      setTestLog((l) => [...l, { role: "assistant", text: "Request failed. Check connection." }]);
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    const refresh = () => setWorkspaceId(loadWorkspaceFromBinding());
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === BINDING_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("smart_trust_platform_binding_updated", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("smart_trust_platform_binding_updated", refresh);
    };
  }, []);

  const agentFromUrl = searchParams?.get("agent")?.trim();
  useEffect(() => {
    if (agentFromUrl) setSelectedId(agentFromUrl);
  }, [agentFromUrl]);

  useEffect(() => {
    if (searchParams?.get("google_connected") === "1") {
      setTab("capabilities");
    }
  }, [searchParams]);

  useEffect(() => {
    const t = searchParams?.get("tab");
    if (t === "knowledge") setTab("knowledge");
  }, [searchParams]);

  useEffect(() => {
    loadAgents();
    fetch("/api/app/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (typeof j?.userId === "number") setConsultantId(String(j.userId));
      })
      .catch(() => {});
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPlatformNpcsLoading(true);
      try {
        const r = await fetch("/api/npc/list", { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        const raw: PlatformNpcListItem[] = Array.isArray(j.npcs) ? j.npcs : [];
        raw.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
        setPlatformNpcs(raw);
      } catch {
        if (!cancelled) setPlatformNpcs([]);
      } finally {
        if (!cancelled) setPlatformNpcsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedId) loadAgent(selectedId);
  }, [selectedId]);

  async function loadCollaborators() {
    if (!selectedId) return;
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/collaborators`, {
        credentials: "include",
      });
      const j = await r.json().catch(() => ({}));
      setCollaborators(j.collaborators?.map((c: { userId: number; email: string; username: string }) => ({ userId: c.userId, email: c.email, username: c.username })) ?? []);
    } catch {
      setCollaborators([]);
    }
  }

  useEffect(() => {
    if (selectedId && collabModalOpen) loadCollaborators();
  }, [selectedId, collabModalOpen]);

  const searchEligibleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function searchEligibleCollaborators(q: string) {
    if (q.length < 2) {
      setCollabSuggestions([]);
      return;
    }
    if (searchEligibleRef.current) clearTimeout(searchEligibleRef.current);
    searchEligibleRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/app/agents/eligible-collaborators?q=${encodeURIComponent(q)}`, {
          credentials: "include",
        });
        const j = await r.json().catch(() => ({}));
        setCollabSuggestions(j.users ?? []);
      } catch {
        setCollabSuggestions([]);
      }
      searchEligibleRef.current = null;
    }, 300);
  }

  async function inviteCollaborator(email: string) {
    if (!selectedId || !email.trim()) return;
    setCollabInviting(true);
    try {
      const r = await fetch(`/api/app/agents/${encodeURIComponent(selectedId)}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(j?.error ?? "Invite failed");
        return;
      }
      toast.success(`${email} is now a collaborator. They share the same workspace ID on this agent.`);
      setCollabEmail("");
      setCollabSuggestions([]);
      loadCollaborators();
    } finally {
      setCollabInviting(false);
    }
  }

  useEffect(() => {
    loadSitesForConsultant(consultantId);
  }, [consultantId]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-cyan-500 blur-[90px]" />
        <div className="absolute top-40 -right-24 h-96 w-96 rounded-full bg-orange-500 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Agents</h1>
            <p className="mt-1 text-sm text-white/60">
              Private-by-default agent builder • assign to your sites • deploy a widget
            </p>
            {workspaceId ? (
              <p className="mt-1 text-xs text-cyan-300/80">
                Workspace: {workspaceId.slice(0, 8)}…{workspaceId.slice(-4)}
              </p>
            ) : (
              <p className="mt-1 text-xs text-amber-300/80">
                Select a workspace (open a trust from Trust Records) to create agents for that workspace.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/app/agents/overview"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              <Bot className="h-4 w-4" />
              NPC overview
            </Link>
            <Link
              href="/app/agents/mapping"
              className="flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm hover:bg-cyan-500/15"
            >
              <Map className="h-4 w-4" />
              Mapping
            </Link>
            <button
              onClick={createBlankAgent}
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm hover:bg-cyan-500/15"
            >
              + New Agent
            </button>
            <button
              onClick={() => setCollabModalOpen(true)}
              disabled={!selectedId}
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm hover:bg-cyan-500/15 disabled:opacity-50 flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Collaborate
            </button>
            <button
              onClick={saveAgent}
              disabled={!selectedId}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-12 gap-4">
          <div className="col-span-12 md:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 mb-4">
              <div className="flex items-center justify-between border-b border-white/10 p-3">
                <div className="text-sm font-semibold">Platform NPCs</div>
                <span className="text-[10px] text-white/40">oasis / Troo / trust</span>
              </div>
              <p className="px-3 pt-2 text-[11px] text-white/50">
                MAANIA, Jarva, Eleanor, and the full seeded roster. Chat here; manage in{" "}
                <Link href="/admin/npc" className="text-cyan-300/90 hover:underline">
                  Admin → NPC
                </Link>
                .
              </p>
              <div className="max-h-[280px] overflow-auto">
                {platformNpcsLoading ? (
                  <div className="p-4 text-sm text-white/50">Loading NPCs…</div>
                ) : platformNpcs.length === 0 ? (
                  <div className="p-4 text-sm text-white/50">No platform NPCs (check database / API).</div>
                ) : (
                  platformNpcs.map((npc) => {
                    const key = publicNpcKey(npc);
                    if (!key) return null;
                    return (
                      <div
                        key={key}
                        className="border-b border-white/5 px-3 py-2.5 last:border-b-0 flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex items-start gap-2">
                          <span className="text-xl shrink-0">{npc.avatarEmoji || "🤖"}</span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{npc.name}</div>
                            <div className="truncate text-[11px] text-white/45">{npc.title || npc.role}</div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Link
                            href={`/oasis-npc?npcId=${encodeURIComponent(key)}`}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] hover:bg-cyan-500/15"
                          >
                            <MessageSquare className="h-3 w-3" />
                            Chat
                          </Link>
                          <Link
                            href={`/admin/npc?npcId=${encodeURIComponent(key)}`}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] hover:bg-white/10"
                          >
                            <Settings2 className="h-3 w-3" />
                            Admin
                          </Link>
                          <Link
                            href={`/admin/npc/analytics?npcId=${encodeURIComponent(key)}`}
                            className="inline-flex items-center justify-center gap-1 rounded-lg border border-orange-400/25 bg-orange-500/10 px-2 py-1 text-[11px] hover:bg-orange-500/15"
                          >
                            <BarChart3 className="h-3 w-3" />
                            Sessions
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5">
              <div className="flex items-center justify-between border-b border-white/10 p-3">
                <div className="text-sm font-semibold">Your Agents</div>
                <button onClick={loadAgents} className="text-xs text-white/60 hover:text-white">
                  Refresh
                </button>
              </div>

              <div className="max-h-[380px] overflow-auto">
                {agents.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={cx(
                      "w-full border-b border-white/5 px-3 py-3 text-left hover:bg-white/5",
                      selectedId === a.id && "bg-white/7"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2">
                        <div className="h-8 w-8 overflow-hidden rounded-full border border-violet-400/45 bg-slate-900/80 shrink-0">
                          {a.avatarImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={a.avatarImageUrl} alt={a.avatarAltText || `${a.name} avatar`} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-violet-200">AI</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{a.name}</div>
                          <div className="truncate text-xs text-white/50">
                            {a.description ?? "—"}
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-[10px] text-white/70">
                        {(a.status ?? "draft").toUpperCase()}
                      </span>
                    </div>
                  </button>
                ))}
                {agents.length === 0 ? (
                  <div className="p-4 text-sm text-white/60">No agents yet.</div>
                ) : null}
              </div>

              <div className="p-3">
                <button
                  onClick={deleteAgent}
                  disabled={!selectedId}
                  className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm hover:bg-red-500/15 disabled:opacity-50"
                >
                  Delete Agent
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 p-3 text-sm font-semibold">
                Templates
              </div>
              <div className="space-y-2 p-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => createAgentFromTemplate(t.id)}
                    className="w-full rounded-xl border border-orange-400/25 bg-orange-500/10 p-3 text-left hover:bg-orange-500/15"
                  >
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="mt-1 text-xs text-white/60">{t.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-6">
            <div className="rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      ["prompt", "Prompt"],
                      ["knowledge", "Knowledge"],
                      ["tools", "Tools"],
                      ["capabilities", "Capabilities"],
                      ["industry", "Industry"],
                      ["voice", "Voice"],
                      ["deploy", "Deploy"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() => setTab(k)}
                      className={cx(
                        "rounded-xl px-3 py-2 text-sm",
                        tab === k
                          ? "border border-cyan-400/30 bg-cyan-500/20"
                          : "border border-white/10 bg-black/20 hover:bg-white/5"
                      )}
                    >
                      {label}
                    </button>
                  ))}

                  <div className="ml-auto flex items-center gap-2">
                    <select
                      value={status}
                      onChange={(e) =>
                        setStatus(e.target.value as "draft" | "active" | "paused")
                      }
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    >
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="p-4">
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs text-white/60">Name</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                      placeholder="Agent name"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/60">Description</label>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                      placeholder="What does this agent do?"
                    />
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <label className="text-xs text-white/60">Agent Avatar (bubble image)</label>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-12 w-12 overflow-hidden rounded-full border border-violet-400/45 bg-slate-900/80">
                        {agentAvatarImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={agentAvatarImageUrl} alt={agentAvatarAltText || "agent avatar"} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-[11px] font-semibold text-violet-200">AI</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <input
                          value={agentAvatarAltText}
                          onChange={(e) => setAgentAvatarAltText(e.target.value)}
                          className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                          placeholder="Avatar alt text"
                        />
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          disabled={!selectedId || agentAvatarUploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.currentTarget.value = "";
                            if (f) void uploadAgentAvatar(f);
                          }}
                          className="mt-2 block text-xs text-white/60"
                        />
                      </div>
                    </div>
                  </div>

                  {tab === "prompt" ? (
                    <div>
                      <div className="mb-4">
                        <label className="text-xs text-white/60">Response Language</label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                        >
                          {COMMON_LANGUAGES.map((l) => (
                            <option key={l.value || "default"} value={l.value}>
                              {l.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-white/50">
                          When set, the agent will speak and respond exclusively in this language.
                        </p>
                      </div>
                      <label className="text-xs text-white/60">System Prompt</label>
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setKnowledgeDragOver(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          setKnowledgeDragOver(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setKnowledgeDragOver(false);
                          if (!selectedId) {
                            alert("Select an agent first.");
                            return;
                          }
                          const files = Array.from(e.dataTransfer?.files ?? []);
                          const pdf = files.find((f) => f.name.toLowerCase().endsWith(".pdf"));
                          if (pdf) uploadKnowledgePdf(pdf);
                          else if (files.length) alert("Only PDF files are accepted.");
                        }}
                        className={cx(
                          "mt-1 rounded-xl border-2 border-dashed px-3 py-2 transition-colors",
                          knowledgeDragOver
                            ? "border-cyan-400/60 bg-cyan-500/10"
                            : "border-white/15 bg-black/20"
                        )}
                      >
                        <textarea
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setKnowledgeDragOver(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setKnowledgeDragOver(false);
                          }}
                          rows={12}
                          className="w-full resize-none border-none bg-transparent px-0 py-0 text-sm outline-none"
                          placeholder="Define the agent's role, rules, style, and workflow."
                        />
                        <div className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2">
                          <span className="text-xs text-white/50">
                            Drop PDFs here or{" "}
                            <button
                              type="button"
                              onClick={triggerKnowledgeBrowse}
                              disabled={knowledgeUploading}
                              className="cursor-pointer text-cyan-400 hover:text-cyan-300 underline disabled:opacity-50"
                            >
                              browse
                            </button>
                            <input
                              ref={knowledgeFileInputRef}
                              type="file"
                              accept=".pdf,application/pdf"
                              className="sr-only"
                              tabIndex={-1}
                              aria-hidden
                              onChange={handleKnowledgeFileChange}
                            />
                            {" "}to add reference documents. Text is extracted and used as context.
                          </span>
                          {knowledgeUploading && (
                            <span className="text-xs text-cyan-400">Uploading…</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
                        <div className="text-sm font-medium text-white/90">Custom API (optional)</div>
                        <div className="text-xs text-white/50">
                          Connect your own LLM endpoint (OpenAI-compatible). Leave blank to use the platform default.
                        </div>
                        <div>
                          <label className="text-xs text-white/60">Endpoint URL</label>
                          <input
                            type="url"
                            value={llmEndpoint}
                            onChange={(e) => setLlmEndpoint(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                            placeholder="https://api.openai.com/v1/chat/completions"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/60">API Key</label>
                          <input
                            type="password"
                            value={llmApiKey}
                            onChange={(e) => setLlmApiKey(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                            placeholder="Leave blank to keep existing key"
                            autoComplete="new-password"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-white/60">Model (optional)</label>
                          <input
                            type="text"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                            placeholder="e.g. gpt-4o-mini"
                          />
                        </div>
                      </div>
                      {knowledgeItems.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-white/50 mb-1">Reference documents</div>
                          <div className="flex flex-wrap gap-2">
                            {knowledgeItems.map((k) => (
                              <span
                                key={k.id}
                                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-xs"
                              >
                                <span className="text-white/80 truncate max-w-[140px]">
                                  {k.displayName ?? k.id.slice(0, 8)}
                                </span>
                                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" strokeWidth={2.5} aria-label="Added" />
                                <button
                                  type="button"
                                  onClick={() => removeKnowledgeItem(k.id)}
                                  className="text-red-400 hover:text-red-300"
                                  aria-label="Remove"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-2 text-xs text-white/50">
                        Tip: Keep it procedural. Tell it what to collect, what to avoid,
                        and what &quot;done&quot; looks like.
                      </div>
                    </div>
                  ) : null}

                  {tab === "knowledge" ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-3">
                      <div className="text-sm font-semibold">Knowledge Base (MVP)</div>
                      <div className="text-xs text-white/60">
                        Add private notes, FAQs, and reference docs. Thomas will use this when answering.
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <AddSourceSection
                          selectedId={selectedId ?? ""}
                          onAdded={() => selectedId && loadKnowledge(selectedId)}
                        />
                      </div>

                      <AddNoteForm
                        selectedId={selectedId ?? ""}
                        onAdded={() => selectedId && loadKnowledge(selectedId)}
                      />

                      <div className="text-xs text-white/50">
                        PDFs:{" "}
                        <button
                          type="button"
                          onClick={triggerKnowledgeBrowse}
                          disabled={knowledgeUploading || !selectedId}
                          className="text-cyan-400 hover:text-cyan-300 underline disabled:opacity-50"
                        >
                          upload PDF
                        </button>
                        <input
                          ref={knowledgeFileInputRef}
                          type="file"
                          accept=".pdf,application/pdf"
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden
                          onChange={handleKnowledgeFileChange}
                        />
                        {knowledgeUploading && " …uploading"}
                      </div>

                      {knowledgeItems.length > 0 && (
                        <div>
                          <div className="text-xs text-white/50 mb-2">Items ({knowledgeItems.length})</div>
                          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                            {knowledgeItems.map((k) => (
                              <div
                                key={k.id}
                                className="flex items-center justify-between rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs"
                              >
                                <span className="text-white/90 truncate flex-1">
                                  {k.displayName ?? k.id.slice(0, 8)}
                                </span>
                                <span className="text-white/40 shrink-0 mx-2">
                                  {k.type === "note"
                                    ? "Note"
                                    : k.type === "url"
                                      ? "URL"
                                      : k.type === "pdf"
                                        ? "PDF"
                                        : k.type === "faq"
                                          ? "FAQ"
                                          : k.type === "web_crawler"
                                            ? "Web"
                                            : k.type === "tables"
                                              ? "Table"
                                              : k.type}
                                </span>
                                <span className="text-emerald-400 shrink-0" title="Added to knowledge base" aria-label="Added">
                                  <Check className="h-4 w-4" strokeWidth={2.5} />
                                </span>
                                <button
                                  type="button"
                                  onClick={() => removeKnowledgeItem(k.id)}
                                  className="text-red-400 hover:text-red-300 shrink-0 ml-1"
                                  aria-label="Remove"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {tab === "tools" ? (
                    <div className="grid gap-3">
                      <div className="text-sm font-semibold">Tools</div>
                      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                        <div>
                          <div className="text-sm font-semibold">CRM Context</div>
                          <div className="text-xs text-white/60">
                            Read contact/conversation history when available.
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={toolCrm}
                          onChange={(e) => setToolCrm(e.target.checked)}
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                        <div>
                          <div className="text-sm font-semibold">Tasks</div>
                          <div className="text-xs text-white/60">
                            Create follow-ups and reminders.
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={toolTasks}
                          onChange={(e) => setToolTasks(e.target.checked)}
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                        <div>
                          <div className="text-sm font-semibold">Automations</div>
                          <div className="text-xs text-white/60">
                            Trigger workflows (when enabled).
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={toolAutomations}
                          onChange={(e) => setToolAutomations(e.target.checked)}
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-3">
                        <div>
                          <div className="text-sm font-semibold">Site Context</div>
                          <div className="text-xs text-white/60">
                            Reads site metadata/branding to answer consistently.
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={toolSiteContext}
                          onChange={(e) => setToolSiteContext(e.target.checked)}
                        />
                      </label>
                    </div>
                  ) : null}

                  {tab === "capabilities" ? (
                    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-4">
                      <AgentCapabilitiesPanel agentId={selectedId} />
                    </div>
                  ) : null}

                  {tab === "industry" ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-5 w-5 text-cyan-400" />
                        <div>
                          <div className="text-sm font-semibold">Industry Mapper</div>
                          <div className="text-xs text-white/60">
                            Map this agent to industries. Improves responses with vertical-specific context.
                          </div>
                        </div>
                      </div>
                      {industriesSelected.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {industriesSelected.map((key) => {
                            const opt = INDUSTRY_MAPPER_GROUPS.flatMap((g) => g.industries).find((i) => i.value === key);
                            return (
                              <span
                                key={key}
                                className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-xs"
                              >
                                {opt?.label ?? key}
                                <button
                                  type="button"
                                  onClick={() => setIndustriesSelected((prev) => prev.filter((k) => k !== key))}
                                  className="text-cyan-300 hover:text-white"
                                  aria-label="Remove"
                                >
                                  ×
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                        {INDUSTRY_MAPPER_GROUPS.map((group) => (
                          <div key={group.id}>
                            <div className="text-xs font-medium text-white/70 uppercase tracking-wider mb-2">
                              {group.label}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {group.industries.map((ind) => {
                                const isSelected = industriesSelected.includes(ind.value);
                                return (
                                  <button
                                    key={ind.value}
                                    type="button"
                                    onClick={() => {
                                      setIndustriesSelected((prev) =>
                                        isSelected
                                          ? prev.filter((k) => k !== ind.value)
                                          : [...prev, ind.value]
                                      );
                                    }}
                                    className={cx(
                                      "rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                                      isSelected
                                        ? "border-cyan-400/60 bg-cyan-500/20 text-white"
                                        : "border-white/15 bg-black/30 text-white/90 hover:border-white/25 hover:bg-white/5"
                                    )}
                                  >
                                    {ind.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-xs text-white/50">
                        Selected industries will be saved with the agent and can inform system prompts.
                      </p>
                    </div>
                  ) : null}

                  {tab === "voice" ? (
                    <VoiceTab
                      selectedVoiceId={voiceId}
                      selectedVoiceProvider={voiceProvider}
                      onSelect={(id, provider) => {
                        setVoiceId(id);
                        setVoiceProvider(provider);
                      }}
                      onSave={() => {
                        if (voiceId && voiceProvider && selectedId) {
                          saveAgent();
                        }
                      }}
                      hasSelection={!!voiceId}
                    />
                  ) : null}

                  {tab === "deploy" ? (
                    <div className="grid gap-3">
                      <div className="text-sm font-semibold">Deploy to a Site</div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs text-white/60">Consultant ID (your userId)</div>
                        <input
                          value={consultantId}
                          onChange={(e) => setConsultantId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                          placeholder="Your user ID to fetch your sites"
                        />
                        <div className="mt-2 text-xs text-white/50">
                          Your user ID fetches sites you own. Use the same ID from your
                          session.
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-xs text-white/60">Select Site</div>
                        <select
                          value={selectedSiteId}
                          onChange={(e) => setSelectedSiteId(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                        >
                          <option value="">— choose —</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {(s.name ?? s.domain ?? s.slug ?? s.id).slice(0, 80)}
                            </option>
                          ))}
                        </select>

                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs text-white/60">Allowed Domains (optional)</div>
                          <input
                            value={allowedDomains}
                            onChange={(e) => setAllowedDomains(e.target.value)}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                            placeholder="example.com, www.client.com (comma-separated, empty = any)"
                          />
                          <div className="mt-1 text-xs text-white/50">
                            Restrict where this widget can run. Leave empty to allow all origins.
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <label className="flex items-center justify-between">
                            <span className="text-xs text-white/60">Require consent banner</span>
                            <input
                              type="checkbox"
                              checked={consentRequired}
                              onChange={(e) => setConsentRequired(e.target.checked)}
                            />
                          </label>
                          {consentRequired ? (
                            <textarea
                              value={consentText}
                              onChange={(e) => setConsentText(e.target.value)}
                              className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                              rows={2}
                              placeholder="This chat may be recorded and stored for follow-up. By continuing you agree."
                            />
                          ) : null}
                          <div className="mt-1 text-xs text-white/50">
                            Visitors must acknowledge before chatting (compliance).
                          </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs text-white/60">Webchat retention (days)</div>
                          <select
                            value={retentionDays}
                            onChange={(e) => setRetentionDays(Number(e.target.value))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                          >
                            <option value={7}>7 days</option>
                            <option value={30}>30 days</option>
                            <option value={90}>90 days</option>
                            <option value={365}>365 days</option>
                          </select>
                          <div className="mt-1 text-xs text-white/50">
                            Delete webchat messages older than this.
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const r = await fetch("/api/app/retention-cleanup", {
                                  method: "POST",
                                  credentials: "include",
                                });
                                const j = await r.json().catch(() => ({}));
                                if (j?.ok) {
                                  alert(
                                    `Cleanup done: ${j.messagesDeleted ?? 0} messages, ${j.conversationsDeleted ?? 0} convos, ${j.contactsDeleted ?? 0} contacts removed.`
                                  );
                                } else {
                                  alert(j?.error ?? "Cleanup failed.");
                                }
                              } catch {
                                alert("Cleanup request failed.");
                              }
                            }}
                            className="mt-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs hover:bg-cyan-500/15"
                          >
                            Run retention cleanup now
                          </button>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={bindToSite}
                            disabled={!selectedId || !selectedSiteId}
                            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
                          >
                            Generate Widget Key
                          </button>
                          <button
                            onClick={saveAgent}
                            disabled={!selectedId}
                            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
                          >
                            Save
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <div className="text-sm font-semibold">Embed</div>
                        <div className="mt-1 text-xs text-white/60">
                          Paste this into your site (or inject via your site builder). The
                          widgetKey should be treated like a secret.
                        </div>

                        <pre className="mt-3 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/80">
                          {widgetKey
                            ? `<script>
  window.TROO_AGENT_CONFIG = {
    widgetKey: "${widgetKey}",
    context: { pageType: "site", source: "embed" }
  };
</script>
<script src="${origin || "https://your-domain.com"}/widget/loader.js" async></script>`
                            : "Generate a widgetKey first."}
                        </pre>
                      </div>

                      <div className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-3">
                        <div className="text-sm font-semibold">Link to World Building</div>
                        <div className="mt-1 text-xs text-white/60">
                          Assign this agent to a building in Troo Town or your World Explorer world.
                          Generate an API key from the building (or World Editor commerce node), then paste it here.
                        </div>
                        {buildingWorldId && buildingBuildingId ? (
                          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80">
                            Linked to: {buildingWorldId} / {buildingBuildingId}
                          </div>
                        ) : null}
                        <div className="mt-3 flex gap-2">
                          <div className="flex-1">
                            <div className="text-[10px] text-white/50 mb-1">Generate API key (Troo Town)</div>
                            <div className="flex gap-2">
                              <select
                                value={buildingKeyGenBuilding}
                                onChange={(e) => setBuildingKeyGenBuilding(e.target.value)}
                                className="flex-1 rounded-xl border border-white/10 bg-black/30 px-2 py-1.5 text-xs outline-none"
                              >
                                {TROO_TOWN_BUILDINGS.map((b) => (
                                  <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                              </select>
                              <button
                                onClick={generateBuildingApiKey}
                                disabled={buildingKeyGenLoading}
                                className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
                              >
                                {buildingKeyGenLoading ? "..." : "Generate"}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="text-[10px] text-white/50 mb-1">Building API Key</div>
                          <div className="flex gap-2">
                            <input
                              value={buildingKeyInput}
                              onChange={(e) => setBuildingKeyInput(e.target.value)}
                              placeholder="Paste API key from World Editor or Generate above"
                              className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs outline-none"
                            />
                            <button
                              onClick={bindToBuilding}
                              disabled={!buildingKeyInput.trim() || !selectedId || buildingLinkLoading}
                              className="rounded-xl bg-cyan-500/30 border border-cyan-400/40 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/40 disabled:opacity-50"
                            >
                              {buildingLinkLoading ? "..." : "Link Agent"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="col-span-12 md:col-span-3">
            <div className="rounded-2xl border border-white/10 bg-white/5">
              <div className="border-b border-white/10 p-3">
                <div className="text-sm font-semibold">Test Chat</div>
                <div className="mt-1 text-xs text-white/60">
                  Preview behavior before deploying. (Wire to real LLM endpoint next.)
                </div>
              </div>

              <div className="max-h-[420px] space-y-2 overflow-auto p-3">
                {testLog.map((m, idx) => (
                  <div
                    key={idx}
                    className={cx(
                      "rounded-xl border p-3 text-sm",
                      m.role === "user"
                        ? "border-cyan-400/20 bg-cyan-500/10"
                        : "border-orange-400/20 bg-orange-500/10"
                    )}
                  >
                    <div className="mb-1 text-[10px] uppercase tracking-wide text-white/60">
                      {m.role}
                    </div>
                    <div className="whitespace-pre-wrap">{m.text}</div>
                  </div>
                ))}
              </div>

              <div className="border-t border-white/10 p-3">
                <div className="flex gap-2">
                  <input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? sendTest() : null)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                    placeholder="Ask something…"
                  />
                  <button
                    onClick={sendTest}
                    className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90"
                  >
                    Send
                  </button>
                </div>

                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={testDebugRetrieval}
                    onChange={(e) => setTestDebugRetrieval(e.target.checked)}
                  />
                  <span className="text-xs text-white/60">Debug retrieval (show selected chunks)</span>
                </label>
                <div className="mt-1 text-xs text-white/50">
                  Selected:{" "}
                  <span className="text-white/80">{selectedAgent?.name ?? "—"}</span>
                </div>
                {testDebugChunks && testDebugChunks.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-500/5 p-2 text-xs">
                    <div className="font-semibold text-cyan-300/80 mb-1">Selected chunks:</div>
                    <div className="space-y-1.5 max-h-32 overflow-auto">
                      {testDebugChunks.map((c, i) => (
                        <div
                          key={c.id}
                          className="rounded border border-white/10 bg-black/20 px-2 py-1"
                        >
                          <span className="text-white/50">
                            #{i + 1} {c.id} (score: {c.score})
                          </span>
                          <div className="mt-0.5 truncate text-white/70">{c.preview}…</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              <div className="font-semibold text-white/80">Isolation guarantee</div>
              Every agent query filters by <span className="text-white/80">userId</span>{" "}
              and site bindings verify ownership.
            </div>
          </div>
        </div>
      </div>

      {collabModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setCollabModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-black/95 p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Collaborate
              </h3>
              <button
                onClick={() => setCollabModalOpen(false)}
                className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-xs text-white/60">
              Invite approved users by email. They will see this agent with the same workspace ID.
            </p>

            <div className="mt-4">
              <label className="text-xs text-white/60">Invite by email</label>
              <div className="mt-1 flex gap-2">
                <input
                  type="email"
                  value={collabEmail}
                  onChange={(e) => {
                    setCollabEmail(e.target.value);
                    searchEligibleCollaborators(e.target.value);
                  }}
                  onBlur={() => setTimeout(() => setCollabSuggestions([]), 200)}
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none"
                  placeholder="user@example.com"
                />
                <button
                  onClick={() => inviteCollaborator(collabEmail)}
                  disabled={!collabEmail.trim() || collabInviting}
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400 disabled:opacity-50"
                >
                  {collabInviting ? "Inviting…" : "Invite"}
                </button>
              </div>
              {collabSuggestions.length > 0 ? (
                <div className="mt-2 rounded-xl border border-white/10 bg-black/40 py-1">
                  {collabSuggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setCollabEmail(u.email ?? "");
                        setCollabSuggestions([]);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-white/10"
                    >
                      {u.email}
                      {u.username ? ` (${u.username})` : ""}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="mt-4 border-t border-white/10 pt-3">
              <div className="text-xs font-semibold text-white/80">Current collaborators</div>
              {collaborators.length === 0 ? (
                <p className="mt-2 text-xs text-white/50">No collaborators yet.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {collaborators.map((c) => (
                    <li key={c.userId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                      <span>{c.email}</span>
                      {c.username ? (
                        <span className="text-xs text-white/50">({c.username})</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-white/60">Loading…</div>
        </div>
      }
    >
      <AgentsPageContent />
    </Suspense>
  );
}
