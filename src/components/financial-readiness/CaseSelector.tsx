"use client";

import Link from "next/link";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import type { CaseModule } from "./vaultTypes";

function CaseSelectorInner({ module }: { module: CaseModule }) {
  const { state, dispatch } = useFinancialReadiness();
  const matters = state.cases.filter((c) => c.module === module);
  const active = module === "optimization" ? state.optimization.activeCaseId : state.resolution.activeCaseId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <span className="whitespace-nowrap">Active matter</span>
        <select
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white max-w-[200px]"
          value={active ?? ""}
          onChange={(e) => {
            const id = e.target.value || null;
            if (module === "optimization") dispatch({ type: "optimization/setActiveCase", id });
            else dispatch({ type: "resolution/setActiveCase", id });
          }}
        >
          <option value="">(auto / new)</option>
          {matters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-xs text-cyan-100 hover:bg-cyan-500/20"
        onClick={() => {
          const label = `Matter ${new Date().toLocaleDateString()}`;
          dispatch({
            type: "cases/create",
            payload: { label, module, primaryParty: "TBD" },
          });
        }}
      >
        New matter
      </button>
      <Link href="/financial-readiness/cases" className="text-xs text-slate-400 hover:text-cyan-300">
        All matters →
      </Link>
    </div>
  );
}

export function OptimizationCaseSelector() {
  return <CaseSelectorInner module="optimization" />;
}

export function ResolutionCaseSelector() {
  return <CaseSelectorInner module="resolution" />;
}
