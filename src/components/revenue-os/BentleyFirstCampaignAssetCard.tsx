"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SocialPlatform } from "@/lib/social/config";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { RevenueOsDashboardFormValues } from "@/lib/revenue-os/run-revenue-os-analysis";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import {
  buildFirstCampaignDraft,
  focusKeyFromAnalysis,
  selectPrimaryPostingPlatform,
} from "@/lib/revenue-os/bentley-first-campaign-asset";
import { postingPlatformDisplayName } from "@/lib/revenue-os/bentley-posting-platforms";
import {
  connectedSocialPlatformsSet,
  normalizeAccountPlatformToSocialPlatform,
} from "@/lib/social/platform-identity";
import {
  isAutomatedOAuthPublishSupported,
  socialAccountTokenLikelyExpired,
  userFacingMessageForPublishApiFailure,
  type PublishApiErrorBody,
} from "@/lib/social/campaign-launch-publish-ui";
import type { SocialAccountLite } from "@/lib/social/social-account-public";
import {
  BENTLEY_FIRST_CAMPAIGN_ASSET_ANCHOR,
  BENTLEY_FIRST_CAMPAIGN_DRAFT_CHANGED_EVENT,
  BENTLEY_FIRST_CAMPAIGN_DRAFT_STORAGE_KEY,
  readFirstCampaignDraftMeta,
} from "@/lib/revenue-os/bentley-first-campaign-ui";
import { bentleyContinuityLog } from "@/lib/revenue-os/bentley-continuity-log";
import { removeBentleySessionScopedAndLegacy, writeBentleySession } from "@/lib/revenue-os/bentley-storage-scope";
import {
  buildCreatePostBody,
  buildPatchPostCopyBody,
} from "@/lib/revenue-os/campaign-post-payload";

const ACCENT = "#00D1FF";

/** Debounced PATCH delay when a server draft exists (ms). */
const AUTOSAVE_DEBOUNCE_MS = 1000;

/** How long success hints stay visible — long enough to read “Saved 8s ago” style labels (ms). */
const SAVED_HINT_MS = 60_000;

/** Relative label after a save timestamp: “just now” → “8s ago” → “2m ago”. */
function formatDraftSavedRelative(savedAtMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - savedAtMs) / 1000));
  if (sec < 3) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

type AutosaveUi = "idle" | "saving" | "saved" | "failed";
type ManualSaveUi = "idle" | "saving" | "saved";

type DraftMeta = { campaignId: string; postId: string; platform: SocialPlatform };

function readDraft(): DraftMeta | null {
  return readFirstCampaignDraftMeta() as DraftMeta | null;
}

function writeDraft(d: DraftMeta | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!d) removeBentleySessionScopedAndLegacy(BENTLEY_FIRST_CAMPAIGN_DRAFT_STORAGE_KEY);
    else writeBentleySession(BENTLEY_FIRST_CAMPAIGN_DRAFT_STORAGE_KEY, JSON.stringify(d));
    window.dispatchEvent(new CustomEvent(BENTLEY_FIRST_CAMPAIGN_DRAFT_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

type Props = {
  res: RevenueOsAnalyzeResponse;
  form: RevenueOsDashboardFormValues;
  postingPlatforms: SocialPlatform[];
  connectedAccounts: SocialAccountLite[];
  contentEngineOutput: ContentEngineOutput | null;
  clientId: string;
  oauthReturnTo: string;
};

export function BentleyFirstCampaignAssetCard({
  res,
  form,
  postingPlatforms,
  connectedAccounts,
  contentEngineOutput,
  clientId,
  oauthReturnTo,
}: Props) {
  const connectedSet = useMemo(
    () => connectedSocialPlatformsSet(connectedAccounts),
    [connectedAccounts]
  );

  const autoPrimary = useMemo(() => {
    if (postingPlatforms.length === 0) return null;
    const focus = focusKeyFromAnalysis(res);
    return selectPrimaryPostingPlatform(postingPlatforms, connectedSet, focus);
  }, [res, postingPlatforms, connectedSet]);

  const [platformChoice, setPlatformChoice] = useState<SocialPlatform | null>(null);
  useEffect(() => {
    setPlatformChoice(null);
  }, [autoPrimary]);

  const effectivePlatform = platformChoice ?? autoPrimary;

  const draft = useMemo(() => {
    if (!effectivePlatform) return null;
    return buildFirstCampaignDraft(effectivePlatform, contentEngineOutput, form, res);
  }, [effectivePlatform, contentEngineOutput, form, res]);

  const launchHydrationLoggedRef = useRef(false);
  useEffect(() => {
    if (launchHydrationLoggedRef.current) return;
    const cap = draft?.captionForPublish?.trim();
    if (!cap || !effectivePlatform) return;
    launchHydrationLoggedRef.current = true;
    bentleyContinuityLog("launch_card_hydrated", { platform: effectivePlatform, source: "first_campaign_draft" });
    bentleyContinuityLog("launch_card_ready", { platform: effectivePlatform, source: "first_campaign_draft" });
  }, [draft?.captionForPublish, effectivePlatform]);

  const [caption, setCaption] = useState("");
  useEffect(() => {
    if (draft?.captionForPublish) setCaption(draft.captionForPublish);
  }, [draft?.captionForPublish]);

  const [hashtags, setHashtags] = useState("");
  useEffect(() => {
    setHashtags(draft?.hashtags ?? "");
  }, [draft?.hashtags]);

  const [draftMeta, setDraftMeta] = useState<DraftMeta | null>(null);
  useEffect(() => {
    if (!effectivePlatform) return;
    const s = readDraft();
    if (s?.platform === effectivePlatform) {
      setDraftMeta(s);
    } else {
      if (s) writeDraft(null);
      setDraftMeta(null);
    }
  }, [effectivePlatform]);

  const isConnected = effectivePlatform ? connectedSet.has(effectivePlatform) : false;

  const automatedPublish = Boolean(
    effectivePlatform && isAutomatedOAuthPublishSupported(effectivePlatform)
  );

  const accountForPlatform = useMemo(() => {
    if (!effectivePlatform) return undefined;
    return connectedAccounts.find(
      (a) =>
        (a.platformCanonical ?? normalizeAccountPlatformToSocialPlatform(a.platform)) === effectivePlatform
    );
  }, [connectedAccounts, effectivePlatform]);

  const tokenLikelyExpired = Boolean(
    accountForPlatform && socialAccountTokenLikelyExpired(accountForPlatform.expiresAt)
  );

  const matchingDraft = useMemo(() => {
    if (!effectivePlatform) return null;
    if (draftMeta?.platform === effectivePlatform && draftMeta.postId && draftMeta.campaignId) {
      return draftMeta;
    }
    const s = readDraft();
    if (s?.platform === effectivePlatform && s.postId && s.campaignId) return s;
    return null;
  }, [draftMeta, effectivePlatform]);

  const [postAssetId, setPostAssetId] = useState<string | null>(null);
  useEffect(() => {
    const m = matchingDraft;
    if (!m?.campaignId || !m.postId) {
      setPostAssetId(null);
      return;
    }
    let ignore = false;
    (async () => {
      try {
        const r = await fetch(`/api/campaigns/${m.campaignId}`);
        if (!r.ok || ignore) return;
        const j = (await r.json()) as {
          posts?: Array<{ id: string; assetId?: string | null }>;
        };
        const row = j.posts?.find((p) => p.id === m.postId);
        if (!ignore) setPostAssetId(row?.assetId ?? null);
      } catch {
        if (!ignore) setPostAssetId(null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [matchingDraft?.campaignId, matchingDraft?.postId]);

  const captionReady = caption.trim().length > 0;

  const [preparing, setPreparing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [platformSwitchNote, setPlatformSwitchNote] = useState<string | null>(null);
  const [autosaveUi, setAutosaveUi] = useState<AutosaveUi>("idle");
  const [manualSaveUi, setManualSaveUi] = useState<ManualSaveUi>("idle");
  const [manualSavedAt, setManualSavedAt] = useState<number | null>(null);
  const [autosaveSavedAt, setAutosaveSavedAt] = useState<number | null>(null);
  /** Bumps once per second while a “saved” hint is shown so relative time updates. */
  const [saveRelativeTick, setSaveRelativeTick] = useState(0);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveAbortRef = useRef<AbortController | null>(null);
  const savedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMatchingPostIdRef = useRef<string | undefined>(undefined);

  const clearSavedHintTimer = useCallback(() => {
    if (savedHintTimerRef.current) {
      clearTimeout(savedHintTimerRef.current);
      savedHintTimerRef.current = null;
    }
  }, []);

  const scheduleSavedHintClear = useCallback(() => {
    clearSavedHintTimer();
    savedHintTimerRef.current = setTimeout(() => {
      savedHintTimerRef.current = null;
      setAutosaveUi((s) => (s === "saved" ? "idle" : s));
      setManualSaveUi((s) => (s === "saved" ? "idle" : s));
    }, SAVED_HINT_MS);
  }, [clearSavedHintTimer]);

  useEffect(() => {
    if (manualSaveUi !== "saved" && autosaveUi !== "saved") return;
    const id = setInterval(() => {
      setSaveRelativeTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [manualSaveUi, autosaveUi]);

  useEffect(() => {
    if (autosaveUi !== "saved") {
      setAutosaveSavedAt(null);
    }
  }, [autosaveUi]);

  useEffect(() => {
    if (manualSaveUi !== "saved") {
      setManualSavedAt(null);
    }
  }, [manualSaveUi]);

  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);

  const abortInFlightAutosave = useCallback(() => {
    autosaveAbortRef.current?.abort();
    autosaveAbortRef.current = null;
  }, []);

  const runPatchAutosave = useCallback(
    async (postId: string, cap: string, tags: string, signal: AbortSignal) => {
      setAutosaveUi("saving");
      try {
        const ur = await fetch(`/api/campaigns/posts/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildPatchPostCopyBody({
              caption: cap,
              hashtags: tags,
            })
          ),
          signal,
        });
        const uj = await ur.json();
        if (!ur.ok) throw new Error(uj?.message ?? "Autosave failed");
        const at = Date.now();
        setAutosaveSavedAt(at);
        setAutosaveUi("saved");
        scheduleSavedHintClear();
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          setAutosaveUi("idle");
          return;
        }
        setAutosaveUi("failed");
      }
    },
    [scheduleSavedHintClear]
  );

  const scheduleAutosave = useCallback(
    (cap: string, tags: string) => {
      const postId = matchingDraft?.postId;
      if (!postId) return;
      setAutosaveUi((s) => (s === "saved" || s === "failed" ? "idle" : s));
      clearAutosaveTimer();
      abortInFlightAutosave();
      autosaveTimerRef.current = setTimeout(() => {
        autosaveTimerRef.current = null;
        const ac = new AbortController();
        autosaveAbortRef.current = ac;
        void runPatchAutosave(postId, cap, tags, ac.signal).finally(() => {
          if (autosaveAbortRef.current === ac) autosaveAbortRef.current = null;
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [abortInFlightAutosave, clearAutosaveTimer, matchingDraft?.postId, runPatchAutosave]
  );

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
      abortInFlightAutosave();
      clearSavedHintTimer();
    };
  }, [abortInFlightAutosave, clearAutosaveTimer, clearSavedHintTimer]);

  useEffect(() => {
    const id = matchingDraft?.postId;
    const had = prevMatchingPostIdRef.current;
    if (had && !id) {
      clearAutosaveTimer();
      abortInFlightAutosave();
      setAutosaveUi("idle");
      setManualSaveUi("idle");
      clearSavedHintTimer();
    }
    prevMatchingPostIdRef.current = id;
  }, [abortInFlightAutosave, clearAutosaveTimer, clearSavedHintTimer, matchingDraft?.postId]);

  const onCaptionChange = (v: string) => {
    setCaption(v);
    if (matchingDraft?.postId) scheduleAutosave(v, hashtags);
  };

  const onHashtagsChange = (v: string) => {
    setHashtags(v);
    if (matchingDraft?.postId) scheduleAutosave(caption, v);
  };

  const prepareServerDraft = useCallback(async () => {
    if (!effectivePlatform || !draft) return;
    clearAutosaveTimer();
    abortInFlightAutosave();
    setAutosaveUi("idle");
    setManualSaveUi("saving");
    setPreparing(true);
    setErr(null);
    setMessage(null);
    try {
      if (matchingDraft?.postId && matchingDraft.campaignId) {
        const ur = await fetch(`/api/campaigns/posts/${matchingDraft.postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildPatchPostCopyBody({
              caption,
              hashtags,
            })
          ),
        });
        const uj = await ur.json();
        if (!ur.ok) throw new Error(uj?.message ?? "Could not update draft");
        const meta = {
          campaignId: matchingDraft.campaignId,
          postId: matchingDraft.postId,
          platform: effectivePlatform,
        };
        setDraftMeta(meta);
        writeDraft(meta);
        setManualSavedAt(Date.now());
        setManualSaveUi("saved");
        scheduleSavedHintClear();
        setPlatformSwitchNote(null);
        return;
      }

      let campaignId = draftMeta?.campaignId;
      if (!campaignId) {
        const cr = await fetch("/api/campaigns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `Revenue OS — ${form.businessName.slice(0, 48) || "Campaign"}`,
            clientId: clientId || undefined,
          }),
        });
        const cj = await cr.json();
        if (!cr.ok) throw new Error(cj?.message ?? "Could not create campaign");
        campaignId = cj.id as string;
      }

      const pr = await fetch(`/api/campaigns/${campaignId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildCreatePostBody({
            platform: effectivePlatform,
            caption,
            hashtags,
          })
        ),
      });
      const pj = await pr.json();
      if (!pr.ok) throw new Error(pj?.message ?? "Could not create post");

      const meta = { campaignId, postId: pj.id as string, platform: effectivePlatform };
      setDraftMeta(meta);
      writeDraft(meta);
      setMessage("Draft saved. You can publish when ready.");
      setManualSavedAt(Date.now());
      setManualSaveUi("saved");
      scheduleSavedHintClear();
      setPlatformSwitchNote(null);
    } catch (e) {
      setManualSaveUi("idle");
      setErr(e instanceof Error ? e.message : "Prepare failed");
    } finally {
      setPreparing(false);
    }
  }, [
    effectivePlatform,
    draft,
    draftMeta?.campaignId,
    matchingDraft,
    caption,
    hashtags,
    clientId,
    form.businessName,
    clearAutosaveTimer,
    abortInFlightAutosave,
    scheduleSavedHintClear,
  ]);

  const refreshFromContentEngine = useCallback(() => {
    if (!effectivePlatform) return;
    const d = buildFirstCampaignDraft(effectivePlatform, contentEngineOutput, form, res);
    setCaption(d.captionForPublish);
    setHashtags(d.hashtags ?? "");
    setErr(null);
    setMessage(
      contentEngineOutput
        ? "Fields refreshed from Content Engine and analysis context."
        : "Fields refreshed from analysis and form context (no Content Engine output on this page yet)."
    );
    if (matchingDraft?.postId) {
      scheduleAutosave(d.captionForPublish, d.hashtags ?? "");
    }
  }, [effectivePlatform, contentEngineOutput, form, res, matchingDraft?.postId, scheduleAutosave]);

  const publishNow = useCallback(async () => {
    const postId = matchingDraft?.postId ?? draftMeta?.postId;
    if (!postId) return;
    setPublishing(true);
    setErr(null);
    setMessage(null);
    try {
      const r = await fetch(`/api/campaigns/posts/${postId}/publish`, { method: "POST" });
      const j = (await r.json()) as PublishApiErrorBody;
      if (!r.ok) {
        throw new Error(userFacingMessageForPublishApiFailure(r.status, j, effectivePlatform ?? null));
      }
      setMessage("Published successfully.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }, [draftMeta?.postId, matchingDraft?.postId, effectivePlatform]);

  const connectHref = useMemo(() => {
    if (!effectivePlatform) return "";
    const qs = new URLSearchParams();
    if (clientId.trim()) qs.set("clientId", clientId.trim());
    qs.set("returnTo", oauthReturnTo);
    return `/api/social/oauth/${effectivePlatform}/start?${qs.toString()}`;
  }, [effectivePlatform, clientId, oauthReturnTo]);

  const onPlatformSelectChange = (next: SocialPlatform) => {
    const cur = effectivePlatform;
    if (cur && next !== cur && (draftMeta?.postId || matchingDraft?.postId)) {
      setPlatformSwitchNote(
        "Switching platform clears the draft shown here. The next save creates a new draft for this network."
      );
    }
    setPlatformChoice(next);
  };

  if (postingPlatforms.length === 0) return null;

  const saveLabel = matchingDraft ? "Update draft" : "Save draft to campaign";

  return (
    <div
      id={BENTLEY_FIRST_CAMPAIGN_ASSET_ANCHOR}
      className="rounded-xl border border-cyan-500/45 bg-slate-900/70 p-4 text-sm text-slate-200 shadow-lg mb-4 scroll-mt-24"
    >
      <h3 className="font-semibold text-cyan-200/95">First campaign post</h3>

      <ul className="mt-2 grid gap-1.5 text-xs text-slate-400 border border-cyan-500/20 rounded-lg bg-black/20 p-2.5">
        <li className="flex flex-wrap items-baseline gap-2">
          <span className="text-slate-500 shrink-0">Text</span>
          <span className={captionReady ? "text-emerald-300/95" : "text-amber-200/90"}>
            {captionReady
              ? automatedPublish
                ? "Ready for server publish"
                : "Ready — copy to native app or client workflow"
              : automatedPublish
                ? "Add caption before publishing"
                : "Add caption to copy out"}
          </span>
        </li>
        <li className="flex flex-wrap items-baseline gap-2">
          <span className="text-slate-500 shrink-0">Media</span>
          <span className="text-slate-300/90">
            {postAssetId ? "Asset attached (optional)" : "Optional — not attached"}
          </span>
        </li>
        <li className="flex flex-wrap items-baseline gap-2">
          <span className="text-slate-500 shrink-0">Account</span>
          <span
            className={
              !automatedPublish
                ? "text-slate-300/90"
                : isConnected && !tokenLikelyExpired
                  ? "text-emerald-300/95"
                  : "text-amber-200/90"
            }
          >
            {!automatedPublish
              ? `No server publish for ${effectivePlatform ? postingPlatformDisplayName(effectivePlatform) : "this network"} — manual posting only`
              : !isConnected
                ? "Not connected — connect below to publish from Hero Factory"
                : tokenLikelyExpired
                  ? "Connected, but access may have expired — reconnect before publishing"
                  : "Connected — ready to publish from Hero Factory"}
          </span>
        </li>
      </ul>
      {draftMeta && (
        <p className="text-sm text-cyan-100/90 mt-2">
          Bentley prepared your first post for {postingPlatformDisplayName(draftMeta.platform)} — edit the caption below
          {automatedPublish ? ", then connect (if needed) or publish." : ", then copy to the native app or share API steps from Launch panel 3."}
        </p>
      )}
      <p className="text-xs text-slate-400 mt-1">
        Bentley picks a primary network from your posting targets using your analysis lever and connection status. Copy
        is assembled from Content Engine output when available, otherwise from your plan and notes (no extra generation).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500">Target platform</label>
        <select
          className="rounded-lg border border-cyan-500/40 bg-black/40 text-cyan-100 text-sm px-2 py-1.5"
          value={effectivePlatform ?? ""}
          onChange={(e) => onPlatformSelectChange(e.target.value as SocialPlatform)}
        >
          {postingPlatforms.map((p) => (
            <option key={p} value={p}>
              {postingPlatformDisplayName(p)}
              {connectedSet.has(p) ? " · connected" : ""}
            </option>
          ))}
        </select>
        {autoPrimary && (
          <span className="text-xs text-slate-500">
            Suggested: {postingPlatformDisplayName(autoPrimary)} (lever + connections)
          </span>
        )}
      </div>

      {platformSwitchNote && (
        <p className="text-xs text-amber-200/90 mt-2 rounded-lg border border-amber-500/25 bg-amber-950/25 px-2.5 py-1.5">
          {platformSwitchNote}
        </p>
      )}

      {draft?.preview && (
        <div className="mt-3 space-y-2 text-xs">
          {draft.preview.map((block) => (
            <div key={block.label} className="rounded-lg border border-cyan-500/20 bg-black/20 p-2">
              <div className="text-cyan-500/80 font-medium">{block.label}</div>
              <div className="text-slate-300 whitespace-pre-wrap mt-1">{block.body}</div>
            </div>
          ))}
        </div>
      )}

      <label className="block mt-3">
        <span className="text-xs text-slate-500">Editable caption (sent to network on publish)</span>
        <textarea
          data-bentley-caption
          className="mt-1 w-full min-h-[140px] rounded-lg border border-cyan-500/40 bg-black/40 text-slate-100 text-sm p-3 focus:outline-none focus:border-cyan-500"
          value={caption}
          onChange={(e) => onCaptionChange(e.target.value)}
        />
      </label>

      <label className="block mt-2">
        <span className="text-xs text-slate-500">Hashtags (optional)</span>
        <textarea
          className="mt-1 w-full min-h-[52px] rounded-lg border border-cyan-500/40 bg-black/40 text-slate-100 text-sm p-2 focus:outline-none focus:border-cyan-500"
          placeholder="#brand #topic"
          value={hashtags}
          onChange={(e) => onHashtagsChange(e.target.value)}
          rows={2}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button
          type="button"
          onClick={refreshFromContentEngine}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-cyan-500/35 text-cyan-200/95 hover:bg-cyan-950/40"
        >
          Refresh from Content Engine
        </button>
        {matchingDraft?.postId && manualSaveUi === "idle" && autosaveUi === "idle" && (
          <span className="text-[11px] text-slate-500">Edits autosave shortly after you stop typing.</span>
        )}
        {manualSaveUi === "saving" && (
          <span className="text-[11px] text-cyan-400/90">Saving…</span>
        )}
        {manualSaveUi === "saved" && (
          <span className="text-[11px] text-emerald-400/90">
            Saved{" "}
            {manualSavedAt != null
              ? formatDraftSavedRelative(manualSavedAt, Date.now())
              : "just now"}{" "}
            · manual
          </span>
        )}
        {manualSaveUi === "idle" && autosaveUi === "saving" && (
          <span className="text-[11px] text-cyan-400/80">Autosaving…</span>
        )}
        {manualSaveUi === "idle" && autosaveUi === "saved" && (
          <span className="text-[11px] text-emerald-400/85">
            Autosaved{" "}
            {autosaveSavedAt != null
              ? formatDraftSavedRelative(autosaveSavedAt, Date.now())
              : "just now"}
          </span>
        )}
        {manualSaveUi === "idle" && autosaveUi === "failed" && (
          <span className="text-[11px] text-amber-200/90">Autosave failed · use Update draft to retry</span>
        )}
      </div>

      {contentEngineOutput ? (
        <p className="text-xs text-emerald-400/90 mt-2">Using your latest Content Engine generation on this page.</p>
      ) : (
        <p className="text-xs text-amber-200/80 mt-2">
          Run <strong>Content Engine</strong> above for richer hooks and prompts — until then we use analysis + your
          notes. <span className="text-slate-500">Refresh still applies analysis and form context.</span>
        </p>
      )}

      {err && <p className="text-xs text-red-300 mt-2">{err}</p>}
      {message && <p className="text-xs text-emerald-300/90 mt-2">{message}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={preparing || !effectivePlatform}
          onClick={() => void prepareServerDraft()}
          className="text-sm font-semibold px-4 py-2 rounded-xl border border-cyan-500/60 text-cyan-50 hover:bg-cyan-950/50 disabled:opacity-50"
          style={{ boxShadow: `0 3px 0 ${ACCENT}44` }}
        >
          {preparing ? "Saving…" : saveLabel}
        </button>

        {!automatedPublish ? (
          <span className="text-xs text-slate-400 max-w-md">
            Server-side publish is not available for this network yet. Use the caption above in the native app, or open{" "}
            <span className="text-slate-300">Launch → 3. API Instructions</span> for your client.
          </span>
        ) : tokenLikelyExpired ? (
          <a
            href={connectHref || "#"}
            className="inline-flex items-center text-sm font-semibold px-4 py-2 rounded-xl border border-amber-500/60 text-amber-100 hover:bg-amber-950/30"
          >
            Reconnect {effectivePlatform ? postingPlatformDisplayName(effectivePlatform) : "account"}
          </a>
        ) : isConnected ? (
          <button
            type="button"
            disabled={publishing || !(matchingDraft?.postId ?? draftMeta?.postId)}
            onClick={() => void publishNow()}
            className="text-sm font-semibold px-4 py-2 rounded-xl text-black border border-cyan-600 disabled:opacity-50"
            style={{
              background: "linear-gradient(180deg, #7DF9FF 0%, #00D1FF 50%, #06b6d4 100%)",
            }}
          >
            {publishing ? "Publishing…" : "Publish"}
          </button>
        ) : (
          <a
            href={connectHref || "#"}
            className="inline-flex items-center text-sm font-semibold px-4 py-2 rounded-xl border border-amber-500/50 text-amber-100 hover:bg-amber-950/30"
          >
            Connect {effectivePlatform ? postingPlatformDisplayName(effectivePlatform) : "account"}
          </a>
        )}
      </div>

      {draftMeta?.postId && (
        <p className="text-[11px] text-slate-500 mt-2">
          Draft post ID: {draftMeta.postId.slice(0, 8)}… —{" "}
          {automatedPublish
            ? "publish uses your connected account for this platform when you click Publish."
            : "saved as a draft; posting is manual for this network."}
        </p>
      )}
    </div>
  );
}
