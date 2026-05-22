import type { ExecutiveApprovalStatus } from "@/lib/executive-agent/executive-agent-approvals-store";

export type ApprovalGateInput = {
  approvalId: string;
  status: ExecutiveApprovalStatus;
  proposedAction: string;
  adminUserId: number;
  approvalOwnerAdminUserId: number;
  humanConfirmed: boolean;
};

export type ApprovalGateResult =
  | { ok: true; message: string }
  | { ok: false; code: string; message: string; httpStatus: number };

/** Every governed automation execution requires explicit human confirmation and pending approval. */
export function validateApprovalGate(input: ApprovalGateInput): ApprovalGateResult {
  if (input.adminUserId !== input.approvalOwnerAdminUserId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Approval does not belong to this executive admin desk.",
      httpStatus: 403,
    };
  }

  if (!input.humanConfirmed) {
    return {
      ok: false,
      code: "HUMAN_CONFIRMATION_REQUIRED",
      message: "Governed automation requires explicit humanConfirmed=true.",
      httpStatus: 400,
    };
  }

  if (input.status === "executed") {
    return {
      ok: false,
      code: "ALREADY_EXECUTED",
      message: "Approval was already executed.",
      httpStatus: 409,
    };
  }

  if (input.status === "rejected") {
    return {
      ok: false,
      code: "REJECTED",
      message: "Rejected approvals cannot be executed.",
      httpStatus: 409,
    };
  }

  if (input.status === "failed") {
    return {
      ok: false,
      code: "FAILED",
      message: "Failed approval must be re-proposed before automation execution.",
      httpStatus: 409,
    };
  }

  if (input.status !== "pending") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: `Approval status ${input.status} is not eligible for governed execution.`,
      httpStatus: 409,
    };
  }

  return { ok: true, message: "Approval gate passed — human confirmation and pending state verified." };
}
