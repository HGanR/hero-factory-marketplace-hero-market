"use client";

import React, { useState } from "react";
import type { PublicDestination } from "@/hooks/useMeetBroadcast";
import { getProviderCapabilities } from "@/lib/streaming/provider-capabilities";
import { STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED } from "@/lib/streaming/destinations";
import { BroadcastProviderBadges } from "./BroadcastProviderBadges";

const PLATFORMS = ["twitch", "instagram", "facebook", "tiktok", "pumpfun", "custom"] as const;

type FormState = {
  platform: string;
  label: string;
  serverUrl: string;
  streamKey: string;
  orientationPreference: string;
  isActive: boolean;
};

const emptyForm: FormState = {
  platform: "twitch",
  label: "",
  serverUrl: "",
  streamKey: "",
  orientationPreference: "auto",
  isActive: true,
};

export function MeetDestinationsPanel({
  destinations,
  loading,
  onSaved,
  onDelete,
  onTest,
  error,
  encryptionConfigured = true,
}: {
  destinations: PublicDestination[];
  loading: boolean;
  onSaved: () => void;
  onDelete: (id: number) => Promise<void>;
  onTest: (id: number) => Promise<void>;
  error: string | null;
  /** From GET /api/stream-destinations — when false, POST/PATCH cannot persist stream keys. */
  encryptionConfigured?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setLocalErr(null);
    setOpen(true);
  }

  function openEdit(d: PublicDestination) {
    setEditingId(d.id);
    setForm({
      platform: d.platform,
      label: d.label,
      serverUrl: d.serverUrl,
      streamKey: "",
      orientationPreference: d.orientationPreference,
      isActive: d.isActive,
    });
    setLocalErr(null);
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    setLocalErr(null);
    try {
      const payload = {
        platform: form.platform,
        label: form.label,
        serverUrl: form.serverUrl,
        orientationPreference: form.orientationPreference,
        isActive: form.isActive,
        ...(form.streamKey.trim() ? { streamKey: form.streamKey.trim() } : {}),
      };
      if (!editingId && !form.streamKey.trim()) {
        setLocalErr("Stream key is required for new destinations.");
        setSaving(false);
        return;
      }
      const url = editingId ? `/api/stream-destinations/${editingId}` : "/api/stream-destinations";
      const method = editingId ? "PATCH" : "POST";
      const body =
        editingId && !form.streamKey.trim()
          ? {
              platform: form.platform,
              label: form.label,
              serverUrl: form.serverUrl,
              orientationPreference: form.orientationPreference,
              isActive: form.isActive,
            }
          : editingId
            ? { ...payload, streamKey: form.streamKey.trim() }
            : { ...payload, streamKey: form.streamKey.trim() };

      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      if (!res.ok) {
        const msg =
          data.code === STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED
            ? `${data.error ?? "Encryption not configured."} This is a server configuration issue — the operator cannot fix it from this screen.`
            : (data.error ?? "Save failed");
        setLocalErr(msg);
        setSaving(false);
        return;
      }
      setOpen(false);
      onSaved();
    } catch {
      setLocalErr("Network error");
    } finally {
      setSaving(false);
    }
  }

  const anyBestEffort = destinations.some((d) => !getProviderCapabilities(d.platform).isStableIngest);
  const editingRow = editingId != null ? destinations.find((d) => d.id === editingId) : null;
  const canPersistSecrets = encryptionConfigured;

  return (
    <div className="space-y-2" data-testid="meet-destinations-panel">
      {!encryptionConfigured ? (
        <div
          className="text-[11px] text-red-200/95 bg-red-950/40 border border-red-800/60 rounded p-2 leading-snug"
          role="alert"
          data-testid="meet-destinations-encryption-banner"
        >
          <strong className="text-red-100">Cannot save stream destinations.</strong> The server is missing{" "}
          <code className="text-red-100/90">STREAM_DESTINATION_ENCRYPTION_KEY</code> (32-byte secret, base64 or hex). Add
          it to the deployment environment and restart the app. Until then, credentials you enter are not stored — Save
          will fail with an error inside the dialog.
        </div>
      ) : null}
      {anyBestEffort ? (
        <div
          className="text-[10px] text-amber-200/95 bg-amber-950/35 border border-amber-700/45 rounded p-2 leading-snug"
          data-testid="meet-broadcast-capability-summary"
        >
          <strong className="text-amber-100">Some destinations use best-effort ingest.</strong> See per-row badges
          and <code className="text-amber-50/90">docs/meet-broadcast-runbook.md</code> in the repo for platform
          behavior. Prefer <strong>custom</strong> with a current RTMP URL when a preset breaks.
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-300">Saved destinations</span>
        <button
          type="button"
          onClick={openCreate}
          className="text-xs px-2 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-white"
          data-testid="meet-destination-add-button"
        >
          Add
        </button>
      </div>
      {loading ? <p className="text-xs text-slate-500">Loading…</p> : null}
      <ul className="space-y-1 max-h-40 overflow-y-auto text-sm">
        {destinations.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between gap-2 bg-slate-900/60 rounded px-2 py-1 border border-slate-700/80"
          >
            <div className="min-w-0">
              <div className="truncate text-slate-200">{d.label || d.platform}</div>
              <div className="text-[10px] text-slate-500 truncate">
                {d.platform} · ****{d.streamKeyLast4}
              </div>
              <BroadcastProviderBadges platform={d.platform} compact />
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => void onTest(d.id)}
              >
                Test
              </button>
              <button
                type="button"
                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => openEdit(d)}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/60 hover:bg-red-800/80"
                onClick={() => void onDelete(d.id)}
              >
                Del
              </button>
            </div>
          </li>
        ))}
        {!loading && destinations.length === 0 ? (
          <li className="text-xs text-slate-500">No destinations yet.</li>
        ) : null}
      </ul>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="meet-destination-modal-backdrop"
        >
          <div className="bg-slate-900 border border-slate-600 rounded-lg p-4 w-full max-w-md shadow-xl space-y-3">
            <h3 className="text-sm font-semibold text-white">{editingId ? "Edit destination" : "Add destination"}</h3>
            {!canPersistSecrets ? (
              <div
                className="text-[11px] text-amber-100/95 bg-amber-950/50 border border-amber-700/50 rounded p-2"
                role="alert"
              >
                Saving is disabled: server encryption is not configured. Set{" "}
                <code className="text-amber-50">STREAM_DESTINATION_ENCRYPTION_KEY</code> and restart.
              </div>
            ) : null}
            {localErr ? (
              <div
                className="text-[11px] text-red-100 bg-red-950/50 border border-red-800/60 rounded p-2 whitespace-pre-wrap"
                role="alert"
                data-testid="meet-destination-save-error"
              >
                {localErr}
              </div>
            ) : null}
            <label className="block text-xs text-slate-400">
              Platform
              <select
                className="mt-1 w-full rounded bg-slate-800 border border-slate-600 text-sm p-2 text-white"
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <BroadcastProviderBadges platform={form.platform} />
            </label>
            <label className="block text-xs text-slate-400">
              Label
              <input
                className="mt-1 w-full rounded bg-slate-800 border border-slate-600 text-sm p-2 text-white"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </label>
            <label className="block text-xs text-slate-400">
              Server URL (optional for Twitch/Instagram/TikTok defaults)
              <input
                className="mt-1 w-full rounded bg-slate-800 border border-slate-600 text-sm p-2 text-white"
                value={form.serverUrl}
                onChange={(e) => setForm((f) => ({ ...f, serverUrl: e.target.value }))}
                placeholder="rtmp://…"
              />
              {!editingId && form.platform !== "custom" && !form.serverUrl.trim() ? (
                <span className="block mt-1 text-[10px] text-slate-500">
                  Leave empty to use the built-in ingest URL for this platform. Paste a URL only if your provider gives
                  a different endpoint.
                </span>
              ) : null}
              {editingRow && form.serverUrl.trim() === "" && form.platform !== "custom" ? (
                <span className="block mt-1 text-[10px] text-slate-500">
                  Stored URL may be empty when defaults apply; the row still has a saved stream key (see list: ****
                  {editingRow.streamKeyLast4}).
                </span>
              ) : null}
            </label>
            <label className="block text-xs text-slate-400">
              Stream key {editingId ? "(leave blank to keep existing)" : ""}
              <input
                type="password"
                autoComplete="off"
                data-testid="meet-destination-stream-key-input"
                className="mt-1 w-full rounded bg-slate-800 border border-slate-600 text-sm p-2 text-white"
                value={form.streamKey}
                onChange={(e) => setForm((f) => ({ ...f, streamKey: e.target.value }))}
              />
              {editingRow ? (
                <span className="block mt-1 text-[10px] text-slate-500">
                  A key is already saved (ends in ****{editingRow.streamKeyLast4}). The field is empty for security —
                  type a new key only to replace it.
                </span>
              ) : null}
            </label>
            <label className="block text-xs text-slate-400">
              Orientation preference
              <select
                className="mt-1 w-full rounded bg-slate-800 border border-slate-600 text-sm p-2 text-white"
                value={form.orientationPreference}
                onChange={(e) => setForm((f) => ({ ...f, orientationPreference: e.target.value }))}
              >
                <option value="auto">auto</option>
                <option value="portrait">portrait</option>
                <option value="landscape">landscape</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              Active (included when broadcasting)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="text-sm px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600"
                onClick={() => {
                  setOpen(false);
                  setLocalErr(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !canPersistSecrets}
                title={
                  !canPersistSecrets
                    ? "Server missing STREAM_DESTINATION_ENCRYPTION_KEY — credentials cannot be stored"
                    : undefined
                }
                className="text-sm px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
                onClick={() => void submit()}
                data-testid="meet-destination-save"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
