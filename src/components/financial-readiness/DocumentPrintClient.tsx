"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import { statusLabel, vaultDocumentLabel } from "./vaultLabels";

export function DocumentPrintClient() {
  const params = useParams();
  const id = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const { state } = useFinancialReadiness();
  const doc = useMemo(() => state.documents.find((d) => d.id === id), [state.documents, id]);

  if (!id || !doc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-slate-600">
        <p>Document not found.</p>
        <Link href="/financial-readiness" className="text-cyan-700 underline print:hidden">
          Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 text-slate-900 bg-white min-h-screen print:py-4 print:px-4">
      <p className="text-sm mb-6 print:hidden">
        <Link href={`/financial-readiness/documents/${encodeURIComponent(doc.id)}`} className="text-cyan-700 underline">
          ← Back to document
        </Link>
        <button
          type="button"
          className="ml-4 text-cyan-700 underline"
          onClick={() => window.print()}
        >
          Print
        </button>
      </p>
      <header className="border-b border-slate-300 pb-4 mb-6">
        <p className="text-xs uppercase tracking-wide text-slate-500">{vaultDocumentLabel(doc.type)}</p>
        <h1 className="text-2xl font-bold mt-1">{doc.primaryParty}</h1>
        <p className="text-sm text-slate-600 mt-2">
          Status: {statusLabel(doc.status)}
          {doc.followUpDueAt ? ` · Follow-up due ${doc.followUpDueAt}` : ""}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Created {new Date(doc.createdAt).toLocaleString()} · Updated {new Date(doc.updatedAt).toLocaleString()}
        </p>
      </header>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-900">{doc.text}</pre>
    </div>
  );
}
