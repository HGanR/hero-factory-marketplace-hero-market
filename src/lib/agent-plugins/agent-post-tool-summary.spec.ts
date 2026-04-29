import { AGENT_ACTION_RESULT_VERSION } from "@/lib/agent-plugins/action-result";
import { buildAuditDescriptor } from "@/lib/agent-plugins/audit-tool-call";
import { compactAgentActionForLlm } from "@/lib/agent-plugins/compact-tool-result";
import type { AgentActionSuccess } from "@/lib/agent-plugins/action-result";

describe("compactAgentActionForLlm + buildAuditDescriptor (post-tool consistency)", () => {
  const agentId = "agent-1";

  it("calendar.createEvent: compact exposes ids; audit descriptor includes event id", () => {
    const result: AgentActionSuccess = {
      v: AGENT_ACTION_RESULT_VERSION,
      actionKey: "calendar.createEvent",
      agentId,
      data: {
        eventId: "evt_123",
        summary: "Sync",
        start: "2026-04-01T15:00:00Z",
        end: "2026-04-01T16:00:00Z",
        htmlLink: "https://calendar.google.com/evt",
      },
    };
    const c = compactAgentActionForLlm(result);
    expect(c.eventId).toBe("evt_123");
    expect(buildAuditDescriptor({ actionKey: "calendar.createEvent", ok: true, result })).toBe(
      "ok|calendar.createEvent|evt_123"
    );
  });

  it("calendar.listEvents: compact uses eventCount; audit uses n= form", () => {
    const result: AgentActionSuccess = {
      v: AGENT_ACTION_RESULT_VERSION,
      actionKey: "calendar.listEvents",
      agentId,
      data: {
        timeMin: "2026-04-01T00:00:00Z",
        timeMax: "2026-04-02T00:00:00Z",
        events: [{ id: "a" }, { id: "b" }],
      },
    };
    const c = compactAgentActionForLlm(result);
    expect(c.eventCount).toBe(2);
    expect(buildAuditDescriptor({ actionKey: "calendar.listEvents", ok: true, result })).toBe(
      "ok|calendar.listEvents|n=2"
    );
  });

  it("calendar.freeBusy: audit uses busy count", () => {
    const result: AgentActionSuccess = {
      v: AGENT_ACTION_RESULT_VERSION,
      actionKey: "calendar.freeBusy",
      agentId,
      data: {
        timeMin: "t0",
        timeMax: "t1",
        busy: [{ start: "a", end: "b" }],
      },
    };
    expect(buildAuditDescriptor({ actionKey: "calendar.freeBusy", ok: true, result })).toBe(
      "ok|calendar.freeBusy|busy=1"
    );
  });

  it("failure path: descriptor is err|code without leaking inputs", () => {
    expect(buildAuditDescriptor({ actionKey: "gmail.createDraft", ok: false, code: "CONFIRMATION_REQUIRED" })).toBe(
      "err|CONFIRMATION_REQUIRED"
    );
    expect(buildAuditDescriptor({ actionKey: "calendar.createEvent", ok: false, code: "DUPLICATE_CALENDAR_EVENT" })).toBe(
      "err|DUPLICATE_CALENDAR_EVENT"
    );
  });

  it("gmail drafts: success descriptors use stable ids when present", () => {
    const draft: AgentActionSuccess = {
      v: AGENT_ACTION_RESULT_VERSION,
      actionKey: "gmail.createDraft",
      agentId,
      data: { draftId: "draft-abc", messageId: "msg-1", threadId: "th-1" },
    };
    expect(buildAuditDescriptor({ actionKey: "gmail.createDraft", ok: true, result: draft })).toContain(
      "draft-abc"
    );
  });

  it("gmail.sendDraft: success includes draftId; failure can include draft id hint", () => {
    const sent: AgentActionSuccess = {
      v: AGENT_ACTION_RESULT_VERSION,
      actionKey: "gmail.sendDraft",
      agentId,
      data: { draftId: "draft-xyz", messageId: "msg-2", threadId: "th-2" },
    };
    expect(buildAuditDescriptor({ actionKey: "gmail.sendDraft", ok: true, result: sent })).toContain("draft-xyz");
    expect(
      buildAuditDescriptor({
        actionKey: "gmail.sendDraft",
        ok: false,
        code: "GMAIL_VALIDATION",
        inputDraftIdHint: "draft-xyz",
      })
    ).toBe("err|GMAIL_VALIDATION|draft=draft-xyz");
  });
});
