"use client";

import type { FrCase } from "./vaultTypes";
import type { VaultDocumentType } from "./vaultTypes";
import type { DocumentLifecycleStatus } from "./vaultTypes";
import type { FrModule } from "./vaultTypes";
import type { CaseModule } from "./vaultTypes";
import { statusLabel } from "./vaultLabels";
import { vaultDocumentLabel } from "./vaultLabels";
import type { CaseListFilterState, VaultFilterState } from "./vaultFilters";
import type { ListSortId } from "./listSort";
import { LIST_SORT_OPTIONS } from "./listSort";

const DOC_TYPES: VaultDocumentType[] = [
  "bureau_dispute",
  "creditor_verification",
  "debt_validation",
  "cease_communication",
];

const MODULES: FrModule[] = ["foundation", "optimization", "resolution"];
const CASE_MODULES: CaseModule[] = ["optimization", "resolution"];

const STATUSES: DocumentLifecycleStatus[] = [
  "not_started",
  "in_progress",
  "awaiting_response",
  "follow_up_due",
  "completed",
  "escalated",
];

type VaultProps = {
  variant: "vault";
  f: VaultFilterState;
  onChange: (next: VaultFilterState) => void;
  cases: FrCase[];
  sort: ListSortId;
  onSortChange: (next: ListSortId) => void;
};

type CasesProps = {
  variant: "cases";
  f: CaseListFilterState;
  onChange: (next: CaseListFilterState) => void;
  sort: ListSortId;
  onSortChange: (next: ListSortId) => void;
};

export function VaultFiltersBar(props: VaultProps | CasesProps) {
  if (props.variant === "cases") {
    const { f, onChange, sort, onSortChange } = props;
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-xs">
        <label className="block text-slate-500">
          Search matters
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            placeholder="Label, party, tags…"
            value={f.search}
            onChange={(e) => onChange({ ...f, search: e.target.value })}
          />
        </label>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          <label className="text-slate-500">
            Status
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
              value={f.status}
              onChange={(e) => onChange({ ...f, status: e.target.value as DocumentLifecycleStatus | "" })}
            >
              <option value="">Any</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-slate-500">
            Module
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
              value={f.module}
              onChange={(e) => onChange({ ...f, module: e.target.value as CaseModule | "" })}
            >
              <option value="">Any</option>
              {CASE_MODULES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-slate-500">
            Tag contains
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
              value={f.tag}
              onChange={(e) => onChange({ ...f, tag: e.target.value })}
            />
          </label>
          <label className="text-slate-500">
            Due
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
              value={f.due}
              onChange={(e) => onChange({ ...f, due: e.target.value as CaseListFilterState["due"] })}
            >
              <option value="">Any</option>
              <option value="soon">Due soon (7d)</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label className="text-slate-500">
            Letters
            <select
              className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
              value={f.docs}
              onChange={(e) => onChange({ ...f, docs: e.target.value as CaseListFilterState["docs"] })}
            >
              <option value="">Any</option>
              <option value="none">No letters (unassigned)</option>
            </select>
          </label>
        </div>
        <label className="text-slate-500">
          Sort
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as ListSortId)}
          >
            {LIST_SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  const { f, onChange, cases, sort, onSortChange } = props;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-xs">
      <label className="block text-slate-500">
        Search vault
        <input
          className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
          placeholder="Primary party or letter text…"
          value={f.search}
          onChange={(e) => onChange({ ...f, search: e.target.value })}
        />
      </label>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="text-slate-500">
          Status
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
            value={f.status}
            onChange={(e) => onChange({ ...f, status: e.target.value as DocumentLifecycleStatus | "" })}
          >
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-slate-500">
          Type
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
            value={f.type}
            onChange={(e) => onChange({ ...f, type: e.target.value as VaultFilterState["type"] })}
          >
            <option value="">Any</option>
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {vaultDocumentLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-slate-500">
          Module
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
            value={f.module}
            onChange={(e) => onChange({ ...f, module: e.target.value as FrModule | "" })}
          >
            <option value="">Any</option>
            {MODULES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-slate-500">
          Matter
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
            value={f.caseId}
            onChange={(e) => onChange({ ...f, caseId: e.target.value })}
          >
            <option value="">Any</option>
            <option value="__unassigned">Unassigned</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-slate-500">
          Tag contains
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
            value={f.tag}
            onChange={(e) => onChange({ ...f, tag: e.target.value })}
          />
        </label>
        <label className="text-slate-500">
          Follow-up
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
            value={f.due}
            onChange={(e) => onChange({ ...f, due: e.target.value as VaultFilterState["due"] })}
          >
            <option value="">Any</option>
            <option value="soon">Due soon (7d)</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
      </div>
      <label className="block text-slate-500">
        Sort
        <select
          className="mt-1 w-full max-w-md rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as ListSortId)}
        >
          {LIST_SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
