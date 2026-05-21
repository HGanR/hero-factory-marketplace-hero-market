import type { ExecutiveSubjectId } from "@/lib/executive-agent/executive-subject-nav";
import type {
  EXECUTIVE_OPERATIONAL_MESSAGE_KINDS,
  EXECUTIVE_OPERATIONAL_THREAD_KINDS,
  EXECUTIVE_OPERATIONAL_THREAD_PRIORITIES,
  EXECUTIVE_OPERATIONAL_THREAD_STATUSES,
} from "@/lib/db/schema.platform-extras";
import type { FulfillmentOrchestrationDepartment } from "@/lib/fulfillment/fulfillment-orchestration-types";

export type ExecutiveOperationalThreadKind = (typeof EXECUTIVE_OPERATIONAL_THREAD_KINDS)[number];
export type ExecutiveOperationalThreadStatus = (typeof EXECUTIVE_OPERATIONAL_THREAD_STATUSES)[number];
export type ExecutiveOperationalThreadPriority = (typeof EXECUTIVE_OPERATIONAL_THREAD_PRIORITIES)[number];
export type ExecutiveOperationalMessageKind = (typeof EXECUTIVE_OPERATIONAL_MESSAGE_KINDS)[number];

export type ExecutiveOperationalThreadDto = {
  id: string;
  title: string;
  threadKind: ExecutiveOperationalThreadKind;
  status: ExecutiveOperationalThreadStatus;
  priority: ExecutiveOperationalThreadPriority;
  subjectId: ExecutiveSubjectId | null;
  department: FulfillmentOrchestrationDepartment | null;
  clientId: string | null;
  orderId: string | null;
  approvalId: string | null;
  decisionNeeded: boolean;
  pinnedNoteText: string | null;
  memorySummary: string | null;
  unresolvedQuestionCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessagePreview?: string | null;
};

export type ExecutiveOperationalThreadMessageDto = {
  id: string;
  threadId: string;
  adminUserId: number;
  bodyText: string;
  messageKind: ExecutiveOperationalMessageKind;
  priorityTag: string | null;
  isPinned: boolean;
  ownerOnly: boolean;
  createdAt: string;
};

export type ExecutiveOperationalThreadsListDto = {
  ok: true;
  threads: ExecutiveOperationalThreadDto[];
  activeDiscussion: ExecutiveOperationalThreadDto | null;
  unresolvedQuestions: string[];
  pendingDecisions: Array<{ threadId: string; title: string; approvalId: string | null }>;
  skipperThreadContext: string;
  generatedAt: string;
};

export type ExecutiveOperationalThreadDetailDto = {
  ok: true;
  thread: ExecutiveOperationalThreadDto;
  messages: ExecutiveOperationalThreadMessageDto[];
  timelineEntries: Array<{
    id: string;
    label: string;
    occurredAt: string;
    detail: string | null;
  }>;
  skipperThreadContext: string;
  generatedAt: string;
};

export type ListOperationalThreadsFilter = {
  subjectId?: string | null;
  clientId?: string | null;
  orderId?: string | null;
  approvalId?: string | null;
  threadKind?: ExecutiveOperationalThreadKind | null;
  status?: ExecutiveOperationalThreadStatus | null;
  decisionNeeded?: boolean | null;
  limit?: number;
};

export type CreateOperationalThreadInput = {
  title: string;
  threadKind: ExecutiveOperationalThreadKind;
  subjectId?: ExecutiveSubjectId | null;
  department?: FulfillmentOrchestrationDepartment | null;
  clientId?: string | null;
  orderId?: string | null;
  approvalId?: string | null;
  priority?: ExecutiveOperationalThreadPriority;
  decisionNeeded?: boolean;
  status?: ExecutiveOperationalThreadStatus;
  pinnedNoteText?: string | null;
  initialMessage?: string | null;
};

export type PostOperationalThreadMessageInput = {
  bodyText: string;
  messageKind?: ExecutiveOperationalMessageKind;
  priorityTag?: string | null;
  isPinned?: boolean;
  ownerOnly?: boolean;
};

const THREAD_KIND_SET = new Set<string>([
  "subject",
  "department",
  "fulfillment_case",
  "approval",
  "internal_note",
]);

const THREAD_STATUS_SET = new Set<string>(["open", "monitoring", "resolved", "archived"]);
const THREAD_PRIORITY_SET = new Set<string>(["low", "normal", "high", "urgent"]);
const MESSAGE_KIND_SET = new Set<string>([
  "discussion",
  "operational_note",
  "question",
  "decision_request",
  "status_update",
  "owner_annotation",
]);

export function isExecutiveOperationalThreadKind(v: string): v is ExecutiveOperationalThreadKind {
  return THREAD_KIND_SET.has(v);
}

export function isExecutiveOperationalThreadStatus(v: string): v is ExecutiveOperationalThreadStatus {
  return THREAD_STATUS_SET.has(v);
}

export function isExecutiveOperationalThreadPriority(v: string): v is ExecutiveOperationalThreadPriority {
  return THREAD_PRIORITY_SET.has(v);
}

export function isExecutiveOperationalMessageKind(v: string): v is ExecutiveOperationalMessageKind {
  return MESSAGE_KIND_SET.has(v);
}

export function normalizeDepartment(
  raw: string | null | undefined
): FulfillmentOrchestrationDepartment | null {
  const d = raw?.trim().toUpperCase();
  if (d === "WEBSITE" || d === "TRUST") return d;
  return null;
}

export function countUnresolvedQuestions(messages: Array<{ messageKind: string; bodyText: string }>): number {
  return messages.filter((m) => m.messageKind === "question" && m.bodyText.trim().length > 0).length;
}

export function buildSkipperThreadAwarenessLines(input: {
  activeThread: ExecutiveOperationalThreadDto | null;
  threads: ExecutiveOperationalThreadDto[];
  unresolvedQuestions: string[];
  pendingDecisions: Array<{ threadId: string; title: string }>;
  relatedOrderId?: string | null;
  relatedApprovalId?: string | null;
}): string[] {
  const lines: string[] = [
    "Internal operational threads only — no client messaging, email, SMS, or autonomous replies.",
  ];
  if (input.activeThread) {
    lines.push(
      `Active discussion: ${input.activeThread.title} (${input.activeThread.status}, ${input.activeThread.priority})`
    );
    if (input.activeThread.decisionNeeded) lines.push("Decision needed on active thread.");
    if (input.activeThread.memorySummary) {
      lines.push(`Thread memory: ${input.activeThread.memorySummary.slice(0, 400)}`);
    }
  }
  if (input.relatedOrderId) {
    const caseThreads = input.threads.filter((t) => t.orderId === input.relatedOrderId);
    if (caseThreads.length) {
      lines.push(`Fulfillment case threads: ${caseThreads.map((t) => t.title).join("; ")}`);
    }
  }
  if (input.relatedApprovalId) {
    const appr = input.threads.filter((t) => t.approvalId === input.relatedApprovalId);
    if (appr.length) lines.push(`Approval discussion: ${appr[0]!.title}`);
  }
  if (input.unresolvedQuestions.length) {
    lines.push(`Unresolved questions (${input.unresolvedQuestions.length}): ${input.unresolvedQuestions.slice(0, 3).join(" | ")}`);
  }
  if (input.pendingDecisions.length) {
    lines.push(
      `Pending decisions: ${input.pendingDecisions.slice(0, 4).map((d) => d.title).join("; ")}`
    );
  }
  const urgent = input.threads.filter((t) => t.priority === "urgent" || t.priority === "high");
  if (urgent.length) {
    lines.push(`Priority threads: ${urgent.slice(0, 5).map((t) => `${t.title} (${t.priority})`).join("; ")}`);
  }
  return lines;
}

export function formatSkipperThreadContext(lines: string[]): string {
  return lines.filter(Boolean).join(" ");
}

/** Merge operational thread activity into fulfillment timeline (read-only). */
export function operationalThreadsToTimelineEntries(input: {
  threads: ExecutiveOperationalThreadDto[];
  messages: ExecutiveOperationalThreadMessageDto[];
}): Array<{
  id: string;
  kind: "orchestration_note";
  label: string;
  occurredAt: string;
  department: FulfillmentOrchestrationDepartment | null;
  orderId: string | null;
  detail: string | null;
}> {
  const byThread = new Map<string, ExecutiveOperationalThreadMessageDto[]>();
  for (const m of input.messages) {
    const list = byThread.get(m.threadId) ?? [];
    list.push(m);
    byThread.set(m.threadId, list);
  }

  const entries: Array<{
    id: string;
    kind: "orchestration_note";
    label: string;
    occurredAt: string;
    department: FulfillmentOrchestrationDepartment | null;
    orderId: string | null;
    detail: string | null;
  }> = [];

  for (const t of input.threads) {
    const msgs = (byThread.get(t.id) ?? []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const latest = msgs[0];
    if (!latest) continue;
    entries.push({
      id: `op-thread-${t.id}-${latest.id}`,
      kind: "orchestration_note",
      label: `[Ops thread] ${t.title}`,
      occurredAt: latest.createdAt,
      department: t.department,
      orderId: t.orderId,
      detail: latest.bodyText.slice(0, 280),
    });
  }
  return entries.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}
