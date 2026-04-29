import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { agentActionSuccess } from "@/lib/agent-plugins/action-result";
import { fetchGoogleJson } from "@/lib/agent-plugins/google-fetch";

export type CalendarFreeBusyInput = {
  timeMin?: string;
  timeMax?: string;
};

export type CalendarFreeBusyData = {
  timeMin: string;
  timeMax: string;
  busy: Array<{ start: string; end: string }>;
};

/**
 * POST calendar/v3/freeBusy — primary calendar busy intervals only (normalized).
 */
export async function executeCalendarFreeBusy(ctx: AgentExecutionContext, input: unknown) {
  const body = (input && typeof input === "object" ? input : {}) as CalendarFreeBusyInput;
  const timeMin =
    typeof body.timeMin === "string" ? body.timeMin : new Date().toISOString();
  const timeMax =
    typeof body.timeMax === "string"
      ? body.timeMax
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const json = (await fetchGoogleJson(ctx, "https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    }),
  })) as {
    calendars?: Record<string, { busy?: Array<{ start?: string; end?: string }> }>;
  };

  const primary = json.calendars?.primary;
  const busy: Array<{ start: string; end: string }> = [];
  for (const b of primary?.busy ?? []) {
    if (typeof b.start === "string" && typeof b.end === "string") {
      busy.push({ start: b.start, end: b.end });
    }
  }

  const data: CalendarFreeBusyData = { timeMin, timeMax, busy };
  return agentActionSuccess("calendar.freeBusy", ctx.agentId, data);
}
