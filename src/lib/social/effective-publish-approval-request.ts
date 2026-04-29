import type { NextRequest } from "next/server";
import { readScheduledPublishRequireApprovalEnv } from "@/lib/revenue-os/publish-approval-gate";

/** Matches client session toggle: send `x-bentley-publish-approval-session: 1` from the browser when UI approval mode is on. */
export const X_BENTLEY_PUBLISH_APPROVAL_SESSION = "x-bentley-publish-approval-session";

/**
 * Effective “approval required” for new governed social posts: env flag OR session header (stricter).
 * Never weaker than env-only: callers must still enforce worker gate separately.
 */
export function readEffectivePublishApprovalRequiredFromRequest(req: NextRequest): boolean {
  const env = readScheduledPublishRequireApprovalEnv();
  const session =
    req.headers.get(X_BENTLEY_PUBLISH_APPROVAL_SESSION)?.trim() === "1" ||
    req.headers.get(X_BENTLEY_PUBLISH_APPROVAL_SESSION.toLowerCase())?.trim() === "1";
  return env || session;
}
