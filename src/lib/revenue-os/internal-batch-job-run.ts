/**
 * Shared normalization + observability for internal cron/batch jobs (Part 26).
 */

import { desc, eq } from "drizzle-orm";
import { internalJobRuns } from "@/lib/db/schema";

/** Max error detail rows returned / persisted per run (payload safety). */
export const INTERNAL_JOB_MAX_BOUNDED_ERRORS = 40;

/** Max length for a single error message string. */
export const INTERNAL_JOB_MAX_MESSAGE_LEN = 220;

export type InternalJobBoundedError = {
  campaignId?: string;
  message: string;
};

export type InternalJobRunStatus = "success" | "partial" | "failed";

export type NormalizedInternalJobPayload = {
  ok: true;
  jobType: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: Record<string, unknown>;
  partialFailure?: boolean;
  errors?: InternalJobBoundedError[];
};

export function truncateInternalJobMessage(s: string, maxLen = INTERNAL_JOB_MAX_MESSAGE_LEN): string {
  const t = String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, Math.max(0, maxLen - 1))}…`;
}

export function pushBoundedInternalJobError(
  list: InternalJobBoundedError[],
  item: InternalJobBoundedError
): void {
  if (list.length >= INTERNAL_JOB_MAX_BOUNDED_ERRORS) return;
  list.push({
    campaignId: item.campaignId,
    message: truncateInternalJobMessage(item.message),
  });
}

function countSummaryErrors(summary: Record<string, unknown>): number {
  const n = summary.errors;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

export function deriveInternalJobRunStatus(args: {
  boundedErrors: InternalJobBoundedError[];
  summary: Record<string, unknown>;
}): InternalJobRunStatus {
  const n = countSummaryErrors(args.summary);
  if (args.boundedErrors.length > 0 || n > 0) return "partial";
  return "success";
}

export function buildNormalizedInternalJobResult(args: {
  jobType: string;
  startedAt: Date;
  finishedAt: Date;
  summary: Record<string, unknown>;
  boundedErrors?: InternalJobBoundedError[];
}): NormalizedInternalJobPayload {
  const boundedErrors = args.boundedErrors ?? [];
  const durationMs = Math.max(0, args.finishedAt.getTime() - args.startedAt.getTime());
  const partialFailure = deriveInternalJobRunStatus({
    boundedErrors,
    summary: args.summary,
  }) === "partial";

  const out: NormalizedInternalJobPayload = {
    ok: true,
    jobType: args.jobType,
    startedAt: args.startedAt.toISOString(),
    finishedAt: args.finishedAt.toISOString(),
    durationMs,
    summary: { ...args.summary },
    ...(partialFailure ? { partialFailure: true } : {}),
    ...(boundedErrors.length ? { errors: boundedErrors } : {}),
  };
  return out;
}

/** Structured one-line log (bounded size) for log aggregators. */
export function logInternalJobRunStructured(payload: NormalizedInternalJobPayload): void {
  const line = JSON.stringify({
    kind: "internal_job_run",
    jobType: payload.jobType,
    durationMs: payload.durationMs,
    partialFailure: payload.partialFailure ?? false,
    errorSamples: payload.errors?.length ?? 0,
  });
  console.info(line);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function persistInternalJobRun(
  db: Db,
  args: {
    jobType: string;
    startedAt: Date;
    finishedAt: Date;
    status: InternalJobRunStatus;
    summary: Record<string, unknown>;
    errorCount: number;
  }
): Promise<void> {
  try {
    await db.insert(internalJobRuns).values({
      id: crypto.randomUUID(),
      jobType: args.jobType,
      startedAt: args.startedAt,
      finishedAt: args.finishedAt,
      status: args.status,
      summaryJson: args.summary,
      errorCount: args.errorCount,
    });
  } catch (e) {
    console.error("[internal-batch-job-run] persistInternalJobRun failed", e);
  }
}

export async function listRecentInternalJobRuns(
  db: Db,
  options?: { limit?: number; jobType?: string }
): Promise<
  {
    id: string;
    jobType: string;
    startedAt: Date;
    finishedAt: Date;
    status: string;
    summaryJson: unknown;
    errorCount: number;
    createdAt: Date;
  }[]
> {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 25));
  const jt = options?.jobType?.trim();
  if (jt) {
    return db
      .select()
      .from(internalJobRuns)
      .where(eq(internalJobRuns.jobType, jt))
      .orderBy(desc(internalJobRuns.createdAt))
      .limit(limit);
  }
  return db.select().from(internalJobRuns).orderBy(desc(internalJobRuns.createdAt)).limit(limit);
}
