"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { APPROVAL_STATUSES, type ApprovalStatus, type UnifiedApproval } from "@/approvals/unifiedApproval";
type Props = { load(): Promise<UnifiedApproval[]>; decide(id: string, decision: "approve" | "reject"): Promise<void> };
export function ApprovalQueueView({ load, decide }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<UnifiedApproval[]>([]);
  const [status, setStatus] = useState<ApprovalStatus | "all">("all");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const active = useRef(false);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try { const latest = await load(); if (active.current) { setRows(latest); setReady(true); setError(""); } }
    catch (e) { if (active.current) { setError(e instanceof Error ? e.message : "Queue unavailable"); setReady(false); } }
    finally { inFlight.current = false; }
  }, [load]);
  useEffect(() => {
    active.current = open;
    if (!open) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => { active.current = false; window.clearInterval(timer); window.removeEventListener("focus", focus); };
  }, [open, refresh]);
  const act = async (row: UnifiedApproval, decision: "approve" | "reject") => {
    if (busy || !ready) return;
    if (!window.confirm(decision === "approve" ? `Approve and execute this stored proposal?\n${row.action}\n${row.target}` : `Reject this proposal?\n${row.action}\n${row.target}`)) return;
    setBusy(row.id);
    try { await decide(row.id, decision); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Decision failed"); setReady(false); }
    finally { setBusy(null); }
  };
  return <section aria-label="Unified approval queue" style={{ position:"fixed", right:20, bottom:105, zIndex:160, maxWidth:"min(620px, calc(100vw - 40px))", color:"#ecfeff", background:"#0d1d2b", border:"1px solid #67d5ef", borderRadius:16, padding:12 }}>
    <button type="button" aria-expanded={open} aria-controls="skipper-unified-queue" onClick={() => setOpen(v => !v)}>{open ? "Minimize approvals" : "Approval queue"}</button>
    {open && <div id="skipper-unified-queue" style={{ maxHeight:"65vh",overflowY:"auto",padding:12 }}>
      <h2>Shared website approval queue</h2>
      <p>Latest 100 server proposals. Pending, approved, rejected, executed and failed are server states. Local unsubmitted drafts are not approvals. Refreshes every 15 seconds while open.</p>
      <label>Status <select value={status} onChange={e=>setStatus(e.target.value as ApprovalStatus | "all")}><option value="all">All statuses</option>{APPROVAL_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
      <button type="button" onClick={()=>void refresh()}>Refresh</button>
      {error && <p role="alert">{error} Refresh before making another decision.</p>}
      {!ready && !error && <p role="status">Loading server proposals…</p>}
      {ready && rows.filter(r=>status === "all" || r.status === status).length === 0 && <p>No proposals in this view.</p>}
      {rows.filter(r=>status === "all" || r.status === status).map(row=><article key={row.id} style={{ borderTop:"1px solid #59717a", marginTop:12,paddingTop:12 }}>
        <h3>{row.category} · {row.action}</h3><p>Status: <strong>{row.status}</strong> · {row.target}</p><p>{row.description}</p>
        <p>{row.createdAt}</p><details><summary>Stored proposal payload</summary><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{JSON.stringify(row.payload,null,2)}</pre></details>
        {row.status === "pending" && <div><button type="button" disabled={Boolean(busy) || !ready} onClick={()=>void act(row,"approve")}>Approve & execute</button> <button type="button" disabled={Boolean(busy) || !ready} onClick={()=>void act(row,"reject")}>Reject</button></div>}
      </article>)}
    </div>}
  </section>;
}
