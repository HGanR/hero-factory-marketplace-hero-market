"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Circle, AlertCircle } from "lucide-react";
import type { SocialPlatform } from "@/lib/social/config";
import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";
import type { RevenueOsAnalyzeResponse } from "@/lib/validators/revenue-os";
import {
  BENTLEY_FIRST_CAMPAIGN_DRAFT_CHANGED_EVENT,
  readFirstCampaignDraftMeta,
} from "@/lib/revenue-os/bentley-first-campaign-ui";
import { BENTLEY_PIPELINE_PROGRESS_EVENT } from "@/lib/revenue-os/bentley-pipeline-progress";
import {
  loadWorkflowState,
  subscribeBentleyWorkflowCrossTab,
  type BentleyWorkflowState,
} from "@/lib/revenue-os/bentley-workflow";
import {
  computeBentleyLaunchReadinessSummary,
  type LaunchReadinessFinalKind,
} from "@/lib/revenue-os/bentley-launch-readiness-summary";
import { connectedSocialPlatformsSet } from "@/lib/social/platform-identity";
import type { SocialAccountLite } from "@/lib/social/social-account-public";

type Props = {
  postingPlatforms: SocialPlatform[];
  connectedAccounts: SocialAccountLite[];
  analysis: RevenueOsAnalyzeResponse | null;
  contentEngineOutput: ContentEngineOutput | null;
};

function statusStyles(kind: LaunchReadinessFinalKind) {
  switch (kind) {
    case "ready":
      return {
        wrap: "border-emerald-500/40 bg-emerald-950/35",
        title: "text-emerald-200",
        icon: "text-emerald-400",
      };
    case "blocked_connection":
      return {
        wrap: "border-amber-500/40 bg-amber-950/25",
        title: "text-amber-100",
        icon: "text-amber-400",
      };
    case "blocked_content":
      return {
        wrap: "border-amber-500/40 bg-amber-950/25",
        title: "text-amber-100",
        icon: "text-amber-400",
      };
    default:
      return {
        wrap: "border-cyan-500/35 bg-slate-900/80",
        title: "text-cyan-100",
        icon: "text-cyan-400",
      };
  }
}

export function BentleyLaunchReadinessSummary({
  postingPlatforms,
  connectedAccounts,
  analysis,
  contentEngineOutput,
}: Props) {
  const [wf, setWf] = useState<BentleyWorkflowState>(() => loadWorkflowState());
  const [draftTick, setDraftTick] = useState(0);

  const refresh = useCallback(() => setWf(loadWorkflowState()), []);

  useEffect(() => {
    refresh();
    const onProg = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onProg);
    document.addEventListener("visibilitychange", onVis);
    const unsub = subscribeBentleyWorkflowCrossTab(refresh);
    return () => {
      window.removeEventListener(BENTLEY_PIPELINE_PROGRESS_EVENT, onProg);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, [refresh]);

  useEffect(() => {
    const onDraft = () => setDraftTick((t) => t + 1);
    window.addEventListener(BENTLEY_FIRST_CAMPAIGN_DRAFT_CHANGED_EVENT, onDraft);
    return () => window.removeEventListener(BENTLEY_FIRST_CAMPAIGN_DRAFT_CHANGED_EVENT, onDraft);
  }, []);

  const connectedSocialPlatforms = useMemo(
    () => connectedSocialPlatformsSet(connectedAccounts),
    [connectedAccounts]
  );

  const hasSessionDraftMeta = useMemo(() => {
    void draftTick;
    if (typeof window === "undefined") return false;
    return readFirstCampaignDraftMeta() != null;
  }, [draftTick]);

  const summary = useMemo(
    () =>
      computeBentleyLaunchReadinessSummary({
        wf,
        postingPlatforms,
        connectedSocialPlatforms,
        analysis,
        contentEngineOutput,
        hasSessionDraftMeta,
      }),
    [wf, postingPlatforms, connectedSocialPlatforms, analysis, contentEngineOutput, hasSessionDraftMeta]
  );

  const palette = statusStyles(summary.finalKind);

  return (
    <div
      className={`mb-6 rounded-2xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm ${palette.wrap}`}
    >
      <div className="flex flex-wrap items-start gap-2">
        {summary.finalKind === "ready" ? (
          <Check className={`h-5 w-5 shrink-0 mt-0.5 ${palette.icon}`} aria-hidden />
        ) : (
          <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${palette.icon}`} aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className={`font-semibold text-[13px] ${palette.title}`}>{summary.headline}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-snug">{summary.subline}</p>
        </div>
      </div>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2" aria-label="Launch readiness checklist">
        {summary.rows.map((row) => (
          <li
            key={row.id}
            className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-slate-200"
          >
            {row.ok ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400 mt-0.5" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-slate-500 mt-0.5" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="font-medium text-slate-100">{row.label}</span>
              {row.detail ? (
                <span className="block text-slate-500 text-[10px] leading-snug mt-0.5">{row.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
