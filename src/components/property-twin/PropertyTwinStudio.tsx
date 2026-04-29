"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListingPackageDrawer } from "@/components/property-twin/ListingPackageDrawer";
import { TwinSceneStage } from "@/components/property-twin/TwinSceneStage";
import {
  ArrowLeft,
  Box,
  Building2,
  Camera,
  ClipboardList,
  Copy,
  ExternalLink,
  FileText,
  GitCompare,
  Layers,
  Loader2,
  MapPin,
  Network,
  Search,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HolographicCard, HOLO_TILE_SM } from "@/components/dashboard/HolographicCard";
import {
  aggregateRoi,
  buildRoiRows,
  describeBuyerScenario,
  propertyDnaScore,
  type ImprovementPreset,
} from "@/lib/property-twin/deal-scenarios";

type PropertyRow = {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  ownerWallet: string | null;
};

type AssetRow = {
  id: number;
  propertyId: number;
  kind: string;
  url: string;
  mimeType: string | null;
  originalFilename: string | null;
  bytes: number | null;
};

type JobRow = {
  id: number;
  propertyId: number;
  mode: string;
  status: string;
  progress: number;
  errorMessage: string | null;
  inputAssetIds: number[] | null;
  outputUrl: string | null;
  resultJson: unknown;
};

type NodeRow = {
  id: number;
  propertyId: number;
  zone: string;
  label: string;
  nodeType: string;
  sortOrder: number;
  payload: Record<string, unknown> | null;
  anchorX?: number | null;
  anchorY?: number | null;
  anchorZ?: number | null;
  estimatedCost?: number | null;
  estimatedValueLift?: number | null;
  roiPercent?: number | null;
};

const ASSET_KINDS = [
  { id: "exterior", label: "Exterior" },
  { id: "interior", label: "Interior" },
  { id: "landscape", label: "Landscape" },
  { id: "video", label: "Video" },
  { id: "floor_plan", label: "Floor plan" },
] as const;

const JOB_MODES = [
  "photogrammetry",
  "gaussian",
  "neural",
  "hybrid",
  "manual",
] as const;

const PT_LAST_PROPERTY_KEY = "property-twin:lastPropertyId";

export default function PropertyTwinStudio() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [intake, setIntake] = useState({ label: "", notes: "" });
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [nodes, setNodes] = useState<NodeRow[]>([]);
  const [reconMode, setReconMode] = useState<(typeof JOB_MODES)[number]>("photogrammetry");
  const [uploadKind, setUploadKind] = useState<(typeof ASSET_KINDS)[number]["id"]>("exterior");
  const [vendorQ, setVendorQ] = useState("scan photogrammetry");
  const [vendorRegion, setVendorRegion] = useState("US-CA");
  const [vendors, setVendors] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [visualMode, setVisualMode] = useState<"current" | "improved">("current");
  const [improvementPreset, setImprovementPreset] = useState<ImprovementPreset>("modern");
  const [listPrice, setListPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [repairCredit, setRepairCredit] = useState("");
  const [upgradeBudget, setUpgradeBudget] = useState("");
  const [listingOpen, setListingOpen] = useState(false);
  const [listingBody, setListingBody] = useState("");
  const [copyFlash, setCopyFlash] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);
  const [shareLinkBusy, setShareLinkBusy] = useState(false);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);

  const loadProperties = useCallback(async () => {
    const r = await fetch("/api/property-twin/properties");
    const data = await r.json();
    if (Array.isArray(data)) setProperties(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  useEffect(() => {
    if (loading) return;
    try {
      const raw = localStorage.getItem(PT_LAST_PROPERTY_KEY);
      if (!raw) return;
      const id = Number(raw);
      if (!Number.isFinite(id)) return;
      if (properties.some((p) => p.id === id)) setPropertyId(id);
    } catch {
      /* ignore */
    }
  }, [loading, properties]);

  useEffect(() => {
    if (propertyId == null) return;
    try {
      localStorage.setItem(PT_LAST_PROPERTY_KEY, String(propertyId));
    } catch {
      /* ignore */
    }
  }, [propertyId]);

  const refreshAll = useCallback(async (pid: number) => {
    const [a, j, n] = await Promise.all([
      fetch(`/api/property-twin/properties/${pid}/assets`).then((x) => x.json()),
      fetch(`/api/property-twin/properties/${pid}/jobs`).then((x) => x.json()),
      fetch(`/api/property-twin/properties/${pid}/nodes`).then((x) => x.json()),
    ]);
    if (Array.isArray(a)) setAssets(a);
    if (Array.isArray(j)) setJobs(j);
    if (Array.isArray(n)) setNodes(n);
  }, []);

  const copyClientPresentationLink = useCallback(async (rotate: boolean) => {
    if (propertyId == null) return;
    setShareLinkBusy(true);
    try {
      const r = await fetch(`/api/property-twin/properties/${propertyId}/presentation-link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.warn("presentation link failed", data);
        return;
      }
      if (typeof data.shareUrl === "string") {
        await navigator.clipboard.writeText(data.shareUrl);
        setShareLinkCopied(true);
        window.setTimeout(() => setShareLinkCopied(false), 2500);
      }
    } catch (e) {
      console.warn("copy presentation link", e);
    } finally {
      setShareLinkBusy(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (propertyId != null) void refreshAll(propertyId);
  }, [propertyId, refreshAll]);

  const latestJob = useMemo(() => jobs[0] ?? null, [jobs]);

  useEffect(() => {
    if (propertyId == null) return;
    const needPoll = jobs.some((j) => j.status === "queued" || j.status === "running");
    if (!needPoll) return;
    const t = setInterval(() => void refreshAll(propertyId), 4000);
    return () => clearInterval(t);
  }, [propertyId, jobs, refreshAll]);

  const submitDraftJob = async (jobId: number) => {
    const r = await fetch(`/api/property-twin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "queued" }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.warn("Submit job failed", err);
    }
  };

  const cancelJob = async (jobId: number) => {
    const r = await fetch(`/api/property-twin/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.warn("Cancel job failed", err);
    }
  };

  const createProperty = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/property-twin/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          description: intake.notes || null,
        }),
      });
      const row = await r.json();
      if (row?.id) {
        setProperties((p) => [row, ...p]);
        setPropertyId(row.id);
        setNewName("");
      }
    } finally {
      setBusy(false);
    }
  };

  const uploadAsset = async (file: File) => {
    if (!propertyId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("kind", uploadKind);
      const r = await fetch(`/api/property-twin/properties/${propertyId}/assets`, {
        method: "POST",
        body: fd,
      });
      if (r.ok) await refreshAll(propertyId);
    } finally {
      setBusy(false);
    }
  };

  const createJob = async () => {
    if (!propertyId) return;
    setBusy(true);
    try {
      await fetch(`/api/property-twin/properties/${propertyId}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: reconMode,
          status: "draft",
          inputAssetIds: assets.map((x) => x.id),
        }),
      });
      await refreshAll(propertyId);
    } finally {
      setBusy(false);
    }
  };

  const runVendorSearch = async () => {
    const params = new URLSearchParams({ q: vendorQ });
    if (vendorRegion.trim()) params.set("region", vendorRegion.trim());
    const r = await fetch(`/api/property-twin/vendors/search?${params}`);
    setVendors(await r.json());
  };

  const addPlanningNode = async () => {
    if (!propertyId) return;
    const label = intake.label.trim() || "Planning node";
    setBusy(true);
    try {
      await fetch(`/api/property-twin/properties/${propertyId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: "site",
          label,
          nodeType: "planning",
          payload: { source: "studio" },
        }),
      });
      setIntake((s) => ({ ...s, label: "" }));
      await refreshAll(propertyId);
    } finally {
      setBusy(false);
    }
  };

  const nodesByZone = useMemo(() => {
    const m = new Map<string, NodeRow[]>();
    for (const n of nodes) {
      const z = n.zone || "general";
      if (!m.has(z)) m.set(z, []);
      m.get(z)!.push(n);
    }
    return m;
  }, [nodes]);

  const coverageSummary = useMemo(() => {
    const kinds = new Set(assets.map((a) => a.kind));
    return ASSET_KINDS.map((k) => ({
      kind: k.id,
      label: k.label,
      ok: kinds.has(k.id),
    }));
  }, [assets]);

  const readiness = useMemo(() => {
    const kinds = new Set(assets.map((a) => a.kind));
    const essentialCount = ["exterior", "interior", "floor_plan"].filter((k) => kinds.has(k)).length;
    const bonusCount = ["landscape", "video"].filter((k) => kinds.has(k)).length;
    let tier: "minimal" | "good" | "strong" = "minimal";
    if (essentialCount >= 2 && bonusCount >= 1) tier = "strong";
    else if (essentialCount >= 2) tier = "good";
    return { tier, essentialCount, bonusCount };
  }, [assets]);

  const assetKindSet = useMemo(() => new Set(assets.map((a) => a.kind)), [assets]);
  const nodeLabels = useMemo(() => nodes.map((n) => n.label), [nodes]);

  const roiRows = useMemo(
    () => buildRoiRows(assetKindSet, nodeLabels, readiness.tier, intake.notes),
    [assetKindSet, nodeLabels, readiness.tier, intake.notes]
  );

  const roiTotals = useMemo(() => aggregateRoi(roiRows), [roiRows]);

  const dna = useMemo(
    () =>
      propertyDnaScore({
        readinessTier: readiness.tier,
        assetKinds: assetKindSet,
        nodeCount: nodes.length,
        hasTwinOutput: Boolean(latestJob?.outputUrl),
      }),
    [readiness.tier, assetKindSet, nodes.length, latestJob?.outputUrl]
  );

  const buyerScenarioText = useMemo(() => {
    const lp = Number(listPrice.replace(/[^0-9.]/g, "")) || 0;
    const op = Number(offerPrice.replace(/[^0-9.]/g, "")) || 0;
    const rc = Number(repairCredit.replace(/[^0-9.]/g, "")) || 0;
    const ub = Number(upgradeBudget.replace(/[^0-9.]/g, "")) || 0;
    if (!op && !lp) return "Enter list and offer to simulate a buyer scenario.";
    return describeBuyerScenario(lp, op, rc, ub);
  }, [listPrice, offerPrice, repairCredit, upgradeBudget]);

  const anchorNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        anchorX: n.anchorX ?? null,
        anchorY: n.anchorY ?? null,
        anchorZ: n.anchorZ ?? null,
      })),
    [nodes]
  );

  const createAnchoredNode = async (p: { x: number; y: number; z: number }) => {
    if (!propertyId) return;
    setBusy(true);
    try {
      const label = intake.label.trim() || "Scene anchor";
      const r = await fetch(`/api/property-twin/properties/${propertyId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: "site",
          label,
          nodeType: "planning",
          anchorX: p.x,
          anchorY: p.y,
          anchorZ: p.z,
          payload: { source: "anchor" },
        }),
      });
      if (r.ok) {
        setIntake((s) => ({ ...s, label: "" }));
        await refreshAll(propertyId);
      }
    } finally {
      setBusy(false);
    }
  };

  const openListingPackage = async () => {
    if (!propertyId) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/property-twin/properties/${propertyId}/listing-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteNotes: intake.notes }),
      });
      const data = await r.json();
      if (typeof data.markdown === "string") {
        setListingBody(data.markdown);
        setListingOpen(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const copyListingPackage = async () => {
    try {
      await navigator.clipboard.writeText(listingBody);
      setCopyFlash(true);
      setTimeout(() => setCopyFlash(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-screen bg-[#050a12] text-slate-100">
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/15 to-transparent pointer-events-none" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 pb-24">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-cyan-300/90 hover:text-cyan-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-slate-600">/</span>
          <Link href="/ret" className="text-sm text-slate-400 hover:text-cyan-200">
            RET
          </Link>
        </div>

        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-cyan-400" />
            Property Twin Studio
          </h1>
          <p className="text-slate-400 mt-2 max-w-3xl">
            Intake, uploads, reconstruction jobs, node planning, and vendor discovery. Data persists via
            Drizzle tables <code className="text-cyan-500/90">property_twin_properties</code>,{" "}
            <code className="text-cyan-500/90">property_twin_assets</code>,{" "}
            <code className="text-cyan-500/90">property_twin_jobs</code>,{" "}
            <code className="text-cyan-500/90">property_twin_nodes</code>.
          </p>
        </header>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading properties…
          </div>
        ) : (
          <div className="space-y-6">
            <HolographicCard accent="both">
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-cyan-100 font-semibold">
                  <ClipboardList className="w-5 h-5" />
                  Property & intake
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="min-w-[200px]">
                    <Label className="text-slate-400">Active property</Label>
                    <Select
                      value={propertyId ? String(propertyId) : ""}
                      onValueChange={(v) => setPropertyId(Number(v))}
                    >
                      <SelectTrigger className="mt-1 bg-slate-900/80 border-white/10">
                        <SelectValue placeholder="Select a property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name} (#{p.id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {properties.length > 1 && (
                      <p className="text-[10px] text-slate-600 mt-1">
                        Last opened is restored from local storage.
                      </p>
                    )}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Label className="text-slate-400">New property name</Label>
                    <Input
                      className="mt-1 bg-slate-900/80 border-white/10"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Meridian Industrial — Building A"
                    />
                  </div>
                  <Button
                    className="bg-cyan-600 hover:bg-cyan-500"
                    disabled={busy || !newName.trim()}
                    onClick={() => void createProperty()}
                  >
                    Create
                  </Button>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-slate-400">Planning node label (quick add)</Label>
                    <Input
                      className="mt-1 bg-slate-900/80 border-white/10"
                      value={intake.label}
                      onChange={(e) => setIntake((s) => ({ ...s, label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400">Site notes</Label>
                    <Textarea
                      className="mt-1 bg-slate-900/80 border-white/10 min-h-[72px]"
                      value={intake.notes}
                      onChange={(e) => setIntake((s) => ({ ...s, notes: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </HolographicCard>

            <div className="grid lg:grid-cols-2 gap-6">
              <HolographicCard accent="cyan">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-cyan-100 font-semibold">
                    <Upload className="w-5 h-5" />
                    Upload workspace
                  </div>
                  <p className="text-xs text-slate-500">
                    Exterior / interior / landscape / video / floor plan — stored under{" "}
                    <code className="text-slate-400">public/uploads/property-twin/&lt;id&gt;/</code>
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Select
                      value={uploadKind}
                      onValueChange={(v) => setUploadKind(v as typeof uploadKind)}
                    >
                      <SelectTrigger className="w-[180px] bg-slate-900/80 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSET_KINDS.map((k) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void uploadAsset(f);
                          e.target.value = "";
                        }}
                      />
                      <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 hover:bg-white/5 text-sm">
                        <Camera className="w-4 h-4" /> Choose file
                      </span>
                    </label>
                  </div>
                  <ul className="text-sm text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                    {assets.map((a) => (
                      <li key={a.id}>
                        <span className="text-cyan-400/90">{a.kind}</span> —{" "}
                        {a.originalFilename ?? a.url}
                      </li>
                    ))}
                    {assets.length === 0 && <li>No assets yet.</li>}
                  </ul>
                </div>
              </HolographicCard>

              <HolographicCard accent="both">
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 text-cyan-100 font-semibold">
                    <Layers className="w-5 h-5" />
                    Reconstruction job
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Select
                      value={reconMode}
                      onValueChange={(v) => setReconMode(v as typeof reconMode)}
                    >
                      <SelectTrigger className="w-[200px] bg-slate-900/80 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_MODES.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      className="border-cyan-500/40"
                      disabled={!propertyId || busy}
                      onClick={() => void createJob()}
                    >
                      Draft job
                    </Button>
                  </div>
                  {latestJob && (
                    <div className="text-xs text-slate-500">
                      Latest job{" "}
                      <span className="text-slate-300">
                        #{latestJob.id}
                      </span>{" "}
                      <span className="text-cyan-400">{latestJob.status}</span>
                      {latestJob.status === "queued" || latestJob.status === "running"
                        ? " — auto-refreshing every 4s"
                        : null}
                    </div>
                  )}
                  <ul className="text-sm space-y-1">
                    {jobs.map((j) => (
                      <li key={j.id} className="flex flex-wrap justify-between gap-2 items-center">
                        <span>
                          #{j.id} · {j.mode} ·{" "}
                          <span className="text-cyan-400">{j.status}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-slate-500">{j.progress}%</span>
                          {j.status === "draft" ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                              disabled={busy}
                              onClick={() =>
                                void (async () => {
                                  await submitDraftJob(j.id);
                                  if (propertyId) await refreshAll(propertyId);
                                })()
                              }
                            >
                              Submit
                            </Button>
                          ) : null}
                          {j.status === "draft" || j.status === "queued" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-slate-500"
                              disabled={busy}
                              onClick={() =>
                                void (async () => {
                                  await cancelJob(j.id);
                                  if (propertyId) await refreshAll(propertyId);
                                })()
                              }
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </span>
                      </li>
                    ))}
                    {jobs.length === 0 && (
                      <li className="text-slate-500">No jobs yet — create a draft.</li>
                    )}
                  </ul>
                </div>
              </HolographicCard>
            </div>

            <HolographicCard accent="both">
              <div className="p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-cyan-100 font-semibold">
                      <TrendingUp className="w-5 h-5" />
                      Deal intelligence
                    </div>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                      Directional ROI from coverage + planning nodes — calibrate with comps. Toggle
                      before/after on the viewer; presets shift lighting and placeholder tone until generative
                      renders land.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">DNA</span>
                    <span className="text-lg font-semibold text-white tabular-nums">{dna.score}</span>
                    <span className="text-slate-500 text-sm">/ 100</span>
                  </div>
                </div>
                {dna.highlights.length > 0 && (
                  <ul className="text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                    {dna.highlights.map((h) => (
                      <li key={h} className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-500/80 shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-300">
                      <GitCompare className="w-4 h-4 text-cyan-400" />
                      Before / after (viewer)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={visualMode === "current" ? "secondary" : "outline"}
                        className={visualMode === "current" ? "bg-slate-800" : "border-white/15"}
                        onClick={() => setVisualMode("current")}
                      >
                        Current
                      </Button>
                      <Button
                        size="sm"
                        variant={visualMode === "improved" ? "secondary" : "outline"}
                        className={visualMode === "improved" ? "bg-slate-800" : "border-white/15"}
                        onClick={() => setVisualMode("improved")}
                      >
                        Improved
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="text-xs text-slate-500 mr-1">Vision preset</span>
                      {(["staged", "modern", "luxury"] as const).map((p) => (
                        <Button
                          key={p}
                          size="sm"
                          variant="outline"
                          className={`h-8 text-xs capitalize border-white/15 ${
                            improvementPreset === p && visualMode === "improved"
                              ? "border-cyan-500/50 text-cyan-200"
                              : ""
                          }`}
                          onClick={() => {
                            setVisualMode("improved");
                            setImprovementPreset(p);
                          }}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-slate-300 flex items-center gap-2">
                      Buyer scenario (quick)
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-slate-500">List price</Label>
                        <Input
                          className="h-9 mt-0.5 bg-slate-900/80 border-white/10 text-sm"
                          inputMode="numeric"
                          placeholder="825000"
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Offer</Label>
                        <Input
                          className="h-9 mt-0.5 bg-slate-900/80 border-white/10 text-sm"
                          inputMode="numeric"
                          placeholder="800000"
                          value={offerPrice}
                          onChange={(e) => setOfferPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Repair credit</Label>
                        <Input
                          className="h-9 mt-0.5 bg-slate-900/80 border-white/10 text-sm"
                          inputMode="numeric"
                          placeholder="5000"
                          value={repairCredit}
                          onChange={(e) => setRepairCredit(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-500">Upgrade budget</Label>
                        <Input
                          className="h-9 mt-0.5 bg-slate-900/80 border-white/10 text-sm"
                          inputMode="numeric"
                          placeholder="12000"
                          value={upgradeBudget}
                          onChange={(e) => setUpgradeBudget(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">
                      {buyerScenarioText}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-sm text-slate-300">ROI scenarios (illustrative)</span>
                    <span className="text-xs text-slate-500">
                      Blended {roiTotals.blendedRoiPercent}% on ~$
                      {roiTotals.totalCost.toLocaleString()} → ~$
                      {roiTotals.totalLift.toLocaleString()} lift
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-500">
                          <th className="p-2 font-medium">Upgrade</th>
                          <th className="p-2 font-medium">Cost</th>
                          <th className="p-2 font-medium">Lift</th>
                          <th className="p-2 font-medium">ROI</th>
                          <th className="p-2 font-medium">When</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roiRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-slate-500">
                              No scenarios matched — add media coverage or planning nodes.
                            </td>
                          </tr>
                        ) : (
                          roiRows.map((r) => (
                            <tr key={r.id} className="border-b border-white/5 text-slate-300">
                              <td className="p-2">{r.label}</td>
                              <td className="p-2 tabular-nums">${r.estimatedCost.toLocaleString()}</td>
                              <td className="p-2 tabular-nums">${r.estimatedValueLift.toLocaleString()}</td>
                              <td className="p-2 text-cyan-400/90 tabular-nums">{r.roiPercent}%</td>
                              <td className="p-2 text-slate-500">{r.timing.replace(/_/g, " ")}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <Button
                    className="bg-violet-600 hover:bg-violet-500"
                    disabled={!propertyId || busy}
                    onClick={() => void openListingPackage()}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Generate listing package
                  </Button>
                  <span className="text-xs text-slate-500">
                    Markdown report: summary, ROI, twin link — paste into email or doc.
                  </span>
                </div>
              </div>
            </HolographicCard>

            <HolographicCard accent="both">
              <div className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 text-cyan-100 font-semibold">
                    <Box className="w-5 h-5" />
                    3D viewer
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={placementMode ? "secondary" : "outline"}
                      className="border-white/15 h-8 text-xs"
                      disabled={!propertyId || busy}
                      onClick={() => setPlacementMode((v) => !v)}
                    >
                      <MapPin className="w-3.5 h-3.5 mr-1" />
                      {placementMode ? "Placement on" : "Placement off"}
                    </Button>
                    {propertyId ? (
                      <>
                        <Button size="sm" variant="outline" className="border-white/15 h-8 text-xs" asChild>
                          <Link href={`/property-twin/present?propertyId=${propertyId}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Presentation
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-white/15 h-8 text-xs"
                          disabled={busy || shareLinkBusy}
                          onClick={() => void copyClientPresentationLink(false)}
                          title="Creates a share token if needed and copies a link anyone can open without signing in"
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          {shareLinkCopied ? "Copied" : "Copy client link"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-slate-500 hover:text-slate-300"
                          disabled={busy || shareLinkBusy}
                          onClick={() => void copyClientPresentationLink(true)}
                          title="Invalidate previous client links and copy a new URL"
                        >
                          New token
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
                <TwinSceneStage
                  job={latestJob}
                  propertySelected={propertyId != null}
                  onRefresh={() =>
                    propertyId != null ? void refreshAll(propertyId) : undefined
                  }
                  visualMode={visualMode}
                  improvementPreset={improvementPreset}
                  nodes={anchorNodes}
                  placementEnabled={placementMode}
                  onAnchorPick={(p) => void createAnchoredNode(p)}
                />
                <p className="text-xs text-slate-500 mt-2">
                  GLB/GLTF load via R3F when <code>outputUrl</code> is set. Turn on placement and click the
                  scene to drop anchored nodes (works on placeholder; pending jobs show a loading state).
                  Splats / point clouds show a download card until a dedicated viewer is added.
                </p>
              </div>
            </HolographicCard>

            <div className="grid lg:grid-cols-2 gap-6">
              <HolographicCard accent="cyan">
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-100 font-semibold">
                    <Network className="w-5 h-5" />
                    Node planning (by zone)
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/20"
                    disabled={!propertyId || busy}
                    onClick={() => void addPlanningNode()}
                  >
                    Add node from intake label
                  </Button>
                  <div className="space-y-3 max-h-56 overflow-y-auto">
                    {Array.from(nodesByZone.entries()).map(([zone, list]) => (
                      <div key={zone}>
                        <div className="text-xs uppercase tracking-wider text-slate-500 mb-1">
                          {zone}
                        </div>
                        <ul className="space-y-1 text-sm">
                          {list.map((n) => (
                            <li key={n.id} className={HOLO_TILE_SM + " px-2 py-1"}>
                              {n.label}{" "}
                              <span className="text-slate-500">({n.nodeType})</span>
                              {n.anchorX != null && n.anchorY != null && n.anchorZ != null ? (
                                <span className="block text-[10px] text-cyan-500/80 font-mono mt-0.5">
                                  [{n.anchorX.toFixed(2)}, {n.anchorY.toFixed(2)}, {n.anchorZ.toFixed(2)}]
                                </span>
                              ) : null}
                              {n.estimatedCost != null || n.estimatedValueLift != null ? (
                                <span className="block text-[10px] text-slate-500 mt-0.5">
                                  ROI data: cost {n.estimatedCost ?? "—"} · lift {n.estimatedValueLift ?? "—"}
                                  {n.roiPercent != null ? ` · ${n.roiPercent}%` : ""}
                                </span>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {nodes.length === 0 && (
                      <p className="text-slate-500 text-sm">No nodes yet.</p>
                    )}
                  </div>
                </div>
              </HolographicCard>

              <HolographicCard accent="both">
                <div className="p-6 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-100 font-semibold">
                    <Search className="w-5 h-5" />
                    Vendor discovery
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      className="bg-slate-900/80 border-white/10 max-w-xs"
                      value={vendorQ}
                      onChange={(e) => setVendorQ(e.target.value)}
                      placeholder="Search…"
                    />
                    <Input
                      className="bg-slate-900/80 border-white/10 w-28"
                      value={vendorRegion}
                      onChange={(e) => setVendorRegion(e.target.value)}
                      placeholder="US-CA"
                    />
                    <Button variant="outline" className="border-white/20" onClick={() => void runVendorSearch()}>
                      Search
                    </Button>
                  </div>
                  {vendors && (
                    <pre className="text-xs text-slate-400 overflow-x-auto max-h-48 p-2 rounded bg-black/30">
                      {JSON.stringify(vendors, null, 2)}
                    </pre>
                  )}
                </div>
              </HolographicCard>
            </div>

            <HolographicCard accent="both">
              <div className="p-6">
                <div className="text-cyan-100 font-semibold mb-2">Coverage & readiness</div>
                <p className="text-xs text-slate-500 mb-3">
                  Readiness:{" "}
                  <span
                    className={
                      readiness.tier === "strong"
                        ? "text-green-400"
                        : readiness.tier === "good"
                          ? "text-cyan-400"
                          : "text-slate-400"
                    }
                  >
                    {readiness.tier}
                  </span>{" "}
                  <span className="text-slate-600">
                    (exterior + interior + floor plan drive “good”; add landscape/video for “strong”.)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {coverageSummary.map((c) => (
                    <span
                      key={c.kind}
                      className={`text-xs px-2 py-1 rounded-full border ${
                        c.ok ? "border-green-500/50 text-green-300" : "border-white/10 text-slate-500"
                      }`}
                    >
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            </HolographicCard>

            <div className={`${HOLO_TILE_SM} p-4 text-xs text-slate-500 border border-dashed border-white/15`}>
              <strong className="text-slate-400">API:</strong>{" "}
              <code>/api/property-twin/properties</code>,{" "}
              <code>…/properties/[id]/assets</code>, <code>…/jobs</code>, <code>…/nodes</code>,{" "}
              <code>/api/property-twin/jobs/[jobId]</code>,{" "}
              <code>/api/property-twin/vendors/search</code>. Run{" "}
              <code className="text-cyan-600/90">drizzle/property_twin_tables.sql</code> and{" "}
              <code className="text-cyan-600/90">drizzle/property_twin_migrate_002.sql</code>,{" "}
              <code className="text-cyan-600/90">drizzle/property_twin_migrate_003_v12.sql</code> (or{" "}
              <code>db:push</code>) before use. Listing package:{" "}
              <code>POST /api/property-twin/properties/[id]/listing-package</code>.
            </div>
          </div>
        )}
      </div>

      <ListingPackageDrawer
        open={listingOpen}
        onOpenChange={setListingOpen}
        markdown={listingBody}
        onCopy={() => void copyListingPackage()}
        copyLabel={copyFlash ? "Copied" : "Copy to clipboard"}
      />
    </div>
  );
}
