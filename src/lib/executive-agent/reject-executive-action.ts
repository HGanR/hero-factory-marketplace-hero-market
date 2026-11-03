import { validateApprovalGate } from "./approval-gated-execution";
import type { ApprovalDependencies } from "./approve-executive-action";
type RejectDeps = Pick<ApprovalDependencies, "read" | "auditRefusal"> & { rejectPending(id: string, adminUserId: number): Promise<boolean> };
export async function rejectExecutiveAction(request: Request, id: string, adminUserId: number, deps: RejectDeps): Promise<Response> {
  const body: unknown = await request.json().catch(() => null);
  const row = await deps.read(id);
  const refuse = async (code: string, status: number) => {
    await deps.auditRefusal({ approvalId: id, adminUserId, code, status: row?.status ?? null });
    return Response.json({ ok: false, code }, { status });
  };
  if (!row) return refuse("NOT_FOUND", 404);
  const gate = validateApprovalGate({ approvalId: row.id, proposedAction: row.proposedAction, status: row.status,
    adminUserId, approvalOwnerAdminUserId: row.adminUserId,
    humanConfirmed: body && typeof body === "object" && !Array.isArray(body) && "humanConfirmed" in body ? body.humanConfirmed : undefined });
  if (!gate.ok) return refuse(gate.code, gate.httpStatus);
  if (!await deps.rejectPending(id, adminUserId)) return refuse("INVALID_STATE", 409);
  return Response.json({ ok: true, status: "rejected" });
}
