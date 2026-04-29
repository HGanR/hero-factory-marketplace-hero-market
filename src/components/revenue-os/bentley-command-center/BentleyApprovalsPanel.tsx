"use client";

import { useCallback, useState } from "react";
import type { BentleySocialCommandCenterPayload } from "@/lib/revenue-os/social-command-center";

type Props = {
  approvals: BentleySocialCommandCenterPayload["approvals"];
  onRefresh: () => Promise<void>;
};

export function BentleyApprovalsPanel({ approvals, onRefresh }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const act = useCallback(
    async (path: "approve" | "reject", id: string) => {
      setBusy(id);
      try {
        const res = await fetch(`/api/revenue-os/autonomous/approval-requests/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approvalRequestId: id, reviewNote: note.trim() || null }),
        });
        if (!res.ok) throw new Error(await res.text());
        await onRefresh();
      } catch (e) {
        console.warn(e);
      } finally {
        setBusy(null);
      }
    },
    [note, onRefresh]
  );

  const pending = approvals.autonomous.pendingApprovals;
  const expiring = approvals.autonomous.expiringSoon;
  const bySev = approvals.autonomous.bySeverity;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-500/20 bg-amber-950/15 p-4 text-sm text-amber-100/90">
        <span className="font-medium text-zinc-100">Governed autonomy · </span>
        {approvals.summaryLine}
      </div>
      <div>
        <label className="text-xs text-zinc-500">Optional review note (approve / reject)</label>
        <input
          className="mt-1 w-full max-w-md rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Context for audit trail…"
        />
      </div>
      {expiring.length ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-100">
          Autonomous actions · {expiring.length} approval(s) expiring soon (cadence / policy windows).
        </div>
      ) : null}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase text-zinc-500">Severity groups</h4>
        <div className="flex flex-wrap gap-2">
          {Object.entries(bySev).map(([sev, items]) => (
            <span key={sev} className="rounded-full border border-white/10 bg-zinc-900/60 px-2 py-1 text-[11px] text-zinc-300">
              {sev}: {items.length}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {pending.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/10 bg-zinc-950/50 p-4">
            <div className="text-[10px] uppercase text-zinc-500">{p.workspaceLabel}</div>
            <div className="mt-1 font-medium text-zinc-100">{p.actionType.replace(/^auto_/, "").replace(/_/g, " ")}</div>
            <div className="mt-1 text-xs text-zinc-400">{p.reason}</div>
            <div className="mt-2 text-[11px] text-zinc-500">
              Targets: {p.preview.targetIds.slice(0, 6).join(", ") || "—"}
            </div>
            {p.expiresAt ? (
              <div className="mt-1 text-[11px] text-amber-200/90">Expires {p.expiresAt.slice(0, 16)}</div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => act("approve", p.id)}
                className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => act("reject", p.id)}
                className="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
      {!pending.length ? (
        <p className="text-sm text-zinc-500">No pending autonomous approvals — connector execution and cadence can proceed without human gates.</p>
      ) : null}
      <div className="grid gap-4 border-t border-white/5 pt-4 md:grid-cols-2">
        <div>
          <h4 className="text-xs font-semibold text-zinc-500">Recently approved</h4>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {approvals.autonomous.recentlyApproved.map((x) => (
              <li key={x.id}>
                {x.actionType} · {x.reviewedAt?.slice(0, 16) ?? "—"}
              </li>
            ))}
            {!approvals.autonomous.recentlyApproved.length ? <li>—</li> : null}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-zinc-500">Recently rejected</h4>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {approvals.autonomous.recentlyRejected.map((x) => (
              <li key={x.id}>
                {x.actionType} · {x.reviewedAt?.slice(0, 16) ?? "—"}
              </li>
            ))}
            {!approvals.autonomous.recentlyRejected.length ? <li>—</li> : null}
          </ul>
        </div>
      </div>
    </div>
  );
}
