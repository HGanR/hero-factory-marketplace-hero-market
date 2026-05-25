"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExecutiveInboxAttachmentsList,
  formatExecutiveInboxTimestamp,
  parseInboxAttachmentsJson,
  type ExecutiveInboxDisplayAttachment,
} from "@/components/executive-inbox/ExecutiveInboxAttachmentsBlock";
import {
  ExecutiveInboxRecipientPicker,
  type ExecutiveInboxRecipient,
} from "@/components/executive-inbox/ExecutiveInboxRecipientPicker";
import { executiveInboxUploadErrorMessage } from "@/lib/executive-inbox/executive-inbox-upload-errors";
import {
  normalizeExecutiveInboxUploadFile,
  pickExecutiveInboxMediaRecorderMimeType,
} from "@/lib/executive-inbox/executive-inbox-upload-mime";

type InboxMsg = {
  id?: string;
  kind?: string;
  bodyText?: string;
  createdAt?: string;
  attachmentsJson?: string | null;
  fromAdminUserId?: number | null;
  fromMarketplaceUserId?: number | null;
  toMarketplaceUserId?: number | null;
};

function inboxNumericId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim()) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function adminRoutingLine(
  m: InboxMsg,
  recipients: ExecutiveInboxRecipient[],
  directory: Record<number, { username: string; email: string }>,
): string {
  const kind = m.kind ?? "";
  const fromUid = inboxNumericId(m.fromMarketplaceUserId);
  const toUid = inboxNumericId(m.toMarketplaceUserId);
  const fromAid = inboxNumericId(m.fromAdminUserId);
  const label = (uid: number | null) => {
    if (uid == null) return "—";
    const u = recipients.find((r) => r.id === uid);
    if (u) return `${u.username} · ${u.email}`;
    const d = directory[uid];
    if (d) return `${d.username} · ${d.email}`;
    return `User id ${uid}`;
  };
  const adminFrom = fromAid != null ? `From executive: ${label(fromAid)}` : "From executive";
  if (kind === "user_to_executive") return `Member ${label(fromUid)} → Executive Department`;
  if (kind === "executive_to_user") return `${adminFrom} → Direct to ${label(toUid)}`;
  if (kind === "executive_broadcast") return `${adminFrom} · Broadcast (all approved)`;
  return kind || "Message";
}

function memberRoutingLine(
  m: InboxMsg,
  directory: Record<number, { username: string; email: string }>,
): string {
  const kind = m.kind ?? "";
  const aid = typeof m.fromAdminUserId === "number" ? m.fromAdminUserId : null;
  const label = (id: number | null) => {
    if (id == null) return "Executive team";
    const d = directory[id];
    if (d?.username) return d.username;
    return `Admin id ${id}`;
  };
  if (kind === "user_to_executive") return `You → Executive Department`;
  if (kind === "executive_to_user") return `From executive: ${label(aid)} → You (direct)`;
  if (kind === "executive_broadcast") return `From executive: ${label(aid)} · Broadcast`;
  return kind || "Message";
}

export default function ExecutiveInboxPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [isExecutiveAdmin, setIsExecutiveAdmin] = useState(false);
  const [messages, setMessages] = useState<InboxMsg[]>([]);
  const [viewerId, setViewerId] = useState<number | null>(null);
  const [directory, setDirectory] = useState<Record<number, { username: string; email: string }>>({});
  const [recipients, setRecipients] = useState<ExecutiveInboxRecipient[]>([]);
  const [broadcast, setBroadcast] = useState(false);
  const [target, setTarget] = useState<number | "">("");
  const [recipientFilter, setRecipientFilter] = useState("");
  const [body, setBody] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ExecutiveInboxDisplayAttachment[]>([]);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const mrChunksRef = useRef<BlobPart[]>([]);

  const uploadUrl = isExecutiveAdmin
    ? "/api/admin/executive-agent/inbox/upload"
    : "/api/marketplace/executive-inbox/upload";

  const appendUploaded = useCallback((a: ExecutiveInboxDisplayAttachment) => {
    setPendingAttachments((p) => (p.length >= 5 ? p : [...p, a]));
  }, []);

  const uploadFile = useCallback(
    async (file: File | Blob, filename: string) => {
      setUploading(true);
      setError(null);
      try {
        const payload =
          file instanceof File ? normalizeExecutiveInboxUploadFile(file) : new File([file], filename, { type: file.type || "application/octet-stream" });
        const form = new FormData();
        form.append("file", payload, payload.name);
        const r = await fetch(uploadUrl, { method: "POST", body: form, credentials: "include" });
        const j = (await r.json().catch(() => ({}))) as {
          attachment?: ExecutiveInboxDisplayAttachment;
          error?: string;
          message?: string;
        };
        if (!r.ok) {
          setError(executiveInboxUploadErrorMessage(j.error, j.message));
          return;
        }
        if (j.attachment) appendUploaded(j.attachment);
      } finally {
        setUploading(false);
      }
    },
    [appendUploaded, uploadUrl],
  );

  const parseDirectory = (dr: Record<string, { username?: string; email?: string }> | undefined) => {
    const dir: Record<number, { username: string; email: string }> = {};
    if (dr && typeof dr === "object") {
      for (const [k, v] of Object.entries(dr)) {
        const id = Number(k);
        if (!Number.isFinite(id) || !v || typeof v !== "object") continue;
        dir[id] = {
          username: typeof v.username === "string" ? v.username : "",
          email: typeof v.email === "string" ? v.email : "",
        };
      }
    }
    return dir;
  };

  const loadMember = useCallback(async () => {
    const r = await fetch("/api/marketplace/executive-inbox", { credentials: "include", cache: "no-store" });
    if (r.status === 401) {
      router.push("/");
      return false;
    }
    if (!r.ok) {
      setError("Could not load inbox.");
      return false;
    }
    const j = (await r.json()) as {
      messages?: InboxMsg[];
      viewerId?: number;
      directory?: Record<string, { username?: string; email?: string }>;
    };
    setMessages(Array.isArray(j.messages) ? j.messages : []);
    setViewerId(typeof j.viewerId === "number" ? j.viewerId : null);
    setDirectory(parseDirectory(j.directory));
    setRecipients([]);
    return true;
  }, [router]);

  const loadAdmin = useCallback(async () => {
    const r = await fetch("/api/admin/executive-agent/inbox", { credentials: "include", cache: "no-store" });
    if (r.status === 401) return false;
    if (!r.ok) {
      setError("Could not load executive inbox.");
      return false;
    }
    const j = (await r.json()) as {
      messages?: InboxMsg[];
      recipients?: ExecutiveInboxRecipient[];
      directory?: Record<string, { username?: string; email?: string }>;
    };
    setMessages(Array.isArray(j.messages) ? j.messages : []);
    setRecipients(Array.isArray(j.recipients) ? j.recipients : []);
    setDirectory(parseDirectory(j.directory));
    setViewerId(null);
    return true;
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const adminOk = await loadAdmin();
    if (adminOk) {
      setIsExecutiveAdmin(true);
      return;
    }
    setIsExecutiveAdmin(false);
    await loadMember();
  }, [loadAdmin, loadMember]);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("user");
      const adminLoggedIn = localStorage.getItem("adminLoggedIn") === "true";
      if (!storedUser && !adminLoggedIn) {
        router.push("/");
        return;
      }
    } catch {
      router.push("/");
      return;
    }
    setReady(true);
    void load();
  }, [router, load]);

  const stopRecording = useCallback(() => {
    mrRef.current?.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (recording || pendingAttachments.length >= 5) return;
    if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mrChunksRef.current = [];
      const mime = pickExecutiveInboxMediaRecorderMimeType();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mrRef.current = mr;
      mr.ondataavailable = (ev) => {
        if (ev.data.size) mrChunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(mrChunksRef.current, { type: mr.mimeType || "audio/webm" });
        mrChunksRef.current = [];
        mrRef.current = null;
        await uploadFile(blob, `voice-${Date.now()}.webm`);
      };
      mr.start(250);
      setRecording(true);
    } catch {
      setRecording(false);
      setError("Microphone permission is required to record.");
    }
  }, [pendingAttachments.length, recording, uploadFile]);

  const send = async () => {
    const hasBody = body.trim().length > 0;
    const hasAtt = pendingAttachments.length > 0;
    if (!hasBody && !hasAtt) return;

    if (isExecutiveAdmin && !broadcast && typeof target !== "number") {
      setError("Select a recipient, or check broadcast to message all approved accounts.");
      return;
    }

    setError(null);

    if (isExecutiveAdmin) {
      const r = await fetch("/api/admin/executive-agent/inbox", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: body,
          broadcast,
          toMarketplaceUserId: !broadcast && typeof target === "number" ? target : undefined,
          attachments: pendingAttachments.length ? pendingAttachments : undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(
          j.error === "NEED_BROADCAST_OR_TARGET"
            ? "Choose broadcast or a recipient."
            : j.error === "EMPTY_MESSAGE"
              ? "Add a message or at least one attachment."
              : "Send failed.",
        );
        return;
      }
    } else {
      const r = await fetch("/api/marketplace/executive-inbox", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bodyText: body,
          attachments: pendingAttachments.length ? pendingAttachments : undefined,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(
          j.error === "NOT_APPROVED"
            ? "Your account must be approved to use the Executive inbox."
            : j.error === "EMPTY_MESSAGE"
              ? "Add a message or at least one attachment."
              : "Send failed.",
        );
        return;
      }
    }

    setBody("");
    setPendingAttachments([]);
    await load();
  };

  const chron = useMemo(() => [...messages].reverse(), [messages]);

  if (!ready) {
    return <div className="min-h-screen bg-slate-950 p-8 text-slate-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Executive Department Inbox</h1>
          <Link href="/dashboard" className="text-sm text-cyan-400 hover:underline">
            ← Dashboard
          </Link>
        </div>

        {isExecutiveAdmin ? (
          <p className="mb-4 text-sm text-amber-200/80">
            Executive admin mode: send a <strong className="font-medium text-amber-100">direct message</strong> to one
            approved account or <strong className="font-medium text-amber-100">broadcast</strong> to all. Attach a{" "}
            <strong className="font-medium text-amber-100">Vercel/Next.js website project ZIP</strong> so recipients can
            open it in Site Builder (requires <code className="text-amber-100/80">site.builder-schema.json</code> inside
            the ZIP — included automatically when you export from Site Builder) or download for local deploy.
          </p>
        ) : (
          <p className="mb-4 text-sm text-slate-400">
            Message the Executive Administration team. Broadcasts and direct replies from leadership appear in your
            thread below.
          </p>
        )}

        {error ? <p className="mb-3 text-sm text-amber-300">{error}</p> : null}

        {isExecutiveAdmin ? (
          <ExecutiveInboxRecipientPicker
            className="mb-4"
            recipients={recipients}
            broadcast={broadcast}
            onBroadcastChange={setBroadcast}
            target={target}
            onTargetChange={setTarget}
            filter={recipientFilter}
            onFilterChange={setRecipientFilter}
          />
        ) : null}

        <textarea
          className="mb-2 min-h-[120px] w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
          placeholder={
            isExecutiveAdmin
              ? "Message to member(s)… (optional if you attach files or record audio)"
              : "Write your message (optional if you attach files or record audio)…"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <input
          id="exec-inbox-file"
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,audio/*"
          disabled={uploading || pendingAttachments.length >= 5}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f, f.name);
            e.target.value = "";
          }}
        />
        <input
          id="exec-inbox-zip"
          type="file"
          className="sr-only"
          accept=".zip,application/zip,application/x-zip-compressed"
          disabled={uploading || pendingAttachments.length >= 5}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFile(f, f.name);
            e.target.value = "";
          }}
        />
        <div className="mb-3 flex flex-wrap gap-2">
          {isExecutiveAdmin ? (
            <label
              htmlFor="exec-inbox-zip"
              className={`cursor-pointer rounded-xl border border-cyan-500/45 bg-cyan-950/40 px-3 py-2 text-xs font-medium text-cyan-100 hover:bg-cyan-900/50 ${
                uploading || pendingAttachments.length >= 5 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              {uploading ? "Uploading…" : "Upload website project (.zip)"}
            </label>
          ) : null}
          <label
            htmlFor="exec-inbox-file"
            className={`cursor-pointer rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 ${
              uploading || pendingAttachments.length >= 5 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            {uploading ? "Uploading…" : "Attach file"}
          </label>
          <button
            type="button"
            onClick={() => (recording ? stopRecording() : void startRecording())}
            disabled={uploading || pendingAttachments.length >= 5}
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              recording
                ? "border-rose-500/60 bg-rose-950/40 text-rose-200"
                : "border-slate-600 bg-slate-900/80 text-slate-200 hover:bg-slate-800"
            } disabled:opacity-40`}
          >
            {recording ? "Stop recording" : "Record voice"}
          </button>
          <span className="self-center text-[10px] text-slate-500">
            Max 5 · 12 MB files · 50 MB website ZIP
          </span>
        </div>
        {pendingAttachments.length ? (
          <div className="mb-3 rounded-xl border border-slate-700/60 bg-slate-900/40 px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Ready to send</div>
            <ExecutiveInboxAttachmentsList items={pendingAttachments} />
            <button
              type="button"
              className="mt-2 text-xs text-rose-300 hover:underline"
              onClick={() => setPendingAttachments([])}
            >
              Clear attachments
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => void send()}
          className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          Send
        </button>

        <h2 className="mt-10 text-sm font-semibold text-slate-300">
          {isExecutiveAdmin ? "Department thread (all traffic)" : "Conversation"}
        </h2>
        <p className="mb-2 text-[10px] text-slate-500">Oldest at top</p>
        <ul className="mt-3 space-y-4 text-sm">
          {chron.map((m, i) => {
            const mine = !isExecutiveAdmin && m.kind === "user_to_executive";
            const align = mine ? "items-end" : "items-start";
            const bubble = mine
              ? "border-cyan-700/50 bg-cyan-950/35"
              : "border-slate-700 bg-slate-900/50";
            const routing = isExecutiveAdmin
              ? adminRoutingLine(m, recipients, directory)
              : memberRoutingLine(m, directory);
            return (
              <li key={String(m.id ?? i)} className={`flex flex-col ${align}`}>
                <div className={`max-w-[min(100%,28rem)] rounded-2xl border px-3 py-2 shadow-sm ${bubble}`}>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{routing}</span>
                  <div className="mt-0.5 text-[10px] text-slate-500">{formatExecutiveInboxTimestamp(m.createdAt)}</div>
                  {String(m.bodyText ?? "").trim() ? (
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.bodyText}</div>
                  ) : (
                    <div className="mt-2 text-[11px] italic text-slate-500">(Attachment only)</div>
                  )}
                  <ExecutiveInboxAttachmentsList items={parseInboxAttachmentsJson(m.attachmentsJson)} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
