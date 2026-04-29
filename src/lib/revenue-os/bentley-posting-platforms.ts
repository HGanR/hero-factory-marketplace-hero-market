import type { SocialPlatform } from "@/lib/social/config";
import {
  connectedSocialPlatformsSet,
  isOauthConnectablePlatformId,
  normalizeStrategyLabelToOauthPostingPlatform,
  OAUTH_CONNECTABLE_PLATFORM_IDS,
} from "@/lib/social/platform-identity";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import { computePrimaryFocusLever } from "@/lib/revenue-os/analysis-derivations";

/**
 * Posting / OAuth helpers (this file): `SocialPlatform` IDs for **connect & publish**.
 * Do not confuse with `RevenueOsDashboardFormValues.platforms` (string labels for content strategy / prompts).
 */

/** Re-export — canonical list lives in `@/lib/social/platform-identity`. */
export const OAUTH_CONNECTABLE_PLATFORMS: readonly SocialPlatform[] = OAUTH_CONNECTABLE_PLATFORM_IDS;

const PLATFORM_DISPLAY: Record<SocialPlatform, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  x: "X",
};

export function postingPlatformDisplayName(p: SocialPlatform): string {
  return PLATFORM_DISPLAY[p] ?? p;
}

export function isOauthConnectablePlatform(p: string): p is SocialPlatform {
  return isOauthConnectablePlatformId(p);
}

export function dedupePostingPlatforms(plats: SocialPlatform[]): SocialPlatform[] {
  return [...new Set(plats.filter(isOauthConnectablePlatform))];
}

/**
 * Parse user free text into OAuth-capable posting platforms only.
 * YouTube / X / Other are ignored here (no OAuth path or disabled).
 */
export function parsePostingPlatformsFromUserText(text: string): SocialPlatform[] {
  const parts = text.split(/[,/&]| and /i).map((s) => s.trim()).filter(Boolean);
  const out: SocialPlatform[] = [];
  for (const p of parts) {
    const id = normalizeStrategyLabelToOauthPostingPlatform(p);
    if (id) out.push(id);
  }
  return dedupePostingPlatforms(out);
}

/**
 * Map content-strategy labels (from `platforms` / questionnaire) to OAuth posting IDs.
 */
export function mapLabelsToPostingPlatforms(labels: string[]): SocialPlatform[] {
  const out: SocialPlatform[] = [];
  for (const raw of labels) {
    const id = normalizeStrategyLabelToOauthPostingPlatform(raw);
    if (id) out.push(id);
  }
  return dedupePostingPlatforms(out);
}

function joinNames(plats: SocialPlatform[]): string {
  if (plats.length === 0) return "";
  if (plats.length === 1) return postingPlatformDisplayName(plats[0]);
  if (plats.length === 2) {
    return `${postingPlatformDisplayName(plats[0])} and ${postingPlatformDisplayName(plats[1])}`;
  }
  const head = plats.slice(0, -1).map(postingPlatformDisplayName).join(", ");
  return `${head}, and ${postingPlatformDisplayName(plats[plats.length - 1])}`;
}

export type ConnectedAccountLite = {
  platform: string;
  platformCanonical?: SocialPlatform | null;
  displayName?: string | null;
};

/**
 * One concise recommendation from analysis + chosen platforms + connection status.
 * Pure function — no I/O.
 */
export function getBentleyPostingRecommendation(
  res: RevenueOsAnalyzeResponse | null,
  postingPlatforms: SocialPlatform[],
  connectedAccounts: ConnectedAccountLite[]
): string {
  const connectedSet = connectedSocialPlatformsSet(connectedAccounts);
  const selected = dedupePostingPlatforms(postingPlatforms);
  const pending = selected.filter((p) => !connectedSet.has(p));
  const connectedSelected = selected.filter((p) => connectedSet.has(p));

  if (selected.length === 0) {
    return "Tell Bentley which networks you want to post to during intake, or add posting platforms below — then connect each with OAuth.";
  }

  if (!res) {
    const pend = joinNames(pending);
    const ok = joinNames(connectedSelected);
    if (pending.length === 0 && connectedSelected.length > 0) {
      return `${ok} ${connectedSelected.length > 1 ? "are" : "is"} connected. Run Full Analysis for a lever-specific posting plan.`;
    }
    if (pending.length > 0 && connectedSelected.length > 0) {
      return `Connect ${pend} via OAuth when ready. ${ok} ${connectedSelected.length > 1 ? "are" : "is"} already linked.`;
    }
    return `Connect ${pend || joinNames(selected)} with OAuth to enable publishing, then run or review analysis.`;
  }

  const focus = computePrimaryFocusLever(res);
  const names = joinNames(selected);
  const pendingStr = pending.length ? ` Connect ${joinNames(pending)} next (OAuth).` : "";
  const haveStr =
    connectedSelected.length > 0
      ? ` ${joinNames(connectedSelected)} ${connectedSelected.length > 1 ? "are" : "is"} already connected — use ${connectedSelected.length > 1 ? "those channels" : "that channel"} first.`
      : "";

  if (focus.key === "traffic") {
    return `Your analysis points to traffic first. Prioritize reach on ${names}.${haveStr}${pendingStr} Then move into campaign launch.`;
  }
  if (focus.key === "conversionRatePct") {
    return `Your primary lever is conversion. Keep creative and landing paths tight on ${names}.${haveStr}${pendingStr} Favor assets that support retargeting and clarity.`;
  }
  if (focus.key === "avgOrderValue") {
    return `Your biggest opportunity is offer strength (AOV). Lead with value-led content on ${names}.${haveStr}${pendingStr} Tie posts to your campaign launch offers.`;
  }
  if (focus.key === "cac") {
    return `CAC efficiency is the focus. Use ${names} deliberately for paid and organic efficiency.${haveStr}${pendingStr}`;
  }
  return `Start posting on ${names} once connected.${haveStr}${pendingStr}`;
}
