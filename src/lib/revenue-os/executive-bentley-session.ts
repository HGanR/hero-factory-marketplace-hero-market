/**
 * Executive campaign session continuity — scoped sessionStorage bridge to Bentley canonical state.
 */

import { readCanonicalBentleySnapshot } from "@/lib/revenue-os/bentley-canonical-snapshot";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import { bentleyScopedSessionKey } from "@/lib/revenue-os/bentley-storage-scope";
import { executiveBentleyIntakeComplete } from "@/lib/revenue-os/executive-bentley-intake";

export const EXECUTIVE_BENTLEY_SESSION_KEY = "executive:bentley-campaign-session-v1";

export type ExecutiveBentleySessionMode = "intake" | "pipeline" | "review" | "idle";

export type ExecutiveBentleySession = {
  v: 1;
  sessionId: string;
  startedAt: string;
  lastActivityAt: string;
  mode: ExecutiveBentleySessionMode;
  intakeActive: boolean;
  clientId: string;
  adminUserId: string;
  pipelineRunId: string | null;
};

function parse(raw: string | null): ExecutiveBentleySession | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as ExecutiveBentleySession;
    if (j.v !== 1 || typeof j.sessionId !== "string") return null;
    return j;
  } catch {
    return null;
  }
}

export function readExecutiveBentleySession(): ExecutiveBentleySession | null {
  if (typeof window === "undefined") return null;
  const key = bentleyScopedSessionKey(EXECUTIVE_BENTLEY_SESSION_KEY);
  return parse(sessionStorage.getItem(key)) ?? parse(sessionStorage.getItem(EXECUTIVE_BENTLEY_SESSION_KEY));
}

export function writeExecutiveBentleySession(session: ExecutiveBentleySession): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(session);
  const key = bentleyScopedSessionKey(EXECUTIVE_BENTLEY_SESSION_KEY);
  try {
    sessionStorage.setItem(key, raw);
    sessionStorage.setItem(EXECUTIVE_BENTLEY_SESSION_KEY, raw);
  } catch {
    // quota
  }
}

export function touchExecutiveBentleySession(patch: Partial<ExecutiveBentleySession>): ExecutiveBentleySession | null {
  const prev = readExecutiveBentleySession();
  if (!prev) return null;
  const next: ExecutiveBentleySession = {
    ...prev,
    ...patch,
    lastActivityAt: new Date().toISOString(),
  };
  writeExecutiveBentleySession(next);
  return next;
}

export function startExecutiveBentleySession(opts: {
  adminUserId: string;
  clientId: string;
  intakeActive?: boolean;
}): ExecutiveBentleySession {
  const snap = readCanonicalBentleySnapshot();
  const intakeComplete = snap ? executiveBentleyIntakeComplete(snap) : false;
  const session: ExecutiveBentleySession = {
    v: 1,
    sessionId: `exec-bentley-${Date.now()}`,
    startedAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    mode: intakeComplete ? "review" : "intake",
    intakeActive: opts.intakeActive ?? !intakeComplete,
    clientId: opts.clientId,
    adminUserId: opts.adminUserId,
    pipelineRunId: null,
  };
  writeExecutiveBentleySession(session);
  return session;
}

export function clearExecutiveBentleySession(): void {
  if (typeof window === "undefined") return;
  const key = bentleyScopedSessionKey(EXECUTIVE_BENTLEY_SESSION_KEY);
  try {
    sessionStorage.removeItem(key);
    sessionStorage.removeItem(EXECUTIVE_BENTLEY_SESSION_KEY);
  } catch {
    // ignore
  }
}

export function executiveBentleySessionSummary(snap: BentleySnapshot | null): string {
  if (!snap) return "No Bentley snapshot in session yet.";
  const parts: string[] = [];
  if (snap.businessName?.trim()) parts.push(`Business: ${snap.businessName.trim()}`);
  if (snap.targetAudience?.trim()) parts.push(`Audience: ${snap.targetAudience.trim()}`);
  if (snap.platforms?.length) parts.push(`Platforms: ${snap.platforms.join(", ")}`);
  return parts.length ? parts.join(" · ") : "Intake started — answer Skipper's questions to populate the pipeline.";
}
