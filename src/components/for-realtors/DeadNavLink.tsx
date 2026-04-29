"use client";

import type { ReactNode } from "react";

/** Placeholder nav link — no navigation (for demo pages). */
export function DeadNavLink({ children }: { children: ReactNode }) {
  return (
    <a
      href="#"
      className="text-slate-300 transition hover:text-white"
      onClick={(e) => e.preventDefault()}
    >
      {children}
    </a>
  );
}
