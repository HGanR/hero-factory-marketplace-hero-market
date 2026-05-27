"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import { topicFromViralContent } from "@/lib/revenue-os/social-studio-from-viral-content";
import {
  buildSocialStudioOperatorGuidance,
  recommendBentleySocialStudioPromote,
} from "@/lib/revenue-os/bentley-social-studio-hints";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY } from "@/lib/revenue-os/bentley-publish-approval-chat";
import { getAdapter } from "@/lib/social/adapters";
import type { SocialPlatform } from "@/lib/social/config";
import { labelSocialStudioAccountOption, filterSocialStudioAccountsForTarget } from "@/lib/revenue-os/social-studio-account-labels";
import { buildSocialStudioManualExportPayload } from "@/lib/revenue-os/social-studio-manual-export";
import {
  SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG,
  type SocialStudioImageAspectKey,
  type SocialStudioImageTemplateId,
} from "@/lib/revenue-os/social-studio-image-templates";

const ACCENT = "#00D1FF";

type ConnectionAccount = {
  id: string;
  platform: string;
  displayName: string | null;
  status?: string;
  directOrganicPublishAvailable?: boolean;
  capabilityNotes?: string[];
  capabilities?: { canPublishText: boolean; canPublishImage: boolean; canSchedule: boolean };
};

type VariantRow = {
  id: string;
  platform: string;
  caption: string;
  hashtags: string;
  aspectRatio: string;
  previewHint: string;
};

type GenerateResponse = {
  runId: string;
  usedViralContent?: boolean;
  effectiveTopic?: string;
  imageTemplate?: SocialStudioImageTemplateId;
  imageAspect?: SocialStudioImageAspectKey;
  brand?: { name: string; primaryColor: string; secondaryColor: string };
  manualMode: boolean;
  asset: { id: string; storageUrl: string | null; hostPublishReady: boolean; width?: number; height?: number };
  variants: VariantRow[];
  exportPackage: { imageDataUrl: string | null; svg: string; captions: Record<string, { caption: string; hashtags: string }> };
  publishPlan: { mode: "direct" | "manual_export" | "mixed"; lines: string[] };
};

type PostMode = "draft" | "schedule" | "publish_now";

/**
 * Social Asset Studio: native pack + promote into governed `campaign_posts` (draft / schedule / publish-now when supported).
 */
export function SocialRevenueOsStudioPanel({
  clientId,
  contentEngineOutput,
}: {
  clientId: string;
  contentEngineOutput: ContentEngineOutput | null;
}) {
  const [topic, setTopic] = useState("Launch highlight");
  const [campaignId, setCampaignId] = useState("");
  const [accounts, setAccounts] = useState<ConnectionAccount[]>([]);
  const [accErr, setAccErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState<GenerateResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [captionEdit, setCaptionEdit] = useState("");
  const [postMode, setPostMode] = useState<PostMode>("draft");
  const [scheduleAt, setScheduleAt] = useState("");
  const [socialAccountId, setSocialAccountId] = useState("");
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteMsg, setPromoteMsg] = useState<string | null>(null);
  const [lastPostId, setLastPostId] = useState<string | null>(null);
  const [imageTemplate, setImageTemplate] = useState<SocialStudioImageTemplateId>("announcement");
  const [imageAspect, setImageAspect] = useState<SocialStudioImageAspectKey | "">("");
  const [sessionPublishApproval, setSessionPublishApproval] = useState(false);

  const loadAccounts = useCallback(async () => {
    const cid = coerceTrimmedString(clientId);
    if (!cid) {
      setAccounts([]);
      return;
    }
    setAccErr(null);
    try {
      const r = await fetch(
        `/api/revenue-os/social-studio/connection-summary?clientId=${encodeURIComponent(cid)}`
      );
      const j = (await r.json()) as { accounts?: ConnectionAccount[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Failed to load accounts");
      setAccounts(Array.isArray(j.accounts) ? j.accounts : []);
    } catch (e) {
      setAccErr(e instanceof Error ? e.message : "Failed to load");
    }
  }, [clientId]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (contentEngineOutput) {
      setTopic(topicFromViralContent(contentEngineOutput, "Launch highlight"));
    }
  }, [contentEngineOutput]);

  useEffect(() => {
    try {
      setSessionPublishApproval(
        typeof window !== "undefined" && window.sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1"
      );
    } catch {
      setSessionPublishApproval(false);
    }
  }, []);

  const selectedVariant = useMemo(() => {
    if (!gen?.variants.length) return null;
    return gen.variants.find((v) => v.id === selectedVariantId) ?? gen.variants[0] ?? null;
  }, [gen, selectedVariantId]);

  useEffect(() => {
    if (gen?.variants[0] && !selectedVariantId) {
      setSelectedVariantId(gen.variants[0].id);
    }
  }, [gen, selectedVariantId]);

  useEffect(() => {
    if (selectedVariant) {
      setCaptionEdit(coerceTrimmedString(selectedVariant.caption));
    }
  }, [selectedVariant?.id, selectedVariant?.caption]);

  const platformAccounts = useMemo(() => {
    if (!selectedVariant) return [];
    return filterSocialStudioAccountsForTarget(accounts, selectedVariant.platform);
  }, [accounts, selectedVariant]);

  const bestDirectAdapterPlatform = useMemo((): string | null => {
    for (const a of accounts) {
      const c = normalizeAccountPlatformToSocialPlatform(a.platform);
      if (c && a.directOrganicPublishAvailable && getAdapter(c as SocialPlatform)) return c;
    }
    return null;
  }, [accounts]);

  const operatorGuidance = useMemo(() => {
    if (!gen) return [] as string[];
    return buildSocialStudioOperatorGuidance({
      bestDirectPlatform: bestDirectAdapterPlatform,
      hasHostedImageUrl: gen.asset.hostPublishReady,
      targetIncludesMetaFamily: gen.variants.some((v) => v.platform === "instagram" || v.platform === "facebook"),
      publishApprovalLikely: sessionPublishApproval,
      hasAnyOauthConnection: accounts.length > 0,
    });
  }, [gen, accounts, bestDirectAdapterPlatform, sessionPublishApproval]);

  const topSummary = useMemo(() => {
    const nConn = accounts.length;
    const nDirect = accounts.filter((a) => a.directOrganicPublishAvailable).length;
    const manual = gen?.variants?.some((v) => v.platform === "tiktok");
    return { nConn, nDirect, manual };
  }, [accounts, gen?.variants]);

  const bentleyHint = useMemo(() => {
    if (!gen?.variants.length) return null;
    return recommendBentleySocialStudioPromote({
      targetPlatforms: gen.variants.map((v) => v.platform),
      connectedAccounts: accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        displayName: a.displayName,
      })),
    });
  }, [gen, accounts]);

  useEffect(() => {
    if (bentleyHint?.accountId && !socialAccountId) {
      setSocialAccountId(bentleyHint.accountId);
    }
  }, [bentleyHint, socialAccountId]);

  function variantReadinessLabel(v: VariantRow) {
    const p = normalizeAccountPlatformToSocialPlatform(v.platform);
    const connected = p && accounts.some((a) => normalizeAccountPlatformToSocialPlatform(a.platform) === p);
    const direct = p && accounts.find((a) => normalizeAccountPlatformToSocialPlatform(a.platform) === p)?.directOrganicPublishAvailable;
    if (!p || p === "tiktok") {
      return { badge: "Manual export", tone: "text-amber-200/90" as const, detail: "In-app direct publish is not available for this network." };
    }
    if (!connected) {
      return { badge: "No connection", tone: "text-amber-200/90" as const, detail: "Connect OAuth for this network or use export." };
    }
    if (!gen?.asset.hostPublishReady && (v.platform === "instagram" || v.platform === "facebook")) {
      return { badge: "Host media", tone: "text-amber-200/90" as const, detail: "Use Pinata/HTTPS for reliable image publish; draft still works." };
    }
    if (!direct) {
      return { badge: "Limited", tone: "text-amber-200/80" as const, detail: "Capabilities may be limited; prefer draft or export." };
    }
    return { badge: "Governed post", tone: "text-emerald-300/90" as const, detail: "Can promote to `campaign_posts` with schedule/publish (subject to approval)." };
  }

  async function onGenerate() {
    setErr(null);
    setGen(null);
    setLastPostId(null);
    setPromoteMsg(null);
    if (!campaignId.trim()) {
      setErr("Enter a campaign id (governed `campaigns.id`).");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/revenue-os/social-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaignId.trim(),
          clientId: clientId.trim(),
          imageTemplate,
          ...(imageAspect ? { imageAspect } : {}),
          ...(topic.trim() ? { topic: topic.trim() } : {}),
          ...(contentEngineOutput ? { contentEngine: contentEngineOutput } : {}),
        }),
      });
      const j = (await r.json()) as GenerateResponse & { error?: string; message?: string };
      if (!r.ok) throw new Error((j as { message?: string }).message ?? (j as { error?: string }).error ?? "Generate failed");
      setGen(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadExport() {
    if (!gen) return;
    const captions: Record<string, { caption: string; hashtags: string }> = {};
    for (const [k, v] of Object.entries(gen.exportPackage.captions)) {
      captions[k] = { caption: v.caption, hashtags: (v as { hashtags?: string }).hashtags ?? "" };
    }
    const pack = buildSocialStudioManualExportPayload({
      runId: gen.runId,
      campaignId: campaignId.trim() || null,
      clientId: clientId.trim() || null,
      topic: gen.effectiveTopic ?? topic,
      imageTemplate: gen.imageTemplate ?? imageTemplate,
      imageAspect: gen.imageAspect ?? (imageAspect || SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[imageTemplate].defaultAspect),
      hostPublishReady: gen.asset.hostPublishReady,
      publishMode: gen.publishPlan,
      captions,
      storageUrl: gen.asset.storageUrl,
      hasSvg: Boolean(gen.exportPackage.svg),
    });
    const extra = {
      ...pack,
      rawSvg: gen.exportPackage.svg,
      brand: gen.brand,
      whatYouCanDoNext: [
        "Promote a variant to create a `campaign_post` (draft, schedule, or publish-now per capability).",
        "If direct publish is unavailable, this JSON + caption file is the consultant handoff — post natively, then later reconcile analytics outside Revenue OS if needed.",
      ],
    };
    const blob = new Blob([JSON.stringify(extra, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `social-studio-export-${gen.runId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadCaptionTxt() {
    if (!gen || !selectedVariant) return;
    const t = coerceTrimmedString(captionEdit || selectedVariant.caption);
    const hs = coerceTrimmedString(selectedVariant.hashtags);
    const text = hs ? `${t}\n\n${hs}` : t;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `social-studio-caption-${selectedVariant.platform}-${gen.runId}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copyAllExport() {
    if (!gen) return;
    const captions: Record<string, { caption: string; hashtags: string }> = {};
    for (const [k, v] of Object.entries(gen.exportPackage.captions)) {
      captions[k] = { caption: v.caption, hashtags: (v as { hashtags?: string }).hashtags ?? "" };
    }
    const pack = buildSocialStudioManualExportPayload({
      runId: gen.runId,
      campaignId: campaignId.trim() || null,
      clientId: clientId.trim() || null,
      topic: gen.effectiveTopic ?? topic,
      imageTemplate: gen.imageTemplate ?? imageTemplate,
      imageAspect: gen.imageAspect ?? (imageAspect || SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[imageTemplate].defaultAspect),
      hostPublishReady: gen.asset.hostPublishReady,
      publishMode: gen.publishPlan,
      captions,
      storageUrl: gen.asset.storageUrl,
      hasSvg: Boolean(gen.exportPackage.svg),
    });
    const blob = JSON.stringify(
      { ...pack, rawSvg: gen.exportPackage.svg, brand: gen.brand },
      null,
      2
    );
    try {
      await navigator.clipboard.writeText(blob);
    } catch {
      /* ignore */
    }
  }

  async function onPromote() {
    if (!gen || !selectedVariant || !campaignId.trim()) {
      setPromoteMsg("Generate a pack and select a campaign first.");
      return;
    }
    setPromoteBusy(true);
    setPromoteMsg(null);
    try {
      const scheduled = postMode === "schedule" && scheduleAt.trim() ? new Date(scheduleAt).toISOString() : null;
      const r = await fetch("/api/revenue-os/social-studio/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: clientId.trim(),
          campaignId: campaignId.trim(),
          generationRunId: gen.runId,
          platformVariantId: selectedVariant.id,
          socialMediaAssetId: gen.asset.id,
          targetPlatform: selectedVariant.platform,
          socialAccountId: socialAccountId.trim() || null,
          postMode,
          scheduledAt: scheduled,
          captionOverride: captionEdit.trim() || null,
        }),
      });
      const j = (await r.json()) as {
        error?: string;
        resolvedMode?: string;
        warnings?: string[];
        post?: { id: string };
        message?: string;
        studioReadiness?: {
          canPublishNow: boolean;
          canSchedule: boolean;
          requiresManual: boolean;
          requiresApproval: boolean;
          reasons: string[];
        };
      };
      if (!r.ok) {
        throw new Error(j.message ?? j.error ?? "Promote failed");
      }
      setLastPostId(j.post?.id ?? null);
      const w = (j.warnings ?? []).join(" ");
      const r0 = j.studioReadiness;
      const cap: string[] = [];
      if (r0) {
        if (r0.canSchedule) cap.push("Schedule-capable (when not downgraded to draft).");
        if (r0.canPublishNow) cap.push("Publish-now was eligible at promote time (subject to approval gates).");
        if (r0.requiresManual) cap.push("Some paths require manual export or native app.");
        if (r0.requiresApproval) cap.push("Governance: approval is required for new posts in this context.");
      }
      setPromoteMsg(
        `Created governed post (${j.resolvedMode ?? "ok"}). ${[...cap, w].filter(Boolean).join(" ")}`.trim()
      );
    } catch (e) {
      setPromoteMsg(e instanceof Error ? e.message : "Promote failed");
    } finally {
      setPromoteBusy(false);
    }
  }

  async function copyCaption() {
    if (!selectedVariant) return;
    try {
      await navigator.clipboard.writeText(captionEdit || selectedVariant.caption);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      id="social-studio"
      className="rounded-2xl border border-cyan-500/30 bg-slate-950/80 p-6 shadow-[0_0_0_1px_rgba(6,182,212,0.12)]"
    >
      <div className="flex flex-col gap-1 mb-4">
        <h2 className="text-lg font-semibold" style={{ color: ACCENT }}>
          Social Asset Studio
        </h2>
        <p className="text-xs text-slate-400 max-w-3xl">
          Generate a native image pack, then <span className="text-slate-200">promote a variant</span> into governed{" "}
          <code className="text-cyan-300/90">campaign_posts</code> (same draft / schedule / publish-now and planner as the
          rest of Revenue OS). When Generate Viral Content is loaded, copy and image lines follow that output.
        </p>
        {contentEngineOutput ? (
          <p className="text-xs text-emerald-400/90 mt-1">Viral content will feed the pack.</p>
        ) : (
          <p className="text-xs text-amber-200/80 mt-1">Optional: run Generate Viral Content first for stronger prompts.</p>
        )}
        <div className="mt-2 rounded-lg border border-white/10 bg-black/25 p-3 text-[11px] text-slate-300 space-y-1">
          <p>
            <span className="text-slate-500">At a glance:</span> {topSummary.nConn} account(s) connected · {topSummary.nDirect}{" "}
            with in-app organic adapter paths · {topSummary.manual ? "TikTok/manual in pack —" : "no TikTok-only wall"} ·{" "}
            {sessionPublishApproval ? (
              <span className="text-amber-200/95">this browser session can flag publish-approval in composer.</span>
            ) : (
              <span>governance still comes from server + UTM on promote.</span>
            )}
          </p>
          {operatorGuidance.length ? (
            <p className="text-slate-500 border-l border-cyan-500/20 pl-2">{operatorGuidance.join(" ")}</p>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <label className="block text-sm text-slate-300">
          Campaign id
          <input
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            placeholder="UUID (governed campaign)"
            className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-sm text-slate-300">
          Topic (optional with viral)
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <label className="block text-sm text-slate-300">
          Image template
          <select
            value={imageTemplate}
            onChange={(e) => setImageTemplate(e.target.value as SocialStudioImageTemplateId)}
            className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
            data-testid="social-studio-template-select"
          >
            {(Object.keys(SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG) as SocialStudioImageTemplateId[]).map((id) => (
              <option key={id} value={id}>
                {SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[id].label} — {SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[id].blurb}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          Layout aspect (empty = template default)
          <select
            value={imageAspect}
            onChange={(e) => setImageAspect((e.target.value || "") as SocialStudioImageAspectKey | "")}
            className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
            data-testid="social-studio-aspect-select"
          >
            <option value="">Default ({SOCIAL_STUDIO_IMAGE_TEMPLATE_CATALOG[imageTemplate].defaultAspect})</option>
            <option value="og">Landscape / OG 1.91:1</option>
            <option value="square">Square 1:1</option>
            <option value="portrait">Portrait 4:5</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={busy}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
          style={{ background: `linear-gradient(180deg, #7DF9FF 0%, ${ACCENT} 100%)` }}
        >
          {busy ? "Generating…" : "Generate image pack"}
        </button>
        <button
          type="button"
          onClick={() => void loadAccounts()}
          className="rounded-xl border border-white/20 px-3 py-2 text-xs text-slate-200 hover:bg-white/5"
        >
          Refresh connections
        </button>
        {gen && (
          <>
            <button
              type="button"
              onClick={downloadExport}
              className="rounded-xl border border-amber-500/50 px-3 py-2 text-xs text-amber-100/95 hover:bg-amber-950/40"
            >
              Export package (JSON)
            </button>
            <button
              type="button"
              onClick={downloadCaptionTxt}
              className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs text-amber-100/90"
            >
              Download caption (.txt)
            </button>
            <button
              type="button"
              onClick={() => void copyAllExport()}
              className="rounded-xl border border-amber-500/20 px-3 py-2 text-xs text-amber-100/80"
            >
              Copy export JSON
            </button>
          </>
        )}
      </div>

      {err && <p className="text-sm text-red-400 mb-3">{err}</p>}
      {accErr && <p className="text-xs text-amber-300/90 mb-3">Connections: {accErr}</p>}

      <div className="mb-4">
        <p className="text-xs text-slate-500 mb-1">Connected accounts (capability-aware)</p>
        <ul className="text-xs text-slate-300 space-y-1">
          {accounts.length === 0 ? (
            <li className="text-slate-500">
              None for this client — use draft + export, or use <span className="text-cyan-300/90">Connected accounts</span> above
              to attach OAuth.
            </li>
          ) : (
            accounts.map((a) => (
              <li key={a.id}>
                <span className="text-cyan-200/90">{a.platform}</span>{" "}
                {a.displayName ? <span className="text-slate-400">— {a.displayName}</span> : null}{" "}
                {a.directOrganicPublishAvailable ? (
                  <span className="text-emerald-400/90">(adapter-backed)</span>
                ) : (
                  <span className="text-amber-300/80">(manual/limited)</span>
                )}
              </li>
            ))
          )}
        </ul>
      </div>

      {bentleyHint?.lines.length ? (
        <div className="text-[11px] text-slate-500 border-l border-cyan-500/30 pl-2 mb-3">
          <span className="text-slate-400">Bentley (heuristic, deterministic):</span> {bentleyHint.lines.join(" ")}
        </div>
      ) : null}

      {gen && (
        <div className="space-y-4 border-t border-white/10 pt-4">
          {gen.usedViralContent && (
            <p className="text-xs text-emerald-400/90">Pack used Viral Content lines where applicable.</p>
          )}
          <div className="text-xs text-slate-400">
            {gen.manualMode || gen.publishPlan.mode !== "direct" ? <span className="text-amber-200/90">Export-friendly mode: </span> : null}
            {gen.publishPlan.lines.join(" ")}
          </div>
          <p className="text-[10px] text-slate-500">
            Card template: <span className="text-slate-300">{gen.imageTemplate ?? imageTemplate}</span> ·{" "}
            {gen.asset.width && gen.asset.height ? (
              <span>
                {gen.asset.width}×{gen.asset.height}px
              </span>
            ) : null}
            {gen.brand?.name ? (
              <>
                {" "}
                · brand <span className="text-slate-400">{gen.brand.name}</span>
              </>
            ) : null}
          </p>

          <p className="text-xs text-slate-500 font-medium">1. Select variant (promotes into a single `campaign_post` record)</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {gen.variants.map((v) => {
              const r = variantReadinessLabel(v);
              const active = v.id === (selectedVariant?.id ?? "");
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setSelectedVariantId(v.id);
                  }}
                  className={`text-left rounded-xl border p-3 flex flex-col gap-2 transition-colors ${
                    active ? "border-cyan-400/70 bg-cyan-950/30" : "border-white/10 bg-black/30 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium text-cyan-300/90 capitalize">{v.platform}</span>
                    <span className={`text-[10px] ${r.tone}`}>{r.badge}</span>
                  </div>
                  {gen.asset.storageUrl && (
                    <div className="rounded-lg overflow-hidden border border-white/10 bg-slate-900 aspect-video flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={gen.asset.storageUrl} alt="" className="max-h-full object-contain" />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 line-clamp-2">{r.detail}</p>
                  <p className="text-[11px] text-slate-300 line-clamp-4 whitespace-pre-wrap">{v.caption}</p>
                </button>
              );
            })}
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block text-sm text-slate-300">
              Caption (editable; overrides variant)
              <textarea
                value={captionEdit}
                onChange={(e) => setCaptionEdit(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-xs text-white"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm text-slate-300">
              <span>Account for destination (optional for draft)</span>
              <select
                value={socialAccountId}
                onChange={(e) => setSocialAccountId(e.target.value)}
                className="rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="">— None (draft / manual) —</option>
                {platformAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {labelSocialStudioAccountOption(a, selectedVariant?.platform ?? "linkedin")}
                  </option>
                ))}
              </select>
              {socialAccountId ? (
                <p className="text-[10px] text-slate-500">
                  Using:{" "}
                  <span className="text-slate-300">
                    {accounts.find((x) => x.id === socialAccountId)?.displayName ?? socialAccountId}
                  </span>
                </p>
              ) : null}
              <label>
                <span className="text-slate-400">Post action</span>
                <select
                  value={postMode}
                  onChange={(e) => setPostMode(e.target.value as PostMode)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  <option value="draft">Save draft</option>
                  <option value="schedule">Schedule (planner)</option>
                  <option value="publish_now">Publish now</option>
                </select>
              </label>
              {postMode === "schedule" && (
                <label>
                  <span className="text-slate-400">When (local)</span>
                  <input
                    type="datetime-local"
                    value={scheduleAt}
                    onChange={(e) => setScheduleAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2 text-sm text-white"
                  />
                </label>
              )}
              <p className="text-[11px] text-slate-500">
                Governed path matches `POST /api/social/posts` (approvals, UTM seeding, media rules). If something is
                blocked, the API still returns a <span className="text-slate-300">draft</span> and warnings.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onPromote()}
              disabled={promoteBusy}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
              style={{ background: `linear-gradient(180deg, #a7f3d0 0%, #34d399 100%)` }}
            >
              {promoteBusy
                ? "Working…"
                : postMode === "draft"
                  ? "Save draft to governed post"
                  : postMode === "schedule"
                    ? "Schedule governed post"
                    : "Publish now (governed)"}
            </button>
            <button
              type="button"
              onClick={copyCaption}
              className="rounded-xl border border-white/20 px-3 py-2 text-xs text-slate-200"
            >
              Copy caption
            </button>
            {gen.asset.storageUrl && (
              <a
                href={gen.asset.storageUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="rounded-xl border border-cyan-500/40 px-3 py-2 text-xs text-cyan-200"
              >
                Download image
              </a>
            )}
          </div>

          {promoteMsg && <p className="text-sm text-cyan-100/90">{promoteMsg}</p>}
          {lastPostId && (
            <p className="text-xs text-slate-400">
              Post id: <code className="text-cyan-300/90">{lastPostId}</code> — appears in the publishing planner and{" "}
              <a className="text-cyan-400 underline" href={`/api/social/posts/${lastPostId}`} target="_blank" rel="noreferrer">
                GET /api/social/posts/…
              </a>{" "}
              (governed JSON). Open{" "}
              <a
                className="text-cyan-400 underline"
                href={`/revenue-os/dashboard?clientId=${encodeURIComponent(clientId)}`}
              >
                AI Revenue OS dashboard
              </a>{" "}
              (same client) to manage posts. Metadata includes{" "}
              <code className="text-cyan-300/80">social_studio_run_id</code> in UTM for traceability.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
