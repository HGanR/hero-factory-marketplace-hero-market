/**
 * Bridge: generated Bentley artifacts → campaign_posts DRAFT rows via existing HTTP APIs.
 * Idempotent via utmParams.bentley_draft_key (server merges optional fields into utmParams).
 */

import type { DeploymentReadyPostDraft } from "@/lib/revenue-os/bentley-deployment-orchestrator";

export const BENTLEY_CAMPAIGN_DEFAULT_NAME = "Bentley — Revenue OS";
export const BENTLEY_UTM_DRAFT_KEY = "bentley_draft_key";
export const BENTLEY_UTM_SOURCE_KEY = "bentley_source";

export type CampaignPostLite = {
  utmParams?: Record<string, string> | null;
};

/** Pure: keys already stored on campaign_posts — used for idempotency tests and client checks. */
export function collectExistingBentleyDraftKeysFromPosts(posts: CampaignPostLite[]): Set<string> {
  const s = new Set<string>();
  for (const p of posts) {
    const raw = p.utmParams?.[BENTLEY_UTM_DRAFT_KEY];
    if (raw) s.add(String(raw));
  }
  return s;
}

/** Pure: drafts that still need POST /api/campaigns/:id/posts */
export function selectDraftsMissingFromCampaign(
  drafts: DeploymentReadyPostDraft[],
  existingKeys: Set<string>
): DeploymentReadyPostDraft[] {
  return drafts.filter((d) => !existingKeys.has(d.draftKey));
}

type CampaignListRow = { id: string; name: string; status?: string };

async function fetchCampaignList(clientId: string): Promise<CampaignListRow[]> {
  const qs = `?clientId=${encodeURIComponent(clientId)}`;
  const r = await fetch(`/api/campaigns${qs}`);
  if (!r.ok) return [];
  const j = (await r.json()) as { campaigns?: CampaignListRow[] };
  return Array.isArray(j.campaigns) ? j.campaigns : [];
}

async function createCampaign(clientId: string, name: string): Promise<{ id: string } | null> {
  const r = await fetch("/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, clientId: clientId || undefined }),
  });
  if (!r.ok) return null;
  const j = (await r.json()) as { id?: string };
  return j.id ? { id: j.id } : null;
}

async function resolveCampaignId(args: {
  clientId: string;
  existingCampaignId?: string | null;
  campaignNameFallback?: string;
}): Promise<string | null> {
  const name = (args.campaignNameFallback ?? BENTLEY_CAMPAIGN_DEFAULT_NAME).trim() || BENTLEY_CAMPAIGN_DEFAULT_NAME;
  if (args.existingCampaignId) {
    const r = await fetch(`/api/campaigns/${args.existingCampaignId}`);
    if (r.ok) return args.existingCampaignId;
  }
  const list = await fetchCampaignList(args.clientId);
  const match = list.find((c) => c.name === name);
  if (match) return match.id;
  const created = await createCampaign(args.clientId, name);
  return created?.id ?? null;
}

async function fetchCampaignPosts(campaignId: string): Promise<CampaignPostLite[]> {
  const r = await fetch(`/api/campaigns/${campaignId}`);
  if (!r.ok) return [];
  const j = (await r.json()) as { posts?: CampaignPostLite[] };
  return Array.isArray(j.posts) ? j.posts : [];
}

/**
 * Creates missing DRAFT campaign_posts for each draft with a fresh bentley_draft_key.
 * Safe to call repeatedly — existing keys are skipped.
 */
export async function ensureCampaignPostsFromBentleyOutputs(args: {
  clientId: string;
  existingCampaignId?: string | null;
  campaignNameFallback?: string;
  drafts: DeploymentReadyPostDraft[];
}): Promise<{ ok: boolean; campaignId?: string; created: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  if (!args.drafts.length) {
    return { ok: true, created: 0, skipped: 0, errors: [] };
  }

  const campaignId = await resolveCampaignId({
    clientId: args.clientId,
    existingCampaignId: args.existingCampaignId,
    campaignNameFallback: args.campaignNameFallback,
  });
  if (!campaignId) {
    return { ok: false, created: 0, skipped: 0, errors: ["Could not resolve or create a campaign."] };
  }

  const existingPosts = await fetchCampaignPosts(campaignId);
  const keys = collectExistingBentleyDraftKeysFromPosts(existingPosts);
  const pending = selectDraftsMissingFromCampaign(args.drafts, keys);
  let created = 0;

  for (const d of pending) {
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: d.platform,
          caption: d.body,
          hashtags: d.hashtagsLine?.trim() || undefined,
          bentleyDraftKey: d.draftKey,
          bentleySource: d.source,
          bentleyContentRole: d.bentleyContentRole,
          bentleyPlatformHints: d.bentleyPlatformHints?.length
            ? d.bentleyPlatformHints.join(",")
            : undefined,
          bentleySequenceDayIndex: d.bentleySequenceDayIndex,
          bentleySequenceRole: d.bentleySequenceRole,
          bentleySequenceReason: d.bentleySequenceReason,
          bentleySuggestedScheduleAt: d.suggestedScheduledAt,
          bentleyScheduleRole: d.bentleyScheduleRole,
          bentleyScheduleConfidence: d.bentleyScheduleConfidence,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        errors.push(
          typeof j === "object" && j && "message" in j
            ? String((j as { message?: string }).message)
            : `HTTP ${r.status} for ${d.platform}`
        );
        continue;
      }
      created += 1;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Network error");
    }
  }

  const skippedExisting = args.drafts.length - pending.length;
  return {
    ok: errors.length === 0,
    campaignId,
    created,
    skipped: skippedExisting,
    errors,
  };
}
