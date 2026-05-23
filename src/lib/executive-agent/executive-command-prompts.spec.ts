import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  executiveCommandPromptForOperationalKind,
  resolveExecutiveCommandPromptFromVoice,
} from "@/lib/executive-agent/executive-command-prompts";

describe("executive-command-prompts", () => {
  it("resolves Skipper voice open commands", () => {
    assert.equal(resolveExecutiveCommandPromptFromVoice("Skipper, show site analytics"), "analytics");
    assert.equal(resolveExecutiveCommandPromptFromVoice("Skipper, open Jarva activity"), "agent_activity");
    assert.equal(resolveExecutiveCommandPromptFromVoice("check new registrations"), "new_registrations");
    assert.equal(resolveExecutiveCommandPromptFromVoice("show Executive Inbox"), "inbox_signals");
    assert.equal(resolveExecutiveCommandPromptFromVoice("open Smart Trust"), "revenue_os_smart_trust");
    assert.equal(resolveExecutiveCommandPromptFromVoice("show KPI forecasting"), "kpi_forecasting");
  });

  it("maps operational voice kinds to HUD modules", () => {
    assert.equal(executiveCommandPromptForOperationalKind("site_analytics"), "analytics");
    assert.equal(executiveCommandPromptForOperationalKind("executive_inbox"), "inbox_signals");
    assert.equal(executiveCommandPromptForOperationalKind("new_registrations"), "new_registrations");
  });
});
