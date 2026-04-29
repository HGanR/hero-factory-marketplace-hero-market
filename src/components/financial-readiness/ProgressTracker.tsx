"use client";

type Step = { id: string; label: string };

type Props = {
  steps: Step[];
  currentIndex: number;
  className?: string;
};

export function ProgressTracker({ steps, currentIndex, className = "" }: Props) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-wide">
        <span>Progress</span>
        <span>
          Step {currentIndex + 1} / {steps.length}
        </span>
      </div>
      <div className="flex gap-1">
        {steps.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <div
              key={s.id}
              className="h-1.5 flex-1 rounded-full overflow-hidden bg-white/10"
              title={s.label}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  done ? "bg-emerald-400/90" : active ? "bg-cyan-400" : "bg-transparent"
                }`}
                style={{ width: done || active ? "100%" : "0%" }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
