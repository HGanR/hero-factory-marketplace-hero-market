"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { BuyerDemoPayload } from "@/lib/maania/build-buyer-demo-payload";
import { MAANIA_BUYER_DEMO_STORAGE_KEY } from "@/lib/maania/maania-demo-storage";

type Props = { fallback: ReactNode };

/**
 * When MAANIA persists a buyer demo payload to sessionStorage, replaces the hero copy on the realtor demo page.
 */
export function BuyerDemoHeroShell({ fallback }: Props) {
  const [payload, setPayload] = useState<BuyerDemoPayload | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MAANIA_BUYER_DEMO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as BuyerDemoPayload;
      if (parsed?.heroTitle && parsed?.buyerProfile && parsed?.readiness) setPayload(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  if (!payload) return <>{fallback}</>;

  const pct = payload.readiness.progressPercent;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-100">
          AI-tailored preview
        </span>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
          Generated from live buyer intake
        </span>
      </div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-emerald-200/95">
        Buyer profile · MAANIA preview
      </p>
      <h1 className="font-serif text-4xl font-semibold text-white drop-shadow-md md:text-5xl md:leading-tight">
        {payload.heroTitle}
      </h1>
      <p className="mt-8 max-w-xl text-xl font-bold uppercase leading-snug tracking-wide text-white drop-shadow md:text-2xl">
        {payload.heroSubtitle}
      </p>
      <p className="mt-6 max-w-md rounded-lg border border-emerald-500/25 bg-black/45 px-4 py-3 text-left text-sm text-slate-100 backdrop-blur-sm">
        <span className="font-semibold text-emerald-200">Live lead asset</span>
        <span className="mt-2 block text-slate-200/95">
          {payload.clientFacingSummary.slice(0, 3).map((line, i) => (
            <span key={i} className="mb-1 block">
              • {line}
            </span>
          ))}
        </span>
        <span className="mt-3 block text-[11px] text-slate-400">
          Intake {payload.readiness.answeredCount}/{payload.readiness.totalCount} · {pct}%
          {pct >= 50 ? " · tailored demo" : pct >= 25 ? " · preview direction" : ""}
          {payload.readiness.nextBestQuestion ? " · next: refine in chat" : " · ready to present"}
        </span>
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white">
          {payload.ctaLabel}
        </span>
      </div>
    </>
  );
}
