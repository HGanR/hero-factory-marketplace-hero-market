import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { aiAgents } from "@/lib/db/schema";
import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { getValidGoogleAccessTokenForAgent } from "@/lib/agent-plugins/google-token";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  startIso: string;
  endIso: string;
  htmlLink?: string;
};

export async function resolveGoogleCalendarAgentContextForMeetHost(
  userId: number
): Promise<AgentExecutionContext | null> {
  const db = await getDb();
  const agents = await db.select().from(aiAgents).where(eq(aiAgents.userId, userId)).limit(40);
  for (const a of agents) {
    const accessToken = await getValidGoogleAccessTokenForAgent(a.id);
    if (accessToken) return { agentId: a.id, userId, accessToken };
  }
  return null;
}

function parseEventTimes(body: Record<string, unknown>): { startIso: string; endIso: string; timeZone: string | null } {
  const start = body.start as Record<string, unknown> | undefined;
  const end = body.end as Record<string, unknown> | undefined;
  const startIso =
    typeof start?.dateTime === "string"
      ? String(start.dateTime)
      : typeof start?.date === "string"
        ? `${String(start.date)}T00:00:00.000Z`
        : "";
  const endIso =
    typeof end?.dateTime === "string"
      ? String(end.dateTime)
      : typeof end?.date === "string"
        ? `${String(end.date)}T23:59:59.000Z`
        : "";
  const timeZone = typeof start?.timeZone === "string" ? String(start.timeZone) : null;
  return { startIso, endIso, timeZone };
}

export async function googleCalendarGetEvent(
  ctx: AgentExecutionContext,
  calendarId: string,
  eventId: string
): Promise<{
  summary: string;
  description: string | null;
  startIso: string;
  endIso: string;
  timeZone: string | null;
  htmlLink?: string | null;
}> {
  const cal = encodeURIComponent(calendarId);
  const ev = encodeURIComponent(eventId);
  const json = (await fetchGoogleJson(
    ctx,
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${ev}`
  )) as Record<string, unknown>;
  const { startIso, endIso, timeZone } = parseEventTimes(json);
  return {
    summary: String(json.summary ?? ""),
    description: json.description != null ? String(json.description) : null,
    startIso,
    endIso,
    timeZone,
    htmlLink: json.htmlLink != null ? String(json.htmlLink) : null,
  };
}

export async function googleCalendarCreateEvent(
  ctx: AgentExecutionContext,
  calendarId: string,
  body: {
    summary: string;
    description?: string | null;
    startIso: string;
    endIso: string;
    timeZone: string;
  }
): Promise<{ eventId: string; htmlLink: string | null }> {
  const cal = encodeURIComponent(calendarId);
  const payload = {
    summary: body.summary,
    description: body.description ?? undefined,
    start: { dateTime: body.startIso, timeZone: body.timeZone },
    end: { dateTime: body.endIso, timeZone: body.timeZone },
  };
  const json = (await fetchGoogleJson(ctx, `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as { id?: string; htmlLink?: string };
  return { eventId: String(json.id ?? ""), htmlLink: json.htmlLink != null ? String(json.htmlLink) : null };
}

export async function googleCalendarUpdateEvent(
  ctx: AgentExecutionContext,
  calendarId: string,
  eventId: string,
  body: {
    summary: string;
    description: string | null | undefined;
    startIso: string;
    endIso: string;
    timeZone: string;
  }
): Promise<{ htmlLink: string | null }> {
  const cal = encodeURIComponent(calendarId);
  const ev = encodeURIComponent(eventId);
  const payload = {
    summary: body.summary,
    description: body.description ?? undefined,
    start: { dateTime: body.startIso, timeZone: body.timeZone },
    end: { dateTime: body.endIso, timeZone: body.timeZone },
  };
  const json = (await fetchGoogleJson(ctx, `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${ev}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })) as { htmlLink?: string };
  return { htmlLink: json.htmlLink != null ? String(json.htmlLink) : null };
}

export async function googleCalendarListUpcoming(
  ctx: AgentExecutionContext,
  calendarId: string,
  opts: { timeMinIso: string; timeMaxIso: string; maxResults: number }
): Promise<GoogleCalendarListItem[]> {
  const cal = encodeURIComponent(calendarId);
  const params = new URLSearchParams({
    timeMin: opts.timeMinIso,
    timeMax: opts.timeMaxIso,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(opts.maxResults),
  });
  const json = (await fetchGoogleJson(
    ctx,
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events?${params.toString()}`
  )) as { items?: Array<Record<string, unknown>> };
  const items = Array.isArray(json.items) ? json.items : [];
  const out: GoogleCalendarListItem[] = [];
  for (const it of items) {
    const { startIso, endIso } = parseEventTimes(it);
    out.push({
      id: String(it.id ?? ""),
      summary: String(it.summary ?? "(no title)"),
      startIso,
      endIso,
      htmlLink: it.htmlLink != null ? String(it.htmlLink) : undefined,
    });
  }
  return out;
}
