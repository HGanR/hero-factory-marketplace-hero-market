"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  fileDrawerToggle: ReactNode;
};

export function SiteBuilderPreviewCanvas({ children, fileDrawerToggle }: Props) {
  return (
    <section className="min-h-[min(78vh,820px)] rounded-2xl border border-white/[0.08] bg-slate-950/35 p-3 shadow-xl shadow-black/25">
      <div className="mb-2 flex items-center justify-end">{fileDrawerToggle}</div>
      {children}
    </section>
  );
}
