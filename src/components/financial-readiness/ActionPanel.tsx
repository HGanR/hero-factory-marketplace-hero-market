"use client";

import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
};

export function ActionPanel({ title, children, className = "" }: Props) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-slate-950/40 p-5 min-h-[280px] ${className}`}
    >
      {title && <h3 className="text-sm font-semibold text-cyan-100 mb-4">{title}</h3>}
      {children}
    </section>
  );
}
