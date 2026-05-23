import "server-only";

import { randomUUID } from "crypto";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  createExecutiveMemoryItem,
  listExecutiveMemoryItems,
} from "@/lib/executive-agent/executive-memory-store";
import type {
  ExecutiveSessionCheckpoint,
  ExecutiveUrgencyLevel,
  OperationalIntelligenceState,
} from "@/lib/executive-agent/executive-presence-types";

type Db = MySql2Database<typeof schema>;

const CHECKPOINT_SUBJECT = "executive_session_checkpoint";
const PREFERENCE_SUBJECT = "executive_session_preference";
const PATTERN_SUBJECT = "executive_priority_pattern";

export type StoredExecutiveSessionCheckpoint = ExecutiveSessionCheckpoint & { id: string };

function parseCheckpointSummary(summary: string): ExecutiveSessionCheckpoint | null {
  try {
    const o = JSON.parse(summary) as ExecutiveSessionCheckpoint;
    if (typeof o.checkedInAt === "string" && typeof o.postureSummary === "string") return o;
  } catch {
    /* ignore */
  }
  return null;
}

export async function getLastExecutiveSessionCheckpoint(
  db: Db,
  adminUserId: number,
): Promise<StoredExecutiveSessionCheckpoint | null> {
  const rows = await listExecutiveMemoryItems(db, {
    adminUserId,
    limit: 12,
    memoryTypes: ["system_note"],
  });
  for (const row of rows) {
    if (row.subjectType !== CHECKPOINT_SUBJECT) continue;
    const parsed = parseCheckpointSummary(row.summary);
    if (parsed) return { ...parsed, id: row.id };
  }
  return null;
}

export async function recordExecutiveSessionCheckpoint(
  db: Db,
  adminUserId: number,
  checkpoint: Omit<ExecutiveSessionCheckpoint, "checkedInAt"> & { checkedInAt?: string },
): Promise<string | null> {
  const payload: ExecutiveSessionCheckpoint = {
    checkedInAt: checkpoint.checkedInAt ?? new Date().toISOString(),
    postureSummary: checkpoint.postureSummary.slice(0, 2000),
    orbState: checkpoint.orbState,
    urgency: checkpoint.urgency,
    pendingApprovals: checkpoint.pendingApprovals,
    openIncidents: checkpoint.openIncidents,
    topAction: checkpoint.topAction?.slice(0, 500) ?? null,
  };
  const row = await createExecutiveMemoryItem(db, adminUserId, {
    memoryType: "system_note",
    subjectType: CHECKPOINT_SUBJECT,
    subjectId: payload.checkedInAt.slice(0, 10),
    title: `Executive check-in ${payload.checkedInAt.slice(0, 19)}`,
    summary: JSON.stringify(payload),
    source: "system",
    confidence: 0.95,
  });
  return row?.id ?? null;
}

export async function loadExecutiveSessionPreferences(db: Db, adminUserId: number) {
  const rows = await listExecutiveMemoryItems(db, {
    adminUserId,
    limit: 24,
    memoryTypes: ["preference", "agent_pattern"],
  });
  const preferenceNotes: string[] = [];
  const priorityPatterns: string[] = [];
  for (const row of rows) {
    if (row.subjectType === PREFERENCE_SUBJECT) {
      preferenceNotes.push(`${row.title}: ${row.summary.slice(0, 240)}`);
    } else if (row.subjectType === PATTERN_SUBJECT) {
      priorityPatterns.push(`${row.title}: ${row.summary.slice(0, 240)}`);
    }
  }
  return { preferenceNotes: preferenceNotes.slice(0, 6), priorityPatterns: priorityPatterns.slice(0, 6) };
}

export async function rememberExecutivePreference(
  db: Db,
  adminUserId: number,
  input: { title: string; summary: string; source?: "voice" | "chat" },
): Promise<string | null> {
  const row = await createExecutiveMemoryItem(db, adminUserId, {
    memoryType: "preference",
    subjectType: PREFERENCE_SUBJECT,
    subjectId: randomUUID().slice(0, 8),
    title: input.title.slice(0, 200),
    summary: input.summary.slice(0, 2000),
    source: input.source ?? "voice",
    confidence: 0.85,
  });
  return row?.id ?? null;
}

export function formatSessionContinuityForPrompt(input: {
  lastCheckpoint: StoredExecutiveSessionCheckpoint | null;
  preferenceNotes: string[];
  priorityPatterns: string[];
}): string {
  const parts: string[] = [];
  if (input.lastCheckpoint) {
    parts.push(
      `Last executive check-in (${input.lastCheckpoint.checkedInAt}): ${input.lastCheckpoint.postureSummary}. Prior urgency=${input.lastCheckpoint.urgency}, approvals=${input.lastCheckpoint.pendingApprovals}, incidents=${input.lastCheckpoint.openIncidents}.`,
    );
    if (input.lastCheckpoint.topAction) {
      parts.push(`Prior recommended action: ${input.lastCheckpoint.topAction}`);
    }
  }
  if (input.preferenceNotes.length) {
    parts.push(`Executive preferences: ${input.preferenceNotes.join(" | ")}`);
  }
  if (input.priorityPatterns.length) {
    parts.push(`Operational priority patterns: ${input.priorityPatterns.join(" | ")}`);
  }
  return parts.join("\n");
}

export type { ExecutiveUrgencyLevel, OperationalIntelligenceState };
