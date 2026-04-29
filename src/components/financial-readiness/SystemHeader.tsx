"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  systemName: string;
  tagline?: string;
  backHref?: string;
  actions?: ReactNode;
};

export function SystemHeader({ systemName, tagline, backHref = "/financial-readiness", actions }: Props) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-white/10 pb-4">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-cyan-300/90 hover:text-cyan-200 mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Financial Readiness Center
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">{systemName}</h1>
        {tagline && <p className="mt-1 text-sm text-slate-400 max-w-2xl">{tagline}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
