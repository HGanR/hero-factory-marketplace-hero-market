import { createHash } from "node:crypto";
import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { agentActionSuccess } from "@/lib/agent-plugins/action-result";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";
import { AgentToolValidationError } from "@/lib/agent-plugins/agent-tool-validation-error";
import { getDb } from "@/lib/db";
import { ensureAgentTables } from "@/lib/db/agents-ensure";
import { agentToolFingerprint } from "@/lib/db/schema";

export type CalendarCreateEventInput = {
  summary?: string;
  startDateTime?: string;
  endDateTime?: string;
  timeZone?: string;
};

export type CalendarCreateEventData = {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  htmlLink?: string;
};

function isValidIanaTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function inputFingerprint(summary: string, startIso: string, endIso: string, tz: string): string {
  return createHash("sha256").update([summary, startIso, endIso, tz].join("|")).digest("hex");
}

/**
 * POST calendar/v3/calendars/primary/events — creates a single calendar event.
 */
export async function executeCalendarCreateEvent(ctx: AgentExecutionContext, input: unknown) {
  const body = (input && typeof input === "object" ? input : {}) as CalendarCreateEventInput;
  const summary =
    typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : "Event";

  const startIso =
    typeof body.startDateTime === "string" && body.startDateTime.trim()
      ? body.startDateTime.trim()
      : new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endIso =
    typeof body.endDateTime === "string" && body.endDateTime.trim()
      ? body.endDateTime.trim()
      : new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();

  const timeZone =
    typeof body.timeZone === "string" && body.timeZone.trim() ? body.timeZone.trim() : "UTC";

  if (!isValidIanaTimeZone(timeZone)) {
    throw new AgentToolValidationError(
      `Invalid time zone "${timeZone}". Use an IANA name such as America/New_York or UTC.`,
      "CALENDAR_VALIDATION"
    );
  }

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    throw new AgentToolValidationError(
      "startDateTime and endDateTime must be valid ISO 8601 date/time strings.",
      "CALENDAR_VALIDATION"
    );
  }
  if (endMs <= startMs) {
    throw new AgentToolValidationError("endDateTime must be after startDateTime.", "CALENDAR_VALIDATION");
  }

  if (endMs - startMs > 1000 * 60 * 60 * 24 * 14) {
    throw new AgentToolValidationError("Event duration cannot exceed 14 days.", "CALENDAR_VALIDATION");
  }

  const fp = inputFingerprint(summary, startIso, endIso, timeZone);

  await ensureAgentTables();
  const db = await getDb();
  const [existing] = await db
    .select({ id: agentToolFingerprint.id })
    .from(agentToolFingerprint)
    .where(
      and(
        eq(agentToolFingerprint.agentId, ctx.agentId),
        eq(agentToolFingerprint.actionKey, "calendar.createEvent"),
        eq(agentToolFingerprint.inputHash, fp)
      )
    )
    .limit(1);

  if (existing) {
    throw new AgentToolValidationError(
      "An identical calendar event was already created for this agent. Change the time or title, or open Google Calendar to edit the existing event.",
      "DUPLICATE_CALENDAR_EVENT"
    );
  }

  const json = (await fetchGoogleJson(ctx, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary,
      start: { dateTime: startIso, timeZone },
      end: { dateTime: endIso, timeZone },
    }),
  })) as {
    id?: string;
    summary?: string;
    htmlLink?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
  };

  const eventId = typeof json.id === "string" ? json.id : "";
  if (!eventId) {
    throw new AgentToolValidationError("Calendar did not return an event id.", "PROVIDER_ERROR");
  }

  try {
    await db.insert(agentToolFingerprint).values({
      id: crypto.randomUUID(),
      agentId: ctx.agentId,
      actionKey: "calendar.createEvent",
      inputHash: fp,
      resourceId: eventId.slice(0, 255),
    });
  } catch (dbErr) {
    console.warn("[calendar.createEvent] fingerprint insert failed", dbErr);
  }

  const data: CalendarCreateEventData = {
    eventId,
    summary: typeof json.summary === "string" ? json.summary : summary,
    start: json.start?.dateTime ?? startIso,
    end: json.end?.dateTime ?? endIso,
    htmlLink: typeof json.htmlLink === "string" ? json.htmlLink : undefined,
  };
  return agentActionSuccess("calendar.createEvent", ctx.agentId, data);
}
