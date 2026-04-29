"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchTrustRecordsMeActive } from "@/lib/trust-records-me-client";

type MarkType = "standard" | "special" | "sound";
type FilingBasis = "use" | "intent" | "other";
type AssetKind = "drawing" | "audio" | "specimen" | "context" | "other";

type TrademarkAsset = {
  id: string;
  kind: AssetKind;
  fileName: string;
  mimeType: string;
  size: number;
  sha256: string;
  uri: string;
  uploadedAt: string;
};

type GoodsService = {
  id: string;
  classNo: string;
  description: string;
  specimenAssetIds: string[];
};

type ProjectPayload = {
  clientId: string;
  workspaceId: string;
  ownerName: string;
  ownerEntityType: string;
  ownerAddress: string;
  jurisdiction: string;
  correspondenceEmail: string;
  attorneyName: string;
  attorneyEmail: string;
  markText: string;
  drawingDescription: string;
  colorClaim: string;
  disclaimerText: string;
  translationText: string;
  transliterationText: string;
  soundDescription: string;
  basis: FilingBasis;
  firstUseDate: string;
  firstCommerceDate: string;
  goodsServices: GoodsService[];
  assets: TrademarkAsset[];
};

type Readiness = {
  score: number;
  filingReady: boolean;
  blockers: Array<{ code: string; message: string }>;
  warnings: Array<{ code: string; message: string }>;
};

type ProjectListRow = {
  id: string;
  title: string;
  markType: MarkType;
  status: "draft" | "ready" | "review";
  score: number;
  filingReady: boolean;
  updatedAt: string;
};

const emptyPayload: ProjectPayload = {
  clientId: "",
  workspaceId: "",
  ownerName: "",
  ownerEntityType: "",
  ownerAddress: "",
  jurisdiction: "",
  correspondenceEmail: "",
  attorneyName: "",
  attorneyEmail: "",
  markText: "",
  drawingDescription: "",
  colorClaim: "",
  disclaimerText: "",
  translationText: "",
  transliterationText: "",
  soundDescription: "",
  basis: "intent",
  firstUseDate: "",
  firstCommerceDate: "",
  goodsServices: [],
  assets: [],
};

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const BINDING_KEY = "smart_trust_platform_binding_v1";

async function jsonFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function TrademarkPrepPage() {
  const [projects, setProjects] = useState<ProjectListRow[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("New Trademark Project");
  const [markType, setMarkType] = useState<MarkType>("standard");
  const [payload, setPayload] = useState<ProjectPayload>(emptyPayload);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");

  const drawingAssets = useMemo(
    () => payload.assets.filter((a) => a.kind === "drawing"),
    [payload.assets]
  );
  const audioAssets = useMemo(
    () => payload.assets.filter((a) => a.kind === "audio"),
    [payload.assets]
  );
  const specimenAssets = useMemo(
    () => payload.assets.filter((a) => a.kind === "specimen" || a.kind === "context"),
    [payload.assets]
  );

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/trademark-projects", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setProjects(Array.isArray(json.projects) ? json.projects : []);
  }, []);

  const loadSessionContext = useCallback(() => {
    if (typeof window === "undefined") return;
    let clientId = "";
    let workspaceId = "";
    try {
      const raw = window.localStorage.getItem(BINDING_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { trustId?: string | null; clientId?: string | null };
        const trustId = String(parsed?.trustId ?? "").trim();
        const bindingClientId = String(parsed?.clientId ?? "").trim();
        if (trustId) workspaceId = trustId;
        if (bindingClientId) clientId = bindingClientId;
      }
    } catch {
      // ignore
    }
    if (clientId || workspaceId) {
      setPayload((prev) => {
        const next = { ...prev };
        if (!next.clientId.trim() && clientId) next.clientId = clientId;
        if (!next.workspaceId.trim() && workspaceId) next.workspaceId = workspaceId;
        return next;
      });
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadSessionContext();
    const onBinding = () => loadSessionContext();
    window.addEventListener("storage", onBinding);
    window.addEventListener("smart_trust_platform_binding_updated", onBinding as EventListener);
    return () => {
      window.removeEventListener("storage", onBinding);
      window.removeEventListener("smart_trust_platform_binding_updated", onBinding as EventListener);
    };
  }, [loadSessionContext]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await fetchTrustRecordsMeActive();
        if (cancelled) return;
        const ctxClientId = snap?.clientId != null ? String(snap.clientId) : "";
        const trustId = snap?.trustId != null ? String(snap.trustId) : "";
        setPayload((prev) => {
          const next = { ...prev };
          if (!next.clientId.trim() && ctxClientId) next.clientId = ctxClientId;
          if (!next.workspaceId.trim() && trustId) next.workspaceId = trustId;
          return next;
        });
      } catch {
        // optional
      }
      try {
        const clientData = await jsonFetch<{ client?: { id?: unknown } }>("/api/clients/me");
        if (cancelled) return;
        const profileClientId = clientData?.client?.id != null ? String(clientData.client.id) : "";
        if (profileClientId) {
          setPayload((prev) => {
            if (prev.clientId.trim()) return prev;
            return { ...prev, clientId: profileClientId };
          });
        }
      } catch {
        // optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/trademark-projects/${projectId}`, { cache: "no-store" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setStatus(e.error || "Failed to load project");
        return;
      }
      const json = await res.json();
      setActiveProjectId(json.id);
      setTitle(json.title || "Trademark Project");
      setMarkType(json.markType || "standard");
      setPayload(json.payload || emptyPayload);
      setReadiness(json.readiness || null);
      setStatus(`Loaded "${json.title}"`);
    } finally {
      setBusy(false);
    }
  }, []);

  const createNew = () => {
    setActiveProjectId(null);
    setTitle("New Trademark Project");
    setMarkType("standard");
    setPayload(emptyPayload);
    setReadiness(null);
    setStatus("Draft reset. Fill fields and save.");
    loadSessionContext();
  };

  const saveProject = useCallback(async () => {
    setBusy(true);
    try {
      const endpoint = activeProjectId
        ? `/api/trademark-projects/${activeProjectId}`
        : "/api/trademark-projects";
      const method = activeProjectId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, markType, payload }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(json.error || "Save failed");
        return;
      }
      if (!activeProjectId && json.id) setActiveProjectId(json.id);
      if (json.readiness) setReadiness(json.readiness);
      setStatus("Project saved.");
      await loadProjects();
    } finally {
      setBusy(false);
    }
  }, [activeProjectId, loadProjects, markType, payload, title]);

  const uploadAsset = useCallback(
    async (kind: AssetKind, file: File | null) => {
      if (!file) return;
      setBusy(true);
      try {
        const form = new FormData();
        form.append("file", file);
        form.append("kind", kind);
        const res = await fetch("/api/trademark-assets/upload", { method: "POST", body: form });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus(json.error || "Upload failed");
          return;
        }
        setPayload((prev) => ({
          ...prev,
          assets: [json as TrademarkAsset, ...prev.assets],
        }));
        setStatus(`${file.name} uploaded.`);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const addGoodsService = () => {
    setPayload((prev) => ({
      ...prev,
      goodsServices: [
        ...prev.goodsServices,
        { id: makeId(), classNo: "", description: "", specimenAssetIds: [] },
      ],
    }));
  };

  const updateGoodsService = (id: string, patch: Partial<GoodsService>) => {
    setPayload((prev) => ({
      ...prev,
      goodsServices: prev.goodsServices.map((gs) => (gs.id === id ? { ...gs, ...patch } : gs)),
    }));
  };

  const removeGoodsService = (id: string) => {
    setPayload((prev) => ({
      ...prev,
      goodsServices: prev.goodsServices.filter((gs) => gs.id !== id),
    }));
  };

  const runReadiness = useCallback(async () => {
    if (!activeProjectId) {
      setStatus("Save the project first to generate a readiness report.");
      return;
    }
    const res = await fetch(`/api/trademark-projects/${activeProjectId}/readiness`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(json.error || "Readiness check failed");
      return;
    }
    setReadiness(json.readiness || null);
    setStatus("Readiness report refreshed.");
  }, [activeProjectId]);

  const downloadPacket = useCallback(
    async (format: "json" | "pdf" = "json") => {
      if (!activeProjectId) {
        setStatus("Save the project first to generate a packet.");
        return;
      }
      const suffix = format === "pdf" ? "pdf" : "json";
      const res = await fetch(
        `/api/trademark-projects/${activeProjectId}/packet${format === "pdf" ? "/pdf" : ""}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setStatus(json.error || "Packet export failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trademark-packet-${activeProjectId}.${suffix}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Packet downloaded (${suffix.toUpperCase()}).`);
    },
    [activeProjectId]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-[1500px] mx-auto space-y-4">
        <div className="rounded-2xl border border-cyan-500/40 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-cyan-200">Trademark Visual + Audio Preparation</h1>
              <p className="text-sm text-slate-300 mt-1">
                Client intake, asset prep, readiness checks, and filing packet output.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100"
              >
                Back to Dashboard
              </Link>
              <button
                onClick={createNew}
                className="rounded-xl border border-orange-400/50 bg-orange-500/10 px-3 py-2 text-sm text-orange-100"
              >
                New Project
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Filing preparation support only. Not legal advice and not a registrability guarantee.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <aside className="rounded-2xl border border-cyan-500/30 bg-slate-900/65 p-4 space-y-3">
            <div className="text-sm font-semibold text-cyan-200">Project Registry</div>
            <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
              {projects.length === 0 ? (
                <div className="text-sm text-slate-400">No projects yet.</div>
              ) : (
                projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadProject(p.id)}
                    className={`w-full text-left rounded-xl border px-3 py-2 ${
                      activeProjectId === p.id
                        ? "border-orange-400 bg-orange-500/10"
                        : "border-slate-700 bg-slate-800/70 hover:border-cyan-400/50"
                    }`}
                  >
                    <div className="text-sm text-slate-100">{p.title}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {p.markType.toUpperCase()} • Score {p.score} • {p.filingReady ? "Ready" : "Needs work"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="space-y-4">
            <section className="rounded-2xl border border-orange-500/35 bg-slate-900/70 p-4">
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm space-y-1">
                  <span className="text-slate-300">Project Title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-slate-300">Mark Type</span>
                  <select
                    value={markType}
                    onChange={(e) => setMarkType(e.target.value as MarkType)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  >
                    <option value="standard">Standard Character</option>
                    <option value="special">Special Form (Logo/Stylized)</option>
                    <option value="sound">Sound Mark</option>
                  </select>
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-slate-300">Filing Basis</span>
                  <select
                    value={payload.basis}
                    onChange={(e) =>
                      setPayload((prev) => ({ ...prev, basis: e.target.value as FilingBasis }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  >
                    <option value="intent">Intent to Use (1b)</option>
                    <option value="use">Use in Commerce (1a)</option>
                    <option value="other">Other Basis</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-4">
              <h2 className="text-sm font-semibold text-cyan-200">Owner + Correspondence</h2>
              <div className="grid gap-3 md:grid-cols-2 mt-2">
                {[
                  ["Client ID", "clientId"],
                  ["Workspace ID", "workspaceId"],
                  ["Owner Legal Name", "ownerName"],
                  ["Entity Type", "ownerEntityType"],
                  ["Owner Address", "ownerAddress"],
                  ["Jurisdiction", "jurisdiction"],
                  ["Correspondence Email", "correspondenceEmail"],
                  ["Attorney Name (optional)", "attorneyName"],
                  ["Attorney Email (optional)", "attorneyEmail"],
                ].map(([label, key]) => {
                  const val = payload[key as keyof ProjectPayload];
                  const strVal = typeof val === "string" ? val : "";
                  return (
                    <label key={key} className="text-sm space-y-1">
                      <span className="text-slate-300">{label}</span>
                      <input
                        value={strVal}
                        onChange={(e) =>
                          setPayload((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                      />
                    </label>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-orange-500/35 bg-slate-900/70 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-orange-200">Mark Representation + Description</h2>
              {markType === "standard" && (
                <label className="text-sm space-y-1 block">
                  <span className="text-slate-300">Standard Character Mark Text</span>
                  <input
                    value={payload.markText}
                    onChange={(e) => setPayload((prev) => ({ ...prev, markText: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
              )}
              {markType === "special" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="text-sm space-y-1">
                    <span className="text-slate-300">Color Claim (if applicable)</span>
                    <input
                      value={payload.colorClaim}
                      onChange={(e) => setPayload((prev) => ({ ...prev, colorClaim: e.target.value }))}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                    />
                  </label>
                  <label className="text-sm space-y-1">
                    <span className="text-slate-300">Drawing Description</span>
                    <input
                      value={payload.drawingDescription}
                      onChange={(e) =>
                        setPayload((prev) => ({ ...prev, drawingDescription: e.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                    />
                  </label>
                </div>
              )}
              {markType === "sound" && (
                <label className="text-sm space-y-1 block">
                  <span className="text-slate-300">Sound Mark Description</span>
                  <textarea
                    value={payload.soundDescription}
                    onChange={(e) =>
                      setPayload((prev) => ({ ...prev, soundDescription: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 min-h-24"
                  />
                </label>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                <label className="text-sm space-y-1">
                  <span className="text-slate-300">Disclaimer Text</span>
                  <input
                    value={payload.disclaimerText}
                    onChange={(e) => setPayload((prev) => ({ ...prev, disclaimerText: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-slate-300">Translation (if non-English)</span>
                  <input
                    value={payload.translationText}
                    onChange={(e) => setPayload((prev) => ({ ...prev, translationText: e.target.value }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
                <label className="text-sm space-y-1">
                  <span className="text-slate-300">Transliteration</span>
                  <input
                    value={payload.transliterationText}
                    onChange={(e) =>
                      setPayload((prev) => ({ ...prev, transliterationText: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                  />
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-cyan-200">Goods/Services + Class</h2>
                <button
                  onClick={addGoodsService}
                  className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-100"
                >
                  Add Entry
                </button>
              </div>
              <div className="space-y-2">
                {payload.goodsServices.length === 0 ? (
                  <div className="text-sm text-slate-400">No entries added.</div>
                ) : (
                  payload.goodsServices.map((gs) => (
                    <div key={gs.id} className="grid gap-2 md:grid-cols-[100px,1fr,130px]">
                      <input
                        value={gs.classNo}
                        onChange={(e) => updateGoodsService(gs.id, { classNo: e.target.value })}
                        placeholder="Class"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      />
                      <input
                        value={gs.description}
                        onChange={(e) => updateGoodsService(gs.id, { description: e.target.value })}
                        placeholder="Identification of goods/services"
                        className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => removeGoodsService(gs.id)}
                        className="rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-orange-500/35 bg-slate-900/70 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-orange-200">Asset Intake + Evidence</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
                  <div className="text-slate-300 mb-2">Drawing / Logo</div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => uploadAsset("drawing", e.target.files?.[0] || null)}
                  />
                </label>
                <label className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
                  <div className="text-slate-300 mb-2">Sound File (MP3/WAV)</div>
                  <input
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4"
                    onChange={(e) => uploadAsset("audio", e.target.files?.[0] || null)}
                  />
                </label>
                <label className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
                  <div className="text-slate-300 mb-2">Specimen / Context (Image/Video/PDF)</div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,video/mp4,application/pdf"
                    onChange={(e) => uploadAsset("specimen", e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-cyan-700/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-cyan-300">Drawing Assets</div>
                  <div className="mt-2 space-y-1 text-xs text-slate-300">
                    {drawingAssets.slice(0, 4).map((a) => (
                      <div key={a.id}>{a.fileName}</div>
                    ))}
                    {drawingAssets.length === 0 && <div className="text-slate-500">None</div>}
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-700/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-cyan-300">Audio Assets</div>
                  <div className="mt-2 space-y-1 text-xs text-slate-300">
                    {audioAssets.slice(0, 4).map((a) => (
                      <div key={a.id}>
                        {a.fileName} ({bytesLabel(a.size)})
                      </div>
                    ))}
                    {audioAssets.length === 0 && <div className="text-slate-500">None</div>}
                  </div>
                </div>
                <div className="rounded-lg border border-cyan-700/40 p-3">
                  <div className="text-xs uppercase tracking-wide text-cyan-300">Specimen Assets</div>
                  <div className="mt-2 space-y-1 text-xs text-slate-300">
                    {specimenAssets.slice(0, 4).map((a) => (
                      <div key={a.id}>{a.fileName}</div>
                    ))}
                    {specimenAssets.length === 0 && <div className="text-slate-500">None</div>}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-500/30 bg-slate-900/70 p-4">
              <h2 className="text-sm font-semibold text-cyan-200">Readiness Engine</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={saveProject}
                  disabled={busy}
                  className="rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 disabled:opacity-60"
                >
                  Save Project
                </button>
                <button
                  onClick={runReadiness}
                  disabled={busy}
                  className="rounded-lg border border-orange-400/50 bg-orange-500/10 px-3 py-2 text-sm text-orange-100 disabled:opacity-60"
                >
                  Run Readiness
                </button>
                <button
                  onClick={() => downloadPacket("json")}
                  disabled={busy}
                  className="rounded-lg border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 disabled:opacity-60"
                >
                  Export JSON
                </button>
                <button
                  onClick={() => downloadPacket("pdf")}
                  disabled={busy}
                  className="rounded-lg border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100 disabled:opacity-60"
                >
                  Export PDF Packet
                </button>
                <div className="text-xs text-slate-400">{status}</div>
              </div>
              <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950 p-3">
                {!readiness ? (
                  <div className="text-sm text-slate-400">No readiness report yet.</div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-slate-200">
                      Score: <span className="text-cyan-300">{readiness.score}</span> •{" "}
                      <span className={readiness.filingReady ? "text-emerald-300" : "text-orange-300"}>
                        {readiness.filingReady ? "Filing Ready" : "Not Ready"}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <div className="text-xs uppercase tracking-wide text-red-300">Blockers</div>
                        <ul className="mt-1 space-y-1 text-sm text-slate-300">
                          {readiness.blockers.length === 0 ? (
                            <li className="text-emerald-300">No blockers.</li>
                          ) : (
                            readiness.blockers.map((b) => <li key={b.code}>- {b.message}</li>)
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-wide text-amber-300">Warnings</div>
                        <ul className="mt-1 space-y-1 text-sm text-slate-300">
                          {readiness.warnings.length === 0 ? (
                            <li className="text-emerald-300">No warnings.</li>
                          ) : (
                            readiness.warnings.map((w) => <li key={w.code}>- {w.message}</li>)
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
