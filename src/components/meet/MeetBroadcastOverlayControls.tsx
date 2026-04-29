"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { BroadcastOverlaySummary } from "@/hooks/useMeetBroadcast";
import {
  getDefaultCtaBanner,
  getDefaultLowerThird,
  getDefaultTicker,
  type BroadcastCtaBanner,
  type BroadcastLowerThird,
  type BroadcastTicker,
} from "@/lib/meet/broadcast-overlays";
import { BroadcastLowerThirdEditor } from "./BroadcastLowerThirdEditor";
import { BroadcastTickerEditor } from "./BroadcastTickerEditor";
import { BroadcastCtaBannerEditor } from "./BroadcastCtaBannerEditor";
import { BroadcastGuestCardList } from "./BroadcastGuestCardList";
import { buildLowerThirdFromGuestCard, type BroadcastGuestCard } from "@/lib/meet/broadcast-guest-cards";

type OverlayDraft = {
  lowerThird: BroadcastLowerThird;
  ticker: BroadcastTicker;
  ctaBanner: BroadcastCtaBanner;
};

export function MeetBroadcastOverlayControls({
  broadcastSessionId,
  hostWalletAddress,
  templateActive,
  overlaySummary,
  fetchOverlayState,
  updateOverlayState,
  resetOverlayState,
  realtimeSyncKey = 0,
}: {
  broadcastSessionId: number;
  hostWalletAddress: string;
  templateActive: boolean;
  overlaySummary: BroadcastOverlaySummary | null | undefined;
  fetchOverlayState: (id: number) => Promise<{ ok: boolean; state?: unknown; error?: string; code?: string }>;
  updateOverlayState: (id: number, patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string; code?: string }>;
  resetOverlayState: (id: number) => Promise<{ ok: boolean; error?: string; code?: string }>;
  /** From `useMeetBroadcast.broadcastRefreshSignal` — refetch overlay draft on V2 realtime hints. */
  realtimeSyncKey?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [overlayPackOptions, setOverlayPackOptions] = useState<{ id: number; name: string }[]>([]);
  const [guestPackOptions, setGuestPackOptions] = useState<{ id: number; name: string }[]>([]);
  const [selectedOverlayPackId, setSelectedOverlayPackId] = useState<string>("");
  const [selectedGuestPackId, setSelectedGuestPackId] = useState<string>("");
  const [guestCardsInPack, setGuestCardsInPack] = useState<BroadcastGuestCard[]>([]);
  const [draft, setDraft] = useState<OverlayDraft>({
    lowerThird: getDefaultLowerThird(),
    ticker: getDefaultTicker(),
    ctaBanner: getDefaultCtaBanner(),
  });

  const syncFromServer = useCallback(
    async (sid: number) => {
      const r = await fetchOverlayState(sid);
      if (!r.ok || !r.state || typeof r.state !== "object") return;
      const s = r.state as Record<string, unknown>;
      setDraft({
        lowerThird: { ...getDefaultLowerThird(), ...(s.lowerThird as object) } as BroadcastLowerThird,
        ticker: { ...getDefaultTicker(), ...(s.ticker as object) } as BroadcastTicker,
        ctaBanner: { ...getDefaultCtaBanner(), ...(s.ctaBanner as object) } as BroadcastCtaBanner,
      });
    },
    [fetchOverlayState]
  );

  useEffect(() => {
    if (templateActive && broadcastSessionId) void syncFromServer(broadcastSessionId);
  }, [templateActive, broadcastSessionId, syncFromServer, realtimeSyncKey]);

  useEffect(() => {
    if (!templateActive) return;
    let cancelled = false;
    const q = new URLSearchParams();
    if (hostWalletAddress) q.set("hostWallet", hostWalletAddress);
    void Promise.all([
      fetch(`/api/meet/broadcast/overlay-packs?${q}`, { credentials: "include" }),
      fetch(`/api/meet/broadcast/guest-card-packs?${q}`, { credentials: "include" }),
    ]).then(async ([opRes, gpRes]) => {
      if (cancelled) return;
      const op = (await opRes.json().catch(() => ({}))) as { packs?: { id: number; name: string }[] };
      const gp = (await gpRes.json().catch(() => ({}))) as { packs?: { id: number; name: string }[] };
      if (opRes.ok) setOverlayPackOptions(op.packs ?? []);
      if (gpRes.ok) setGuestPackOptions(gp.packs ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [templateActive, hostWalletAddress]);

  useEffect(() => {
    if (!selectedGuestPackId) {
      setGuestCardsInPack([]);
      return;
    }
    let cancelled = false;
    const q = new URLSearchParams();
    if (hostWalletAddress) q.set("hostWallet", hostWalletAddress);
    void fetch(`/api/meet/broadcast/guest-card-packs/${selectedGuestPackId}?${q}`, { credentials: "include" }).then(async (res) => {
      const data = (await res.json().catch(() => ({}))) as {
        pack?: { guestCardsJson?: { cards?: BroadcastGuestCard[] } };
      };
      if (cancelled || !res.ok) return;
      setGuestCardsInPack(data.pack?.guestCardsJson?.cards ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedGuestPackId, hostWalletAddress]);

  const onApply = async () => {
    setBusy(true);
    setLocalErr(null);
    const r = await updateOverlayState(broadcastSessionId, {
      lowerThird: draft.lowerThird,
      ticker: draft.ticker,
      ctaBanner: draft.ctaBanner,
    });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Update failed");
    setBusy(false);
  };

  const onApplyOverlayPackLive = async () => {
    if (!selectedOverlayPackId) return;
    setBusy(true);
    setLocalErr(null);
    const r = await updateOverlayState(broadcastSessionId, {
      applyOverlayPackId: Number(selectedOverlayPackId),
    });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Apply pack failed");
    else await syncFromServer(broadcastSessionId);
    setBusy(false);
  };

  const onApplyGuestToEditor = (card: BroadcastGuestCard) => {
    setDraft((d) => ({
      ...d,
      lowerThird: buildLowerThirdFromGuestCard(card, d.lowerThird),
    }));
  };

  const onApplyGuestLive = async (card: BroadcastGuestCard) => {
    if (!selectedGuestPackId) return;
    setBusy(true);
    setLocalErr(null);
    const r = await updateOverlayState(broadcastSessionId, {
      guestCardPackId: Number(selectedGuestPackId),
      guestCardId: card.id,
    });
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Apply guest failed");
    else await syncFromServer(broadcastSessionId);
    setBusy(false);
  };

  const onReset = async () => {
    setBusy(true);
    setLocalErr(null);
    const r = await resetOverlayState(broadcastSessionId);
    if (!r.ok) setLocalErr(r.error ?? r.code ?? "Reset failed");
    else await syncFromServer(broadcastSessionId);
    setBusy(false);
  };

  if (!templateActive) {
    return (
      <div
        className="mt-3 rounded border border-slate-800 bg-slate-950/40 px-2 py-2 text-[11px] text-slate-500"
        data-testid="meet-broadcast-overlay-disabled"
      >
        Overlay graphics (lower third, ticker, CTA) are V2-only and require the rendered compositor template to be
        active.
      </div>
    );
  }

  return (
    <div
      className="mt-3 rounded border border-slate-700/80 bg-slate-950/50 px-2 py-2 space-y-2"
      data-testid="meet-broadcast-overlay-controls"
    >
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Overlays (V2)</div>
      {localErr ? <p className="text-[11px] text-red-300">{localErr}</p> : null}
      {overlaySummary?.updatedAt ? (
        <p className="text-[10px] text-slate-500">
          Last overlay update: {new Date(overlaySummary.updatedAt).toLocaleString()}
        </p>
      ) : (
        <p className="text-[10px] text-slate-500">No persisted overlay overrides — defaults (all off).</p>
      )}
      <p className="text-[10px] text-slate-500">
        On-air: LT {overlaySummary?.lowerThirdVisible ? "on" : "off"} · Ticker {overlaySummary?.tickerVisible ? "on" : "off"}{" "}
        · CTA {overlaySummary?.ctaBannerVisible ? "on" : "off"}
      </p>

      <div className="rounded border border-slate-800/80 p-2 space-y-2" data-testid="broadcast-overlay-preset-apply">
        <div className="text-[10px] uppercase tracking-wide text-slate-500">Preset packs (explicit apply)</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-500">
            Overlay pack
            <select
              value={selectedOverlayPackId}
              onChange={(e) => setSelectedOverlayPackId(e.target.value)}
              className="mt-0.5 block w-40 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
            >
              <option value="">—</option>
              {overlayPackOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy || !selectedOverlayPackId}
            onClick={() => void onApplyOverlayPackLive()}
            className="rounded bg-violet-800/90 px-2 py-1 text-[10px] text-white hover:bg-violet-700/90 disabled:opacity-40"
            data-testid="broadcast-overlay-apply-pack"
          >
            Merge pack → live
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[10px] text-slate-500">
            Guest card pack
            <select
              value={selectedGuestPackId}
              onChange={(e) => setSelectedGuestPackId(e.target.value)}
              className="mt-0.5 block w-40 rounded bg-slate-950 border border-slate-700 px-2 py-1 text-xs"
            >
              <option value="">—</option>
              {guestPackOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <BroadcastGuestCardList
          cards={guestCardsInPack}
          disabled={busy}
          onApplyToEditor={onApplyGuestToEditor}
          onApplyLive={onApplyGuestLive}
        />
      </div>

      <BroadcastLowerThirdEditor
        disabled={busy}
        value={draft.lowerThird}
        onChange={(p) => setDraft((d) => ({ ...d, lowerThird: { ...d.lowerThird, ...p } }))}
      />
      <BroadcastTickerEditor
        disabled={busy}
        value={draft.ticker}
        onChange={(p) => setDraft((d) => ({ ...d, ticker: { ...d.ticker, ...p } }))}
      />
      <BroadcastCtaBannerEditor
        disabled={busy}
        value={draft.ctaBanner}
        onChange={(p) => setDraft((d) => ({ ...d, ctaBanner: { ...d.ctaBanner, ...p } }))}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onApply()}
          className="rounded bg-cyan-800 px-2 py-1 text-[11px] text-white hover:bg-cyan-700 disabled:opacity-40"
          data-testid="broadcast-overlay-apply"
        >
          Apply overlays
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onReset()}
          className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          data-testid="broadcast-overlay-reset"
        >
          Reset overlays
        </button>
      </div>
    </div>
  );
}
