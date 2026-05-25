"use client";

import { useCallback, useState } from "react";
import {
  NEURO_ASSIGNED_AGENTS,
  NEURO_SUBJECT_AREAS,
  type NeuroAssignedAgent,
  type NeuroSubjectArea,
} from "@/lib/executive-agent/neuro/neuro-types";
import { useNeuroHud } from "./neuro-hud-context";

type Props = {
  onUploaded?: () => void;
};

export function NeuroDocumentUploadPanel({ onUploaded }: Props) {
  const { refreshOverview } = useNeuroHud();
  const [title, setTitle] = useState("");
  const [subjectArea, setSubjectArea] = useState<NeuroSubjectArea>("GENERAL");
  const [assignedAgent, setAssignedAgent] = useState<NeuroAssignedAgent>("GENERAL");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setBusy(true);
      setMsg(null);
      try {
        const fd = new FormData();
        fd.set("file", file);
        if (title.trim()) fd.set("title", title.trim());
        fd.set("subjectArea", subjectArea);
        fd.set("assignedAgent", assignedAgent);
        const r = await fetch("/api/admin/executive-agent/neuro/documents/upload", {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const j = (await r.json()) as { error?: string; documentId?: string };
        if (!r.ok) throw new Error(j.error ?? `Upload failed (${r.status})`);
        setMsg("Uploaded — indexing in background.");
        setTitle("");
        await refreshOverview();
        onUploaded?.();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [assignedAgent, onUploaded, refreshOverview, subjectArea, title]
  );

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-950/10 p-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200/90">
        Upload NEURO source
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional)"
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[11px] text-slate-200"
        />
        <select
          value={subjectArea}
          onChange={(e) => setSubjectArea(e.target.value as NeuroSubjectArea)}
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[11px] text-slate-200"
        >
          {NEURO_SUBJECT_AREAS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={assignedAgent}
          onChange={(e) => setAssignedAgent(e.target.value as NeuroAssignedAgent)}
          className="rounded-lg border border-slate-700 bg-slate-950/60 px-2 py-1.5 text-[11px] text-slate-200"
        >
          {NEURO_ASSIGNED_AGENTS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-cyan-500/40 bg-cyan-950/10 px-2 py-2 text-[10px] font-medium text-cyan-200 hover:bg-cyan-950/20">
          {busy ? "Uploading…" : "Choose file (PDF, TXT, MD, DOCX)"}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md,.docx,.doc,application/pdf,text/plain,text/markdown"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {msg ? <p className="mt-2 text-[10px] text-slate-400">{msg}</p> : null}
    </div>
  );
}
