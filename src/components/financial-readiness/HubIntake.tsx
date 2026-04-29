"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Scale, Sparkles, Wrench } from "lucide-react";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import type { HubPrimaryGoal } from "./state";

const OPTIONS: {
  goal: HubPrimaryGoal;
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}[] = [
  {
    goal: "foundation",
    title: "Build my credit foundation",
    description: "Education, utilization, and habits before disputes or collections work.",
    href: "/financial-readiness/foundation",
    icon: <Sparkles className="h-6 w-6 text-cyan-300" />,
  },
  {
    goal: "optimization",
    title: "Fix or optimize my credit",
    description: "Report notes, disputes, letters, and timelines for tradeline work.",
    href: "/financial-readiness/optimization",
    icon: <Wrench className="h-6 w-6 text-violet-300" />,
  },
  {
    goal: "resolution",
    title: "Handle active debt now",
    description: "Collector log, validation, cease notices, and case status.",
    href: "/financial-readiness/resolution",
    icon: <Scale className="h-6 w-6 text-amber-300" />,
  },
];

export function HubIntake() {
  const router = useRouter();
  const { dispatch } = useFinancialReadiness();

  return (
    <section className="rounded-2xl border border-cyan-500/25 bg-gradient-to-br from-cyan-950/40 to-slate-950/60 p-6 mb-10">
      <h2 className="text-xl font-semibold text-white mb-1">Start here — pick your path</h2>
      <p className="text-sm text-slate-400 mb-6 max-w-2xl">
        One quick choice routes you into the right system. You can switch modules anytime; progress is saved in
        this browser.
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        {OPTIONS.map((o) => (
          <button
            key={o.goal}
            type="button"
            onClick={() => {
              dispatch({ type: "hub/completeIntake", goal: o.goal });
              router.push(o.href);
            }}
            className="text-left rounded-xl border border-white/10 bg-white/[0.04] p-4 hover:border-cyan-500/40 hover:bg-white/[0.06] transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{o.icon}</div>
              <div>
                <p className="font-medium text-white group-hover:text-cyan-100">{o.title}</p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">{o.description}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-sm text-cyan-400">
                  Continue <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
