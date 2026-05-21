import type { ExecutiveOperationalThreadKind } from "@/lib/executive-agent/executive-conversation-threads";

export type ApprovalThreadLinkInput = {
  approvalId: string;
  proposedAction: string;
  targetType?: string | null;
  targetId?: string | null;
};

export function approvalDiscussionThreadKind(): ExecutiveOperationalThreadKind {
  return "approval";
}

export function buildApprovalDiscussionThreadTitle(input: ApprovalThreadLinkInput): string {
  const action = input.proposedAction.trim() || "approval";
  const target = input.targetId?.trim();
  if (target) return `Approval · ${action} (${target.slice(0, 12)}…)`;
  return `Approval · ${action}`;
}

export function approvalThreadLinkKey(approvalId: string): string {
  return `approval:${approvalId.trim()}`;
}

export function parseApprovalThreadLinkKey(key: string): { approvalId: string } | null {
  const m = /^approval:(.+)$/.exec(key.trim());
  if (!m?.[1]) return null;
  return { approvalId: m[1] };
}
