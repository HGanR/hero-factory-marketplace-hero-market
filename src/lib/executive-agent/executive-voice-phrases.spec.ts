import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildAnalyticsClarificationResponse,
  buildSkipperGreetingResponse,
  buildVoiceAnalyticsFollowUpPrompt,
  hasSpecificAnalyticsMetric,
  isSkipperGreeting,
  isTodayAnalyticsQuestion,
  resolveAnalyticsFollowUpCategory,
} from "@/lib/executive-agent/executive-voice-phrases";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("executive-voice-phrases", () => {
  it("detects Skipper greetings", () => {
    assert.equal(isSkipperGreeting("Hello Skipper"), true);
    assert.equal(isSkipperGreeting("hey skipper"), true);
    assert.equal(isSkipperGreeting("Good morning Skipper!"), true);
    assert.equal(isSkipperGreeting("Good afternoon skipper."), true);
    assert.equal(isSkipperGreeting("Good evening Skipper?"), true);
    assert.equal(isSkipperGreeting("skipper"), true);
    assert.equal(isSkipperGreeting("Hello Skipper what are today's analytics"), false);
  });

  it("returns fixed greeting and clarification copy", () => {
    assert.equal(buildSkipperGreetingResponse(), "Good day, Boss. How can I help you today?");
    assert.ok(buildAnalyticsClarificationResponse().includes("Chief?"));
  });

  it("detects vague today analytics questions", () => {
    assert.equal(isTodayAnalyticsQuestion("What are today's analytics?"), true);
    assert.equal(isTodayAnalyticsQuestion("what are the days analytics"), true);
    assert.equal(isTodayAnalyticsQuestion("Today's analytics"), true);
    assert.equal(isTodayAnalyticsQuestion("analytics for today"), true);
    assert.equal(isTodayAnalyticsQuestion("How are we doing today"), true);
  });

  it("does not clarify when a specific metric is already named", () => {
    assert.equal(isTodayAnalyticsQuestion("What are today's site visits?"), false);
    assert.equal(isTodayAnalyticsQuestion("today's analytics for conversions"), false);
    assert.equal(hasSpecificAnalyticsMetric("show me revenue today"), true);
    assert.equal(hasSpecificAnalyticsMetric("paypal status"), true);
    assert.equal(hasSpecificAnalyticsMetric("join community count"), true);
    assert.equal(hasSpecificAnalyticsMetric("campaign performance today"), true);
  });

  it("resolves analytics follow-up categories", () => {
    assert.equal(resolveAnalyticsFollowUpCategory("site visits"), "site_visits");
    assert.equal(resolveAnalyticsFollowUpCategory("visits"), "site_visits");
    assert.equal(resolveAnalyticsFollowUpCategory("active users"), "active_users");
    assert.equal(resolveAnalyticsFollowUpCategory("traffic sources"), "traffic_sources");
    assert.equal(resolveAnalyticsFollowUpCategory("conversions"), "conversions");
    assert.equal(resolveAnalyticsFollowUpCategory("hello"), null);
  });

  it("follow-up prompt references analytics voice follow-up", () => {
    const p = buildVoiceAnalyticsFollowUpPrompt("site_visits");
    assert.match(p, /Voice follow-up/i);
    assert.match(p, /platform analytics/i);
  });
});

describe("executive voice turn route (static)", () => {
  it("does not import executeExecutiveApprovedAction (writes stay in orchestrator approvals path)", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const s = readFileSync(p, "utf8");
    assert.ok(!s.includes("executeExecutiveApprovedAction"));
    assert.ok(s.includes("isSkipperGreeting"));
    assert.ok(s.includes("getLatestExecutiveVoiceTurnForSession"));
    assert.ok(s.includes('requestedTool: "getPlatformAnalyticsSummary"'));
  });
});
