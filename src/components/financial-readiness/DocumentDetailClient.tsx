"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Copy, FileDown, Mail, RefreshCw, Files, Printer } from "lucide-react";
import { useFinancialReadiness } from "./FinancialReadinessProvider";
import { statusLabel, vaultDocumentLabel } from "./vaultLabels";
import type { DocumentLifecycleStatus } from "./vaultTypes";
import { computeFollowUpDueAt } from "./dueDateLogic";
import { OperationalButtons } from "./OperationalButtons";
import { FollowUpPanel } from "./FollowUpPanel";
import { newCaseId } from "./state";
import {
  buildEmailReadyLetterText,
  copyTextToClipboard,
  downloadTextFile,
  letterDownloadFilename,
} from "./exportUtils";
import { DocumentBadgesRow } from "./vaultBadges";

const STATUSES: DocumentLifecycleStatus[] = [
  "not_started",
  "in_progress",
  "awaiting_response",
  "follow_up_due",
  "completed",
  "escalated",
];

export function DocumentDetailClient() {
  const params = useParams();
  const id = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const { state, dispatch } = useFinancialReadiness();
  const router = useRouter();
  const navigateNewMatterLock = useRef(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const doc = useMemo(() => state.documents.find((d) => d.id === id), [state.documents, id]);
  const [editText, setEditText] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const matterCases = useMemo(() => {
    if (!doc || doc.module === "foundation") return [];
    return state.cases.filter((c) => c.module === doc.module);
  }, [state.cases, doc]);

  const linkedCaseEscalated = useMemo(() => {
    if (!doc?.caseId) return false;
    const mc = state.cases.find((c) => c.id === doc.caseId);
    return mc?.status === "escalated";
  }, [doc?.caseId, state.cases]);

  if (!id || !doc) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <p className="text-slate-400 mb-4">Document not found in this browser vault.</p>
        <Link href="/financial-readiness" className="text-cyan-400 hover:underline">
          ← Back to hub
        </Link>
      </div>
    );
  }

  const text = editText ?? doc.text;
  const tagsStr = tagInput || doc.tags.join(", ");

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  const saveEdits = () => {
    dispatch({
      type: "documents/patch",
      id: doc.id,
      patch: {
        text: editText ?? doc.text,
        tags: tagsStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      },
    });
    setEditText(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap justify-between gap-2">
        <Link href="/financial-readiness" className="text-sm text-cyan-300/90 hover:text-cyan-200">
          ← Financial Readiness hub
        </Link>
        {doc.caseId && (
          <Link
            href={`/financial-readiness/cases/${encodeURIComponent(doc.caseId)}`}
            className="text-sm text-slate-400 hover:text-cyan-300"
          >
            Open matter →
          </Link>
        )}
      </div>

      <header
        className={`border-b border-white/10 pb-4 ${linkedCaseEscalated ? "border-l-4 border-amber-400/70 pl-3 -ml-1" : ""}`}
      >
        <p className="text-xs uppercase tracking-wide text-slate-500">{vaultDocumentLabel(doc.type)}</p>
        <h1 className="text-2xl font-bold text-white mt-1 flex flex-wrap items-center gap-2">
          {doc.primaryParty}
          {linkedCaseEscalated && (
            <span className="text-xs font-normal uppercase tracking-wide text-amber-300/90">Escalated matter</span>
          )}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Module: {doc.module} · Created {new Date(doc.createdAt).toLocaleString()} · Updated{" "}
          {new Date(doc.updatedAt).toLocaleString()}
        </p>
        <div className="mt-2">
          <DocumentBadgesRow status={doc.status} tags={doc.tags} />
        </div>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block text-xs text-slate-500">
          Status
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={doc.status}
            onChange={(e) =>
              dispatch({
                type: "documents/patch",
                id: doc.id,
                patch: { status: e.target.value as DocumentLifecycleStatus },
              })
            }
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-500 sm:col-span-2">
          Tags (comma-separated)
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            value={tagsStr}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={() => {
              dispatch({
                type: "documents/patch",
                id: doc.id,
                patch: {
                  tags: tagsStr
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                },
              });
              setTagInput("");
            }}
          />
        </label>
      </div>

      <FollowUpPanel
        variant="document"
        id={doc.id}
        followUpDueAt={doc.followUpDueAt}
        tags={doc.tags}
        dispatch={dispatch}
        today={today}
      />

      <div>
        <h2 className="text-sm font-semibold text-white mb-2">Operational actions</h2>
        <OperationalButtons target="document" id={doc.id} dispatch={dispatch} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <h2 className="text-sm font-semibold text-white">Matter assignment</h2>
        {doc.module === "foundation" ? (
          <p className="text-xs text-slate-500">
            Matters apply to Optimization and Resolution letters. This foundation document stays in the vault only.
          </p>
        ) : (
          <>
            <label className="block text-xs text-slate-500">
              Assign to matter ({doc.module})
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                value={doc.caseId ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  dispatch({ type: "documents/assignCase", documentId: doc.id, caseId: v || null });
                }}
              >
                <option value="">— Unassigned —</option>
                {matterCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-2 text-xs text-slate-300 hover:border-amber-500/40"
                onClick={() => dispatch({ type: "documents/assignCase", documentId: doc.id, caseId: null })}
                disabled={!doc.caseId}
              >
                Detach from matter
              </button>
              <button
                type="button"
                className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100"
                onClick={() => {
                  if (navigateNewMatterLock.current) return;
                  navigateNewMatterLock.current = true;
                  const label =
                    typeof window !== "undefined"
                      ? window.prompt("New matter label (optional)", `Matter — ${doc.primaryParty}`)
                      : null;
                  const caseId = newCaseId();
                  dispatch({
                    type: "documents/createCaseFromDocument",
                    documentId: doc.id,
                    label: label ?? undefined,
                    caseId,
                  });
                  router.push(`/financial-readiness/cases/${encodeURIComponent(caseId)}`);
                  window.setTimeout(() => {
                    navigateNewMatterLock.current = false;
                  }, 2000);
                }}
              >
                New matter from this letter
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/financial-readiness/documents/${encodeURIComponent(doc.id)}/print`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/40"
        >
          <Printer className="h-4 w-4" /> Print view
        </Link>
        <button
          type="button"
          onClick={() => downloadTextFile(letterDownloadFilename(doc), doc.text)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/40"
        >
          <FileDown className="h-4 w-4" /> Download .txt
        </button>
        <button
          type="button"
          onClick={async () => {
            await copyTextToClipboard(buildEmailReadyLetterText(doc));
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/40"
        >
          <Mail className="h-4 w-4" /> Copy email-ready
        </button>
        <button
          type="button"
          onClick={copyAll}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-200 hover:border-cyan-500/40"
        >
          <Copy className="h-4 w-4" /> Copy text
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "documents/regenerate", id: doc.id })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/20 border border-violet-500/40 px-3 py-2 text-sm text-violet-100"
        >
          <RefreshCw className="h-4 w-4" /> Regenerate from sources
        </button>
        <button
          type="button"
          onClick={() => {
            dispatch({ type: "documents/duplicate", id: doc.id });
            router.push("/financial-readiness#documents");
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/35 px-3 py-2 text-sm text-cyan-100"
        >
          <Files className="h-4 w-4" /> Duplicate (open vault on hub)
        </button>
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "documents/patch",
              id: doc.id,
              patch: {
                followUpDueAt: computeFollowUpDueAt(doc.type, new Date().toISOString()),
              },
            })
          }
          className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-400"
        >
          Reset follow-up from today
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-2">Letter text</h2>
        <textarea
          className="w-full min-h-[320px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-mono text-slate-200"
          value={text}
          onChange={(e) => setEditText(e.target.value)}
        />
        <button
          type="button"
          onClick={saveEdits}
          className="mt-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-4 py-2 text-sm text-emerald-100"
        >
          Save edits
        </button>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-2">Source fields</h2>
        <pre className="text-xs font-mono text-slate-400 whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-white/[0.03] p-4 overflow-auto max-h-80">
          {JSON.stringify(doc.sources, null, 2)}
        </pre>
      </div>
    </div>
  );
}
