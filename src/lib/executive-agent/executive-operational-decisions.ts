import type {
  EXECUTIVE_OPERATIONAL_DECISION_SOURCE_KINDS,
  EXECUTIVE_OPERATIONAL_DECISION_STATUSES,
  EXECUTIVE_OPERATIONAL_THREAD_PRIORITIES,
} from "@/lib/db/schema.platform-extras";
import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type ExecutiveOperationalDecisionStatus =
  (typeof EXECUTIVE_OPERATIONAL_DECISION_STATUSES)[number];
export type ExecutiveOperationalDecisionSourceKind =
  (typeof EXECUTIVE_OPERATIONAL_DECISION_SOURCE_KINDS)[number];
export type ExecutiveOperationalDecisionPriority =
  (typeof EXECUTIVE_OPERATIONAL_THREAD_PRIORITIES)[number];

export type ExecutiveOperationalDecisionDto = {
  id: string;
  title: string;
  promptSummary: string;
  status: ExecutiveOperationalDecisionStatus;
  priority: ExecutiveOperationalDecisionPriority;
  sourceKind: ExecutiveOperationalDecisionSourceKind;
  threadId: string | null;
  questionMessageId: string | null;
  promotedFromMessageId: string | null;
  approvalId: string | null;
  orderId: string | null;
  clientId: string | null;
  subjectId: ExecutiveSubjectId | null;
  department: FulfillmentOrchestrationDepartment | null;
  decisionText: string | null;
  decidedAt: string | null;
  decidedByAdminUserId: number | null;
  deferredUntil: string | null;
  deferReason: string | null;
  supersededByDecisionId: string | null;
  supersedesDecisionId: string | null;
  createdAt: string;
  updatedAt: string;
  threadTitle?: string | null;
  urgent: boolean;
};

export type ExecutivePendingDecisionsDto = {
  ok: true;
  pending: ExecutiveOperationalDecisionDto[];
  deferred: ExecutiveOperationalDecisionDto[];
  recentlyDecided: ExecutiveOperationalDecisionDto[];
  promotedCount: number;
  skipperDecisionContext: string;
  generatedAt: string;
};

export type CreateExecutiveDecisionInput = {
  title: string;
  promptSummary: string;
  priority?: ExecutiveOperationalDecisionPriority;
  sourceKind?: ExecutiveOperationalDecisionSourceKind;
  threadId?: string | null;
  questionMessageId?: string | null;
  approvalId?: string | null;
  orderId?: string | null;
  clientId?: string | null;
  subjectId?: ExecutiveSubjectId | null;
  department?: FulfillmentOrchestrationDepartment | null;
  supersedesDecisionId?: string | null;
};

const STATUS_SET = new Set<string>(["open", "decided", "deferred", "superseded"]);
const SOURCE_SET = new Set<string>(["manual", "decision_request", "question", "approval"]);
const PRIORITY_SET = new Set<string>(["low", "normal", "high", "urgent"]);

export function isExecutiveOperationalDecisionStatus(v: string): v is ExecutiveOperationalDecisionStatus {
  return STATUS_SET.has(v);
}

export function isExecutiveOperationalDecisionSourceKind(
  v: string
): v is ExecutiveOperationalDecisionSourceKind {
  return SOURCE_SET.has(v);
}

export function isExecutiveOperationalDecisionPriority(
  v: string
): v is ExecutiveOperationalDecisionPriority {
  return PRIORITY_SET.has(v);
}

export function isDecisionUrgent(d: Pick<ExecutiveOperationalDecisionDto, "status" | "deferredUntil">): boolean {
  if (d.status !== "open" && d.status !== "deferred") return false;
  if (d.status === "open") return true;
  if (!d.deferredUntil) return false;
  return new Date(d.deferredUntil).getTime() <= Date.now();
}

export function buildSkipperPendingDecisionsContext(input: {
  pending: ExecutiveOperationalDecisionDto[];
  deferred: ExecutiveOperationalDecisionDto[];
}): string {
  const lines = [
    "Executive decision ledger — human-only; Skipper may recommend but must not decide or execute approvals.",
  ];
  if (input.pending.length) {
    lines.push(
      `Pending decisions (${input.pending.length}): ${input.pending
        .slice(0, 6)
        .map((d) => `${d.title} [${d.priority}${d.department ? ` · ${d.department}` : ""}]`)
        .join("; ")}`
    );
  }
  if (input.deferred.length) {
    lines.push(
      `Deferred (${input.deferred.length}): ${input.deferred
        .slice(0, 4)
        .map((d) => `${d.title} until ${d.deferredUntil?.slice(0, 10) ?? "TBD"}`)
        .join("; ")}`
    );
  }
  if (!input.pending.length && !input.deferred.length) {
    lines.push("No pending owner decisions in queue.");
  }
  return lines.join(" ");
}
