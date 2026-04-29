"use client";

import React, { useCallback, useEffect, useState } from "react";

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

export function BroadcastOverlayPackEditor({
  hostWalletAddress,
  editingId,
  initial,
  onCancel,
  onSaved,
}: {
  hostWalletAddress: string;
  editingId: number | null;
  initial?: {
    name: string;
    description: string | null;
    lowerThirdPresetJson: Record<string, unknown> | null;
    tickerPresetJson: Record<string, unknown> | null;
    ctaPresetJson: Record<string, unknown> | null;
  } | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ltJson, setLtJson] = useState("{}");
  const [tkJson, setTkJson] = useState("{}");
  const [ctaJson, setCtaJson] = useState("{}");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setDescription(initial.description ?? "");
      setLtJson(JSON.stringify(initial.lowerThirdPresetJson ?? {}, null, 0));
      setTkJson(JSON.stringify(initial.tickerPresetJson ?? {}, null, 0));
      setCtaJson(JSON.stringify(initial.ctaPresetJson ?? {}, null, 0));
    } else {
      setName("");
      setDescription("");
      setLtJson("{}");
      setTkJson("{}");
      setCtaJson("{}");
    }
  }, [initial, editingId]);

  const submit = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const lt = safeJsonParse(ltJson);
    const tk = safeJsonParse(tkJson);
    const cta = safeJsonParse(ctaJson);
    if (lt !== null && (typeof lt !== "object" || Array.isArray(lt))) {
      setErr("Lower third JSON must be an object");
      setBusy(false);
      return;
    }
    if (tk !== null && (typeof tk !== "object" || Array.isArray(tk))) {
      setErr("Ticker JSON must be an object");
      setBusy(false);
      return;
    }
    if (cta !== null && (typeof cta !== "object" || Array.isArray(cta))) {
      setErr("CTA JSON must be an object");
      setBusy(false);
      return;
    }
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      lowerThirdPresetJson: lt === null ? {} : lt,
      tickerPresetJson: tk === null ? {} : tk,
      ctaPresetJson: cta === null ? {} : cta,
      hostWallet: hostWalletAddress || undefined,
    };
    const url = editingId != null ? `/api/meet/broadcast/overlay-packs/${editingId}` : "/api/meet/broadcast/overlay-packs";
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
  }, [name, description, ltJson, tkJson, ctaJson, editingId, hostWalletAddress, onSaved, onCancel]);

  return (
    <div className="text-[11px] space-y-2 border border-slate-700/80 rounded p-2 bg-slate-950/40" data-testid="broadcast-overlay-pack-editor">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{editingId != null ? "Edit overlay pack" : "New overlay pack"}</div>
      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
      />
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
      />
      <label className="block text-[10px] text-slate-500">
        Lower third preset (JSON object)
        <textarea value={ltJson} onChange={(e) => setLtJson(e.target.value)} rows={3} className="mt-0.5 w-full font-mono text-[10px] rounded bg-slate-950 border border-slate-700 px-2 py-1" />
      </label>
      <label className="block text-[10px] text-slate-500">
        Ticker preset (JSON)
        <textarea value={tkJson} onChange={(e) => setTkJson(e.target.value)} rows={2} className="mt-0.5 w-full font-mono text-[10px] rounded bg-slate-950 border border-slate-700 px-2 py-1" />
      </label>
      <label className="block text-[10px] text-slate-500">
        CTA preset (JSON)
        <textarea value={ctaJson} onChange={(e) => setCtaJson(e.target.value)} rows={2} className="mt-0.5 w-full font-mono text-[10px] rounded bg-slate-950 border border-slate-700 px-2 py-1" />
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
