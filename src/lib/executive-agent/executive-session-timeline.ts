import type { ExecutiveSessionTimelineEntry } from "@/lib/executive-agent/executive-presence-types";
import type { StoredExecutiveSessionCheckpoint } from "@/lib/executive-agent/executive-session-memory";

export type TimelineBuildInput = {
  now: string;
  lastCheckpoint: StoredExecutiveSessionCheckpoint | null;
  incidents: string[];
  newEscalations: string[];
  approvalDelta: number;
  resolvedSinceLast: string[];
  operatorShifts: string[];
  workflowChanges: string[];
  sessionNote: string | null;
};

export function buildExecutiveSessionTimeline(input: TimelineBuildInput): ExecutiveSessionTimelineEntry[] {
  const since = input.lastCheckpoint?.checkedInAt ?? null;
  const entries: ExecutiveSessionTimelineEntry[] = [];

  if (input.sessionNote) {
    entries.push({
      id: "session:current",
      category: "session",
      summary: input.sessionNote,
      occurredAt: input.now,
      deltaSinceLastSession: true,
    });
  }

  for (const s of input.resolvedSinceLast) {
    entries.push({
      id: `resolved:${s.slice(0, 24)}`,
      category: "resolved",
      summary: s,
      occurredAt: input.now,
      deltaSinceLastSession: Boolean(since),
    });
  }

  for (const s of input.incidents) {
    entries.push({
      id: `incident:${s.slice(0, 24)}`,
      category: "incident",
      summary: s,
      occurredAt: input.now,
      deltaSinceLastSession: Boolean(since),
    });
  }

  for (const s of input.newEscalations) {
    entries.push({
      id: `escalation:${s.slice(0, 24)}`,
      category: "escalation",
      summary: s,
      occurredAt: input.now,
      deltaSinceLastSession: Boolean(since),
    });
  }

  if (input.approvalDelta !== 0) {
    entries.push({
      id: "approval:delta",
      category: "approval",
      summary:
        input.approvalDelta > 0
          ? `${input.approvalDelta} new approval(s) entered the queue since last check-in.`
          : `${Math.abs(input.approvalDelta)} approval(s) cleared since last check-in.`,
      occurredAt: input.now,
      deltaSinceLastSession: Boolean(since),
    });
  }

  for (const s of input.operatorShifts) {
    entries.push({
      id: `operator:${s.slice(0, 24)}`,
      category: "operator",
      summary: s,
      occurredAt: input.now,
      deltaSinceLastSession: Boolean(since),
    });
  }

  for (const s of input.workflowChanges) {
    entries.push({
      id: `workflow:${s.slice(0, 24)}`,
      category: "workflow",
      summary: s,
      occurredAt: input.now,
      deltaSinceLastSession: Boolean(since),
    });
  }

  if (!since && entries.length === 0) {
    entries.push({
      id: "session:first",
      category: "session",
      summary: "First executive session on this desk — establishing operational baseline.",
      occurredAt: input.now,
      deltaSinceLastSession: false,
    });
  }

  return entries.slice(0, 20);
}

export function countSessionsSince(checkpoint: StoredExecutiveSessionCheckpoint | null): number {
  return checkpoint ? 1 : 0;
}
