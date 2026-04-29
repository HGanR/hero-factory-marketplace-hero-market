"use client";

import type { FinancialReadinessAction } from "./state";
import type { OperationalOp } from "./operationalMap";

const OPS: { op: OperationalOp; label: string }[] = [
  { op: "mailed", label: "Mailed" },
  { op: "awaiting_response", label: "Awaiting response" },
  { op: "responded", label: "Responded" },
  { op: "resolved", label: "Resolved" },
  { op: "escalate", label: "Escalate" },
  { op: "reopen", label: "Reopen" },
];

type Props = {
  target: "document" | "case";
  id: string;
  dispatch: (a: FinancialReadinessAction) => void;
  className?: string;
};

export function OperationalButtons({ target, id, dispatch, className = "" }: Props) {
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {OPS.map(({ op, label }) => (
        <button
          key={op}
          type="button"
          onClick={() => dispatch({ type: "operational/apply", target, id, op })}
          className="rounded-md border border-white/15 bg-white/[0.04] px-2 py-1 text-xs text-slate-200 hover:border-cyan-500/35 hover:text-white"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
