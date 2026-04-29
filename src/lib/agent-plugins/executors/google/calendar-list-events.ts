import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { agentActionSuccess } from "@/lib/agent-plugins/action-result";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";

export type CalendarListEventsInput = {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
};

export type CalendarListEventsItem = {
  id: string;
  summary?: string;
  start?: string;
  end?: string;
  htmlLink?: string;
};

/**
 * GET calendar/v3/calendars/primary/events — upcoming events in a window (normalized).
 */
export async function executeCalendarListEvents(ctx: AgentExecutionContext, input: unknown) {
  const body = (input && typeof input === "object" ? input : {}) as CalendarListEventsInput;
  const timeMin =
    typeof body.timeMin === "string" ? body.timeMin : new Date().toISOString();
  const timeMax =
    typeof body.timeMax === "string" && body.timeMax.trim()
      ? body.timeMax
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const maxResults = Math.min(50, Math.max(1, typeof body.maxResults === "number" ? body.maxResults : 10));

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", String(maxResults));

  const json = (await fetchGoogleJson(ctx, url.toString(), { method: "GET" })) as {
    items?: Array<{
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      htmlLink?: string;
    }>;
  };

  const events: CalendarListEventsItem[] = [];
  for (const ev of json.items ?? []) {
    if (typeof ev.id !== "string") continue;
    const start = ev.start?.dateTime ?? ev.start?.date ?? "";
    const end = ev.end?.dateTime ?? ev.end?.date ?? "";
    events.push({
      id: ev.id,
      summary: typeof ev.summary === "string" ? ev.summary : undefined,
      start: start || undefined,
      end: end || undefined,
      htmlLink: typeof ev.htmlLink === "string" ? ev.htmlLink : undefined,
    });
  }

  const data = { timeMin, timeMax, maxResults, events };
  return agentActionSuccess("calendar.listEvents", ctx.agentId, data as Record<string, unknown>);
}
