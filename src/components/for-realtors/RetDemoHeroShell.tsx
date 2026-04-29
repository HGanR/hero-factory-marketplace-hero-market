"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { RetDemoPagePayload } from "@/lib/maania/build-ret-demo-payload";
import { MAANIA_RET_DEMO_STORAGE_KEY } from "@/lib/maania/maania-demo-storage";

type Props = { fallback: ReactNode };

/**
 * When MAANIA persists a RET demo payload to sessionStorage, replaces the hero on the realtor demo page.
 */
export function RetDemoHeroShell({ fallback }: Props) {
  const [payload, setPayload] = useState<RetDemoPagePayload | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MAANIA_RET_DEMO_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RetDemoPagePayload;
      if (parsed?.heroTitle && parsed?.propertyDealLabel) setPayload(parsed);
    } catch {
      /* ignore */
    }
  }, []);

  if (!payload) return <>{fallback}</>;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-blue-400/35 bg-blue-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-100">
          RET transfer preview
        </span>
        <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90">
          Generated from seller intake
        </span>
      </div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4em] text-blue-200/95">
        Property intelligence · MAANIA preview
      </p>
      <h1 className="font-serif text-4xl font-semibold text-white drop-shadow-md md:text-5xl md:leading-tight">
        {payload.heroTitle}
      </h1>
      <p className="mt-8 max-w-xl text-xl font-bold uppercase leading-snug tracking-wide text-white drop-shadow md:text-2xl">
        {payload.heroSubtitle}
      </p>
      <p className="mt-6 max-w-md rounded-lg border border-blue-500/25 bg-black/45 px-4 py-3 text-left text-sm text-slate-100 backdrop-blur-sm">
        <span className="font-semibold text-blue-200">Deal snapshot</span>
        <span className="mt-2 block text-slate-200/95">
          <span className="mb-1 block">• {payload.propertyDealLabel}</span>
          <span className="mb-1 block">• {payload.ownerContact}</span>
        </span>
        <span className="mt-3 block text-[11px] text-slate-400">
          {payload.riskSummary.slice(0, 2).join(" · ")}
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
