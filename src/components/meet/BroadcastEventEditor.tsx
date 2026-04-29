"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { UpcomingBroadcastEventRow } from "./BroadcastUpcomingEventsCard";

type ScenePresetOpt = { id: number; name: string };
type TemplateOpt = { id: number; name: string };
type ShowPackageOpt = { id: number; name: string };

function isoToDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(local: string): string {
  const t = new Date(local).getTime();
  if (Number.isNaN(t)) return new Date().toISOString();
  return new Date(t).toISOString();
}

export function BroadcastEventEditor({
  hostWalletAddress,
  defaultRoomId,
  editing,
  scenePresets,
  timelineTemplates,
  showPackages,
  onCancelEdit,
  onSaved,
}: {
  hostWalletAddress: string;
  defaultRoomId: string;
  editing: UpcomingBroadcastEventRow | null;
  scenePresets: ScenePresetOpt[];
  timelineTemplates: TemplateOpt[];
  showPackages: ShowPackageOpt[];
  onCancelEdit: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [scenePresetId, setScenePresetId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [showPackageId, setShowPackageId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setStartLocal(isoToDatetimeLocal(editing.scheduledStartIso));
      setRoomId(editing.roomId ?? defaultRoomId);
      setScenePresetId(editing.scenePresetId != null ? String(editing.scenePresetId) : "");
      setTemplateId(editing.defaultTimelineTemplateId != null ? String(editing.defaultTimelineTemplateId) : "");
      setShowPackageId(editing.showPackageId != null ? String(editing.showPackageId) : "");
    } else {
      setTitle("");
      setStartLocal(isoToDatetimeLocal(new Date(Date.now() + 3600_000).toISOString()));
      setRoomId(defaultRoomId);
      setScenePresetId("");
      setTemplateId("");
      setShowPackageId("");
    }
  }, [editing, defaultRoomId]);

  const submit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const body: Record<string, unknown> = {
      title: title.trim(),
      scheduledStartIso: datetimeLocalToIso(startLocal),
      roomId: roomId.trim() || null,
      hostWallet: hostWalletAddress || undefined,
      status: "scheduled",
    };
    if (editing) {
      body.scenePresetId = scenePresetId ? Number(scenePresetId) : null;
      body.defaultTimelineTemplateId = templateId ? Number(templateId) : null;
      body.showPackageId = showPackageId ? Number(showPackageId) : null;
    } else {
      if (scenePresetId) body.scenePresetId = Number(scenePresetId);
      if (templateId) body.defaultTimelineTemplateId = Number(templateId);
      if (showPackageId) body.showPackageId = Number(showPackageId);
    }

    const url = editing ? `/api/meet/broadcast/events/${editing.id}` : "/api/meet/broadcast/events";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setErr(data.error ?? "Save failed");
      setBusy(false);
      return;
    }
    onSaved();
    onCancelEdit();
    setBusy(false);
  }, [title, startLocal, roomId, scenePresetId, templateId, showPackageId, editing, hostWalletAddress, onSaved, onCancelEdit]);

  return (
    <div className="text-[11px] space-y-2 border border-slate-700/80 rounded p-2 bg-slate-950/40" data-testid="broadcast-event-editor">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {editing ? "Edit event" : "New broadcast event"}
      </div>
      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(ev) => setTitle(ev.target.value)}
        className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
      />
      <label className="block text-[10px] text-slate-500">
        Scheduled start (local)
        <input
          type="datetime-local"
          value={startLocal}
          onChange={(ev) => setStartLocal(ev.target.value)}
          className="mt-0.5 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
        />
      </label>
      <input
        type="text"
        placeholder="Room id"
        value={roomId}
        onChange={(ev) => setRoomId(ev.target.value)}
        className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs font-mono"
      />
      <div className="grid grid-cols-1 gap-1">
        <label className="text-[10px] text-slate-500">
          Scene preset (optional)
          <select
            value={scenePresetId}
            onChange={(ev) => setScenePresetId(ev.target.value)}
            className="mt-0.5 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
          >
            <option value="">—</option>
            {scenePresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-slate-500">
          Timeline template (optional)
          <select
            value={templateId}
            onChange={(ev) => setTemplateId(ev.target.value)}
            className="mt-0.5 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
          >
            <option value="">—</option>
            {timelineTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[10px] text-slate-500">
          Show package (optional)
          <select
            value={showPackageId}
            onChange={(ev) => setShowPackageId(ev.target.value)}
            className="mt-0.5 w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
          >
            <option value="">—</option>
            {showPackages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !title.trim() || !startLocal}
          onClick={() => void submit()}
          className="text-[10px] px-2 py-1 rounded bg-emerald-800/80 hover:bg-emerald-700/80 disabled:opacity-40"
        >
          {busy ? "Saving…" : editing ? "Update" : "Create"}
        </button>
        {editing ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancelEdit}
            className="text-[10px] px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
