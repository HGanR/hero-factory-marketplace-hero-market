"use client";

import Link from "next/link";
import { COMPLETION_HANDOFFS } from "./completionRoutes";

type Variant = keyof typeof COMPLETION_HANDOFFS;

export function ModuleCompletionPanel({ variant }: { variant: Variant }) {
  const cfg = COMPLETION_HANDOFFS[variant];
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 mt-6">
      <p className="text-sm font-medium text-emerald-200/95 mb-3">{cfg.headline}</p>
      <div className="flex flex-wrap gap-2">
        {cfg.links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30"
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/financial-readiness"
          className="inline-flex rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 hover:border-white/30"
        >
          Back to hub
        </Link>
      </div>
    </div>
  );
}
