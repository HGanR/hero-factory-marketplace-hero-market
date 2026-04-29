"use client";

import { Check } from "lucide-react";

type Step = { id: string; label: string };

type Props = {
  title: string;
  steps: Step[];
  currentIndex: number;
  onSelect: (index: number) => void;
};

export function WorkflowSidebar({ title, steps, currentIndex, onSelect }: Props) {
  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-cyan-200/80 mb-3">{title}</p>
      <nav className="space-y-1" aria-label="Workflow steps">
        {steps.map((s, i) => {
          const active = i === currentIndex;
          const complete = i < currentIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(i)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                active
                  ? "bg-cyan-500/15 text-white border border-cyan-500/30"
                  : "text-slate-300 hover:bg-white/5 border border-transparent"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  complete
                    ? "bg-emerald-500/20 text-emerald-300"
                    : active
                      ? "bg-cyan-500/30 text-cyan-100"
                      : "bg-white/5 text-slate-500"
                }`}
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
