"use client";

import type { ReactNode } from "react";
import { FinancialReadinessProvider } from "./FinancialReadinessProvider";

export function FinancialReadinessLayoutClient({ children }: { children: ReactNode }) {
  return (
    <FinancialReadinessProvider>
      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-[#0c1222] to-black text-slate-100">
        <div
          className="pointer-events-none fixed inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,209,255,0.12), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(139,92,246,0.08), transparent)",
          }}
        />
        <div className="relative">{children}</div>
      </div>
    </FinancialReadinessProvider>
  );
}
