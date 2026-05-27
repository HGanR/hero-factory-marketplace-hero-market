"use client";

import { useCallback, useEffect, useState } from "react";
import { Zap, RefreshCw, ArrowRight, Sparkles, AlertTriangle, TrendingUp } from "lucide-react";
import { useAiRevenueOsContentCampaign } from "@/components/ai-revenue-os/AiRevenueOsSharedState";
import { loadWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type {
  StructuredRecommendation,
  TopPerformingSnapshot,
} from "@/lib/bentley-social-leads/conversionRecommendations";
import type { OperatorNextActionsBundle } from "@/lib/bentley-social-leads/operatorNextActions";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";
import { appendCampaignBriefIfMissing } from "@/lib/revenue-os/unified-generation-markers";

const ACCENT = "#00D1FF";

function scrollToContentEngine() {
  if (typeof document === "undefined") return;
  document.querySelector<HTMLElement>('[data-bentley-section="content-engine"]')?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function recStyle(kind: StructuredRecommendation["kind"]): string {
  if (kind === "do_more") return "border-emerald-500/35 bg-emerald-950/25 text-emerald-100/95";
  if (kind === "avoid") return "border-rose-500/35 bg-rose-950/20 text-rose-100/90";
  return "border-amber-500/35 bg-amber-950/25 text-amber-100/90";
}

type Props = {
  /**
   * When set (e.g. Revenue OS dashboard), merge brief into canonical `form.notes` instead of shared `campaignNotes`.
   */
  onApplyBrief?: (brief: string) => void;
};

export function IntelligenceAccelerationPanel({ onApplyBrief }: Props) {
  const { setCampaignNotes, isProviderActive } = useAiRevenueOsContentCampaign();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [topPerforming, setTopPerforming] = useState<TopPerformingSnapshot | null>(null);
  const [recommendations, setRecommendations] = useState<StructuredRecommendation[]>([]);
  const [operatorNextActions, setOperatorNextActions] = useState<OperatorNextActionsBundle | null>(null);
  const [nextCampaignBrief, setNextCampaignBrief] = useState<string>("");
  const [applied, setApplied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const ws = loadWorkflowState();
      const hid = coerceTrimmedString(ws.artifacts.bentleySliContentHandoff?.handoffId) || undefined;
      const q = hid ? `?bentleyHandoffId=${encodeURIComponent(hid)}` : "";
      const r = await fetch(`/api/bentley-social-leads/intelligence-acceleration${q}`, {
        credentials: "include",
      });
      if (r.status === 401) {
        setTopPerforming(null);
        setOperatorNextActions(null);
        return;
      }
      const data = (await r.json()) as {
        topPerforming?: TopPerformingSnapshot;
        recommendations?: StructuredRecommendation[];
        operatorNextActions?: OperatorNextActionsBundle;
        nextCampaignBrief?: string;
        error?: string;
      };
      if (!r.ok) throw new Error(data?.error ?? "Failed");
      setTopPerforming(data.topPerforming ?? null);
      setRecommendations(data.recommendations ?? []);
      setOperatorNextActions(data.operatorNextActions ?? null);
      setNextCampaignBrief(data.nextCampaignBrief ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function applyNextCampaign() {
    if (!nextCampaignBrief.trim()) return;
    const block = nextCampaignBrief.trim();
    if (onApplyBrief) {
      onApplyBrief(block);
    } else {
      setCampaignNotes((prev) => appendCampaignBriefIfMissing(prev, block));
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
    scrollToContentEngine();
  }

  const canApply = Boolean(onApplyBrief) || isProviderActive;

  const nba = operatorNextActions?.nextBestAction;

  return (
    <div className="rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-6 shadow-lg shadow-cyan-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-300" />
          <h3 className="text-lg font-semibold text-white">Intelligence acceleration</h3>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs inline-flex items-center gap-1 text-slate-400 hover:text-white"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        Next actions from conversion data plus optional Bentley handoff (when present in workflow). Nothing posts
        automatically — use “Generate next campaign” to prefill Content Engine notes. Generation endpoints merge the same
        layers: <span className="text-cyan-300/90">conversion + Bentley + campaign brief + user input</span> (unified
        context).
      </p>

      {err ? <p className="text-xs text-rose-400 mb-3">{err}</p> : null}

      {loading && !operatorNextActions ? (
        <p className="text-sm text-slate-500">Loading guidance…</p>
      ) : !operatorNextActions ? (
        <p className="text-sm text-slate-500">Sign in to load acceleration signals.</p>
      ) : (
        <div className="space-y-5">
          {nba ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
              <div className="flex items-center gap-2 text-cyan-200 text-xs font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4" style={{ color: ACCENT }} />
                Next best action
              </div>
              <p className="text-white font-medium">{nba.title}</p>
              <p className="text-sm text-slate-400 mt-1">{nba.detail}</p>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{nba.rationale}</p>
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400/90" />
                Bottlenecks
              </div>
              {operatorNextActions.bottlenecks.length === 0 ? (
                <p className="text-sm text-slate-500">None flagged — keep capturing outcomes.</p>
              ) : (
                <ul className="text-sm text-slate-300 space-y-2">
                  {operatorNextActions.bottlenecks.map((b, i) => (
                    <li key={i} className="leading-snug">
                      • {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                <TrendingUp className="w-4 h-4 text-emerald-400/90" />
                Opportunities
              </div>
              {operatorNextActions.opportunities.length === 0 ? (
                <p className="text-sm text-slate-500">Add more attributed leads to surface lifts.</p>
              ) : (
                <ul className="text-sm text-slate-300 space-y-2">
                  {operatorNextActions.opportunities.map((b, i) => (
                    <li key={i} className="leading-snug">
                      • {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {topPerforming ? (
            <div className="rounded-xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Top performers</p>
              <div className="grid sm:grid-cols-2 gap-2 text-xs text-slate-300">
                <p>
                  <span className="text-slate-500">Platforms:</span> {topPerforming.platforms.join(", ") || "—"}
                </p>
                <p>
                  <span className="text-slate-500">Pain:</span> {topPerforming.painThemes.join(", ") || "—"}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-slate-500">CTA angles:</span> {topPerforming.ctaAngles.join(" · ") || "—"}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-slate-500">Offer angles:</span> {topPerforming.offerAngles.join(" · ") || "—"}
                </p>
              </div>
            </div>
          ) : null}

          {recommendations.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Structured guidance
              </p>
              <div className="flex flex-wrap gap-2">
                {recommendations.map((r, i) => (
                  <div
                    key={`${r.kind}-${r.label}-${i}`}
                    className={`rounded-lg border px-3 py-2 text-xs max-w-full ${recStyle(r.kind)}`}
                    title={r.rationale}
                  >
                    <span className="font-semibold uppercase tracking-wide opacity-80">{r.kind.replace("_", " ")}</span>
                    <span className="mx-1 opacity-50">·</span>
                    <span>{r.label.slice(0, 96)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!nextCampaignBrief.trim() || !canApply}
              onClick={() => applyNextCampaign()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600/80 hover:bg-cyan-500/90 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate next campaign
              <ArrowRight className="w-4 h-4" />
            </button>
            {applied ? (
              <span className="text-xs text-emerald-400/90">Brief merged into notes — scroll to Content Engine.</span>
            ) : !canApply ? (
              <span className="text-xs text-slate-500">Sign in and use AI Revenue OS or the dashboard to inject notes.</span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
