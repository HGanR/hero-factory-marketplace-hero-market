"use client";

/** Lightweight panel for the execution & lead loop (step 2). */
export function ConversionOutcomesPanel() {
  return (
    <div
      id="conversion-outcomes"
      className="rounded-xl border border-cyan-500/20 bg-slate-900/50 p-4 text-sm text-slate-300"
      data-bentley-section="conversion-outcomes"
    >
      <p className="font-medium text-cyan-200/90">Conversion outcomes</p>
      <p className="mt-2 text-slate-400">
        Log outcomes from posts and campaigns. Use Tracked Leads and Engagement Capture above to tie activity back to
        Bentley classifications.
      </p>
    </div>
  );
}
