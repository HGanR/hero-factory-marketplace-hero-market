"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type AiRevenueOsCollapsibleStepProps = {
  step: number;
  id: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Bentley analytics / section marker */
  dataBentleySection?: string;
  /** Opening the page with `#hash` matching any of these expands this step */
  openOnHashIds?: string[];
};

export function AiRevenueOsCollapsibleStep({
  step,
  id,
  title,
  subtitle,
  children,
  defaultOpen = false,
  dataBentleySection,
  openOnHashIds = [],
}: AiRevenueOsCollapsibleStepProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = (window.location.hash || "").replace(/^#/, "");
    if (!hash) return;
    if (hash === id || openOnHashIds.includes(hash)) {
      setOpen(true);
    }
  }, [id, openOnHashIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const hash = (window.location.hash || "").replace(/^#/, "");
      if (hash === id || openOnHashIds.includes(hash)) setOpen(true);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [id, openOnHashIds]);

  return (
    <section
      id={id}
      data-bentley-section={dataBentleySection}
      className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/40"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-4 p-5 text-left transition-colors hover:bg-slate-800/50"
        aria-expanded={open}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-bold text-cyan-300">
          {step}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold text-white">{title}</span>
          <span className="mt-1 block text-sm text-slate-400">{subtitle}</span>
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-slate-400 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="border-t border-slate-700/60 px-5 pb-6 pt-2">{children}</div>
      ) : null}
    </section>
  );
}
