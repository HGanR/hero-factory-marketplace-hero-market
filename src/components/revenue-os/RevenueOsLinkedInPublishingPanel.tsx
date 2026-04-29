"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY } from "@/lib/revenue-os/bentley-publish-approval-chat";
import { X_BENTLEY_PUBLISH_APPROVAL_SESSION } from "@/lib/social/effective-publish-approval-request";
import { SocialPublishingStatusBadgeInline } from "@/components/revenue-os/SocialPublishingStatusBadge";
import {
  GOVERNED_SOCIAL_PUBLISH_PLATFORMS,
  type GovernedSocialPublishPlatform,
} from "@/lib/social/social-governed-platforms";
import {
  formatComposerSocialAccountLabel,
  governedProviderLabel,
  labelForStoredPostProvider,
} from "@/lib/social/social-composer-labels";

type AccountRow = {
  id: string;
  provider: string;
  platform?: string;
  displayName: string | null;
  providerAccountId: string | null;
  externalAccountId?: string | null;
  status: string;
  tokenExpiresAt: string | null;
  connectedAt: string | null;
};

type PostRow = {
  id: string;
  contentPreview: string;
  provider: string;
  assetId?: string | null;
  assetCreativeType?: string | null;
  scheduledFor: string | null;
  approvalStatus: string;
  publishStatus: string;
  lastError: string | null;
};

type CampaignAssetOption = {
  id: string;
  creativeType: string;
  hasStorageUrl: boolean;
  label: string;
  instagramPublishEligible?: boolean;
  facebookImageEligible?: boolean;
};

function buildOAuthStartPath(platform: GovernedSocialPublishPlatform): string {
  if (platform === "linkedin") return "/api/social/linkedin/start";
  return `/api/social/oauth/${platform}/start`;
}

export function RevenueOsLinkedInPublishingPanel() {
  const [clientId, setClientId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [campaignAssets, setCampaignAssets] = useState<CampaignAssetOption[]>([]);
  const [provider, setProvider] = useState<GovernedSocialPublishPlatform>("linkedin");
  const [accountId, setAccountId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [content, setContent] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [showAllProvidersInList, setShowAllProvidersInList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountsForProvider = useMemo(() => {
    const p = provider.toLowerCase();
    return accounts.filter((a) => String(a.provider || a.platform || "").toLowerCase() === p);
  }, [accounts, provider]);

  const instagramSelectableAssets = useMemo(
    () =>
      campaignAssets.filter((a) => {
        if (a.instagramPublishEligible === true) return true;
        if (a.instagramPublishEligible === false) return false;
        const ct = String(a.creativeType).toUpperCase();
        return a.hasStorageUrl && (ct === "IMAGE" || ct === "VIDEO");
      }),
    [campaignAssets]
  );

  const facebookImageAssets = useMemo(
    () =>
      campaignAssets.filter((a) => {
        if (a.facebookImageEligible === true) return true;
        if (a.facebookImageEligible === false) return false;
        return a.hasStorageUrl && String(a.creativeType).toUpperCase() === "IMAGE";
      }),
    [campaignAssets]
  );

  const selectedCampaignAsset = useMemo(
    () => campaignAssets.find((a) => a.id === assetId),
    [campaignAssets, assetId]
  );

  const refreshAccounts = useCallback(async () => {
    if (!clientId) return;
    const r = await fetch(`/api/social/accounts?clientId=${encodeURIComponent(clientId)}`);
    if (!r.ok) return;
    const j = (await r.json()) as { accounts?: AccountRow[] };
    setAccounts(j.accounts ?? []);
  }, [clientId]);

  const refreshPosts = useCallback(async () => {
    if (!campaignId) return;
    const q = new URLSearchParams({ campaignId });
    if (!showAllProvidersInList) q.set("provider", provider);
    const r = await fetch(`/api/social/posts?${q.toString()}`);
    if (!r.ok) return;
    const j = (await r.json()) as { posts?: PostRow[] };
    setPosts(j.posts ?? []);
  }, [campaignId, provider, showAllProvidersInList]);

  const refreshCampaignAssets = useCallback(async () => {
    if (!campaignId) return;
    const r = await fetch(`/api/social/campaign-assets?campaignId=${encodeURIComponent(campaignId)}`);
    if (!r.ok) {
      setCampaignAssets([]);
      return;
    }
    const j = (await r.json()) as { assets?: CampaignAssetOption[] };
    setCampaignAssets(j.assets ?? []);
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/clients/me");
        if (!r.ok || cancelled) return;
        const j = (await r.json()) as { client?: { id: string } | null };
        if (j.client?.id) setClientId(j.client.id);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/campaigns?clientId=${encodeURIComponent(clientId)}`);
      if (!r.ok || cancelled) return;
      const j = (await r.json()) as { campaigns?: { id: string; name: string }[] };
      const list = j.campaigns ?? [];
      setCampaigns(list);
      if (!campaignId && list[0]) setCampaignId(list[0].id);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, campaignId]);

  useEffect(() => {
    void refreshAccounts();
  }, [refreshAccounts]);

  useEffect(() => {
    void refreshPosts();
  }, [refreshPosts]);

  useEffect(() => {
    void refreshCampaignAssets();
  }, [refreshCampaignAssets]);

  useEffect(() => {
    if (!accountId) return;
    const ok = accountsForProvider.some((a) => a.id === accountId);
    if (!ok) setAccountId("");
  }, [accountsForProvider, accountId]);

  useEffect(() => {
    if (provider !== "instagram") setAssetId("");
  }, [provider]);

  const connectHref = useCallback(
    (p: GovernedSocialPublishPlatform) => {
      const u = new URL(
        buildOAuthStartPath(p),
        typeof window !== "undefined" ? window.location.origin : "http://localhost"
      );
      if (clientId) u.searchParams.set("clientId", clientId);
      u.searchParams.set("returnTo", "/ai-revenue-os");
      return u.toString();
    },
    [clientId]
  );

  const submitPost = async () => {
    setError(null);
    if (!campaignId || !accountId || !content.trim()) {
      setError(`Choose a campaign, ${governedProviderLabel(provider)} account, and post text.`);
      return;
    }
    if (provider === "instagram" && scheduledFor && !assetId.trim()) {
      setError(
        "Instagram scheduled posts require a campaign image or video asset. Pick one below or save as draft without a schedule."
      );
      return;
    }
    if (
      provider === "instagram" &&
      scheduledFor &&
      assetId.trim() &&
      selectedCampaignAsset &&
      selectedCampaignAsset.instagramPublishEligible === false
    ) {
      setError("Selected asset is not eligible for Instagram (need IMAGE or VIDEO with a storage URL).");
      return;
    }
    setLoading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (typeof window !== "undefined" && sessionStorage.getItem(BENTLEY_UI_REQUIRE_APPROVAL_SESSION_KEY) === "1") {
        headers[X_BENTLEY_PUBLISH_APPROVAL_SESSION] = "1";
      }
      const body: Record<string, unknown> = {
        provider,
        campaignId,
        accountId,
        content: content.trim(),
      };
      if (scheduledFor) body.scheduledFor = new Date(scheduledFor).toISOString();
      if (linkUrl.trim()) body.linkUrl = linkUrl.trim();
      if (assetId.trim()) body.assetId = assetId.trim();

      const r = await fetch("/api/social/posts", { method: "POST", headers, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          (j as { message?: string }).message ||
          (j as { error?: string }).error ||
          (typeof (j as { details?: unknown }).details === "object"
            ? JSON.stringify((j as { details: unknown }).details)
            : null) ||
          "Create failed";
        setError(msg);
        return;
      }
      setContent("");
      setScheduledFor("");
      setLinkUrl("");
      setAssetId("");
      await refreshPosts();
    } finally {
      setLoading(false);
    }
  };

  const instagramNeedsMedia = provider === "instagram" && !assetId.trim();

  return (
    <section
      data-testid="revenue-os-linkedin-publishing"
      className="rounded-2xl border border-cyan-500/35 bg-slate-900/70 p-4 shadow-[0_4px_24px_rgba(0,209,255,0.08)]"
      aria-label="Governed social publishing"
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Social publishing</div>
      <p className="mt-1 text-[11px] text-slate-500 leading-snug">
        Create governed posts for LinkedIn, Facebook Page, or Instagram Business. Approval, scheduling, and publishing use
        the same <code className="text-slate-400">campaign_posts</code> model and worker as the planner.
      </p>

      <div className="mt-4 space-y-3 text-xs text-slate-200">
        <div>
          <div className="text-slate-500 mb-1">Connect accounts</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <a href={connectHref("linkedin")} className="text-cyan-400 hover:underline" data-testid="connect-linkedin">
              LinkedIn
            </a>
            <a href={connectHref("facebook")} className="text-cyan-400 hover:underline" data-testid="connect-facebook">
              Facebook
            </a>
            <a href={connectHref("instagram")} className="text-cyan-400 hover:underline" data-testid="connect-instagram">
              Instagram
            </a>
          </div>
          <ul data-testid="composer-account-summary" className="mt-2 space-y-1 text-slate-500">
            {accounts.length === 0 ? (
              <li>No social accounts connected for this client.</li>
            ) : (
              accounts.map((a) => (
                <li key={a.id} className="flex justify-between gap-2">
                  <span className="text-slate-300">
                    {labelForStoredPostProvider(a.provider)} —{" "}
                    {formatComposerSocialAccountLabel({
                      id: a.id,
                      platform: a.provider,
                      displayName: a.displayName,
                      externalAccountId: a.externalAccountId ?? a.providerAccountId,
                    })}
                  </span>
                  <span className="shrink-0">{a.status}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <label className="block">
          <span className="text-slate-500">Campaign</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            data-testid="composer-campaign-select"
          >
            <option value="">Select…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-slate-500">Provider</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={provider}
            onChange={(e) => setProvider(e.target.value as GovernedSocialPublishPlatform)}
            data-testid="composer-provider-select"
          >
            {GOVERNED_SOCIAL_PUBLISH_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {governedProviderLabel(p)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-slate-500">{governedProviderLabel(provider)} account</span>
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            data-testid="composer-account-select"
          >
            <option value="">Select…</option>
            {accountsForProvider.map((a) => (
              <option key={a.id} value={a.id}>
                {formatComposerSocialAccountLabel({
                  id: a.id,
                  platform: a.provider,
                  displayName: a.displayName,
                  externalAccountId: a.externalAccountId ?? a.providerAccountId,
                })}
              </option>
            ))}
          </select>
          {accountsForProvider.length === 0 ? (
            <p className="mt-1 text-[11px] text-amber-500/90" data-testid="composer-no-accounts-for-provider">
              No connected account for this provider. Use a connect link above (each connection is stored separately).
            </p>
          ) : null}
        </label>

        {provider === "instagram" ? (
          <div
            className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-2 text-[11px] text-amber-100/95"
            data-testid="composer-instagram-media-notice"
          >
            <strong className="font-semibold">Instagram:</strong> Graph Content Publishing requires a public URL to an{" "}
            <strong>image or video</strong> file. Scheduled posts must include media; drafts may omit it until you attach
            media. Carousel/multi-image is not supported yet.
          </div>
        ) : null}

        {provider === "facebook" ? (
          <p className="text-[11px] text-slate-500" data-testid="composer-facebook-media-hint">
            Optional: attach a campaign <strong>IMAGE</strong> to publish as a Page photo (caption + link are merged into
            the photo caption). Text/link-only posts still supported. Video not implemented for Facebook.
          </p>
        ) : null}

        {provider === "linkedin" ? (
          <p className="text-[11px] text-slate-500" data-testid="composer-linkedin-asset-hint">
            Optional campaign asset: stored on the post for future use — LinkedIn publishing still uses text and link
            preview only in-app today.
          </p>
        ) : null}

        {provider === "instagram" ? (
          <label className="block">
            <span className="text-slate-500">Image or video asset (campaign)</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              data-testid="composer-asset-select"
            >
              <option value="">None (draft only — attach before schedule/publish)</option>
              {instagramSelectableAssets.map((a) => (
                <option key={a.id} value={a.id} disabled={a.instagramPublishEligible === false}>
                  {a.label} · {a.id.slice(0, 8)}…
                  {a.instagramPublishEligible === false ? " (ineligible)" : ""}
                </option>
              ))}
            </select>
            {campaignId && instagramSelectableAssets.length === 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                No IMAGE/VIDEO assets with storage URL for this campaign. Add assets, then refresh.
              </p>
            ) : null}
          </label>
        ) : provider === "facebook" ? (
          <label className="block">
            <span className="text-slate-500">Optional image (Page photo)</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              data-testid="composer-facebook-asset-select"
            >
              <option value="">None — text or link post</option>
              {facebookImageAssets.map((a) => (
                <option key={a.id} value={a.id} disabled={a.facebookImageEligible === false}>
                  {a.label} · {a.id.slice(0, 8)}…
                </option>
              ))}
            </select>
          </label>
        ) : provider === "linkedin" ? (
          <label className="block">
            <span className="text-slate-500">Optional campaign asset</span>
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              data-testid="composer-linkedin-asset-select"
            >
              <option value="">None</option>
              {campaignAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.id.slice(0, 8)}…
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="block">
          <span className="text-slate-500">Post</span>
          <textarea
            className="mt-1 w-full min-h-[88px] rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            data-testid="composer-post-content"
          />
        </label>

        <label className="block">
          <span className="text-slate-500">Schedule (optional, local time)</span>
          <input
            type="datetime-local"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
            data-testid="composer-schedule-input"
          />
        </label>

        <label className="block">
          <span className="text-slate-500">Link URL (optional)</span>
          <input
            type="url"
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            data-testid="composer-link-url"
          />
        </label>

        {instagramNeedsMedia ? (
          <p className="text-[11px] text-amber-400/95" data-testid="composer-instagram-readiness-hint">
            Without image/video media, this post can be saved as a draft only. Scheduling requires an eligible asset
            (planner diagnostics: instagram_requires_media).
          </p>
        ) : null}

        {error ? <div className="text-amber-400 text-[11px]">{error}</div> : null}

        <button
          type="button"
          disabled={loading}
          onClick={() => void submitPost()}
          className="rounded bg-cyan-600/90 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          data-testid="composer-submit-post"
        >
          {loading ? "Saving…" : "Create / schedule post"}
        </button>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent posts</div>
          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={showAllProvidersInList}
              onChange={(e) => setShowAllProvidersInList(e.target.checked)}
              data-testid="composer-list-all-providers"
            />
            Show all providers
          </label>
        </div>
        <ul data-testid="composer-posts-list" className="mt-2 space-y-2 text-[11px]">
          {posts.length === 0 ? (
            <li className="text-slate-500">No posts yet for this campaign{showAllProvidersInList ? "" : ` (${governedProviderLabel(provider)})`}.</li>
          ) : (
            posts.map((p) => (
              <li key={p.id} className="rounded border border-slate-800 bg-slate-950/80 p-2">
                <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-slate-500">
                  <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-slate-300" data-testid="composer-post-provider-chip">
                    {labelForStoredPostProvider(p.provider)}
                  </span>
                  {p.provider === "instagram" && !p.assetId ? (
                    <span className="text-amber-500/90">No media</span>
                  ) : null}
                  {p.assetId ? (
                    <span className="text-slate-500">
                      Media{p.assetCreativeType ? ` (${p.assetCreativeType})` : ""}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-slate-200 line-clamp-2">{p.contentPreview}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                  <SocialPublishingStatusBadgeInline
                    approvalStatus={p.approvalStatus}
                    publishStatusLabel={p.publishStatus}
                  />
                  {p.scheduledFor ? <span>scheduled: {p.scheduledFor}</span> : null}
                  {p.lastError ? <span className="text-amber-500">error: {p.lastError}</span> : null}
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
