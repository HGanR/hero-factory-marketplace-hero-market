"use client";

export function AccountingComplianceBanner() {
  return (
    <div
      className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/95 leading-snug"
      role="note"
    >
      <p className="font-semibold text-amber-200/95">Pre-accounting workspace — not tax filing or legal advice</p>
      <p className="mt-1 text-amber-100/85">
        This area helps you organize books, documents, and summaries for review by a <strong>licensed tax preparer or CPA</strong>.
        Final filing positions, elections, and submissions require professional review. The assistant is not a substitute for
        licensed tax or legal counsel unless separately engaged.
      </p>
    </div>
  );
}
