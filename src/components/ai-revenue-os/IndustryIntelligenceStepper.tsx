"use client";

import { useCallback } from "react";

const GOLD = "#D4AF37";
const GOLD_LIGHT = "#F5C518";

type Step = {
  id: string;
  label: string;
  complete: boolean;
};

export function IndustryIntelligenceStepper({
  steps,
  onStepClick,
}: {
  steps: Step[];
  onStepClick: (id: string) => void;
}) {
  const handleClick = useCallback(
    (id: string) => {
      onStepClick(id);
    },
    [onStepClick]
  );

  return (
    <div className="flex flex-wrap items-center gap-4 justify-center py-6">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleClick(step.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-medium text-sm
              transition-all hover:scale-[1.02]
              ${step.complete ? "opacity-100" : "opacity-70"}
            `}
            style={{
              borderColor: step.complete ? GOLD : "rgba(212,175,55,0.4)",
              color: step.complete ? GOLD_LIGHT : "rgba(212,175,55,0.7)",
              backgroundColor: step.complete ? "rgba(212,175,55,0.08)" : "transparent",
            }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                backgroundColor: step.complete ? GOLD : "rgba(212,175,55,0.3)",
                color: step.complete ? "black" : "rgba(255,255,255,0.8)",
              }}
            >
              {step.complete ? "✓" : i + 1}
            </span>
            {step.label}
          </button>
          {i < steps.length - 1 && (
            <div
              className="w-6 h-0.5 hidden sm:block"
              style={{ backgroundColor: "rgba(212,175,55,0.4)" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
