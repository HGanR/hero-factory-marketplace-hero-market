"use client";
import { ApprovalQueueView } from "./ApprovalQueueView";
import type { UnifiedApproval } from "./unifiedApproval";
async function load(): Promise<UnifiedApproval[]> {
  const response = await fetch("/api/admin/executive-agent/approvals", { credentials: "include", cache: "no-store" });
  const body = await response.json();
  if (!response.ok || body.schemaVersion !== "skipper-proposal-v1" || !Array.isArray(body.queue)) throw new Error(body.error || "Shared queue unavailable; update the website first.");
  return body.queue;
}
async function decide(id: string, decision: "approve" | "reject") {
  const response = await fetch(`/api/admin/executive-agent/approvals/${encodeURIComponent(id)}/${decision}`, {
    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ humanConfirmed: true }),
  });
  const body = await response.json();
  if (!response.ok || body.ok !== true) throw new Error(body.message || body.error || body.code || "Decision failed; refresh the server state.");
}
export function UnifiedApprovalQueue() { return <ApprovalQueueView load={load} decide={decide} />; }
