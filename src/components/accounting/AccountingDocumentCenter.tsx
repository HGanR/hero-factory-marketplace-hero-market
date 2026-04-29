"use client";

import { Fragment, useMemo, useState } from "react";
import { useAccountingPreAccounting } from "./AccountingPreAccountingContext";
import type { DocumentIntakeTag } from "@/lib/accounting/pre-accounting/types";
import {
  loadDocumentLibrary,
  saveDocumentLibrary,
  type DocumentLibraryItemStored,
} from "@/lib/accounting/pre-accounting/profile-storage";
import {
  patchPreAccountingDocument,
  uploadPreAccountingDocument,
  type ServerDocumentRecord,
} from "@/lib/accounting/pre-accounting/api-client";

const TAGS: { id: DocumentIntakeTag; label: string }[] = [
  { id: "bank_statements", label: "Bank statements" },
  { id: "credit_card_statements", label: "Credit card statements" },
  { id: "merchant_processor", label: "Merchant / processor statements" },
  { id: "payroll_reports", label: "Payroll reports" },
  { id: "contractor_forms", label: "Contractor / 1099 support" },
  { id: "income_forms", label: "Income forms (W-2, 1099, K-1, etc.)" },
  { id: "expense_receipts", label: "Expense receipts" },
  { id: "loan_documents", label: "Loan documents" },
  { id: "asset_purchases", label: "Asset purchase records" },
  { id: "prior_year_returns", label: "Prior-year returns" },
  { id: "estimated_tax_payments", label: "Estimated tax payments" },
  { id: "state_filings", label: "State filings" },
  { id: "irs_notices", label: "IRS / agency notices" },
  { id: "entity_formation", label: "Entity formation docs" },
  { id: "trust_docs", label: "Trust documents" },
  { id: "other", label: "Other" },
];

/** Maps UI checklist tags to persisted `documentTag` strings (API / DB). */
const TAG_TO_SERVER: Record<DocumentIntakeTag, string> = {
  bank_statements: "bank_statement",
  credit_card_statements: "credit_card_statement",
  merchant_processor: "merchant_processor",
  payroll_reports: "payroll_report",
  contractor_forms: "1099",
  income_forms: "W2",
  expense_receipts: "receipt",
  loan_documents: "loan_statement",
  asset_purchases: "asset_purchase_record",
  prior_year_returns: "prior_year_return",
  estimated_tax_payments: "estimated_tax_payment",
  state_filings: "state_filing",
  irs_notices: "IRS_notice",
  entity_formation: "entity_formation",
  trust_docs: "trust_docs",
  other: "other",
};

const DOC_STATUSES = ["uploaded", "needs_review", "accepted", "rejected", "superseded", "missing"] as const;

const REPORT_TYPES = [
  "",
  "bank_statement",
  "credit_card_statement",
  "payroll_summary",
  "p_l",
  "balance_sheet",
  "tax_form",
  "receipt",
  "prior_year_return",
  "other",
] as const;

function parseLinkedDisplay(json: string | null | undefined): string {
  if (!json) return "—";
  try {
    const j = JSON.parse(json) as unknown;
    if (Array.isArray(j)) return (j as string[]).join(", ") || "—";
  } catch {
    return json.slice(0, 80);
  }
  return "—";
}

function linkedFormCodesInputValue(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const j = JSON.parse(json) as unknown;
    if (Array.isArray(j)) return (j as string[]).join(", ");
  } catch {
    return "";
  }
  return "";
}

export function AccountingDocumentCenter() {
  const { profile, patchProfile, serverWorkspace, reloadFromServer } = useAccountingPreAccounting();
  const [items, setItems] = useState<DocumentLibraryItemStored[]>(() => loadDocumentLibrary());
  const [uploadLabel, setUploadLabel] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [tag, setTag] = useState<DocumentIntakeTag>("bank_statements");
  const [quarterLabel, setQuarterLabel] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadReportType, setUploadReportType] = useState<string>("");
  const [uploadLinkedForms, setUploadLinkedForms] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const serverDocs: ServerDocumentRecord[] = useMemo(() => {
    const d = serverWorkspace?.documents;
    return Array.isArray(d) ? (d as ServerDocumentRecord[]) : [];
  }, [serverWorkspace?.documents]);

  const profileId = profile.serverProfileId;

  const mergedTags = useMemo(() => {
    const s = new Set([...profile.documentsCollectedTags, ...items.map((i) => i.tag as DocumentIntakeTag)]);
    return s;
  }, [profile.documentsCollectedTags, items]);

  const registerRow = () => {
    const trimmed = registerName.trim();
    if (!trimmed) return;
    const row: DocumentLibraryItemStored = {
      id: `doc-${Date.now()}`,
      tag,
      displayName: trimmed,
      addedAt: new Date().toISOString(),
    };
    const next = [...items, row];
    setItems(next);
    saveDocumentLibrary(next);
    if (!profile.documentsCollectedTags.includes(tag)) {
      patchProfile({ documentsCollectedTags: [...profile.documentsCollectedTags, tag] });
    }
    setRegisterName("");
  };

  const toggleCollectedTag = (id: DocumentIntakeTag) => {
    const has = profile.documentsCollectedTags.includes(id);
    patchProfile({
      documentsCollectedTags: has
        ? profile.documentsCollectedTags.filter((t) => t !== id)
        : [...profile.documentsCollectedTags, id],
    });
  };

  const onUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profileId) {
      setUploadError(
        profileId ? "Choose a file." : "Wait until your profile is saved to the server (check sync banner), then try again."
      );
      return;
    }
    setUploading(true);
    setUploadError(null);
    const form = new FormData();
    form.set("file", file);
    form.set("accountingProfileId", String(profileId));
    form.set("documentTag", TAG_TO_SERVER[tag]);
    form.set("taxYear", String(profile.taxYear));
    const dn = uploadLabel.trim() || file.name;
    form.set("documentName", dn);
    if (quarterLabel) form.set("quarterLabel", quarterLabel);
    if (uploadReportType) form.set("reportType", uploadReportType);
    if (uploadLinkedForms.trim()) form.set("linkedFormCodesJson", uploadLinkedForms.trim());
    const res = await uploadPreAccountingDocument(form);
    setUploading(false);
    if (!res.ok) {
      setUploadError(res.error ?? "Upload failed");
      return;
    }
    if (!profile.documentsCollectedTags.includes(tag)) {
      patchProfile({ documentsCollectedTags: [...profile.documentsCollectedTags, tag] });
    }
    setUploadLabel("");
    setUploadLinkedForms("");
    await reloadFromServer();
  };

  const patchDoc = async (id: number, body: Parameters<typeof patchPreAccountingDocument>[1]) => {
    const res = await patchPreAccountingDocument(id, body);
    if (!res.ok) {
      setUploadError(res.error ?? "Update failed");
      return;
    }
    await reloadFromServer();
  };

  const onDocStatus = async (id: number, status: (typeof DOC_STATUSES)[number]) => {
    const res = await patchPreAccountingDocument(id, { status });
    if (!res.ok) {
      setUploadError(res.error ?? "Could not update status");
      return;
    }
    await reloadFromServer();
  };

  const onRejectionReason = async (id: number, rejectionReason: string | null) => {
    const res = await patchPreAccountingDocument(id, { rejectionReason });
    if (!res.ok) {
      setUploadError(res.error ?? "Could not save rejection reason");
      return;
    }
    await reloadFromServer();
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Upload <strong className="text-slate-200">PDFs and source files</strong> for preparer review. Metadata is stored on the
        server when you are signed in. Use <strong>Handoff Packet</strong> for a ZIP that includes these files.
      </p>

      {uploadError && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{uploadError}</p>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Tag coverage (checklist)</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleCollectedTag(t.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                mergedTags.has(t.id)
                  ? "border-cyan-500/60 bg-cyan-950/50 text-cyan-200"
                  : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Upload a file</h3>
        <p className="mt-1 text-xs text-slate-500">
          Tag applies to the upload. Optional quarter links the file to Q1–Q4 for your preparer.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="min-w-[180px] flex-1 space-y-1">
            <span className="text-xs text-slate-500">Label (optional override)</span>
            <input
              value={uploadLabel}
              onChange={(e) => setUploadLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="Defaults to file name"
            />
          </label>
          <label className="sm:w-56 space-y-1">
            <span className="text-xs text-slate-500">Tag</span>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as DocumentIntakeTag)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {TAGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:w-32 space-y-1">
            <span className="text-xs text-slate-500">Quarter</span>
            <select
              value={quarterLabel}
              onChange={(e) => setQuarterLabel(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">—</option>
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
            </select>
          </label>
          <label className="sm:w-44 space-y-1">
            <span className="text-xs text-slate-500">Report type</span>
            <select
              value={uploadReportType}
              onChange={(e) => setUploadReportType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {REPORT_TYPES.map((rt) => (
                <option key={rt || "default"} value={rt}>
                  {rt ? rt.replace(/_/g, " ") : "—"}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-[160px] flex-1 space-y-1">
            <span className="text-xs text-slate-500">Link to form codes (optional)</span>
            <input
              value={uploadLinkedForms}
              onChange={(e) => setUploadLinkedForms(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="e.g. schedule_c, 1099_nec"
            />
          </label>
          <label className="cursor-pointer rounded-lg bg-cyan-800 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">
            <input type="file" className="hidden" disabled={uploading || !profileId} onChange={onUploadFile} />
            {uploading ? "Uploading…" : profileId ? "Choose file" : "Save profile first"}
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <h3 className="text-sm font-semibold text-slate-200">Register a placeholder (name only)</h3>
        <p className="mt-1 text-xs text-slate-500">For files you keep elsewhere — stored locally in this browser.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1">
            <span className="text-xs text-slate-500">Display name</span>
            <input
              value={registerName}
              onChange={(e) => setRegisterName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              placeholder="e.g. Chase Jan–Mar 2025 PDF"
            />
          </label>
          <label className="sm:w-56 space-y-1">
            <span className="text-xs text-slate-500">Folder / tag</span>
            <select
              value={tag}
              onChange={(e) => setTag(e.target.value as DocumentIntakeTag)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            >
              {TAGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={registerRow}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600"
          >
            Add to local register
          </button>
        </div>
      </div>

      {serverDocs.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <h3 className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase text-slate-400">
            Server document register — traceability
          </h3>
          <p className="border-b border-slate-800 px-3 py-2 text-xs text-slate-500">
            Each file can link to <strong className="text-slate-400">quarter packets</strong>,{" "}
            <strong className="text-slate-400">probable forms</strong>, and{" "}
            <strong className="text-slate-400">handoff ZIP</strong>. Internal notes stay reviewer-only unless the handoff
            explicitly includes them.
          </p>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Tag</th>
                <th className="px-3 py-2">Year / Q</th>
                <th className="px-3 py-2">Forms</th>
                <th className="px-3 py-2">Handoff</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {serverDocs.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-slate-800/80">
                    <td className="px-3 py-2 text-slate-200">{r.documentName}</td>
                    <td className="px-3 py-2 text-slate-400">{r.documentTag}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {r.taxYear}
                      {r.quarterLabel ? ` · ${r.quarterLabel}` : ""}
                    </td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-xs text-cyan-200/80" title={parseLinkedDisplay(r.linkedFormCodesJson)}>
                      {parseLinkedDisplay(r.linkedFormCodesJson)}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.includeInHandoff !== false ? "Yes" : "No"}</td>
                    <td className="px-3 py-2">
                      <select
                        value={r.status}
                        onChange={(e) => void onDocStatus(r.id, e.target.value as (typeof DOC_STATUSES)[number])}
                        className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                      >
                        {DOC_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {r.fileUrl ? (
                        <a href={r.fileUrl} className="text-cyan-400 underline" target="_blank" rel="noopener noreferrer">
                          Open
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-xs text-slate-400 underline"
                        onClick={() => setExpandedId((x) => (x === r.id ? null : r.id))}
                      >
                        {expandedId === r.id ? "Hide" : "Edit links"}
                      </button>
                    </td>
                  </tr>
                  {expandedId === r.id ? (
                    <tr className="border-b border-slate-800 bg-slate-950/80">
                      <td colSpan={8} className="px-3 py-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="space-y-1 text-xs">
                            <span className="text-slate-500">Report type</span>
                            <select
                              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
                              value={r.reportType ?? ""}
                              onChange={(e) =>
                                void patchDoc(r.id, { reportType: e.target.value || null })
                              }
                            >
                              {REPORT_TYPES.map((rt) => (
                                <option key={rt || "x"} value={rt}>
                                  {rt ? rt.replace(/_/g, " ") : "—"}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="space-y-1 text-xs">
                            <span className="text-slate-500">Quarter</span>
                            <select
                              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
                              value={r.quarterLabel ?? ""}
                              onChange={(e) =>
                                void patchDoc(r.id, { quarterLabel: e.target.value || null })
                              }
                            >
                              <option value="">—</option>
                              <option value="Q1">Q1</option>
                              <option value="Q2">Q2</option>
                              <option value="Q3">Q3</option>
                              <option value="Q4">Q4</option>
                            </select>
                          </label>
                          <label className="space-y-1 text-xs md:col-span-2">
                            <span className="text-slate-500">Linked form codes (comma-separated)</span>
                            <input
                              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-slate-100"
                              defaultValue={linkedFormCodesInputValue(r.linkedFormCodesJson)}
                              placeholder="schedule_c, 1099_nec"
                              onBlur={(e) => void patchDoc(r.id, { linkedFormCodesJson: e.target.value })}
                            />
                          </label>
                          <label className="space-y-1 text-xs md:col-span-2">
                            <span className="text-slate-500">Ledger context (JSON, optional)</span>
                            <textarea
                              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-xs text-slate-100"
                              rows={2}
                              defaultValue={r.ledgerContextJson ?? ""}
                              placeholder='{"accountLabel":"…","categoryPattern":"…"}'
                              onBlur={(e) => void patchDoc(r.id, { ledgerContextJson: e.target.value || null })}
                            />
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-300">
                            <input
                              type="checkbox"
                              checked={r.includeInHandoff !== false}
                              onChange={(e) => void patchDoc(r.id, { includeInHandoff: e.target.checked })}
                            />
                            Include in handoff ZIP by default
                          </label>
                          <label className="space-y-1 text-xs md:col-span-2">
                            <span className="text-slate-500">Client-visible note</span>
                            <textarea
                              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-slate-100"
                              rows={2}
                              defaultValue={r.notes ?? ""}
                              onBlur={(e) => void patchDoc(r.id, { notes: e.target.value })}
                            />
                          </label>
                          {(r.status === "rejected" || r.status === "needs_review") && (
                            <label className="space-y-1 text-xs md:col-span-2">
                              <span className="text-rose-400/90">Rejection / follow-up reason (reviewer)</span>
                              <textarea
                                className="w-full rounded border border-rose-900/40 bg-rose-950/20 px-2 py-1.5 text-slate-100"
                                rows={2}
                                defaultValue={r.rejectionReason ?? ""}
                                placeholder="Why rejected or what is needed from the client"
                                onBlur={(e) =>
                                  void onRejectionReason(r.id, e.target.value.trim() ? e.target.value.trim() : null)
                                }
                              />
                            </label>
                          )}
                          <label className="space-y-1 text-xs md:col-span-2">
                            <span className="text-amber-500/90">Internal reviewer note (not for client)</span>
                            <textarea
                              className="w-full rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1.5 text-slate-100"
                              rows={2}
                              defaultValue={r.internalReviewerNotes ?? ""}
                              onBlur={(e) => void patchDoc(r.id, { internalReviewerNotes: e.target.value })}
                            />
                          </label>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          <strong className="text-slate-400">Where used:</strong> quarter workflow (Q column), form support
                          matrix (linked codes), handoff packet (include + ZIP), review queue (status).
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No server uploads yet — sign in, wait for sync, then upload files above.
        </p>
      )}

      {items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <h3 className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-semibold uppercase text-slate-400">
            Local register (browser only)
          </h3>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Tag</th>
                <th className="px-3 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-slate-800/80">
                  <td className="px-3 py-2 text-slate-200">{r.displayName}</td>
                  <td className="px-3 py-2 text-slate-400">{r.tag}</td>
                  <td className="px-3 py-2 text-slate-500">{new Date(r.addedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
