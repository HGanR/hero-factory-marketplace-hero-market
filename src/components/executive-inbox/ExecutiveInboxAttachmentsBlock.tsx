"use client";

import { useState } from "react";
import {
  downloadExecutiveInboxSiteProject,
  isExecutiveInboxSiteProjectAttachment,
  openExecutiveInboxSiteProjectInBuilder,
  type ExecutiveInboxDisplayAttachment,
} from "@/lib/executive-inbox/executive-inbox-site-project-client";

export type { ExecutiveInboxDisplayAttachment };

export function formatExecutiveInboxTimestamp(iso: unknown): string {
  if (typeof iso !== "string" || !iso.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function parseInboxAttachmentsJson(raw: unknown): ExecutiveInboxDisplayAttachment[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const j = JSON.parse(raw) as unknown;
    if (!Array.isArray(j)) return [];
    const out: ExecutiveInboxDisplayAttachment[] = [];
    for (const row of j) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const kindRaw = o.kind;
      const kind =
        kindRaw === "audio" || kindRaw === "file" || kindRaw === "site_project" ? kindRaw : "file";
      const filename = typeof o.filename === "string" ? o.filename : "file";
      const mimeType = typeof o.mimeType === "string" ? o.mimeType : "";
      const sizeBytes = typeof o.sizeBytes === "number" ? o.sizeBytes : 0;
      const url = typeof o.url === "string" ? o.url : "";
      const projectType = o.projectType === "vercel_nextjs" ? "vercel_nextjs" : undefined;
      if (!id || !url.startsWith("https://")) continue;
      out.push({ id, kind, filename, mimeType, sizeBytes, url, ...(projectType ? { projectType } : {}) });
    }
    return out;
  } catch {
    return [];
  }
}

function SiteProjectAttachmentActions({
  attachment,
  compact,
}: {
  attachment: ExecutiveInboxDisplayAttachment;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const textCls = compact ? "text-[10px]" : "text-xs";

  return (
    <li className={`rounded-lg border border-cyan-500/25 bg-cyan-950/20 p-2 ${textCls}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-cyan-400/35 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-cyan-200">
          Website project
        </span>
        <span className="font-medium text-slate-200">{attachment.filename}</span>
        {attachment.sizeBytes > 0 ? (
          <span className="text-slate-500">{(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
        ) : null}
      </div>
      <p className="mt-1 text-slate-400">
        Vercel / Next.js handoff — open in Site Builder to edit with the assistant, or download for local / Cursor deploy.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setActionError(null);
            setBusy(true);
            void openExecutiveInboxSiteProjectInBuilder(attachment).then((r) => {
              setBusy(false);
              if (!r.ok) setActionError(r.error ?? "Import failed.");
            });
          }}
          className="rounded-lg border border-cyan-400/45 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 hover:bg-cyan-500/25 disabled:opacity-40"
        >
          {busy ? "Opening…" : "Open in Site Builder"}
        </button>
        <button
          type="button"
          onClick={() => downloadExecutiveInboxSiteProject(attachment)}
          className="rounded-lg border border-slate-600 bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 hover:bg-slate-800"
        >
          Download project
        </button>
      </div>
      {actionError ? <p className="mt-2 text-amber-200/90">{actionError}</p> : null}
    </li>
  );
}

export function ExecutiveInboxAttachmentsList({
  items,
  compact,
}: {
  items: ExecutiveInboxDisplayAttachment[];
  compact?: boolean;
}) {
  if (!items.length) return null;
  const textCls = compact ? "text-[10px]" : "text-xs";
  return (
    <ul className={`mt-2 space-y-2 ${compact ? "max-w-full" : ""}`}>
      {items.map((a) => {
        if (isExecutiveInboxSiteProjectAttachment(a)) {
          return <SiteProjectAttachmentActions key={a.id} attachment={a} compact={compact} />;
        }
        if (a.kind === "audio") {
          return (
            <li key={a.id} className="rounded-lg border border-slate-700/60 bg-slate-950/50 p-2">
              <div className={`mb-1 font-medium text-slate-400 ${textCls}`}>Voice message</div>
              <audio controls src={a.url} className="h-9 w-full max-w-md" preload="metadata" />
              <div className={`mt-1 text-slate-500 ${textCls}`}>{a.filename}</div>
            </li>
          );
        }
        return (
          <li key={a.id} className={`flex flex-wrap items-center gap-2 ${textCls}`}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-cyan-400 underline decoration-cyan-400/40 hover:text-cyan-300"
            >
              {a.filename}
            </a>
            <span className="text-slate-500">
              {a.mimeType}
              {a.sizeBytes > 0 ? ` · ${(a.sizeBytes / 1024).toFixed(0)} KB` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
