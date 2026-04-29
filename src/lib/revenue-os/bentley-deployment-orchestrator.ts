/**
 * Deterministic deployment orchestration from Bentley / Step 4 artifacts — no I/O, no LLM.
 */

export {
  advanceBentleyPipelineStage,
  type AdvanceBentleyPipelineStageArgs,
  type AdvanceBentleyPipelineStageResult,
  type BentleyPipelineHandoffStage,
} from "@/lib/revenue-os/bentley-pipeline-deployment-handoff";

import type { CampaignResponse } from "@/lib/revenue-os/campaign-schema";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { RevenueOsContentBatchRole } from "@/lib/revenue-os/content-batch-routing-types";
import type { RevenueOsBatchCalendarSequence } from "@/lib/revenue-os/content-batch-calendar-sequencing-types";
import type { RevenueOsSuggestedSchedulePlan } from "@/lib/revenue-os/content-sequence-schedule-types";
import { postMatchesSlotPlatforms } from "@/lib/revenue-os/apply-sequence-schedule-to-drafts";
import type { RevenueOsLaunchModePlan } from "@/lib/revenue-os/launch-mode-types";
import type { RevenueOsPlatformRoleRoutingSummary } from "@/lib/revenue-os/platform-role-routing";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import {
  buildPlatformHintsForContentRole,
  classifyContentForBatchRole,
} from "@/lib/revenue-os/route-generated-content-into-batches";
import { normalizeStrategyLabelToOauthPostingPlatform } from "@/lib/social/platform-identity";
import type { SocialPlatform } from "@/lib/social/config";
import { getScheduledPublishReadiness } from "@/lib/social/scheduled-publish-readiness";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";

const MIN_BODY_LEN = 40;
const MIN_OFFER_LEN = 28;
const MIN_MEDIA_BRIEF = 80;
const MIN_CE_CAPTION = 36;

export type DeploymentSharedProfileSlice = {
  postingPlatforms: string[];
};

export type DeploymentReadyPostDraft = {
  platform: string;
  title: string;
  body: string;
  status: "draft";
  suggestedScheduledAt?: string;
  assetHints?: string[];
  source: "campaign_from_notes" | "content_engine" | "launch_mode";
  /** Stable idempotency token for campaign_posts.utmParams.bentley_draft_key */
  draftKey: string;
  /** Optional caption companion for APIs that store hashtags separately */
  hashtagsLine?: string;
  /** When content-batch routing is applied — UTM-safe provenance (optional). */
  bentleyContentRole?: RevenueOsContentBatchRole;
  /** Suggested platforms for this role from platform-role routing (hints only). */
  bentleyPlatformHints?: string[];
  /** Optional calendar sequence provenance (UTM-safe; hints only). */
  bentleySequenceDayIndex?: number;
  bentleySequenceRole?: RevenueOsContentBatchRole;
  bentleySequenceReason?: string;
  /** Optional schedule-plan hints (not the same as DB scheduledAt until user confirms). */
  bentleyScheduleRole?: RevenueOsContentBatchRole;
  bentleyScheduleConfidence?: "high" | "medium" | "low";
};

export type BuildDeploymentDraftsArgs = {
  sharedProfile: DeploymentSharedProfileSlice;
  campaignResult?: CampaignResponse | null;
  contentEngineResult?: ContentEngineOutput | null;
  mediaBrief?: string | null;
  launchPlan?: RevenueOsLaunchModePlan | null;
  systemSignals?: RevenueOsSystemSignals | null;
  /** When set with {@link applyContentBatchMetadata}, drafts receive role + platform hint fields. */
  platformRoleRoutingSummary?: RevenueOsPlatformRoleRoutingSummary | null;
  /** Default false — preserves legacy drafts without batch metadata. */
  applyContentBatchMetadata?: boolean;
  /** When set with {@link applySequenceMetadata}, drafts receive sequence fields if role matches a slot. */
  batchCalendarSequence?: RevenueOsBatchCalendarSequence | null;
  /** Default false — no sequence fields on drafts. */
  applySequenceMetadata?: boolean;
  /** When set with sequence + schedule plan, drafts may receive suggested times + schedule metadata. */
  sequenceSchedulePlan?: RevenueOsSuggestedSchedulePlan | null;
  /** Default false — no schedule-plan fields on drafts. */
  applySequenceScheduleMetadata?: boolean;
};

function norm(s: string | null | undefined): string {
  return String(s ?? "").trim();
}

function mergeSchedulePlanIntoDeploymentDrafts(
  drafts: DeploymentReadyPostDraft[],
  plan: RevenueOsSuggestedSchedulePlan,
  sequence: RevenueOsBatchCalendarSequence
): DeploymentReadyPostDraft[] {
  const seqSlots = sequence.slots ?? [];
  const planSlots = plan.slots ?? [];
  if (!planSlots.length || !seqSlots.length) return drafts;

  const used = new Set<number>();
  const out = drafts.map((d) => ({ ...d }));

  for (let si = 0; si < planSlots.length; si++) {
    const slot = planSlots[si]!;
    const seqDay = seqSlots[si]?.dayIndex ?? slot.dayIndex;
    let best = -1;
    let bestScore = -1;

    for (let di = 0; di < out.length; di++) {
      if (used.has(di)) continue;
      const d = out[di]!;
      if (d.bentleyContentRole !== slot.role) continue;
      if (!postMatchesSlotPlatforms(d.platform, slot)) continue;
      let sc = 2;
      if (d.bentleySequenceDayIndex != null && d.bentleySequenceDayIndex === seqDay) sc += 2;
      if (sc > bestScore) {
        bestScore = sc;
        best = di;
      }
    }

    if (best < 0) {
      for (let di = 0; di < out.length; di++) {
        if (used.has(di)) continue;
        const d = out[di]!;
        if (d.bentleyContentRole !== slot.role) continue;
        let sc = 1;
        if (d.bentleySequenceDayIndex != null && d.bentleySequenceDayIndex === seqDay) sc += 2;
        if (sc > bestScore) {
          bestScore = sc;
          best = di;
        }
      }
    }

    if (best >= 0) {
      used.add(best);
      const cur = out[best]!;
      out[best] = {
        ...cur,
        suggestedScheduledAt: slot.suggestedScheduledAt,
        bentleyScheduleRole: slot.role,
        bentleyScheduleConfidence: slot.confidence,
      };
    }
  }

  return out;
}

function stableHash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h, 33) ^ input.charCodeAt(i);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function buildStableBentleyDraftKey(parts: {
  source: DeploymentReadyPostDraft["source"];
  platform: string;
  index: number;
  bodySnippet: string;
}): string {
  const snip = parts.bodySnippet.slice(0, 160);
  return `bentley:${parts.source}:${parts.platform}:${parts.index}:${stableHash(snip)}`;
}

function oauthPlatformsFromProfile(shared: DeploymentSharedProfileSlice): SocialPlatform[] {
  const out: SocialPlatform[] = [];
  const seen = new Set<SocialPlatform>();
  for (const label of shared.postingPlatforms ?? []) {
    const p = normalizeStrategyLabelToOauthPostingPlatform(label);
    if (p && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

function collectAssetHints(
  contentEngineResult?: ContentEngineOutput | null,
  mediaBrief?: string | null
): string[] | undefined {
  const fromCe = contentEngineResult?.imagePrompts?.filter((x) => norm(x)).slice(0, 6) ?? [];
  const fromBrief =
    norm(mediaBrief)
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 5) ?? [];
  const merged = [...fromCe, ...fromBrief].filter(Boolean);
  return merged.length ? merged : undefined;
}

function substantialCampaign(c?: CampaignResponse | null): boolean {
  if (!c) return false;
  if (norm(c.offerStatement).length >= MIN_OFFER_LEN) return true;
  const pillars = (c.messagePillars ?? []).map(norm).join(" ");
  if (pillars.length >= MIN_BODY_LEN) return true;
  return false;
}

function buildBodyFromCampaign(c: CampaignResponse, hookIndex: number): { title: string; body: string } {
  const hooks = c.shortFormHooks ?? [];
  const hook = norm(hooks[hookIndex % Math.max(hooks.length, 1)]) || "Campaign draft";
  const offer = norm(c.offerStatement);
  const body = `${hook}\n\n${offer}`.trim();
  return { title: hook.slice(0, 120) || "Campaign draft", body };
}

function buildBodyFromContentEngine(ce: ContentEngineOutput): { title: string; body: string; tags: string } {
  const cap = norm(ce.fullPost?.caption);
  const tags = (ce.fullPost?.hashtags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  const body = tags ? `${cap}\n\n${tags}`.trim() : cap;
  return {
    title: norm(ce.captions?.hook).slice(0, 120) || "Content bundle draft",
    body,
    tags,
  };
}

function buildBodyFromLaunch(plan: RevenueOsLaunchModePlan): { title: string; body: string } {
  const d1 = plan.days?.find((d) => d.day === 1) ?? plan.days?.[0];
  const objective = norm(d1?.objective);
  const tasks = (d1?.tasks ?? []).map(norm).filter(Boolean).slice(0, 5);
  const body = [objective, tasks.length ? `Tasks:\n${tasks.map((t) => `• ${t}`).join("\n")}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return {
    title: norm(d1?.title) || "Day 1 launch draft",
    body,
  };
}

function buildBodyFromBrief(brief: string): { title: string; body: string } {
  const lines = norm(brief)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = lines[0]?.slice(0, 120) || "Media brief draft";
  const body = lines.join("\n\n");
  return { title, body };
}

/**
 * When drafts would be empty, human-readable reasons (deterministic).
 */
export function getDeploymentDraftBlockers(args: BuildDeploymentDraftsArgs): string[] {
  const blockers: string[] = [];
  const platforms = oauthPlatformsFromProfile(args.sharedProfile);
  if (!platforms.length) {
    blockers.push(
      "No OAuth-capable posting platforms in your intake list (e.g. Instagram, TikTok, LinkedIn, Facebook, Pinterest, Snapchat)."
    );
  }

  const ce = args.contentEngineResult;
  const capOk = norm(ce?.fullPost?.caption).length >= MIN_CE_CAPTION;
  const campOk = substantialCampaign(args.campaignResult);
  const briefOk = norm(args.mediaBrief ?? "").length >= MIN_MEDIA_BRIEF;
  const launchOk = Boolean(norm(args.launchPlan?.days?.[0]?.objective ?? "").length >= 20);

  if (!capOk && !campOk && !briefOk && !launchOk) {
    blockers.push(
      "No substantive content bundle yet — run Content Engine, generate a campaign from notes, compile a media brief, or generate a launch plan."
    );
  }

  return blockers;
}

export function buildDeploymentReadyPostDrafts(args: BuildDeploymentDraftsArgs): DeploymentReadyPostDraft[] {
  const blockers = getDeploymentDraftBlockers(args);
  if (blockers.length) return [];

  const platforms = oauthPlatformsFromProfile(args.sharedProfile);
  if (!platforms.length) return [];

  const assetHints = collectAssetHints(args.contentEngineResult, args.mediaBrief);

  type Plan = {
    source: DeploymentReadyPostDraft["source"];
    buildForIndex: (i: number) => { title: string; body: string; hashtagsLine?: string };
  };

  let plan: Plan | null = null;

  if (substantialCampaign(args.campaignResult)) {
    const c = args.campaignResult!;
    plan = {
      source: "campaign_from_notes",
      buildForIndex: (i) => {
        const { title, body } = buildBodyFromCampaign(c, i);
        return { title, body };
      },
    };
  } else if (args.contentEngineResult && norm(args.contentEngineResult.fullPost?.caption).length >= MIN_CE_CAPTION) {
    const ce = args.contentEngineResult;
    plan = {
      source: "content_engine",
      buildForIndex: () => {
        const b = buildBodyFromContentEngine(ce);
        return { title: b.title, body: b.body, hashtagsLine: b.tags };
      },
    };
  } else if (args.launchPlan && norm(args.launchPlan.days?.[0]?.objective ?? "").length >= 20) {
    const lp = args.launchPlan;
    plan = {
      source: "launch_mode",
      buildForIndex: () => buildBodyFromLaunch(lp),
    };
  } else if (norm(args.mediaBrief ?? "").length >= MIN_MEDIA_BRIEF) {
    const brief = norm(args.mediaBrief!);
    plan = {
      source: "campaign_from_notes",
      buildForIndex: () => buildBodyFromBrief(brief),
    };
  }

  if (!plan) return [];

  const out: DeploymentReadyPostDraft[] = [];
  platforms.forEach((platform, index) => {
    const piece = plan!.buildForIndex(index);
    if (norm(piece.body).length < MIN_BODY_LEN) return;
    const draft: DeploymentReadyPostDraft = {
      platform,
      title: piece.title,
      body: piece.body,
      status: "draft",
      assetHints,
      source: plan!.source,
      draftKey: buildStableBentleyDraftKey({
        source: plan!.source,
        platform,
        index,
        bodySnippet: piece.body,
      }),
      hashtagsLine: piece.hashtagsLine,
    };
    out.push(draft);
  });

  let result = out;

  if (args.applyContentBatchMetadata && args.platformRoleRoutingSummary) {
    const routing = args.platformRoleRoutingSummary;
    result = result.map((d) => {
      const hookLine = d.body.split("\n\n")[0]?.trim() ?? "";
      const routedSource: "content_engine" | "campaign_from_notes" | "launch_mode" | "manual" =
        d.source === "launch_mode"
          ? "launch_mode"
          : d.source === "content_engine"
            ? "content_engine"
            : substantialCampaign(args.campaignResult)
              ? "campaign_from_notes"
              : "manual";
      const { role } = classifyContentForBatchRole({
        title: d.title,
        body: d.body,
        hook: plan?.source === "content_engine" ? d.title : hookLine.slice(0, 240),
        cta:
          plan?.source === "campaign_from_notes" && substantialCampaign(args.campaignResult)
            ? d.body.split("\n\n").slice(1).join("\n\n").trim() || null
            : null,
        source: routedSource,
      });
      const hints = buildPlatformHintsForContentRole(role, routing);
      return {
        ...d,
        bentleyContentRole: role,
        bentleyPlatformHints: hints.length ? hints : undefined,
      };
    });
  }

  if (args.applySequenceMetadata && args.batchCalendarSequence?.slots?.length) {
    const slots = args.batchCalendarSequence.slots;
    result = result.map((d) => {
      if (!d.bentleyContentRole) return d;
      const slot = slots.find((s) => s.role === d.bentleyContentRole);
      if (!slot) return d;
      return {
        ...d,
        bentleySequenceDayIndex: slot.dayIndex,
        bentleySequenceRole: slot.role,
        bentleySequenceReason: slot.reason.slice(0, 280),
      };
    });
  }

  if (
    args.applySequenceScheduleMetadata &&
    args.sequenceSchedulePlan?.slots?.length &&
    args.applySequenceMetadata &&
    args.batchCalendarSequence?.slots?.length
  ) {
    result = mergeSchedulePlanIntoDeploymentDrafts(
      result,
      args.sequenceSchedulePlan,
      args.batchCalendarSequence
    );
  }

  return result;
}

export type ComputeDeploymentReadinessArgs = BuildDeploymentDraftsArgs & {
  /** Connected accounts from GET /api/social/accounts */
  socialAccounts?: { platform: string; platformCanonical?: SocialPlatform | null }[];
  /** Existing draft/scheduled posts for the target campaign (for duplicate detection). */
  existingPosts?: { platform: string; utmParams?: Record<string, string> | null }[];
};

export function computeDeploymentReadiness(args: ComputeDeploymentReadinessArgs): {
  isReady: boolean;
  blockers: string[];
  strengths: string[];
} {
  const blockers: string[] = [];
  const strengths: string[] = [];

  const drafts = buildDeploymentReadyPostDrafts(args);
  const draftBlockers = getDeploymentDraftBlockers(args);

  if (drafts.length) {
    strengths.push(`${drafts.length} deployment-ready draft(s) mapped from your artifacts.`);
  } else {
    blockers.push(...draftBlockers);
  }

  const connected = args.socialAccounts?.length
    ? connectedSocialPlatformsSet(args.socialAccounts)
    : new Set<SocialPlatform>();

  if (drafts.length) {
    const missingAccounts = drafts.map((d) => d.platform as SocialPlatform).filter((p) => !connected.has(p));
    const uniqueMissing = [...new Set(missingAccounts)];
    if (uniqueMissing.length) {
      blockers.push(
        `No connected OAuth account for: ${uniqueMissing.join(", ")} — connect in Launch Campaigns before publishing.`
      );
    } else {
      strengths.push("Connected accounts cover all draft platforms.");
    }
  }

  const existingKeys = new Set<string>();
  for (const p of args.existingPosts ?? []) {
    const k = p.utmParams?.bentley_draft_key ?? p.utmParams?.["bentley_draft_key"];
    if (k) existingKeys.add(String(k));
  }
  let pendingKeys = 0;
  if (drafts.length && args.existingPosts !== undefined) {
    pendingKeys = drafts.filter((d) => !existingKeys.has(d.draftKey)).length;
    if (pendingKeys > 0) {
      blockers.push(
        `${pendingKeys} draft post row(s) not yet created in campaign_posts — use **Create Draft Posts** in the deployment panel.`
      );
    }
  }

  const sched = getScheduledPublishReadiness();
  if (!sched.supportsScheduling) {
    strengths.push(
      "Timed publishes use the **scheduled worker** (`POST /api/internal/scheduled-publish/run` + secret). Until cron runs, use **Publish now** on the dashboard."
    );
  }

  if (args.systemSignals?.trafficReadinessScore != null && args.systemSignals.trafficReadinessScore >= 60) {
    strengths.push("Traffic readiness score is in a healthy band for execution.");
  }

  const accountsCoverDrafts =
    drafts.length > 0 && drafts.every((d) => connected.has(d.platform as SocialPlatform));
  const rowsSatisfied = args.existingPosts === undefined || pendingKeys === 0;

  const isReady = Boolean(drafts.length && accountsCoverDrafts && rowsSatisfied);

  return { isReady, blockers, strengths };
}
