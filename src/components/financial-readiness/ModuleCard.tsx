"use client";

import Link from "next/link";
import type { ReactNode } from "react";

const ACCENTS = {
  cyan: "border-cyan-500/35 bg-cyan-500/5 hover:border-cyan-400/50 text-cyan-100/95",
  violet: "border-violet-500/35 bg-violet-500/5 hover:border-violet-400/50 text-violet-100/95",
  amber: "border-amber-500/35 bg-amber-500/5 hover:border-amber-400/50 text-amber-100/95",
} as const;

export type ModuleCardProps = {
  title: string;
  description: string;
  href: string;
  cta: string;
  accent: keyof typeof ACCENTS;
  icon: ReactNode;
};

export function ModuleCard({ title, description, href, cta, accent, icon }: ModuleCardProps) {
  const ring = ACCENTS[accent] ?? ACCENTS.cyan;
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border p-5 transition-colors ${ring}`}
    >
      <div className="mb-3 flex items-center gap-2 text-white">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-current">{icon}</span>
        <h2 className="text-base font-semibold leading-snug">{title}</h2>
      </div>
      <p className="flex-1 text-sm text-slate-400 leading-relaxed">{description}</p>
      <span className="mt-4 inline-flex text-sm font-medium text-cyan-300 group-hover:underline">{cta} →</span>
    </Link>
  );
}
