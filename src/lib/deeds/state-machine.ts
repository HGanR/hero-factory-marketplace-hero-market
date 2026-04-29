/**
 * Deed state machine - enforces monotonic transitions
 * 
 * Valid transitions:
 * DRAFT → PENDING → APPROVED → EXECUTED → RECORDED
 * 
 * Note: "locked" is not a status - it's a separate field (lockedAt timestamp).
 * Locking can occur when status is "recorded" or "executed" (handled separately in lock endpoint).
 */

export type DeedStatus = "draft" | "pending" | "approved" | "executed" | "recorded" | "void";

const VALID_TRANSITIONS: Record<DeedStatus, DeedStatus[]> = {
  draft: ["pending", "approved", "void"],
  pending: ["approved", "void"],
  approved: ["executed", "void"], // Note: Locking is separate (lockedAt field), not a status transition
  executed: ["recorded", "void"],
  recorded: ["void"], // Note: Locking is separate (lockedAt field), not a status transition
  void: [], // terminal state
};

export function canTransitionDeedStatus(from: DeedStatus, to: DeedStatus): { ok: boolean; message?: string } {
  // Same state is allowed (idempotent)
  if (from === to) {
    return { ok: true };
  }

  // Check if transition is valid
  const allowed = VALID_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      message: `Invalid state transition: ${from} → ${to}. Allowed transitions from ${from}: ${allowed.join(", ")}`,
    };
  }

  return { ok: true };
}

export function validateDeedStatusTransition(
  currentStatus: DeedStatus,
  newStatus: DeedStatus
): { ok: true } | { ok: false; code: string; message: string } {
  const check = canTransitionDeedStatus(currentStatus, newStatus);
  if (!check.ok) {
    return {
      ok: false,
      code: "INVALID_STATE_TRANSITION",
      message: check.message || "Invalid state transition",
    };
  }
  return { ok: true };
}
