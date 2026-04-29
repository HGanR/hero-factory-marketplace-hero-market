"use client";

import React from "react";
import { Check } from "lucide-react";
import type { MissionPathStep } from "@/lib/user-mission-path/mission-path-types";

type Props = {
  step: MissionPathStep;
  isLast?: boolean;
};

export function MissionPathStepNode({ step, isLast }: Props) {
  return (
    <li className="relative flex gap-3 min-w-0">
      {!isLast && (
        <div
          className="absolute left-[15px] top-8 bottom-0 w-px -translate-x-1/2 bg-gradient-to-b from-cyan-500/40 to-transparent"
          aria-hidden
        />
      )}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
          step.done
            ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
            : "border-white/20 bg-white/[0.04] text-slate-400"
        }`}
        aria-label={step.done ? `${step.title} complete` : `${step.title} pending`}
      >
        {step.done ? <Check className="h-4 w-4 text-cyan-300" /> : <span>{step.order}</span>}
      </div>
      <div className="pb-6 min-w-0">
        <div
          className={`text-sm font-semibold leading-tight ${step.done ? "text-slate-200" : "text-slate-100"}`}
        >
          {step.title}
        </div>
        {step.detail ? (
          <div className="mt-0.5 text-xs text-slate-500 truncate" title={step.detail}>
            {step.detail}
          </div>
        ) : null}
      </div>
    </li>
  );
}
