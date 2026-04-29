import type { AgentActionSuccess } from "@/lib/agent-plugins/action-result";

/** Small JSON-safe payloads for tool messages back to the LLM. */
export function compactAgentActionForLlm(result: AgentActionSuccess): Record<string, unknown> {
  const { actionKey, data } = result;
  const d = data as Record<string, unknown>;

  switch (actionKey) {
    case "calendar.freeBusy": {
      const busy = Array.isArray(d.busy) ? d.busy.slice(0, 48) : [];
      return { ok: true, timeMin: d.timeMin, timeMax: d.timeMax, busyCount: busy.length, busy };
    }
    case "calendar.listEvents": {
      const events = Array.isArray(d.events) ? d.events.slice(0, 20) : [];
      return {
        ok: true,
        timeMin: d.timeMin,
        timeMax: d.timeMax,
        eventCount: events.length,
        events,
      };
    }
    case "gmail.listMessages": {
      const messages = Array.isArray(d.messages) ? d.messages.slice(0, 25) : [];
      return { ok: true, resultSizeEstimate: d.resultSizeEstimate, messages };
    }
    case "gmail.createDraft": {
      return { ok: true, draftId: d.draftId, messageId: d.messageId, threadId: d.threadId };
    }
    case "gmail.sendDraft": {
      return {
        ok: true,
        draftId: d.draftId,
        messageId: d.messageId,
        threadId: d.threadId,
      };
    }
    case "calendar.createEvent": {
      return {
        ok: true,
        eventId: d.eventId,
        summary: d.summary,
        start: d.start,
        end: d.end,
        htmlLink: d.htmlLink,
      };
    }
    case "drive.listFiles": {
      const files = Array.isArray(d.files) ? d.files.slice(0, 20) : [];
      return { ok: true, files };
    }
    default:
      return { ok: true, data: d };
  }
}
