import "server-only";

import { randomUUID } from "crypto";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "@/lib/db/schema";
import {
  skipperCapabilitySuggestions,
  skipperLearningEvents,
  skipperLearningSummaries,
  skipperPromptImprovementSuggestions,
  skipperPromptOverlays,
} from "@/lib/db/schema";
import { isSkipperPromptOverlaysMissingTableError } from "@/lib/executive-agent/skipper-prompt-overlays-table-errors";

type Db = MySql2Database<typeof schema>;

const SKIPPER_PROMPT_OVERLAYS_TABLE = "skipper_prompt_overlays";

export { isSkipperPromptOverlaysMissingTableError } from "@/lib/executive-agent/skipper-prompt-overlays-table-errors";

export type SkipperPromptOverlaysTableStatus = "ready" | "missing_table" | "unavailable";

export async function probeSkipperPromptOverlaysTableStatus(db: Db): Promise<SkipperPromptOverlaysTableStatus> {
  try {
    await db.select({ id: skipperPromptOverlays.id }).from(skipperPromptOverlays).limit(1);
    return "ready";
  } catch (e) {
    if (isSkipperPromptOverlaysMissingTableError(e)) return "missing_table";
    return "unavailable";
  }
}

export async function insertSkipperLearningEvent(
  db: Db,
  row: { adminUserId: number; eventType: string; source?: string; payload: Record<string, unknown> },
) {
  const id = randomUUID();
  await db.insert(skipperLearningEvents).values({
    id,
    adminUserId: row.adminUserId,
    eventType: row.eventType.slice(0, 64),
    source: (row.source ?? "chat").slice(0, 32),
    payloadJson: JSON.stringify(row.payload).slice(0, 100_000),
  });
  return id;
}

export async function listSkipperLearningEventsSince(db: Db, adminUserId: number, since: Date, limit = 500) {
  const lim = Math.min(2000, Math.max(1, limit));
  return db
    .select()
    .from(skipperLearningEvents)
    .where(and(eq(skipperLearningEvents.adminUserId, adminUserId), gte(skipperLearningEvents.createdAt, since)))
    .orderBy(desc(skipperLearningEvents.createdAt))
    .limit(lim);
}

export async function listActiveSkipperPromptOverlaysForAdmin(db: Db, adminUserId: number, limit = 24) {
  const lim = Math.min(48, Math.max(1, limit));
  try {
    return await db
      .select({
        id: skipperPromptOverlays.id,
        title: skipperPromptOverlays.title,
        content: skipperPromptOverlays.content,
        status: skipperPromptOverlays.status,
        approvedAt: skipperPromptOverlays.approvedAt,
        createdAt: skipperPromptOverlays.createdAt,
      })
      .from(skipperPromptOverlays)
      .where(and(eq(skipperPromptOverlays.adminUserId, adminUserId), eq(skipperPromptOverlays.status, "active")))
      .orderBy(asc(skipperPromptOverlays.approvedAt), asc(skipperPromptOverlays.createdAt))
      .limit(lim);
  } catch (e) {
    if (isSkipperPromptOverlaysMissingTableError(e)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[${SKIPPER_PROMPT_OVERLAYS_TABLE}] table missing — active prompt overlays skipped (return []). Apply migrations.`,
        );
      }
      return [];
    }
    throw e;
  }
}

export async function insertSkipperLearningSummary(
  db: Db,
  row: { adminUserId: number; windowStart: Date; windowEnd: Date; compressed: Record<string, unknown> },
) {
  const id = randomUUID();
  await db.insert(skipperLearningSummaries).values({
    id,
    adminUserId: row.adminUserId,
    windowStart: row.windowStart,
    windowEnd: row.windowEnd,
    compressedJson: JSON.stringify(row.compressed).slice(0, 500_000),
  });
  return id;
}

export async function insertSkipperPromptImprovementSuggestion(
  db: Db,
  row: {
    adminUserId: number;
    summaryId: string;
    title: string;
    rationale: string;
    proposedOverlayContent: string;
  },
) {
  const id = randomUUID();
  await db.insert(skipperPromptImprovementSuggestions).values({
    id,
    adminUserId: row.adminUserId,
    summaryId: row.summaryId,
    title: row.title.slice(0, 500),
    rationale: row.rationale,
    proposedOverlayContent: row.proposedOverlayContent,
    status: "pending",
  });
  return id;
}

export async function insertSkipperCapabilitySuggestion(
  db: Db,
  row: {
    adminUserId: number;
    summaryId: string;
    title: string;
    description: string;
    suggestedFlagKey?: string | null;
  },
) {
  const id = randomUUID();
  await db.insert(skipperCapabilitySuggestions).values({
    id,
    adminUserId: row.adminUserId,
    summaryId: row.summaryId,
    title: row.title.slice(0, 500),
    description: row.description,
    suggestedFlagKey: row.suggestedFlagKey?.trim().slice(0, 120) || null,
    status: "pending",
  });
  return id;
}

export async function insertSkipperPromptOverlay(
  db: Db,
  row: {
    adminUserId: number;
    title: string;
    content: string;
    status: "pending" | "approved" | "rejected" | "active" | "archived";
    sourceSummaryId?: string | null;
    approvedAt?: Date | null;
  },
) {
  const id = randomUUID();
  await db.insert(skipperPromptOverlays).values({
    id,
    adminUserId: row.adminUserId,
    title: row.title.slice(0, 500),
    content: row.content,
    status: row.status,
    sourceSummaryId: row.sourceSummaryId?.trim() || null,
    approvedAt: row.approvedAt ?? null,
  });
  return id;
}

export async function listSkipperPromptOverlaysForAdmin(
  db: Db,
  adminUserId: number,
  opts?: { status?: (typeof schema.SKIPPER_PROMPT_OVERLAY_STATUSES)[number]; limit?: number },
) {
  const lim = Math.min(200, Math.max(1, opts?.limit ?? 80));
  const st = opts?.status;
  try {
    if (st) {
      return await db
        .select()
        .from(skipperPromptOverlays)
        .where(and(eq(skipperPromptOverlays.adminUserId, adminUserId), eq(skipperPromptOverlays.status, st)))
        .orderBy(desc(skipperPromptOverlays.createdAt))
        .limit(lim);
    }
    return await db
      .select()
      .from(skipperPromptOverlays)
      .where(eq(skipperPromptOverlays.adminUserId, adminUserId))
      .orderBy(desc(skipperPromptOverlays.createdAt))
      .limit(lim);
  } catch (e) {
    if (isSkipperPromptOverlaysMissingTableError(e)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[${SKIPPER_PROMPT_OVERLAYS_TABLE}] table missing — listSkipperPromptOverlaysForAdmin returned [].`);
      }
      return [];
    }
    throw e;
  }
}

export async function updateSkipperPromptOverlayStatus(
  db: Db,
  id: string,
  adminUserId: number,
  next: "pending" | "approved" | "rejected" | "active" | "archived",
) {
  const now = new Date();
  const approvedAt = next === "active" || next === "approved" ? now : null;
  await db
    .update(skipperPromptOverlays)
    .set({
      status: next,
      approvedAt,
    })
    .where(and(eq(skipperPromptOverlays.id, id), eq(skipperPromptOverlays.adminUserId, adminUserId)));
}

export async function getSkipperPromptImprovementSuggestionForAdmin(db: Db, id: string, adminUserId: number) {
  const [row] = await db
    .select()
    .from(skipperPromptImprovementSuggestions)
    .where(
      and(eq(skipperPromptImprovementSuggestions.id, id), eq(skipperPromptImprovementSuggestions.adminUserId, adminUserId)),
    )
    .limit(1);
  return row ?? null;
}

export async function listPendingSkipperLearningItemsForAdmin(db: Db, adminUserId: number) {
  const improvements = await db
    .select()
    .from(skipperPromptImprovementSuggestions)
    .where(
      and(
        eq(skipperPromptImprovementSuggestions.adminUserId, adminUserId),
        eq(skipperPromptImprovementSuggestions.status, "pending"),
      ),
    )
    .orderBy(desc(skipperPromptImprovementSuggestions.createdAt))
    .limit(40);

  const capabilities = await db
    .select()
    .from(skipperCapabilitySuggestions)
    .where(
      and(eq(skipperCapabilitySuggestions.adminUserId, adminUserId), eq(skipperCapabilitySuggestions.status, "pending")),
    )
    .orderBy(desc(skipperCapabilitySuggestions.createdAt))
    .limit(40);

  let overlays: (typeof skipperPromptOverlays.$inferSelect)[] = [];
  try {
    overlays = await db
      .select()
      .from(skipperPromptOverlays)
      .where(and(eq(skipperPromptOverlays.adminUserId, adminUserId), eq(skipperPromptOverlays.status, "pending")))
      .orderBy(desc(skipperPromptOverlays.createdAt))
      .limit(40);
  } catch (e) {
    if (isSkipperPromptOverlaysMissingTableError(e)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[${SKIPPER_PROMPT_OVERLAYS_TABLE}] table missing — pending overlays list empty.`);
      }
      overlays = [];
    } else {
      throw e;
    }
  }

  return { improvements, capabilities, overlays };
}

export async function updateSkipperPromptImprovementSuggestionStatus(
  db: Db,
  id: string,
  adminUserId: number,
  next: "pending" | "approved" | "rejected",
) {
  await db
    .update(skipperPromptImprovementSuggestions)
    .set({
      status: next,
      resolvedAt: next === "pending" ? null : new Date(),
    })
    .where(
      and(eq(skipperPromptImprovementSuggestions.id, id), eq(skipperPromptImprovementSuggestions.adminUserId, adminUserId)),
    );
}

export async function updateSkipperCapabilitySuggestionStatus(
  db: Db,
  id: string,
  adminUserId: number,
  next: "pending" | "approved" | "rejected",
) {
  await db
    .update(skipperCapabilitySuggestions)
    .set({
      status: next,
      resolvedAt: next === "pending" ? null : new Date(),
    })
    .where(and(eq(skipperCapabilitySuggestions.id, id), eq(skipperCapabilitySuggestions.adminUserId, adminUserId)));
}
