"use client";

/** Dispatched when Content Engine asks to clone a variant into optimization (ContentEngineSection listens). */
export const BENTLEY_SET_CLONE_VARIANT_EVENT = "heroMarket.bentley.setCloneVariant";

export function VariantOptimizationPanel() {
  return (
    <div
      id="launch-variant-optimization"
      className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-4 text-sm text-slate-300"
      data-bentley-section="variant-optimization"
    >
      <p className="font-medium text-cyan-200">Launch variant optimization</p>
      <p className="mt-2 text-slate-400">
        Compare creative variants generated in the Content Engine. Clone actions dispatch{" "}
        <code className="rounded bg-black/40 px-1 text-[11px] text-cyan-300">{BENTLEY_SET_CLONE_VARIANT_EVENT}</code> for
        handoff.
      </p>
    </div>
  );
}
