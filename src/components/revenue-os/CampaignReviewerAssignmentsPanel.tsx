"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ReviewerLookupCandidateApi } from "@/lib/revenue-os/campaign-reviewer-assignment-lookup";
import { sortReviewerAssignmentsForDisplay } from "@/lib/revenue-os/reviewer-assignment-display-sort";

export type ReviewerAssignmentApiRow = {
  id: string;
  campaignId: string;
  userId: number;
  role: string;
  createdAt: string;
  updatedAt: string;
};

const ROLE_OPTIONS = [
  { value: "approver", label: "approver" },
  { value: "editor", label: "editor" },
  { value: "reviewer", label: "reviewer" },
] as const;

const LOOKUP_DEBOUNCE_MS = 280;

type Props = {
  campaignId: string | null;
  canManage: boolean;
  /** From GET /api/campaigns/:id governanceEntitlements (default true). */
  reviewerAssignmentsEnabled?: boolean;
  /** Campaign owner marketplace user id (read-only display). */
  ownerUserId?: number | null;
};

/**
 * Owner/admin: list, add (search or manual marketplace user id), change role, remove reviewer assignments.
 */
export function CampaignReviewerAssignmentsPanel({
  campaignId,
  canManage,
  reviewerAssignmentsEnabled = true,
  ownerUserId,
}: Props) {
  const [reviewers, setReviewers] = useState<ReviewerAssignmentApiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [lookupInput, setLookupInput] = useState("");
  const [debouncedLookup, setDebouncedLookup] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupCandidates, setLookupCandidates] = useState<ReviewerLookupCandidateApi[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ReviewerLookupCandidateApi | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addRole, setAddRole] = useState<string>("approver");
  const [addBusy, setAddBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [removePromptId, setRemovePromptId] = useState<string | null>(null);
  const [addInlineError, setAddInlineError] = useState<string | null>(null);
  const [rowInlineErrors, setRowInlineErrors] = useState<Record<string, string>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedReviewers = useMemo(() => sortReviewerAssignmentsForDisplay(reviewers), [reviewers]);
  const mutationLocked = addBusy || rowBusyId != null;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedLookup(lookupInput.trim()), LOOKUP_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [lookupInput]);

  useEffect(() => {
    setSelectedCandidate(null);
  }, [debouncedLookup]);

  const load = useCallback(async () => {
    if (!campaignId || !canManage || !reviewerAssignmentsEnabled) {
      setReviewers([]);
      setLoadError(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/reviewers`);
      const j = (await r.json().catch(() => ({}))) as {
        reviewers?: ReviewerAssignmentApiRow[];
        error?: string;
        message?: string;
      };
      if (!r.ok) {
        setReviewers([]);
        if (r.status === 403 || r.status === 404) {
          setLoadError(null);
        } else {
          setLoadError(j.message ?? "Could not load reviewers.");
          toast.error(j.message ?? "Could not load reviewers.");
        }
        return;
      }
      setReviewers(Array.isArray(j.reviewers) ? j.reviewers : []);
    } catch {
      setReviewers([]);
      const msg = "Could not load reviewers.";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [campaignId, canManage, reviewerAssignmentsEnabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!campaignId || !canManage || !reviewerAssignmentsEnabled) {
      setLookupCandidates([]);
      setLookupLoading(false);
      return;
    }
    const q = debouncedLookup;
    if (q.length < 2) {
      setLookupCandidates([]);
      setLookupLoading(false);
      return;
    }

    let cancelled = false;
    setLookupLoading(true);
    const run = async () => {
      try {
        const params = new URLSearchParams({ q });
        const r = await fetch(`/api/campaigns/${campaignId}/reviewers/lookup?${params}`, {
          credentials: "include",
        });
        const j = (await r.json().catch(() => ({}))) as {
          candidates?: ReviewerLookupCandidateApi[];
          message?: string;
        };
        if (cancelled) return;
        if (!r.ok) {
          setLookupCandidates([]);
          return;
        }
        setLookupCandidates(Array.isArray(j.candidates) ? j.candidates : []);
      } catch {
        if (!cancelled) setLookupCandidates([]);
      } finally {
        if (!cancelled) setLookupLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [campaignId, canManage, reviewerAssignmentsEnabled, debouncedLookup]);

  if (!campaignId || !canManage) return null;

  if (!reviewerAssignmentsEnabled) {
    return (
      <div
        className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4"
        data-testid="campaign-reviewer-assignments-panel"
        data-governance-gated="true"
      >
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Campaign reviewers</p>
        <p className="text-xs text-slate-400">
          Reviewer assignment management is not available on the current plan. Available on higher plans.
        </p>
      </div>
    );
  }

  const resolveAddUserId = (): number | null => {
    if (selectedCandidate) return selectedCandidate.userId;
    const uid = parseInt(addUserId.trim(), 10);
    if (!Number.isFinite(uid) || uid <= 0) return null;
    return uid;
  };

  const onAdd = async () => {
    const uid = resolveAddUserId();
    if (uid == null) {
      toast.error("Search and select a user, or enter a valid marketplace user id (manual).");
      return;
    }
    setAddInlineError(null);
    setAddBusy(true);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/reviewers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, role: addRole }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        ok?: boolean;
      };
      if (r.status === 409) {
        const msg = j.message ?? "This user is already assigned — change role in the list or remove first.";
        setAddInlineError(msg);
        toast.error(msg);
        return;
      }
      if (!r.ok || !j.ok) {
        const msg = j.message ?? "Could not add reviewer.";
        setAddInlineError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Reviewer added.");
      setAddUserId("");
      setLookupInput("");
      setLookupCandidates([]);
      setSelectedCandidate(null);
      setAddInlineError(null);
      await load();
    } finally {
      setAddBusy(false);
    }
  };

  const onPatchRole = async (assignmentId: string, role: string) => {
    setRowInlineErrors((prev) => {
      const next = { ...prev };
      delete next[assignmentId];
      return next;
    });
    setRowBusyId(assignmentId);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/reviewers/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const j = (await r.json().catch(() => ({}))) as { message?: string; ok?: boolean };
      if (!r.ok || !j.ok) {
        const msg = j.message ?? "Could not update role.";
        setRowInlineErrors((prev) => ({ ...prev, [assignmentId]: msg }));
        toast.error(msg);
        return;
      }
      toast.success("Role updated.");
      await load();
    } finally {
      setRowBusyId(null);
    }
  };

  const onRemoveConfirmed = async (assignmentId: string) => {
    setRemovePromptId(null);
    setRowBusyId(assignmentId);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/reviewers/${assignmentId}`, {
        method: "DELETE",
      });
      const j = (await r.json().catch(() => ({}))) as { message?: string; ok?: boolean };
      if (!r.ok || !j.ok) {
        toast.error(j.message ?? "Could not remove.");
        return;
      }
      toast.success("Reviewer removed.");
      await load();
    } finally {
      setRowBusyId(null);
    }
  };

  const showLookupEmpty =
    debouncedLookup.length >= 2 && !lookupLoading && lookupCandidates.length === 0;

  const ownerNum = ownerUserId != null && ownerUserId > 0 ? ownerUserId : null;

  return (
    <div
      className="rounded-xl border border-slate-700/80 bg-slate-950/50 p-4"
      data-testid="campaign-reviewer-assignments-panel"
    >
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Campaign reviewers</p>
      <p className="text-[10px] text-slate-500 mb-3">
        Lookup is the default path; manual user id stays available as a fallback.{" "}
        <span className="text-slate-400">Approver</span> / <span className="text-slate-400">editor</span> may finalize
        approvals. <span className="text-slate-400">Reviewer</span> may review but not finalize.{" "}
        <span className="text-slate-400">Owner</span> is implicit (see below).
      </p>

      {loadError ? (
        <p className="text-xs text-amber-200/85 mb-2" data-testid="reviewers-load-error">
          {loadError}
        </p>
      ) : null}

      <div className="border border-slate-800/80 rounded-lg p-3 mb-4 bg-slate-900/25" data-testid="reviewer-add-section">
        <p className="text-[10px] font-medium text-slate-400 mb-2">Add reviewer — search first</p>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-slate-500" htmlFor="reviewer-lookup-search">
            Search by name, email, or user id
          </label>
          <input
            id="reviewer-lookup-search"
            type="search"
            autoComplete="off"
            placeholder="Type at least 2 characters…"
            value={lookupInput}
            onChange={(e) => {
              setLookupInput(e.target.value);
              setAddInlineError(null);
            }}
            className="w-full max-w-md rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-200"
            disabled={mutationLocked}
            data-testid="reviewer-lookup-search"
          />
        </div>

        {lookupLoading ? (
          <p className="text-[10px] text-slate-500 mt-1" data-testid="reviewer-lookup-loading">
            Searching…
          </p>
        ) : null}

        {showLookupEmpty ? (
          <div
            className="mt-2 rounded-lg border border-dashed border-slate-700/80 bg-slate-900/30 px-2 py-2 text-[10px] text-slate-400 space-y-1"
            data-testid="reviewer-lookup-empty"
          >
            <p className="text-slate-300">No matching user found.</p>
            <p className="text-slate-500" data-testid="reviewer-invite-placeholder">
              Inviting someone by email will be available here in a future update.
            </p>
          </div>
        ) : null}

        {lookupCandidates.length > 0 ? (
          <ul className="mt-2 space-y-1 max-w-md" data-testid="reviewer-lookup-candidates">
            {lookupCandidates.map((c) => {
              const isSel = selectedCandidate?.userId === c.userId;
              return (
                <li key={c.userId}>
                  <button
                    type="button"
                    disabled={mutationLocked}
                    onClick={() => {
                      setSelectedCandidate(c);
                      setAddUserId("");
                      setManualOpen(false);
                      setAddInlineError(null);
                    }}
                    className={cn(
                      "w-full text-left rounded-lg border px-2 py-1.5 text-[11px] transition-colors",
                      isSel
                        ? "border-cyan-600/60 bg-cyan-950/40 text-cyan-100"
                        : "border-slate-700 bg-slate-900/50 text-slate-200 hover:border-slate-500"
                    )}
                    data-testid={`reviewer-lookup-option-${c.userId}`}
                  >
                    <span className="font-medium text-slate-100">{c.displayName}</span>
                    <span className="text-slate-500"> · </span>
                    <span className="text-slate-400 break-all">{c.email}</span>
                    <span className="block text-[10px] text-slate-500 font-mono mt-0.5">user #{c.userId}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {selectedCandidate ? (
          <div
            className="mt-2 rounded-lg border border-emerald-900/40 bg-emerald-950/25 px-2 py-2 text-[11px] text-emerald-100/95"
            data-testid="reviewer-selected-summary"
          >
            <p className="text-[10px] uppercase tracking-wide text-emerald-200/80 mb-1">Selected for assignment</p>
            <p>
              <span className="font-semibold">{selectedCandidate.displayName}</span>
              <span className="text-emerald-200/70"> · </span>
              <span className="break-all">{selectedCandidate.email}</span>
            </p>
            <p className="font-mono text-[10px] text-emerald-200/80 mt-0.5">user #{selectedCandidate.userId}</p>
            <button
              type="button"
              disabled={mutationLocked}
              onClick={() => setSelectedCandidate(null)}
              className="mt-2 text-[10px] text-emerald-300/90 underline underline-offset-2"
            >
              Clear selection
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-1 mt-2">
          <button
            type="button"
            disabled={mutationLocked}
            onClick={() => setManualOpen((o) => !o)}
            className="text-left text-[10px] text-slate-500 hover:text-slate-400 underline underline-offset-2 w-fit"
            data-testid="reviewer-manual-toggle"
          >
            {manualOpen ? "Hide manual user id" : "Enter marketplace user id manually (fallback)"}
          </button>
          {manualOpen ? (
            <div className="flex flex-col gap-0.5 max-w-xs">
              <label className="text-[10px] text-slate-500" htmlFor="reviewer-manual-userid">
                Marketplace user id
              </label>
              <input
                id="reviewer-manual-userid"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 42"
                value={addUserId}
                onChange={(e) => {
                  setAddUserId(e.target.value);
                  if (e.target.value.trim()) setSelectedCandidate(null);
                  setAddInlineError(null);
                }}
                className="w-28 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
                disabled={mutationLocked}
                data-testid="reviewer-manual-userid"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end gap-2 mt-2">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-slate-500">Role</label>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value)}
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
              disabled={mutationLocked}
              data-testid="reviewer-add-role"
            >
              {ROLE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={mutationLocked || addBusy}
            onClick={() => void onAdd()}
            className="rounded border border-emerald-900/50 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-100/90 disabled:opacity-40"
            data-testid="reviewer-add-submit"
          >
            {addBusy ? "Adding…" : "Add reviewer"}
          </button>
        </div>

        {addInlineError ? (
          <div
            className="mt-2 rounded border border-amber-900/45 bg-amber-950/25 px-2 py-1.5 text-[10px] text-amber-100/95"
            role="alert"
            data-testid="reviewer-add-inline-error"
          >
            {addInlineError}
          </div>
        ) : null}
      </div>

      <p className="text-[10px] font-medium text-slate-400 mb-2">Current reviewers</p>

      {ownerNum != null ? (
        <div
          className="mb-2 rounded border border-slate-800/90 bg-slate-900/30 px-2 py-1.5 text-[11px] text-slate-400"
          data-testid="reviewer-owner-implicit-row"
        >
          <span className="text-slate-500 uppercase text-[10px] mr-2">Owner</span>
          <span className="font-mono text-slate-300">user #{ownerNum}</span>
          <span className="text-slate-600 ml-2">(implicit)</span>
        </div>
      ) : null}

      {loading ? (
        <p className="text-xs text-slate-500" data-testid="reviewers-loading">
          Loading…
        </p>
      ) : sortedReviewers.length === 0 ? (
        <p className="text-xs text-slate-500 mb-1" data-testid="reviewers-empty">
          No reviewer assignments yet.
        </p>
      ) : (
        <ul className="space-y-2 mb-1" data-testid="reviewers-list">
          {sortedReviewers.map((a) => {
            const rowBusy = rowBusyId === a.id;
            const otherRowBusy = rowBusyId != null && rowBusyId !== a.id;
            const rowLocked = mutationLocked && !rowBusy;
            const confirmingRemove = removePromptId === a.id;
            const rowErr = rowInlineErrors[a.id];
            return (
              <li
                key={a.id}
                className="rounded border border-slate-800/90 bg-slate-900/40 px-2 py-1.5 text-[11px]"
                data-testid={`reviewer-row-${a.id}`}
                data-reviewer-user-id={a.userId}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-300 font-mono">user #{a.userId}</span>
                  <label className="sr-only" htmlFor={`role-${a.id}`}>
                    Role
                  </label>
                  <select
                    id={`role-${a.id}`}
                    className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[10px] text-slate-200"
                    value={a.role}
                    disabled={rowLocked || rowBusy}
                    onChange={(e) => void onPatchRole(a.id, e.target.value)}
                    aria-label={`Role for user ${a.userId}`}
                    data-testid={`reviewer-row-role-${a.id}`}
                  >
                    {ROLE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {!confirmingRemove ? (
                    <button
                      type="button"
                      disabled={rowLocked || rowBusy}
                      onClick={() => {
                        setRemovePromptId(a.id);
                        setRowInlineErrors((prev) => {
                          const next = { ...prev };
                          delete next[a.id];
                          return next;
                        });
                      }}
                      className={cn(
                        "ml-auto rounded border border-red-900/50 px-1.5 py-0.5 text-[10px] text-red-200/90",
                        "disabled:opacity-40"
                      )}
                      data-testid={`reviewer-remove-${a.id}`}
                    >
                      Remove
                    </button>
                  ) : (
                    <span className="ml-auto flex flex-wrap items-center gap-1">
                      <span className="text-[10px] text-amber-200/90">Remove this reviewer?</span>
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => void onRemoveConfirmed(a.id)}
                        className="rounded border border-red-800/60 bg-red-950/40 px-1.5 py-0.5 text-[10px] text-red-100"
                        data-testid={`reviewer-remove-confirm-${a.id}`}
                      >
                        {rowBusy ? "…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        disabled={rowBusy}
                        onClick={() => setRemovePromptId(null)}
                        className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300"
                        data-testid={`reviewer-remove-cancel-${a.id}`}
                      >
                        Cancel
                      </button>
                    </span>
                  )}
                </div>
                {rowErr ? (
                  <p className="mt-1 text-[10px] text-amber-200/85" data-testid={`reviewer-row-error-${a.id}`}>
                    {rowErr}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
