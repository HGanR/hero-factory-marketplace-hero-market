"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2, RefreshCw } from "lucide-react";

import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

const ACCENT = "#00D1FF";

export type OfferLadderProfile = {
  userId: string;
  businessName: string;
  businessType: string;
  currentMonthlyRevenue: number;
  targetMonthlyRevenue: number;
  avgOrderValue: number;
  conversionRatePct: number;
  cac: number;
  grossMarginPct: number;
};

type LadderTier = {
  name: string;
  price: number;
  description: string;
  guarantee: string;
};

type GenerateResponse = {
  offerLadder?: {
    core: LadderTier;
    premium: LadderTier;
    ascension: LadderTier;
  };
  error?: string;
  version?: number;
};

export function OfferLadderPanel({
  profile,
  industry,
  clientId,
  trustId,
}: {
  profile: OfferLadderProfile;
  industry?: string;
  clientId: string;
  trustId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GenerateResponse | null>(null);

  const canRequest =
    Boolean(coerceTrimmedString(profile.userId)) &&
    profile.targetMonthlyRevenue > 0 &&
    profile.avgOrderValue > 0;

  const runGenerate = useCallback(async () => {
    if (!canRequest) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/revenue-os/offers/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            userId: profile.userId,
            businessName: profile.businessName,
            businessType: profile.businessType,
            currentMonthlyRevenue: profile.currentMonthlyRevenue,
            targetMonthlyRevenue: profile.targetMonthlyRevenue,
            avgOrderValue: profile.avgOrderValue,
            conversionRatePct: profile.conversionRatePct,
            cac: profile.cac,
            grossMarginPct: profile.grossMarginPct,
          },
          industry: coerceTrimmedString(industry) || undefined,
          clientId: coerceTrimmedString(clientId) || undefined,
          trustId: coerceTrimmedString(trustId) || undefined,
        }),
      });
      const json = (await res.json()) as GenerateResponse;
      if (!res.ok) {
        throw new Error(json?.error || "Offer generation failed");
      }
      setData(json);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load offer ladder");
    } finally {
      setLoading(false);
    }
  }, [
    canRequest,
    profile.userId,
    profile.businessName,
    profile.businessType,
    profile.currentMonthlyRevenue,
    profile.targetMonthlyRevenue,
    profile.avgOrderValue,
    profile.conversionRatePct,
    profile.cac,
    profile.grossMarginPct,
    industry,
    clientId,
    trustId,
  ]);

  /** Refetch when unit economics identity changes (profile is memoized on the dashboard). */
  useEffect(() => {
    if (!canRequest) return;
    void runGenerate();
    // runGenerate is stable for the same profile shape; omit to avoid duplicate strict runs
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: listed primitive deps only
  }, [
    canRequest,
    profile.userId,
    profile.targetMonthlyRevenue,
    profile.avgOrderValue,
    profile.grossMarginPct,
    industry,
    clientId,
    trustId,
  ]);

  const ladder = data?.offerLadder;
  const tiers = ladder
    ? ([ladder.core, ladder.premium, ladder.ascension] as const)
    : [];

  return (
    <section
      className="rounded-2xl border border-cyan-500/50 bg-slate-800/50 p-6 shadow-lg"
      aria-labelledby="offer-ladder-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-cyan-400" aria-hidden />
          <h2 id="offer-ladder-heading" className="text-lg font-semibold text-cyan-400">
            Offer ladder
          </h2>
          {data?.version != null ? (
            <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cyan-200/90">
              v{data.version}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void runGenerate()}
          disabled={loading || !canRequest}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Core → Premium → Ascension pricing modeled from your targets and unit economics. Saved to your workspace when
        generation succeeds.
      </p>

      {!canRequest ? (
        <p className="mt-4 text-sm text-amber-200/90">
          Set target revenue and average order value in the form above to generate an offer ladder.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !ladder ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: ACCENT }} />
          Generating offer ladder…
        </div>
      ) : null}

      {ladder ? (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="rounded-xl border border-white/10 bg-black/30 p-4"
              style={{ boxShadow: "0 0 0 1px rgba(0,209,255,0.08)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">{tier.name}</div>
              <div className="mt-2 text-2xl font-bold text-white">
                ${tier.price.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-slate-500">suggested</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{tier.description}</p>
              <p className="mt-3 text-xs text-slate-500 border-t border-white/5 pt-3">{tier.guarantee}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
