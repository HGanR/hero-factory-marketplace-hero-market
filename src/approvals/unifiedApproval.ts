export const APPROVAL_STATUSES = ["pending", "approved", "rejected", "executed", "failed"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type UnifiedApproval = { schemaVersion: "skipper-proposal-v1"; id: string; action: string; status: ApprovalStatus; category: "bentley" | "code" | "outreach" | "operations"; target: string; description: string; payload: Record<string, unknown>; createdAt: string };
export function toUnifiedApproval(row: {id:string; proposedAction:string; status:ApprovalStatus; targetType?:string|null; targetId?:string|null; payloadJson:string; createdAt:Date|string}): UnifiedApproval {
  let payload: Record<string, unknown> = {};
  try { const value: unknown = JSON.parse(row.payloadJson); if(value && typeof value === "object" && !Array.isArray(value)) payload = value as Record<string, unknown>; } catch { /* legacy payload retained as a review warning */ }
  const action = row.proposedAction;
  const category = /bentley|campaign/i.test(action) ? "bentley" : /sitebuilder|code/i.test(action) ? "code" : /outreach|followup/i.test(action) ? "outreach" : "operations";
  return { schemaVersion:"skipper-proposal-v1", id:row.id, action, status:row.status, category,
    target:[row.targetType,row.targetId].filter(Boolean).join(": "), description:typeof payload.description === "string" ? payload.description.slice(0,4000) : typeof payload.note === "string" ? payload.note.slice(0,4000) : "Review the stored proposal before deciding.",
    payload, createdAt:row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt };
}
