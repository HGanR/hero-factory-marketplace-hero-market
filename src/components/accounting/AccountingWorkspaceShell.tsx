"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingComplianceBanner } from "./AccountingComplianceBanner";
import { useAccountingPreAccounting, type AccountingWorkspaceSection } from "./AccountingPreAccountingContext";
import { PreAccountingOverviewDashboard } from "./PreAccountingOverviewDashboard";
import { AccountingDocumentCenter } from "./AccountingDocumentCenter";
import { QuarterlyWorkflowPanel } from "./QuarterlyWorkflowPanel";
import { AccountingReportsHub } from "./AccountingReportsHub";
import { TaxFormCandidatesPanel } from "./TaxFormCandidatesPanel";
import { TaxPreparerHandoffPanel } from "./TaxPreparerHandoffPanel";
import { AccountingReviewQueuePanel } from "./AccountingReviewQueuePanel";

const EnhancedAccountingSystem = dynamic(() => import("@/components/EnhancedAccountingSystem"), {
  ssr: false,
});

export function AccountingWorkspaceShell() {
  const { setWorkspaceSection, syncStatus, lastServerError, reloadFromServer } = useAccountingPreAccounting();

  const onTabChange = (v: string) => {
    setWorkspaceSection(v as AccountingWorkspaceSection);
  };

  useEffect(() => {
    setWorkspaceSection("overview");
  }, [setWorkspaceSection]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-28">
      <div className="border-b border-slate-800 bg-slate-950/90">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-50">Accounting · Pre-accounting workspace</h1>
              <p className="mt-1 text-sm text-slate-400">
                Organize records, documents, and handoff packages for a licensed tax preparer or CPA.
              </p>
            </div>
          </div>
          <AccountingComplianceBanner />
          <div
            className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800/90 bg-slate-950/80 px-4 py-2.5 text-sm"
            role="status"
          >
            <span className="font-medium text-slate-500">Server sync</span>
            {syncStatus === "loading" && <span className="text-amber-300">Loading workspace…</span>}
            {syncStatus === "saving" && <span className="text-cyan-300">Saving to server…</span>}
            {syncStatus === "idle" && !lastServerError && (
              <span className="text-emerald-400/90">Profile and readiness saved on the server when signed in.</span>
            )}
            {syncStatus === "error" && lastServerError && (
              <>
                <span className="text-red-400">{lastServerError}</span>
                <button
                  type="button"
                  onClick={() => void reloadFromServer()}
                  className="rounded-md border border-slate-600 px-2 py-0.5 text-cyan-400 hover:bg-slate-800"
                >
                  Retry
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Tabs defaultValue="overview" className="space-y-6" onValueChange={onTabChange}>
          <TabsList className="flex h-auto min-h-11 flex-wrap justify-start gap-1 bg-slate-950 p-1">
            {(
              [
                ["overview", "Overview"],
                ["ledger", "Ledger"],
                ["documents", "Documents"],
                ["quarterly", "Quarterly"],
                ["reports", "Reports"],
                ["forms", "Potential IRS Forms"],
                ["review_queue", "Review queue"],
                ["handoff", "Handoff Packet"],
              ] as const
            ).map(([id, label]) => (
              <TabsTrigger
                key={id}
                value={id}
                className="text-xs sm:text-sm data-[state=active]:bg-slate-800"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <PreAccountingOverviewDashboard />
          </TabsContent>

          <TabsContent value="ledger" className="space-y-4 -mx-4 sm:-mx-6 lg:-mx-8">
            <p className="px-4 text-sm text-slate-400 sm:px-6 lg:px-8">
              Ledger, imports, and capital &amp; instruments — same workspace as before, scoped under this tab.
            </p>
            <div className="border-y border-slate-800/80 bg-slate-950/30">
              <EnhancedAccountingSystem embeddedInWorkspace />
            </div>
          </TabsContent>

          <TabsContent value="documents">
            <AccountingDocumentCenter />
          </TabsContent>

          <TabsContent value="quarterly">
            <QuarterlyWorkflowPanel />
          </TabsContent>

          <TabsContent value="reports">
            <AccountingReportsHub />
          </TabsContent>

          <TabsContent value="forms">
            <TaxFormCandidatesPanel />
          </TabsContent>

          <TabsContent value="review_queue">
            <AccountingReviewQueuePanel />
          </TabsContent>

          <TabsContent value="handoff">
            <TaxPreparerHandoffPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
