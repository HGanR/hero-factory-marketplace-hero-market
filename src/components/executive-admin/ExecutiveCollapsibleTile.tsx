"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  defaultCollapsed?: boolean;
  /** When this number changes, the tile expands (e.g. subject nav focus). */
  expandOnSignal?: number;
  id?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Nested operation panels — strips top margin so tiles stack cleanly. */
export function ExecutiveEmbeddedStack({ children }: { children: ReactNode }) {
  return <div className="space-y-2 [&>div]:!mt-0 [&>section]:!mt-0">{children}</div>;
}

export function ExecutiveCollapsibleTile({
  title,
  subtitle,
  defaultCollapsed = true,
  expandOnSignal,
  id,
  badge,
  children,
  className = "",
}: Props) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const showBody = !collapsed;

  useEffect(() => {
    if (expandOnSignal != null && expandOnSignal > 0) {
      setCollapsed(false);
    }
  }, [expandOnSignal]);

  return (
    <section
      id={id}
      className={`rounded-xl border border-[#00A3FF]/22 bg-[#000814]/90 shadow-[inset_0_0_18px_rgba(0,163,255,0.03)] backdrop-blur-md ${className}`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((open) => !open)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-[#00A3FF]/5"
      >
        <div className="flex min-w-0 items-center gap-2">
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#00A3FF]/90" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#00A3FF]/90" aria-hidden />
          )}
          <div className="min-w-0">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00A3FF]/95">{title}</h3>
            {subtitle ? (
              <p className={`mt-0.5 text-[9px] leading-snug text-slate-600 ${collapsed ? "truncate" : ""}`}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </button>
      {showBody ? <div className="border-t border-[#00A3FF]/12 px-3 py-3">{children}</div> : null}
    </section>
  );
}
