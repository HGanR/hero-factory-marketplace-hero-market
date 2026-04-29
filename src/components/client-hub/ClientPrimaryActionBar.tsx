import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Sticky CTA bar for client hub sub-pages (e.g. Build landing, Attach agent).
 */
export function ClientPrimaryActionBar({ children, className = "" }: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-cyan-500/20 bg-slate-900/60 px-4 py-3 ${className}`}
    >
      {children}
    </div>
  );
}
