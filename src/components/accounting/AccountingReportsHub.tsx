"use client";

import Link from "next/link";
import { useAccountingPreAccounting } from "./AccountingPreAccountingContext";

export function AccountingReportsHub() {
  const { profile } = useAccountingPreAccounting();

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Reports support <strong className="text-slate-200">tax prep readiness</strong> — not filed returns. Your preparer
        finalizes presentation and elections.
      </p>
      <div className="rounded-xl border border-cyan-900/40 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold text-cyan-200/95">Dedicated reporting workspace</h3>
        <p className="mt-2 text-sm text-slate-400">
          Open the reporting area for document uploads, transaction tagging, spreadsheets, and banker summary — tax year{" "}
          <strong className="text-slate-200">{profile.taxYear}</strong> context is stored in your pre-accounting profile.
        </p>
        <Link
          href="/accounting/reporting"
          className="mt-3 inline-flex rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
        >
          Go to Reporting
        </Link>
      </div>
      <ul className="list-inside list-disc space-y-2 text-sm text-slate-400">
        <li>Profit &amp; loss by month / quarter / year — use Ledger + exports</li>
        <li>Balance sheet / trial balance — preparer may map from your books</li>
        <li>Uncategorized transactions — review in Ledger tab</li>
        <li>Missing documents — see Overview checklist and Documents tab</li>
        <li>Quarterly statement packets — Quarterly Packets tab + Handoff export</li>
      </ul>
    </div>
  );
}
