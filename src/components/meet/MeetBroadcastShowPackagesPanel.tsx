"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BroadcastShowPackageEditor, type ShowPackageRow } from "./BroadcastShowPackageEditor";
import { BroadcastOverlayPackEditor } from "./BroadcastOverlayPackEditor";
import { BroadcastGuestCardPackEditor } from "./BroadcastGuestCardPackEditor";

async function parseJson(res: Response) {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function MeetBroadcastShowPackagesPanel({
  roomId,
  hostWalletAddress,
  scenePresets,
  timelineTemplates,
  onInfo,
}: {
  roomId: string;
  hostWalletAddress: string;
  scenePresets: { id: number; name: string }[];
  timelineTemplates: { id: number; name: string }[];
  onInfo?: (msg: string) => void;
}) {
  const q = useCallback(() => {
    const p = new URLSearchParams();
    if (hostWalletAddress) p.set("hostWallet", hostWalletAddress);
    return p.toString();
  }, [hostWalletAddress]);

  const [showPackages, setShowPackages] = useState<ShowPackageRow[]>([]);
  const [overlayPacks, setOverlayPacks] = useState<{ id: number; name: string; description: string | null }[]>([]);
  const [guestPacks, setGuestPacks] = useState<{ id: number; name: string }[]>([]);
  /** null = closed, "new" = create, else edit existing row */
  const [showPackageForm, setShowPackageForm] = useState<"new" | ShowPackageRow | null>(null);
  const [editingOverlayId, setEditingOverlayId] = useState<number | null>(null);
  const [overlayInitial, setOverlayInitial] = useState<Parameters<typeof BroadcastOverlayPackEditor>[0]["initial"]>(null);
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [guestInitial, setGuestInitial] = useState<{ json: string; name: string; description: string } | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const qs = q();
    const [spRes, opRes, gpRes] = await Promise.all([
      fetch(`/api/meet/broadcast/show-packages?${qs}`, { credentials: "include" }),
      fetch(`/api/meet/broadcast/overlay-packs?${qs}`, { credentials: "include" }),
      fetch(`/api/meet/broadcast/guest-card-packs?${qs}`, { credentials: "include" }),
    ]);
    const spData = await parseJson(spRes);
    const opData = await parseJson(opRes);
    const gpData = await parseJson(gpRes);
    if (spRes.ok) setShowPackages((spData.packages as ShowPackageRow[]) ?? []);
    if (opRes.ok) {
      const rows = (opData.packs as { id: number; name: string; description: string | null }[]) ?? [];
      setOverlayPacks(rows.map((r) => ({ id: r.id, name: r.name, description: r.description })));
    }
    if (gpRes.ok) {
      const rows = (gpData.packs as { id: number; name: string }[]) ?? [];
      setGuestPacks(rows.map((r) => ({ id: r.id, name: r.name })));
    }
  }, [q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function previewPackage(id: number) {
    setPreviewBusyId(id);
    const res = await fetch(`/api/meet/broadcast/show-packages/${id}/prepare-defaults`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostWallet: hostWalletAddress || undefined }),
    });
    const data = await parseJson(res);
    setPreviewBusyId(null);
    if (!res.ok) {
      onInfo?.(String(data.error ?? "Preview failed"));
      return;
    }
    const summ = data.showPackageSummary as { name?: string } | undefined;
    const ld = data.launchDefaults as Record<string, unknown> | undefined;
    const parts = [
      summ?.name ? `Package: ${summ.name}` : null,
      ld?.roomId ? `room: ${String(ld.roomId)}` : null,
      ld?.scenePresetId != null ? `scenePreset: ${String(ld.scenePresetId)}` : null,
      ld?.timelineTemplateId != null ? `template: ${String(ld.timelineTemplateId)}` : null,
    ].filter(Boolean);
    onInfo?.(parts.length ? `Preview — ${parts.join(" · ")}` : "Package defaults resolved.");
  }

  async function deleteShow(id: number) {
    if (!confirm("Delete this show package?")) return;
    const qs = q();
    const res = await fetch(`/api/meet/broadcast/show-packages/${id}?${qs}`, { method: "DELETE", credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) onInfo?.(String(data.error ?? "Delete failed"));
    else void refresh();
  }

  async function deleteOverlay(id: number) {
    if (!confirm("Delete this overlay pack?")) return;
    const qs = q();
    const res = await fetch(`/api/meet/broadcast/overlay-packs/${id}?${qs}`, { method: "DELETE", credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) onInfo?.(String(data.error ?? "Delete failed"));
    else void refresh();
  }

  async function deleteGuestPack(id: number) {
    if (!confirm("Delete this guest card pack?")) return;
    const qs = q();
    const res = await fetch(`/api/meet/broadcast/guest-card-packs/${id}?${qs}`, { method: "DELETE", credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) onInfo?.(String(data.error ?? "Delete failed"));
    else void refresh();
  }

  async function loadOverlayForEdit(id: number) {
    const qs = q();
    const res = await fetch(`/api/meet/broadcast/overlay-packs/${id}?${qs}`, { credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) {
      onInfo?.(String(data.error ?? "Load failed"));
      return;
    }
    const pack = data.pack as {
      name: string;
      description: string | null;
      lowerThirdPresetJson: Record<string, unknown> | null;
      tickerPresetJson: Record<string, unknown> | null;
      ctaPresetJson: Record<string, unknown> | null;
    };
    setOverlayInitial({
      name: pack.name,
      description: pack.description,
      lowerThirdPresetJson: pack.lowerThirdPresetJson,
      tickerPresetJson: pack.tickerPresetJson,
      ctaPresetJson: pack.ctaPresetJson,
    });
    setEditingOverlayId(id);
  }

  async function loadGuestForEdit(id: number) {
    const qs = q();
    const res = await fetch(`/api/meet/broadcast/guest-card-packs/${id}?${qs}`, { credentials: "include" });
    const data = await parseJson(res);
    if (!res.ok) {
      onInfo?.(String(data.error ?? "Load failed"));
      return;
    }
    const pack = data.pack as { name: string; description: string | null; guestCardsJson: unknown };
    setGuestInitial({
      name: pack.name,
      description: pack.description ?? "",
      json: JSON.stringify(pack.guestCardsJson ?? { cards: [] }, null, 2),
    });
    setEditingGuestId(id);
  }

  return (
    <div className="mt-3 border-t border-slate-700 pt-3 space-y-3" data-testid="meet-broadcast-show-packages-panel">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">Show packages & presets</div>
      <p className="text-[10px] text-slate-500 leading-snug">
        Bundle launch defaults, overlay styles, and guest identities. Assign a show package on an event (or set one as your account default). Nothing applies to air until you explicitly start or use overlay actions.
      </p>
      <button type="button" className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600" onClick={() => void refresh()}>
        Refresh presets
      </button>

      <section className="space-y-2">
        <div className="text-[10px] text-slate-400 font-medium">Show packages</div>
        {showPackageForm == null ? (
          <button type="button" className="text-[10px] text-sky-400 hover:underline" onClick={() => setShowPackageForm("new")}>
            + New show package
          </button>
        ) : null}
        {showPackageForm != null ? (
          <BroadcastShowPackageEditor
            hostWalletAddress={hostWalletAddress}
            defaultRoomId={roomId}
            scenePresets={scenePresets}
            timelineTemplates={timelineTemplates}
            overlayPacks={overlayPacks}
            guestCardPacks={guestPacks}
            editing={showPackageForm === "new" ? null : showPackageForm}
            onCancel={() => setShowPackageForm(null)}
            onSaved={() => void refresh()}
          />
        ) : null}
        <ul className="space-y-1 text-[10px]">
          {showPackages.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 border border-slate-800 rounded px-2 py-1">
              <span className="text-slate-200">
                {p.name}
                {p.isDefault ? <span className="text-amber-300/90"> (default)</span> : null}
              </span>
              <button type="button" className="text-sky-400 hover:underline" onClick={() => setShowPackageForm(p)}>
                Edit
              </button>
              <button type="button" className="text-sky-400 hover:underline" disabled={previewBusyId === p.id} onClick={() => void previewPackage(p.id)}>
                {previewBusyId === p.id ? "…" : "Preview defaults"}
              </button>
              <button type="button" className="text-red-300/90 hover:underline" onClick={() => void deleteShow(p.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="text-[10px] text-slate-400 font-medium">Overlay packs</div>
        {editingOverlayId === null && overlayInitial === null ? (
          <button type="button" className="text-[10px] text-sky-400 hover:underline" onClick={() => setEditingOverlayId(0)}>
            + New overlay pack
          </button>
        ) : null}
        {editingOverlayId !== null ? (
          <BroadcastOverlayPackEditor
            hostWalletAddress={hostWalletAddress}
            editingId={editingOverlayId > 0 ? editingOverlayId : null}
            initial={editingOverlayId > 0 ? overlayInitial ?? undefined : null}
            onCancel={() => {
              setEditingOverlayId(null);
              setOverlayInitial(null);
            }}
            onSaved={() => void refresh()}
          />
        ) : null}
        <ul className="space-y-1 text-[10px]">
          {overlayPacks.map((p) => (
            <li key={p.id} className="flex flex-wrap gap-2 border border-slate-800 rounded px-2 py-1">
              <span className="text-slate-200">{p.name}</span>
              <button type="button" className="text-sky-400 hover:underline" onClick={() => void loadOverlayForEdit(p.id)}>
                Edit
              </button>
              <button type="button" className="text-red-300/90 hover:underline" onClick={() => void deleteOverlay(p.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="text-[10px] text-slate-400 font-medium">Guest card packs</div>
        {editingGuestId === null && guestInitial === null ? (
          <button type="button" className="text-[10px] text-sky-400 hover:underline" onClick={() => setEditingGuestId(0)}>
            + New guest card pack
          </button>
        ) : null}
        {editingGuestId !== null ? (
          <BroadcastGuestCardPackEditor
            hostWalletAddress={hostWalletAddress}
            editingId={editingGuestId > 0 ? editingGuestId : null}
            initialJson={editingGuestId > 0 ? guestInitial?.json : undefined}
            initialName={editingGuestId > 0 ? guestInitial?.name : undefined}
            initialDescription={editingGuestId > 0 ? guestInitial?.description : undefined}
            onCancel={() => {
              setEditingGuestId(null);
              setGuestInitial(null);
            }}
            onSaved={() => void refresh()}
          />
        ) : null}
        <ul className="space-y-1 text-[10px]">
          {guestPacks.map((p) => (
            <li key={p.id} className="flex flex-wrap gap-2 border border-slate-800 rounded px-2 py-1">
              <span className="text-slate-200">{p.name}</span>
              <button type="button" className="text-sky-400 hover:underline" onClick={() => void loadGuestForEdit(p.id)}>
                Edit
              </button>
              <button type="button" className="text-red-300/90 hover:underline" onClick={() => void deleteGuestPack(p.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
