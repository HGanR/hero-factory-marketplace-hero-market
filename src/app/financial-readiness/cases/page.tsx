import { Suspense } from "react";
import { CasesListClient } from "@/components/financial-readiness/CasesListClient";

export default function FinancialReadinessCasesPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-12 text-sm text-slate-500">Loading matters…</div>}>
      <CasesListClient />
    </Suspense>
  );
}
