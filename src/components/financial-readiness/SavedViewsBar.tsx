"use client";

import { useMemo, useState } from "react";
import type { ListSortId } from "./listSort";
import type { CaseListFilterState, VaultFilterState } from "./vaultFilters";
import { listCaseViews, listVaultViews, saveCaseView, saveVaultView } from "./savedViews";

type VaultProps = {
  variant: "vault";
  filter: VaultFilterState;
  sort: ListSortId;
  onApply: (filter: VaultFilterState, sort: ListSortId) => void;
};

type CaseProps = {
  variant: "cases";
  filter: CaseListFilterState;
  sort: ListSortId;
  onApply: (filter: CaseListFilterState, sort: ListSortId) => void;
};

export function SavedViewsBar(props: VaultProps | CaseProps) {
  const [tick, setTick] = useState(0);
  const views = useMemo(() => {
    void tick;
    return props.variant === "vault" ? listVaultViews() : listCaseViews();
  }, [props.variant, tick]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs mb-3">
      <label className="text-slate-500 flex items-center gap-2">
        Saved views
        <select
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white max-w-[220px]"
          value=""
          onChange={(e) => {
            const id = e.target.value;
            e.target.value = "";
            if (!id) return;
            const v = views.find((x) => x.id === id);
            if (!v) return;
            if (props.variant === "vault") {
              props.onApply(v.filter, v.sort);
            } else {
              props.onApply(v.filter, v.sort);
            }
          }}
        >
          <option value="">Apply a view…</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => {
          const name =
            typeof window !== "undefined" ? window.prompt("Name for this view") : null;
          if (!name?.trim()) return;
          if (props.variant === "vault") {
            saveVaultView(name, props.filter, props.sort);
          } else {
            saveCaseView(name, props.filter, props.sort);
          }
          setTick((x) => x + 1);
        }}
        className="rounded-md border border-white/15 px-2 py-1 text-slate-300 hover:border-cyan-500/40"
      >
        Save current as…
      </button>
    </div>
  );
}
