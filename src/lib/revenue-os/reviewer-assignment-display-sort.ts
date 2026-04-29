/**
 * Display order for campaign reviewer assignments (Part 25).
 */

import { normalizeReviewerRole } from "@/lib/revenue-os/campaign-reviewer-role";

const ROLE_SORT: Record<string, number> = {
  approver: 0,
  editor: 1,
  reviewer: 2,
};

export function sortReviewerAssignmentsForDisplay<T extends { userId: number; role: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const ra = ROLE_SORT[normalizeReviewerRole(a.role)] ?? 99;
    const rb = ROLE_SORT[normalizeReviewerRole(b.role)] ?? 99;
    if (ra !== rb) return ra - rb;
    return a.userId - b.userId;
  });
}
