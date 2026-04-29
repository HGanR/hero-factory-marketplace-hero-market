"use client";

import React, { useCallback, useEffect, useState } from "react";

const DEFAULT_CARDS = `{\n  "cards": [\n    {\n      "id": "guest_1",\n      "displayName": "Guest Name",\n      "title": "Role",\n      "company": "Company"\n    }\n  ]\n}`;

export function BroadcastGuestCardPackEditor({
  hostWalletAddress,
  editingId,
  initialJson,
  initialName,
  initialDescription,
  onCancel,
  onSaved,
}: {
  hostWalletAddress: string;
  editingId: number | null;
  initialJson?: string;
  initialName?: string;
  initialDescription?: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [raw, setRaw] = useState(DEFAULT_CARDS);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(initialName ?? "");
    setDescription(initialDescription ?? "");
    setRaw(initialJson ?? DEFAULT_CARDS);
  }, [initialJson, initialName, initialDescription, editingId]);

  const submit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    let guestCardsJson: unknown;
    try {
      guestCardsJson = JSON.parse(raw) as unknown;
    } catch {
      setErr("Invalid JSON");
      setBusy(false);
      return;
    }
    const body = {
      name: name.trim(),
      description: description.trim() || null,
      guestCardsJson,
      hostWallet: hostWalletAddress || undefined,
    };
    const url = editingId != null ? `/api/meet/broadcast/guest-card-packs/${editingId}` : "/api/meet/broadcast/guest-card-packs";
    const res = await fetch(url, {
      method: editingId != null ? "PATCH" : "POST",
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
    onCancel();
    setBusy(false);
  }, [name, description, raw, editingId, hostWalletAddress, onSaved, onCancel]);

  return (
    <div className="text-[11px] space-y-2 border border-slate-700/80 rounded p-2 bg-slate-950/40" data-testid="broadcast-guest-card-pack-editor">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{editingId != null ? "Edit guest card pack" : "New guest card pack"}</div>
      <input
        type="text"
        placeholder="Pack name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
      />
      <input
        type="text"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
      />
      <label className="block text-[10px] text-slate-500">
        guestCardsJson
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={10} className="mt-0.5 w-full font-mono text-[10px] rounded bg-slate-950 border border-slate-700 px-2 py-1" />
      </label>
      {err ? <p className="text-[10px] text-red-300">{err}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={() => void submit()}
          className="text-[10px] px-2 py-1 rounded bg-emerald-800/80 hover:bg-emerald-700/80 disabled:opacity-40"
        >
          {busy ? "…" : "Save"}
        </button>
        <button type="button" disabled={busy} onClick={onCancel} className="text-[10px] px-2 py-1 rounded bg-slate-700">
          Cancel
        </button>
      </div>
    </div>
  );
}
