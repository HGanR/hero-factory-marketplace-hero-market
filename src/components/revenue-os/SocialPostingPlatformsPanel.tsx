"use client";

import { useMemo } from "react";
import type { SocialPlatform } from "@/lib/social/config";
import { PLATFORM_CONFIG } from "@/lib/social/config";
import {
  getBentleyPostingRecommendation,
  postingPlatformDisplayName,
} from "@/lib/revenue-os/bentley-posting-platforms";
import { normalizeAccountPlatformToSocialPlatform } from "@/lib/social/platform-identity";
import type { SocialAccountLite } from "@/lib/social/social-account-public";
import { StrategyPostingAlignmentBadge } from "@/components/revenue-os/StrategyPostingAlignmentBadge";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

const ACCENT = "#00D1FF";

export type { SocialAccountLite };

type Props = {
  postingPlatforms: SocialPlatform[];
  /** Content strategy channel labels (dashboard `form.platforms`) — for alignment hint only */
  strategyPlatforms?: string[];
  clientId: unknown;
  returnTo: string;
  connectedAccounts: SocialAccountLite[];
  analysis: RevenueOsAnalyzeResponse | null;
};

export function SocialPostingPlatformsPanel({
  postingPlatforms,
  strategyPlatforms,
  clientId,
  returnTo,
  connectedAccounts,
  analysis,
}: Props) {
  const connectedByPlatform = useMemo(() => {
    const m = new Map<SocialPlatform, SocialAccountLite>();
    for (const a of connectedAccounts) {
      const sp = a.platformCanonical ?? normalizeAccountPlatformToSocialPlatform(a.platform);
      if (sp && !m.has(sp)) m.set(sp, a);
    }
    return m;
  }, [connectedAccounts]);

  const recommendation = useMemo(
    () => getBentleyPostingRecommendation(analysis, postingPlatforms, connectedAccounts),
    [analysis, postingPlatforms, connectedAccounts]
  );

  const safeClientId = coerceTrimmedString(clientId);

  const startOAuthConnect = (platform: SocialPlatform) => {
    const qs = new URLSearchParams();
    if (safeClientId) qs.set("clientId", safeClientId);
    qs.set("returnTo", returnTo);
    window.location.href = `/api/social/oauth/${platform}/start?${qs.toString()}`;
  };

  return (
    <div className="rounded-xl border border-cyan-500/40 bg-slate-900/60 p-4 text-sm text-slate-200 shadow-lg">
      <div>
        <h3 className="font-semibold text-cyan-200/95">OAuth posting & connections</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Networks you selected as <span className="text-slate-300">publish targets</span> (checkboxes in Analysis
          context). Separate from <span className="text-slate-300">content strategy channels</span> (comma list) used
          for prompts. Connect accounts with OAuth — credentials stay with the provider.
        </p>
      </div>

      {strategyPlatforms !== undefined ? (
        <StrategyPostingAlignmentBadge
          variant="compact"
          platforms={strategyPlatforms}
          postingPlatforms={postingPlatforms}
          connectedAccounts={connectedAccounts}
        />
      ) : null}

      <p className="text-xs text-slate-300/95 mt-3 leading-relaxed border-l-2 border-cyan-500/35 pl-2.5">
        {recommendation}
      </p>

      {postingPlatforms.length === 0 ? (
        <p className="text-xs text-slate-500 mt-3">
          Select posting targets below (or complete Bentley intake). We&apos;ll list each network and its connection
          status here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {postingPlatforms.map((platform) => {
            const row = connectedByPlatform.get(platform);
            const enabled = PLATFORM_CONFIG[platform]?.enabled === true;
            const label = postingPlatformDisplayName(platform);
            return (
              <li
                key={platform}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-cyan-500/25 bg-black/25 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-cyan-100/90">{label}</span>
                  {row ? (
                    <span
                      className="text-xs px-2 py-0.5 rounded-md border border-emerald-500/50 text-emerald-200/90 bg-emerald-950/40"
                      title={row.displayName ?? undefined}
                    >
                      Connected{row.displayName ? ` · ${row.displayName}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Not connected</span>
                  )}
                </div>
                {!row && (
                  <button
                    type="button"
                    disabled={!enabled}
                    onClick={() => startOAuthConnect(platform)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-cyan-500/60 text-cyan-200 hover:bg-cyan-950/50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    style={{ boxShadow: enabled ? `0 2px 0 ${ACCENT}33` : undefined }}
                  >
                    {enabled ? "Connect" : "Unavailable"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
