import { validateApprovalGate } from "./approval-gated-execution";
import type { ExecutiveApprovalRow, ExecutiveActionExecutorResult } from "./executive-action-executors";

export type ApprovalRefusal = {
  approvalId: string;
  adminUserId: number;
  code: string;
  status: ExecutiveApprovalRow["status"] | null;
};
export type ApprovalDependencies = {
  read: (id: string) => Promise<ExecutiveApprovalRow | null>;
  claim: (id: string, adminUserId: number) => Promise<boolean>;
  execute: (row: ExecutiveApprovalRow, adminUserId: number) => Promise<ExecutiveActionExecutorResult>;
  auditRefusal: (refusal: ApprovalRefusal) => Promise<void>;
};

/** Request boundary; the route wires these dependencies to real persistence. */
export async function approveExecutiveAction(
  request: Request, approvalId: string, adminUserId: number, deps: ApprovalDependencies
): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const row = await deps.read(approvalId);
  const refuse = async (code: string, error: string, status: number) => {
    // Await the audit; a logging failure must never fall through to execution.
    await deps.auditRefusal({ approvalId, adminUserId, code, status: row?.status ?? null });
    return Response.json({ ok: false, code, error }, { status });
  };
  if (!row) return refuse("NOT_FOUND", "Approval not found.", 404);
  const gate = validateApprovalGate({
    approvalId: row.id, status: row.status, proposedAction: row.proposedAction,
    adminUserId, approvalOwnerAdminUserId: row.adminUserId,
    humanConfirmed: (
      body !== null && typeof body === "object" && !Array.isArray(body)
      && "humanConfirmed" in body ? body.humanConfirmed : undefined
    ),
  });
  if (!gate.ok) return refuse(gate.code, gate.message, gate.httpStatus);
  if (!(await deps.claim(row.id, adminUserId))) {
    return refuse("INVALID_STATE", "Approval changed before it could be approved.", 409);
  }
  // Dispatcher re-reads and locks the persisted row, never request payloads.
  const exec = await deps.execute(row, adminUserId);
  return Response.json({ ok: exec.ok, message: exec.message, status: exec.status, data: exec.data });
}
