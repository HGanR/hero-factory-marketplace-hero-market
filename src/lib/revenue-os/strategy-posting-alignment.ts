import type { SocialPlatform } from "@/lib/social/config";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import {
  mapLabelsToPostingPlatforms,
  postingPlatformDisplayName,
} from "@/lib/revenue-os/bentley-posting-platforms";

export type StrategyPostingAlignmentKind = "aligned" | "partial" | "none" | "no_compare";

export type StrategyPostingAlignment = {
  kind: StrategyPostingAlignmentKind;
  /** OAuth platform IDs implied by content strategy labels */
  strategyOAuthIds: SocialPlatform[];
  /** Short status line for UI */
  title: string;
  /** One-line explanation */
  detail: string;
};

/**
 * Compare content strategy channel labels (`platforms`) with selected OAuth `postingPlatforms`.
 * Informational only — does not mutate form state.
 *
 * Rules:
 * - Map each strategy label to OAuth-capable IDs via `mapLabelsToPostingPlatforms` (same as analysis).
 * - If that yields no IDs: `no_compare` (empty strategy or only non-OAuth labels like YouTube-only).
 * - If strategy implies OAuth IDs but none are checked: `none`.
 * - If every implied ID is checked: `aligned`.
 * - If some but not all implied IDs are checked: `partial`.
 */
export function computeStrategyPostingAlignment(
  platforms: string[],
  postingPlatforms: SocialPlatform[]
): StrategyPostingAlignment {
  const trimmed = platforms.map((s) => s.trim()).filter(Boolean);
  const strategyOAuthIds = mapLabelsToPostingPlatforms(trimmed);

  if (strategyOAuthIds.length === 0) {
    if (trimmed.length === 0) {
      return {
        kind: "no_compare",
        strategyOAuthIds: [],
        title: "Strategy ↔ publish",
        detail: "Add content strategy channels to compare with OAuth posting targets.",
      };
    }
    return {
      kind: "no_compare",
      strategyOAuthIds: [],
      title: "Strategy ↔ publish",
      detail:
        "Your strategy channels don't include OAuth-connectable networks (e.g. YouTube or X alone). Nothing to align yet.",
    };
  }

  const posting = new Set(postingPlatforms);
  const covered = strategyOAuthIds.filter((p) => posting.has(p));

  if (posting.size === 0) {
    return {
      kind: "none",
      strategyOAuthIds,
      title: "No matching OAuth target selected",
      detail: `Strategy maps to ${formatNames(strategyOAuthIds)}, but no posting targets are checked.`,
    };
  }

  if (covered.length === 0) {
    return {
      kind: "none",
      strategyOAuthIds,
      title: "No matching OAuth target selected",
      detail: `Strategy implies ${formatNames(strategyOAuthIds)}; none are selected as posting targets.`,
    };
  }

  if (covered.length === strategyOAuthIds.length) {
    return {
      kind: "aligned",
      strategyOAuthIds,
      title: "Aligned",
      detail: `OAuth posting targets cover your strategy channels (${formatNames(strategyOAuthIds)}).`,
    };
  }

  const missing = strategyOAuthIds.filter((p) => !posting.has(p));
  return {
    kind: "partial",
    strategyOAuthIds,
    title: "Partially aligned",
    detail: `Selected: ${formatNames(covered)}. Also in strategy but not checked: ${formatNames(missing)}.`,
  };
}

function formatNames(ids: SocialPlatform[]): string {
  return ids.map(postingPlatformDisplayName).join(", ");
}

function isPostingTargetConnected(
  p: SocialPlatform,
  connectedAccounts: { platform: string; platformCanonical?: SocialPlatform | null }[]
): boolean {
  return connectedAccounts.some((a) => {
    const acct = a.platformCanonical ?? normalizeAccountPlatformToSocialPlatform(a.platform);
    return acct === p;
  });
}

/**
 * Single actionable line from alignment + which posting targets are connected (informational only).
 * Pass `connectedAccounts` from GET /api/social/accounts (may be empty).
 */
export function buildStrategyPostingNextAction(
  alignment: StrategyPostingAlignment,
  platforms: string[],
  postingPlatforms: SocialPlatform[],
  connectedAccounts: { platform: string }[]
): string {
  const posting = new Set(postingPlatforms);
  const trimmed = platforms.map((s) => s.trim()).filter(Boolean);

  switch (alignment.kind) {
    case "no_compare":
      if (trimmed.length === 0) {
        return "Add content strategy channels in Analysis context, then choose matching OAuth posting targets.";
      }
      return "Add OAuth-connectable channels (e.g. Instagram or LinkedIn) to your strategy list if you want posting alignment.";
    case "none":
    case "partial": {
      const needSelect = alignment.strategyOAuthIds.filter((p) => !posting.has(p));
      if (needSelect.length === 0) {
        return "Review OAuth posting targets in Analysis context.";
      }
      if (needSelect.length === 1) {
        return `Select ${postingPlatformDisplayName(needSelect[0])} in OAuth posting targets to match your strategy.`;
      }
      return `Select ${formatNames(needSelect)} in OAuth posting targets to match your strategy.`;
    }
    case "aligned": {
      const relevant = postingPlatforms.filter((p) => alignment.strategyOAuthIds.includes(p));
      const unconnected = relevant.filter(
        (p) => !isPostingTargetConnected(p, connectedAccounts)
      );
      if (unconnected.length === 0) {
        return "Your strategy is covered; you're ready to continue.";
      }
      if (unconnected.length === 1) {
        return `Connect ${postingPlatformDisplayName(unconnected[0])} to publish on your selected channel.`;
      }
      return `Connect ${formatNames(unconnected)} to publish on your selected channels.`;
    }
  }
}

export function computeStrategyPostingAlignmentWithNextAction(
  platforms: string[],
  postingPlatforms: SocialPlatform[],
  connectedAccounts: { platform: string }[]
): StrategyPostingAlignment & { nextAction: string } {
  const base = computeStrategyPostingAlignment(platforms, postingPlatforms);
  const nextAction = buildStrategyPostingNextAction(
    base,
    platforms,
    postingPlatforms,
    connectedAccounts
  );
  return { ...base, nextAction };
}
