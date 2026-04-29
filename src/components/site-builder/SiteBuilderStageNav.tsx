"use client";

import type { BuilderWorkflowStage } from "@/components/site-builder/builder-workflow-stage";
import { Check } from "lucide-react";
import { motion } from "framer-motion";

const STAGES: Array<{ id: BuilderWorkflowStage; label: string; hint: string }> = [
  { id: "describe", label: "Brief", hint: "Goal & tone" },
  { id: "review", label: "Outline", hint: "Structure check" },
  { id: "refine", label: "Edit", hint: "Live preview" },
  { id: "publish", label: "Ship", hint: "Save & deploy" },
];

const ORDER: BuilderWorkflowStage[] = ["describe", "review", "refine", "publish"];

type Props = {
  stage: BuilderWorkflowStage;
  onStageChange: (s: BuilderWorkflowStage) => void;
};

export function SiteBuilderStageNav({ stage, onStageChange }: Props) {
  const activeIdx = ORDER.indexOf(stage);

  return (
    <motion.nav
      layout
      className="rounded-2xl border border-white/[0.07] bg-slate-950/40 p-1.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm"
      aria-label="Builder navigation"
    >
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {STAGES.map((s, i) => {
          const active = stage === s.id;
          const done = i < activeIdx;
          return (
            <motion.button
              layout
              key={s.id}
              type="button"
              aria-label={`${s.label}: ${s.hint}`}
              aria-current={active ? "step" : undefined}
              onClick={() => onStageChange(s.id)}
              initial={false}
              animate={{
                backgroundColor: active ? "rgba(99, 102, 241, 0.14)" : done ? "rgba(16, 185, 129, 0.06)" : "transparent",
              }}
              transition={{ duration: 0.22 }}
              className={`relative rounded-xl px-3 py-3 text-left transition-[box-shadow] ${
                active
                  ? "shadow-[0_0_0_1px_rgba(129,140,248,0.45),0_8px_28px_rgba(79,70,229,0.12)]"
                  : done
                    ? "ring-1 ring-emerald-500/15 hover:bg-white/[0.03]"
                    : "hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${
                    active
                      ? "bg-indigo-500/30 text-indigo-100 ring-1 ring-indigo-400/40"
                      : done
                        ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25"
                        : "bg-slate-800/80 text-slate-500 ring-1 ring-white/[0.06]"
                  }`}
                  aria-hidden
                >
                  {done && !active ? <Check className="h-3 w-3" strokeWidth={2.5} /> : i + 1}
                </span>
                <div className="min-w-0">
                  <div
                    className={`text-sm font-semibold leading-tight tracking-tight ${
                      active ? "text-indigo-50" : done ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </div>
                  <div className={`mt-0.5 text-[11px] leading-snug ${active ? "text-slate-400" : "text-slate-500"}`}>{s.hint}</div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.nav>
  );
}
