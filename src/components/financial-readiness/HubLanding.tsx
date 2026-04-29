"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ListSortId } from "./listSort";
import { sortVaultDocuments } from "./listSort";
import { Building2, Scale, Sparkles, Wrench } from "lucide-react";
import { AIAdvisorPanel } from "./AIAdvisorPanel";
import { HubIntake } from "./HubIntake";
import { HubSummaryCards } from "./HubSummaryCards";
import { HubUrgencyStrip } from "./HubUrgencyStrip";
import { HubAnalyticsCards } from "./HubAnalyticsCards";
import { ModuleCard } from "./ModuleCard";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import { useAiRevenueOsLink, useBusinessCreditPipeline, useEntityTrustOnboarding } from "./integrationHooks";
import { VaultFiltersBar } from "./VaultFiltersBar";
import { emptyVaultFilterState, filterDocuments, type VaultFilterState } from "./vaultFilters";
import { DocumentBadgesRow } from "./vaultBadges";
import { clearListUiPrefs, loadListUiPrefs, mergeVaultFilterFromPrefs, saveVaultListUi } from "./listUiPrefs";
import { ListBulkToolbar } from "./listBulkToolbar";
import { SavedViewsBar } from "./SavedViewsBar";
import {
  BULK_COMPLETE_CONFIRM_MIN,
  vaultBulkAddTag,
  vaultBulkAssign,
  vaultBulkMarkCompleted,
  vaultBulkSnooze,
  type BulkUndo,
} from "./bulkOperations";
import { buildAllDocumentsCombinedText, downloadTextFile } from "./exportUtils";
import { vaultFilteredEmptyHint } from "./emptyListHints";

export function HubLanding() {
  const { state, dispatch } = useFinancialReadiness();
  const [vaultFilter, setVaultFilter] = useState<VaultFilterState>(() => emptyVaultFilterState());
  const [vaultSort, setVaultSort] = useState<ListSortId>("updated_desc");
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignCaseId, setAssignCaseId] = useState("");
  const [vaultUndo, setVaultUndo] = useState<BulkUndo | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const p = loadListUiPrefs();
    if (p.vaultFilter) setVaultFilter(mergeVaultFilterFromPrefs(p.vaultFilter));
    if (p.vaultSort) setVaultSort(p.vaultSort);
    setPrefsLoaded(true);
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    saveVaultListUi(vaultSort, vaultFilter);
  }, [vaultSort, vaultFilter, prefsLoaded]);

  const filteredDocs = useMemo(() => {
    const f = filterDocuments(state.documents, vaultFilter, today);
    return sortVaultDocuments(f, vaultSort, today);
  }, [state.documents, vaultFilter, today, vaultSort]);

  useEffect(() => {
    const ids = new Set(filteredDocs.map((d) => d.id));
    setSelected((prev) => {
      const n = new Set<string>();
      for (const id of prev) if (ids.has(id)) n.add(id);
      return n;
    });
  }, [filteredDocs]);

  const selectedDocs = useMemo(
    () => filteredDocs.filter((d) => selected.has(d.id)),
    [filteredDocs, selected]
  );

  const matterOptions = useMemo(
    () => state.cases.map((c) => ({ id: c.id, label: c.label })),
    [state.cases]
  );

  const revenueOs = useAiRevenueOsLink({ module: "financial-readiness", step: "hub" });
  const bizCredit = useBusinessCreditPipeline({});
  const trust = useEntityTrustOnboarding({});

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 lg:py-14">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard" className="text-cyan-300/90 hover:text-cyan-200">
            ← Back to dashboard
          </Link>
          <Link href="/financial-readiness/cases" className="text-slate-400 hover:text-cyan-300">
            Matters & cases
          </Link>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              typeof window !== "undefined" &&
              window.confirm(
                "Erase all Financial Readiness data in this browser (letters, matters, progress), plus saved filters and named views? This cannot be undone."
              )
            ) {
              dispatch({ type: "reset" });
              clearListUiPrefs();
            }
          }}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Reset local data
        </button>
      </div>

      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400/90 mb-2">
          TroothHurtz · Financial Readiness Center
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
          One hub. Three systems. Built to scale with your business.
        </h1>
        <p className="mt-4 text-lg text-slate-400 max-w-3xl leading-relaxed">
          The Financial Readiness Center is separate from AI Revenue OS, Trust Records, and Accounting — but
          designed to hand off cleanly when you connect revenue, entities, and compliance workflows. Progress,
          drafts, and generated letters persist in this browser until you reset.
        </p>
      </header>

      <div className="mb-6">
        <HubUrgencyStrip />
      </div>

      <div className="mb-6">
        <HubAnalyticsCards />
      </div>

      <div className="mb-10">
        <HubSummaryCards />
      </div>

      {!state.hub.intakeCompleted && <HubIntake />}

      <div className="grid lg:grid-cols-[1fr_minmax(280px,340px)] gap-8 items-start">
        <div className="space-y-8">
          <section className="grid sm:grid-cols-1 md:grid-cols-3 gap-5">
            <ModuleCard
              title="Credit Foundation System"
              description="Learn how scores work, model utilization, and complete a build-your-profile checklist."
              href="/financial-readiness/foundation"
              cta="Start My Foundation"
              accent="cyan"
              icon={<Sparkles className="h-5 w-5" />}
            />
            <ModuleCard
              title="Credit Optimization Engine"
              description="Import notes, flag negatives, build disputes, generate letters, and track 30/45-day windows."
              href="/financial-readiness/optimization"
              cta="Fix My Credit"
              accent="violet"
              icon={<Wrench className="h-5 w-5" />}
            />
            <ModuleCard
              title="Debt Resolution Protocol"
              description="Log collector contacts, draft validation and cease letters, and track case status."
              href="/financial-readiness/resolution"
              cta="Handle Debt Now"
              accent="amber"
              icon={<Scale className="h-5 w-5" />}
            />
          </section>

          <section id="documents" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white mb-3">Document vault</h2>
            {state.documents.length === 0 ? (
              <div className="text-sm text-slate-400 space-y-2">
                <p>No letters in the vault yet.</p>
                <p>
                  <Link href="/financial-readiness/optimization" className="text-cyan-400 hover:underline">
                    Open Optimization
                  </Link>{" "}
                  to draft disputes, or{" "}
                  <Link href="/financial-readiness/resolution" className="text-cyan-400 hover:underline">
                    Resolution
                  </Link>{" "}
                  for validation / cease letters.
                </p>
              </div>
            ) : (
              <>
                <SavedViewsBar
                  variant="vault"
                  filter={vaultFilter}
                  sort={vaultSort}
                  onApply={(f, s) => {
                    setVaultFilter(f);
                    setVaultSort(s);
                  }}
                />
                <VaultFiltersBar
                  variant="vault"
                  f={vaultFilter}
                  onChange={setVaultFilter}
                  cases={state.cases}
                  sort={vaultSort}
                  onSortChange={setVaultSort}
                />
                <p className="text-xs text-slate-500 mt-3 mb-2">
                  Showing {filteredDocs.length} of {state.documents.length}
                </p>
                <ListBulkToolbar
                  variant="vault"
                  selectedCount={selected.size}
                  filteredCount={filteredDocs.length}
                  onSelectAllFiltered={() => setSelected(new Set(filteredDocs.map((d) => d.id)))}
                  onClearSelection={() => setSelected(new Set())}
                  onMarkCompleted={() => {
                    if (selectedDocs.length === 0) return;
                    if (
                      selectedDocs.length >= BULK_COMPLETE_CONFIRM_MIN &&
                      typeof window !== "undefined" &&
                      !window.confirm(`Mark ${selectedDocs.length} letters completed?`)
                    ) {
                      return;
                    }
                    const lines = selectedDocs.map((d) => ({
                      documentId: d.id,
                      from: d.status,
                      to: "completed" as const,
                    }));
                    setVaultUndo(vaultBulkMarkCompleted(dispatch, selectedDocs, lines));
                    setSelected(new Set());
                  }}
                  onSnooze7={() => {
                    if (selectedDocs.length === 0) return;
                    setVaultUndo(vaultBulkSnooze(dispatch, selectedDocs, today, 7));
                    setSelected(new Set());
                  }}
                  onAddTag={() => {
                    const tag =
                      typeof window !== "undefined" ? window.prompt("Tag to add to selected letters") : null;
                    if (!tag?.trim()) return;
                    if (selectedDocs.length === 0) return;
                    setVaultUndo(vaultBulkAddTag(dispatch, selectedDocs, tag.trim()));
                    setSelected(new Set());
                  }}
                  onExport={() => {
                    downloadTextFile(
                      `vault-selected-${Date.now()}.txt`,
                      buildAllDocumentsCombinedText(selectedDocs)
                    );
                  }}
                  onUndo={() => {
                    if (!vaultUndo) return;
                    vaultUndo.apply(dispatch);
                    setVaultUndo(null);
                  }}
                  undoAvailable={!!vaultUndo}
                  matterOptions={matterOptions}
                  assignCaseId={assignCaseId}
                  onAssignCaseIdChange={setAssignCaseId}
                  onAssignToMatter={() => {
                    if (!assignCaseId || selectedDocs.length === 0) return;
                    const reassign = selectedDocs.filter((d) => d.caseId && d.caseId !== assignCaseId);
                    if (
                      reassign.length > 0 &&
                      typeof window !== "undefined" &&
                      !window.confirm(
                        `${reassign.length} selected letter(s) are already on another matter. Reassign them to the chosen matter?`
                      )
                    ) {
                      return;
                    }
                    setVaultUndo(vaultBulkAssign(dispatch, selectedDocs, assignCaseId));
                    setSelected(new Set());
                    setAssignCaseId("");
                  }}
                />
                {filteredDocs.length === 0 ? (
                  <p className="text-sm text-slate-400 mt-3">{vaultFilteredEmptyHint(vaultFilter)}</p>
                ) : (
                  <ul className="space-y-3 max-h-72 overflow-auto mt-2">
                    {filteredDocs.map((d) => (
                      <li
                        key={d.id}
                        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-300"
                      >
                        <div className="flex gap-2 items-start">
                          <input
                            type="checkbox"
                            className="mt-1.5 shrink-0 rounded border-white/20"
                            checked={selected.has(d.id)}
                            onChange={() => {
                              setSelected((prev) => {
                                const n = new Set(prev);
                                if (n.has(d.id)) n.delete(d.id);
                                else n.add(d.id);
                                return n;
                              });
                            }}
                            aria-label={`Select ${d.primaryParty}`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap justify-between gap-2 items-start">
                              <Link
                                href={`/financial-readiness/documents/${encodeURIComponent(d.id)}`}
                                className="font-medium text-cyan-200 hover:underline"
                              >
                                {d.primaryParty} — {d.type.replace(/_/g, " ")}
                              </Link>
                              <span className="text-xs text-slate-500">
                                {new Date(d.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                              <DocumentBadgesRow status={d.status} tags={d.tags} />
                              {d.followUpDueAt && (
                                <span className="text-amber-200/80 font-mono">Due {d.followUpDueAt}</span>
                              )}
                              {d.caseId && (
                                <Link
                                  href={`/financial-readiness/cases/${encodeURIComponent(d.caseId)}`}
                                  className="text-cyan-500/80 hover:underline"
                                >
                                  Matter
                                </Link>
                              )}
                            </div>
                            <pre className="mt-2 text-xs text-slate-400 whitespace-pre-wrap font-mono max-h-32 overflow-auto">
                              {d.text.slice(0, 400)}
                              {d.text.length > 400 ? "…" : ""}
                            </pre>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-400" />
              Future integrations (placeholders)
            </h2>
            <p className="text-sm text-slate-400 mb-4">
              These hooks reserve UI affordances for upcoming platform links — no external calls yet.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                title="Coming soon"
              >
                {revenueOs.label}
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                title="Coming soon"
              >
                {bizCredit.label}
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-500 cursor-not-allowed"
                title="Coming soon"
              >
                {trust.label}
              </button>
            </div>
          </section>
        </div>

        <AIAdvisorPanel context={{ module: "hub", stepLabel: "Overview", state }} />
      </div>
    </div>
  );
}
