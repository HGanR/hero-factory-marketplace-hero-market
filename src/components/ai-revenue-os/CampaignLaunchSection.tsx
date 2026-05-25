"use client";

import { useEffect, useMemo, useState } from "react";
import { useSocialAccounts } from "@/hooks/useSocialAccounts";
import type { SocialPlatform } from "@/lib/social/config";
import type { BentleyLaunchPrefill } from "@/lib/revenue-os/bentley-orchestrator";
import {
  useAiRevenueOsBentleyActions,
  useAiRevenueOsSnapshotSignature,
} from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import {
  connectedSocialPlatformsSet,
  normalizeAccountPlatformToSocialPlatform,
} from "@/lib/social/platform-identity";
import { parseScheduledPublishMeta } from "@/lib/social/scheduled-publish-meta";
import {
  bentleySnapshotToCampaignLaunchPrefillBridge,
  filterCampaignLaunchPlatformsByTargets,
  nextDescriptionAfterLaunchPrefill,
  nextNewCampaignNameAfterLaunchPrefill,
} from "@/lib/revenue-os/bentley-launch-prefill";
import { postingPlatformDisplayName } from "@/lib/revenue-os/bentley-posting-platforms";
import type { SocialAccountLite } from "@/lib/social/social-account-public";
import {
  isAutomatedOAuthPublishSupported,
  socialAccountTokenLikelyExpired,
  userFacingMessageForPublishApiFailure,
  type PublishApiErrorBody,
} from "@/lib/social/campaign-launch-publish-ui";
import {
  computeLaunchTargetsReadiness,
  getCampaignPostLaunchPresentation,
} from "@/lib/social/campaign-launch-readiness";
import { describeBentleyCampaignArtifactForLaunch } from "@/lib/revenue-os/bentley-operator-pipeline-model";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { loadWorkflowState, subscribeBentleyWorkflowCrossTab } from "@/lib/revenue-os/bentley-workflow";

const GOLD = "#D4AF37";

function accountForPostingPlatform(
  accounts: SocialAccountLite[],
  plat: SocialPlatform
): SocialAccountLite | undefined {
  return accounts.find(
    (a) => (a.platformCanonical ?? normalizeAccountPlatformToSocialPlatform(a.platform)) === plat
  );
}

type Campaign = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  accessSource?: "owner" | "assignment";
  viewerCampaignReviewerRole?: string;
};

type Post = {
  id: string;
  platform: string;
  status: string;
  caption: string | null;
  scheduledAt: string | null;
  assetId?: string | null;
  assetStorageUrl?: string | null;
  /** From GET /api/campaigns/:id — Bentley / Pinata durable state. */
  assetDurableBadge?: "temporary" | "stored" | "optimized" | null;
  errorMessage?: string | null;
  scheduledPublishMeta?: unknown;
  postedAt?: string | null;
};

function assetDurableBadgeLabel(b: Post["assetDurableBadge"]): string | null {
  if (b === "temporary") return "Temporary image";
  if (b === "stored") return "Stored";
  if (b === "optimized") return "Optimized";
  return null;
}

function postStatusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "POSTED") return "Published";
  if (s === "PUBLISHING") return "Publishing";
  if (s === "SCHEDULED") return "Scheduled";
  if (s === "RETRY_SCHEDULED") return "Retry scheduled";
  if (s === "FAILED") return "Failed";
  if (s === "DRAFT") return "Draft";
  return status;
}

type CampaignDetail = Campaign & { posts: Post[] };

const API_INSTRUCTIONS: Record<string, { title: string; steps: string[] }> = {
  linkedin: {
    title: "LinkedIn API",
    steps: [
      "Go to https://www.linkedin.com/developers/",
      "Create or sign in to your app (Add product: Share on LinkedIn)",
      "Request w_member_social permission under Products",
      "Add redirect URI (your app callback URL) under Auth settings",
      "Copy Client ID and Client Secret into your .env as LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET",
    ],
  },
  instagram: {
    title: "Instagram / Meta API",
    steps: [
      "Go to https://developers.facebook.com/",
      "Create an app (Business type) and add Instagram Graph API product",
      "Add Facebook Login product for OAuth",
      "Link your Instagram Business or Creator account to a Facebook Page",
      "Request permissions: instagram_business_basic, instagram_content_publish, pages_show_list, pages_read_engagement",
      "Add your callback URL to Valid OAuth Redirect URIs",
      "Copy App ID and App Secret into .env as META_APP_ID and META_APP_SECRET",
    ],
  },
  facebook: {
    title: "Facebook / Meta API",
    steps: [
      "Go to https://developers.facebook.com/",
      "Create an app (Business type) and add Facebook Login product",
      "Request permissions: pages_manage_posts, pages_show_list, pages_read_engagement",
      "Add your callback URL to Valid OAuth Redirect URIs",
      "Copy App ID and App Secret into .env as META_APP_ID and META_APP_SECRET",
    ],
  },
  tiktok: {
    title: "TikTok API",
    steps: [
      "Go to https://developers.tiktok.com/",
      "Create an app and add Login Kit (and Content Posting API if available)",
      "Configure redirect URI in App settings",
      "Request scopes: user.info.basic, video.publish, video.list",
      "Copy Client Key and Client Secret into .env as TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET",
    ],
  },
  pinterest: {
    title: "Pinterest API",
    steps: [
      "Go to https://developers.pinterest.com/",
      "Create a business app",
      "Add redirect URI and request scopes: user_accounts:read, boards:read, pins:read, pins:write",
      "Copy App ID and App Secret into .env as PINTEREST_APP_ID and PINTEREST_APP_SECRET",
    ],
  },
  snapchat: {
    title: "Snapchat Marketing API",
    steps: [
      "Go to Snap Business Manager: https://business.snapchat.com/",
      "In Business Details, create an OAuth app (Organization Admin required)",
      "Add redirect URI and agree to Developer Terms",
      "Copy Client ID and Client Secret (shown once) into .env as SNAPCHAT_CLIENT_ID and SNAPCHAT_CLIENT_SECRET",
    ],
  },
};

export function CampaignLaunchSection({
  clientId,
  postingTargets,
  launchPrefill,
  campaignGenerated,
}: {
  /** Prop kept for API parity with dashboard / future server calls. */
  userId: string;
  clientId: string;
  /** When set (e.g. from guided intake), only these networks show OAuth connect CTAs and API-instruction options. */
  postingTargets?: SocialPlatform[];
  /** From Bentley snapshot — caption, hooks, CTA, campaign name when pipeline produced a campaign. */
  launchPrefill?: BentleyLaunchPrefill;
  /** When true, empty manual fields are filled from `launchPrefill` if present. */
  campaignGenerated?: boolean;
}) {
  const { data: accounts = [] } = useSocialAccounts(clientId);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [createCampaignLoading, setCreateCampaignLoading] = useState(false);

  // Window 1: Video
  const [videoOrientation, setVideoOrientation] = useState<"portrait" | "landscape">("landscape");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (videoFile) {
      const url = URL.createObjectURL(videoFile);
      setVideoPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setVideoPreviewUrl(null);
  }, [videoFile]);

  // Window 2: Images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [emojis, setEmojis] = useState("");
  /** Once true, Bentley prefill must not overwrite the field. */
  const [userEditedCampaignName, setUserEditedCampaignName] = useState(false);
  const [userEditedDescription, setUserEditedDescription] = useState(false);

  // Window 3: Active instruction platform
  const [instructionPlatform, setInstructionPlatform] = useState<string>("linkedin");

  const qs = clientId ? `?clientId=${encodeURIComponent(clientId)}` : "";

  useEffect(() => {
    if (!campaignGenerated || !launchPrefill) return;
    if (!userEditedCampaignName) {
      setNewCampaignName((prev) =>
        nextNewCampaignNameAfterLaunchPrefill(campaignGenerated, launchPrefill, prev)
      );
    }
    if (!userEditedDescription) {
      setDescription((prev) =>
        nextDescriptionAfterLaunchPrefill(campaignGenerated, launchPrefill, prev)
      );
    }
  }, [campaignGenerated, launchPrefill, userEditedCampaignName, userEditedDescription]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/campaigns${qs}`);
        if (r.ok) {
          const j = await r.json();
          setCampaigns(j.campaigns ?? []);
        }
      } catch {
        setCampaigns([]);
      }
    })();
  }, [qs]);

  const loadCampaign = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/${id}`);
      if (!r.ok) throw new Error("Failed to load campaign");
      const j = await r.json();
      setSelectedCampaign(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreateCampaignLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCampaignName.trim(),
          clientId: clientId || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? "Failed to create");
      setNewCampaignName("");
      setCampaigns((prev) => [
        { id: j.id, name: newCampaignName.trim(), status: "DRAFT", createdAt: new Date().toISOString() },
        ...prev,
      ]);
      setMessage("Campaign created");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setCreateCampaignLoading(false);
    }
  };

  const connectPlatform = (platform: string) => {
    const url = `/api/social/oauth/${platform}/start${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`;
    window.location.href = url;
  };

  const publishPost = async (postId: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/campaigns/posts/${postId}/publish`, {
        method: "POST",
      });
      const j = (await r.json()) as PublishApiErrorBody;
      if (!r.ok) {
        const row = selectedCampaign?.posts.find((x) => x.id === postId);
        const plat = row ? normalizeAccountPlatformToSocialPlatform(row.platform) : null;
        throw new Error(userFacingMessageForPublishApiFailure(r.status, j, plat));
      }
      setMessage("Posted!");
      if (selectedCampaign) loadCampaign(selectedCampaign.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setLoading(false);
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "image/jpeg" || f.type === "image/jpg" || f.type === "image/gif"
    );
    setImageFiles((prev) => [...prev, ...files]);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const valid = files.filter((f) =>
      ["image/jpeg", "image/jpg", "image/gif"].includes(f.type)
    );
    setImageFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  };

  const connectedPlatforms = connectedSocialPlatformsSet(accounts);
  const platforms = useMemo(
    () => filterCampaignLaunchPlatformsByTargets(postingTargets),
    [postingTargets]
  );

  const launchReadiness = useMemo(
    () => computeLaunchTargetsReadiness(platforms, accounts, connectedPlatforms),
    [platforms, accounts, connectedPlatforms]
  );

  const [wfGen, setWfGen] = useState(0);
  useEffect(() => {
    const bump = () => setWfGen((n) => n + 1);
    window.addEventListener("bentley-workflow-updated", bump);
    const unsub = subscribeBentleyWorkflowCrossTab(bump);
    return () => {
      window.removeEventListener("bentley-workflow-updated", bump);
      unsub();
    };
  }, []);

  const wfState = useMemo(() => loadWorkflowState(), [wfGen]);

  const bentleyCampaignArtifact = useMemo(
    () =>
      describeBentleyCampaignArtifactForLaunch({
        campaignGenerated: campaignGenerated === true,
        hasLaunchPrefillBody: Boolean(
          coerceTrimmedString(launchPrefill?.caption) ||
            coerceTrimmedString(launchPrefill?.hooks) ||
            coerceTrimmedString(launchPrefill?.cta) ||
            coerceTrimmedString(launchPrefill?.campaignName)
        ),
        workflow: wfState,
      }),
    [campaignGenerated, launchPrefill, wfState]
  );

  const showPrefillBanner = Boolean(campaignGenerated && launchPrefill);

  useEffect(() => {
    if (!postingTargets?.length) return;
    const set = new Set(postingTargets);
    if (!set.has(instructionPlatform as SocialPlatform)) {
      const first = platforms[0]?.key;
      if (first) setInstructionPlatform(first);
    }
  }, [instructionPlatform, postingTargets, platforms]);

  const copyInstructions = () => {
    const inst = API_INSTRUCTIONS[instructionPlatform];
    if (!inst) {
      setMessage("Select a platform first");
      return;
    }
    const text = `How to obtain ${inst.title} for Marketing Launch:\n\n${inst.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
    navigator.clipboard.writeText(text).then(() => setMessage("Instructions copied"));
  };

  const windowBase =
    "rounded-2xl border p-4 flex flex-col min-h-[260px]";
  const windowStyle = {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderColor: "rgba(212,175,55,0.6)",
  };

  return (
    <div
      className="rounded-2xl p-4 border mt-10"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", borderColor: GOLD }}
    >
      <h2 className="text-lg font-semibold mb-1" style={{ color: GOLD }}>
        Launch Campaigns
      </h2>
      <p className="text-gray-500 text-xs mb-3">
        Assets → copy → client API steps → connect accounts → create campaign & posts.
      </p>

      <div
        className="mb-3 rounded-lg border border-[#D4AF37]/30 bg-black/35 px-2.5 py-2 text-[11px] text-gray-300 flex flex-wrap gap-x-3 gap-y-1"
        data-testid="launch-readiness-summary"
      >
        <span title={bentleyCampaignArtifact.detail}>
          <span className="text-gray-500">Bentley campaign</span> · {bentleyCampaignArtifact.shortLabel}
        </span>
        <span>
          <span className="text-gray-500">Targets</span> · {launchReadiness.selectedCount}
        </span>
        <span>
          <span className="text-gray-500">Publish-ready</span> · {launchReadiness.publishReadyCount}
        </span>
        <span>
          <span className="text-gray-500">Reconnect</span> · {launchReadiness.reconnectRequiredCount}
        </span>
        <span>
          <span className="text-gray-500">Manual-only</span> · {launchReadiness.manualOnlyCount}
        </span>
        {launchReadiness.connectRequiredCount > 0 ? (
          <span className="text-amber-200/90">
            Connect required · {launchReadiness.connectRequiredCount}
          </span>
        ) : null}
      </div>

      {showPrefillBanner ? (
        <div
          className="mb-3 text-[11px] leading-snug text-amber-200/90 border border-amber-500/25 rounded-lg px-2.5 py-1.5 bg-amber-950/25"
          data-testid="bentley-prefill-note"
        >
          Prefilled from Bentley campaign output. Your edits stay — we don&apos;t overwrite manual changes.
        </div>
      ) : null}

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-green-900/30 text-green-300 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-900/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Three windows in grid */}
      <div className="grid md:grid-cols-3 gap-4 mb-5">
        {/* Window 1: Video & constraints */}
        <div className={`${windowBase}`} style={windowStyle}>
          <h3 className="text-base font-semibold mb-3" style={{ color: GOLD }}>
            1. Video
          </h3>
          <p className="text-gray-500 text-xs mb-4">
            Portrait or landscape. Max size per platform limits.
          </p>
          <div className="space-y-4 flex-1">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Orientation</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setVideoOrientation("portrait")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    videoOrientation === "portrait"
                      ? "bg-[#D4AF37] text-black"
                      : "border border-[#D4AF37]/50 text-gray-300 hover:bg-[#D4AF37]/10"
                  }`}
                >
                  Portrait (9:16)
                </button>
                <button
                  onClick={() => setVideoOrientation("landscape")}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    videoOrientation === "landscape"
                      ? "bg-[#D4AF37] text-black"
                      : "border border-[#D4AF37]/50 text-gray-300 hover:bg-[#D4AF37]/10"
                  }`}
                >
                  Landscape (16:9)
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Upload video</label>
              <label
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-[#D4AF37]/70"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-[#D4AF37]/70"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-[#D4AF37]/70");
                  const f = e.dataTransfer.files[0];
                  if (f?.type.startsWith("video/")) setVideoFile(f);
                }}
                className="block border-2 border-dashed rounded-xl overflow-hidden cursor-pointer hover:border-[#D4AF37]/60 transition-colors relative group"
                style={{
                  borderColor: "rgba(212,175,55,0.4)",
                  aspectRatio: videoOrientation === "portrait" ? "9/16" : "16/9",
                }}
              >
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
                />
                {videoPreviewUrl ? (
                  <video
                    src={videoPreviewUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    controls
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-gray-500">Drop or select video</span>
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none">
                  {videoPreviewUrl && (
                    <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium px-3 py-1 rounded-lg bg-black/50 transition-opacity">
                      Change video
                    </span>
                  )}
                </div>
              </label>
              {videoFile && (
                <div className="mt-1 text-xs text-gray-500 truncate">{videoFile.name}</div>
              )}
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>TikTok/Reels: 1080×1920 (portrait) or 1920×1080 (landscape)</div>
              <div>LinkedIn: 1:1 or 16:9 recommended</div>
            </div>
          </div>
        </div>

        {/* Window 2: Images, description, emojis */}
        <div className={`${windowBase}`} style={windowStyle}>
          <h3 className="text-base font-semibold mb-3" style={{ color: GOLD }}>
            2. Images & Copy
          </h3>
          <p className="text-gray-500 text-xs mb-4">
            JPEG or GIF uploads. Description and emojis for captions.
          </p>
          <div className="space-y-4 flex-1">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Upload images (JPEG, GIF)</label>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleImageDrop}
                className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-[#D4AF37]/60 transition-colors"
                style={{ borderColor: "rgba(212,175,55,0.4)" }}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/gif"
                  multiple
                  className="hidden"
                  id="img-upload"
                  onChange={handleImageSelect}
                />
                <label htmlFor="img-upload" className="cursor-pointer block">
                  {imageFiles.length > 0 ? (
                    <span className="text-gray-300">{imageFiles.length} file(s) selected</span>
                  ) : (
                    <span className="text-gray-500">Drop or select JPEG/GIF</span>
                  )}
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => {
                  setUserEditedDescription(true);
                  setDescription(e.target.value);
                }}
                placeholder="Post caption, CTA, hashtags..."
                rows={3}
                className="w-full p-3 rounded-xl border bg-black/40 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37] resize-none"
                style={{ borderColor: "rgba(212,175,55,0.5)" }}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-2">Emojis (optional)</label>
              <input
                value={emojis}
                onChange={(e) => setEmojis(e.target.value)}
                placeholder="🚀 💡 ✨"
                className="w-full p-3 rounded-xl border bg-black/40 text-white placeholder-gray-500 focus:outline-none focus:border-[#D4AF37]"
                style={{ borderColor: "rgba(212,175,55,0.5)" }}
              />
            </div>
          </div>
        </div>

        {/* Window 3: API instructions for consultant */}
        <div className={`${windowBase}`} style={windowStyle}>
          <h3 className="text-base font-semibold mb-3" style={{ color: GOLD }}>
            3. API Instructions for Client
          </h3>
          <p className="text-gray-500 text-xs mb-4">
            Share these steps so your client can obtain and place their API keys for the marketing launch.
          </p>
          <div className="space-y-4 flex-1">
            <div>
              <label className="text-sm text-gray-400 block mb-2">Platform</label>
              <select
                value={instructionPlatform}
                onChange={(e) => setInstructionPlatform(e.target.value)}
                className="w-full p-3 rounded-xl border bg-black/40 text-white focus:outline-none focus:border-[#D4AF37]"
                style={{ borderColor: "rgba(212,175,55,0.5)" }}
              >
                {platforms.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.key === "instagram" ? "Instagram / Meta" : p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-gray-300 space-y-2">
              {(API_INSTRUCTIONS[instructionPlatform]?.steps ?? []).map((step, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[#D4AF37]">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <button
              onClick={copyInstructions}
              className="mt-auto px-4 py-2 rounded-xl text-sm font-medium border hover:bg-[#D4AF37]/10"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              Copy instructions
            </button>
          </div>
        </div>
      </div>

      {/* Connect accounts + Campaign flow */}
      <div className="pt-6 border-t" style={{ borderColor: "rgba(212,175,55,0.3)" }}>
        <div className="text-sm text-gray-400 mb-3">Connected accounts</div>
        <div className="flex flex-wrap gap-3 mb-6">
          {accounts.map((a) => {
            const canon = a.platformCanonical ?? normalizeAccountPlatformToSocialPlatform(a.platform);
            const stale = canon ? socialAccountTokenLikelyExpired(a.expiresAt) : false;
            return (
              <div
                key={a.id}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border"
                style={{ borderColor: "rgba(212,175,55,0.5)", backgroundColor: "rgba(0,0,0,0.3)" }}
              >
                <span className="capitalize">{a.platform}</span>
                {a.displayName && (
                  <span className="text-gray-500 text-sm">({a.displayName})</span>
                )}
                {stale && canon && isAutomatedOAuthPublishSupported(canon) && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-amber-500/50 text-amber-200/90">
                    Reconnect
                  </span>
                )}
              </div>
            );
          })}
          {platforms.map((p) => {
            if (!isAutomatedOAuthPublishSupported(p.key)) {
              return (
                <div
                  key={p.key}
                  className="px-3 py-2 rounded-xl border border-gray-600/60 text-xs text-gray-400 max-w-xs"
                >
                  {p.label}: server publish not wired yet — use panel 3 or post manually.
                </div>
              );
            }
            return connectedPlatforms.has(p.key) ? null : (
              <button
                key={p.key}
                type="button"
                onClick={() => connectPlatform(p.key)}
                className="px-4 py-2 rounded-xl border hover:bg-white/5 transition-colors"
                style={{ borderColor: GOLD }}
              >
                Connect {p.label}
              </button>
            );
          })}
          {postingTargets && postingTargets.length > 0 && platforms.length === 0 ? (
            <p className="text-xs text-amber-200/90 max-w-md">
              No OAuth-eligible targets match your current selection. Add publish targets under{" "}
              <span className="text-slate-200">Analysis context → OAuth posting targets</span>, or use manual posting
              instructions for networks we do not connect yet.
            </p>
          ) : null}
        </div>

        <div className="flex gap-3 mb-4">
          <input
            value={newCampaignName}
            onChange={(e) => {
              setUserEditedCampaignName(true);
              setNewCampaignName(e.target.value);
            }}
            placeholder="Campaign name"
            className="flex-1 p-3 rounded-xl border bg-black/40 text-white focus:outline-none focus:border-[#D4AF37]"
            style={{ borderColor: "rgba(212,175,55,0.5)" }}
          />
          <button
            onClick={createCampaign}
            disabled={createCampaignLoading || !newCampaignName.trim()}
            className="px-5 py-2 rounded-xl font-medium disabled:opacity-50"
            style={{
              background: "linear-gradient(180deg, #F5C518 0%, #D4AF37 50%, #B8860B 100%)",
              color: "#000",
            }}
          >
            {createCampaignLoading ? "Creating…" : "Create Campaign"}
          </button>
        </div>

        {campaigns.length > 0 && (
          <div>
            <div className="text-sm text-gray-400 mb-3">Campaigns</div>
            <div className="space-y-2">
              {campaigns.map((c) => (
                <button
                  key={c.id}
                  onClick={() => loadCampaign(c.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    selectedCampaign?.id === c.id ? "ring-2 ring-[#D4AF37]" : ""
                  }`}
                  style={{
                    backgroundColor: selectedCampaign?.id === c.id ? "rgba(212,175,55,0.1)" : "rgba(0,0,0,0.3)",
                    borderColor: "rgba(212,175,55,0.5)",
                  }}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.accessSource === "assignment" ? (
                    <span className="ml-2 text-xs text-amber-200/90">Shared</span>
                  ) : null}
                  {c.accessSource === "assignment" && c.viewerCampaignReviewerRole ? (
                    <span className="ml-1 text-xs text-gray-500">· {c.viewerCampaignReviewerRole}</span>
                  ) : null}
                  <span className="ml-2 text-gray-500 text-sm">({c.status})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedCampaign && selectedCampaign.posts?.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Posts</div>
            <div className="space-y-2">
              {selectedCampaign.posts.map((p) => {
                const postPlat = normalizeAccountPlatformToSocialPlatform(p.platform);
                const presentation = getCampaignPostLaunchPresentation({
                  status: p.status,
                  platformRaw: p.platform,
                  accounts,
                  connectedPlatforms,
                });
                const automated = isAutomatedOAuthPublishSupported(postPlat);
                const acct = postPlat ? accountForPostingPlatform(accounts, postPlat) : undefined;
                const connected = postPlat ? connectedPlatforms.has(postPlat) : false;
                const tokenStale =
                  Boolean(postPlat && acct && socialAccountTokenLikelyExpired(acct.expiresAt));
                const canServerPublish = automated && connected && !tokenStale;
                const meta = parseScheduledPublishMeta(p.scheduledPublishMeta);
                const canManualPublish =
                  p.status === "DRAFT" ||
                  p.status === "SCHEDULED" ||
                  p.status === "FAILED" ||
                  p.status === "RETRY_SCHEDULED";
                const platformTitle = postPlat ? postingPlatformDisplayName(postPlat) : p.platform;
                return (
                <div
                  key={p.id}
                  className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
                  style={{ backgroundColor: "rgba(0,0,0,0.3)", borderColor: "rgba(212,175,55,0.4)" }}
                  data-testid={`post-row-${p.id}`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-gray-100">{platformTitle}</span>
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-[#D4AF37]/40 text-[#E8D5A3]`}
                      >
                        {presentation.launchBadge}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          p.status === "POSTED"
                            ? "border-emerald-500/50 text-emerald-200"
                            : p.status === "FAILED"
                              ? "border-red-500/50 text-red-200"
                              : p.status === "PUBLISHING"
                                ? "border-cyan-500/50 text-cyan-100"
                                : p.status === "RETRY_SCHEDULED"
                                  ? "border-amber-500/50 text-amber-100"
                                  : "border-gray-500/50 text-gray-300"
                        }`}
                      >
                        {postStatusLabel(p.status)}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500">{presentation.serverPublishLine}</div>
                    <div className="text-[11px] text-gray-300">{presentation.nextActionLine}</div>
                    {presentation.publishAvailabilityNote ? (
                      <div className="text-[11px] text-amber-200/85">{presentation.publishAvailabilityNote}</div>
                    ) : null}
                    {p.scheduledAt && (
                      <div className="text-[11px] text-gray-500">
                        Slot: {new Date(p.scheduledAt).toLocaleString()}
                      </div>
                    )}
                    {meta.nextPublishAttemptAt && p.status === "RETRY_SCHEDULED" && (
                      <div className="text-[11px] text-amber-200/90">
                        Next retry: {new Date(meta.nextPublishAttemptAt).toLocaleString()}
                      </div>
                    )}
                    {p.errorMessage && (p.status === "FAILED" || p.status === "RETRY_SCHEDULED") && (
                      <div className="text-[11px] text-red-300/90 break-words line-clamp-2" title={p.errorMessage}>
                        {p.errorMessage}
                      </div>
                    )}
                    {p.assetStorageUrl ? (
                      <div className="mt-2 flex items-start gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.assetStorageUrl}
                          alt=""
                          className="w-20 h-20 rounded-lg object-cover border border-[#D4AF37]/30 shrink-0"
                        />
                        <div className="pt-0.5 space-y-1">
                          <div className="text-[10px] text-gray-500">Post media</div>
                          {assetDurableBadgeLabel(p.assetDurableBadge) ? (
                            <span
                              className={`inline-block text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                                p.assetDurableBadge === "temporary"
                                  ? "border-amber-500/50 text-amber-100/95"
                                  : p.assetDurableBadge === "optimized"
                                    ? "border-cyan-500/45 text-cyan-100/90"
                                    : "border-emerald-500/40 text-emerald-100/90"
                              }`}
                            >
                              {assetDurableBadgeLabel(p.assetDurableBadge)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {canManualPublish && automated ? (
                  <div className="flex flex-col items-stretch sm:items-end gap-1 shrink-0">
                    {tokenStale && postPlat ? (
                        <button
                          type="button"
                          onClick={() => connectPlatform(postPlat)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-500/60 text-amber-100 hover:bg-amber-950/30"
                        >
                          Reconnect {postingPlatformDisplayName(postPlat)}
                        </button>
                      ) : !connected && postPlat ? (
                        <button
                          type="button"
                          onClick={() => connectPlatform(postPlat)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#D4AF37]/70 text-[#F5E6A3] hover:bg-[#D4AF37]/10"
                        >
                          Connect {postingPlatformDisplayName(postPlat)} to publish
                        </button>
                      ) : (
                        <>
                        <button
                          type="button"
                          onClick={() => publishPost(p.id)}
                          disabled={loading || !postPlat || !canServerPublish}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                          style={{ background: GOLD, color: "#000" }}
                        >
                          {p.status === "FAILED" || p.status === "RETRY_SCHEDULED" ? "Retry now" : "Publish now"}
                        </button>
                        {loading ? (
                          <span className="text-[10px] text-gray-500 text-right">Finishing publish request…</span>
                        ) : null}
                        </>
                      )}
                  </div>
                  ) : null}
                </div>
              );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Reads `launchPrefill` / `pipeline.campaignGenerated` from shared Bentley snapshot (must render under `AiRevenueOsSharedStateProvider`). */
export function CampaignLaunchSectionFromBentleySnapshot({
  userId,
  clientId,
  postingTargets,
}: {
  userId: string;
  clientId: string;
  postingTargets?: SocialPlatform[];
}) {
  useAiRevenueOsSnapshotSignature();
  const { getBentleySnapshot } = useAiRevenueOsBentleyActions();
  const { launchPrefill, campaignGenerated } = bentleySnapshotToCampaignLaunchPrefillBridge(getBentleySnapshot());
  return (
    <CampaignLaunchSection
      userId={userId}
      clientId={clientId}
      postingTargets={postingTargets}
      launchPrefill={launchPrefill}
      campaignGenerated={campaignGenerated}
    />
  );
}
