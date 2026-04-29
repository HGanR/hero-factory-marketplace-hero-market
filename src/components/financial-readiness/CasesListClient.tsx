"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import { VaultFiltersBar } from "./VaultFiltersBar";
import { deriveCaseSignals } from "./deriveCaseSignals";
import { caseFilterFromFocusParam, focusLabel, type CasesFocusParam } from "./casesFocus";
import { emptyCaseListFilterState, filterCasesForList, type CaseListFilterState } from "./vaultFilters";
import type { ListSortId } from "./listSort";
import { sortCases } from "./listSort";
import { MatterBadgesRow } from "./vaultBadges";
import { loadListUiPrefs, mergeCaseFilterFromPrefs, saveCasesListUi } from "./listUiPrefs";
import { ListBulkToolbar } from "./listBulkToolbar";
import { SavedViewsBar } from "./SavedViewsBar";
import {
  BULK_COMPLETE_CONFIRM_MIN,
  casesBulkAddTag,
  casesBulkMarkCompleted,
  casesBulkSnooze,
  type BulkUndo,
} from "./bulkOperations";
import { buildBulkCasesExportText, downloadTextFile } from "./exportUtils";
import { casesFilteredEmptyHint } from "./emptyListHints";

const FOCUS_KEYS = new Set<string>(["overdue", "due_this_week", "escalated", "awaiting_response"]);

export function CasesListClient() {
  const searchParams = useSearchParams();
  const { state, dispatch } = useFinancialReadiness();
  const [caseFilter, setCaseFilter] = useState<CaseListFilterState>(() => emptyCaseListFilterState());
  const [caseSort, setCaseSort] = useState<ListSortId>("updated_desc");
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [casesUndo, setCasesUndo] = useState<BulkUndo | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const focus = searchParams.get("focus");
    const patch = caseFilterFromFocusParam(focus);
    if (patch) {
      setCaseFilter({ ...emptyCaseListFilterState(), ...patch });
      setPrefsLoaded(true);
      return;
    }
    const p = loadListUiPrefs();
    if (p.caseFilter) setCaseFilter(mergeCaseFilterFromPrefs(p.caseFilter));
    if (p.caseSort) setCaseSort(p.caseSort);
    setPrefsLoaded(true);
  }, [searchParams]);

  useEffect(() => {
    if (!prefsLoaded) return;
    saveCasesListUi(caseSort, caseFilter);
  }, [caseSort, caseFilter, prefsLoaded]);

  const filtered = useMemo(
    () => sortCases(filterCasesForList(state.cases, caseFilter, today), caseSort, today),
    [state.cases, caseFilter, today, caseSort]
  );

  useEffect(() => {
    const ids = new Set(filtered.map((c) => c.id));
    setSelected((prev) => {
      const n = new Set<string>();
      for (const id of prev) if (ids.has(id)) n.add(id);
      return n;
    });
  }, [filtered]);

  const selectedCases = useMemo(
    () => filtered.filter((c) => selected.has(c.id)),
    [filtered, selected]
  );

  const focusParam = searchParams.get("focus");
  const activeFocus =
    focusParam && FOCUS_KEYS.has(focusParam) ? (focusParam as CasesFocusParam) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <Link href="/financial-readiness" className="text-sm text-cyan-300/90 hover:text-cyan-200">
        ← Financial Readiness hub
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-white">Matters & cases</h1>
        <p className="text-sm text-slate-400 mt-1">
          Operational groupings for optimization and resolution — documents and collector logs attach here.
        </p>
      </header>
      {state.cases.length === 0 ? (
        <div className="text-sm text-slate-400 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4">
          <p className="text-white font-medium">No matters yet</p>
          <p>
            Create matters from{" "}
            <Link href="/financial-readiness/optimization" className="text-cyan-400 hover:underline">
              Optimization
            </Link>{" "}
            or{" "}
            <Link href="/financial-readiness/resolution" className="text-cyan-400 hover:underline">
              Resolution
            </Link>
            , or open a letter and use <strong className="text-slate-300">New matter from this letter</strong>.
          </p>
        </div>
      ) : (
        <>
          {activeFocus && (
            <p className="text-xs text-cyan-300/90 rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2">
              Filtered view: {focusLabel(activeFocus)} —{" "}
              <Link href="/financial-readiness/cases" className="underline hover:text-cyan-200">
                Clear focus
              </Link>
            </p>
          )}
          <SavedViewsBar
            variant="cases"
            filter={caseFilter}
            sort={caseSort}
            onApply={(f, s) => {
              setCaseFilter(f);
              setCaseSort(s);
            }}
          />
          <VaultFiltersBar
            variant="cases"
            f={caseFilter}
            onChange={setCaseFilter}
            sort={caseSort}
            onSortChange={setCaseSort}
          />
          <p className="text-xs text-slate-500">
            Showing {filtered.length} of {state.cases.length}
          </p>
          <ListBulkToolbar
            variant="cases"
            selectedCount={selected.size}
            filteredCount={filtered.length}
            onSelectAllFiltered={() => setSelected(new Set(filtered.map((c) => c.id)))}
            onClearSelection={() => setSelected(new Set())}
            onMarkCompleted={() => {
              if (selectedCases.length === 0) return;
              if (
                selectedCases.length >= BULK_COMPLETE_CONFIRM_MIN &&
                typeof window !== "undefined" &&
                !window.confirm(`Mark ${selectedCases.length} matters completed?`)
              ) {
                return;
              }
              const lines = selectedCases.map((c) => ({
                caseId: c.id,
                from: c.status,
                to: "completed" as const,
              }));
              setCasesUndo(casesBulkMarkCompleted(dispatch, selectedCases, lines));
              setSelected(new Set());
            }}
            onSnooze7={() => {
              if (selectedCases.length === 0) return;
              setCasesUndo(casesBulkSnooze(dispatch, selectedCases, today, 7));
              setSelected(new Set());
            }}
            onAddTag={() => {
              const tag = typeof window !== "undefined" ? window.prompt("Tag to add to selected matters") : null;
              if (!tag?.trim() || selectedCases.length === 0) return;
              setCasesUndo(casesBulkAddTag(dispatch, selectedCases, tag.trim()));
              setSelected(new Set());
            }}
            onExport={() => {
              downloadTextFile(
                `matters-export-${Date.now()}.txt`,
                buildBulkCasesExportText(selectedCases, state)
              );
            }}
            onUndo={() => {
              if (!casesUndo) return;
              casesUndo.apply(dispatch);
              setCasesUndo(null);
            }}
            undoAvailable={!!casesUndo}
          />
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
              {casesFilteredEmptyHint(caseFilter, activeFocus)}
            </p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((c) => {
                const sig = deriveCaseSignals(c, state.documents, today);
                return (
                  <li key={c.id}>
                    <div className="flex gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 hover:border-cyan-500/30">
                      <input
                        type="checkbox"
                        className="mt-3 shrink-0 rounded border-white/20"
                        checked={selected.has(c.id)}
                        onChange={() => {
                          setSelected((prev) => {
                            const n = new Set(prev);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          });
                        }}
                        aria-label={`Select ${c.label}`}
                      />
                      <Link
                        href={`/financial-readiness/cases/${encodeURIComponent(c.id)}`}
                        className="flex flex-wrap justify-between gap-2 flex-1 min-w-0 py-1"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-white flex flex-wrap items-center gap-2">
                            {c.label}
                            {sig.caseEscalated && (
                              <span className="text-[10px] uppercase tracking-wide text-amber-300/90">Escalated</span>
                            )}
                            {sig.suggestCaseFollowUp && (
                              <span className="text-[10px] uppercase tracking-wide text-rose-300/90">Doc overdue</span>
                            )}
                            {sig.readinessToClose && (
                              <span className="text-[10px] uppercase tracking-wide text-emerald-300/90">Ready to close</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-2">
                            {c.module} · {c.documentIds.length} docs · {c.interactionIds.length} logs
                          </p>
                          <div className="mt-2">
                            <MatterBadgesRow status={c.status} tags={c.tags} />
                          </div>
                        </div>
                        {c.followUpDueAt && (
                          <span className="text-xs font-mono text-amber-200/90 shrink-0">Due {c.followUpDueAt}</span>
                        )}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
