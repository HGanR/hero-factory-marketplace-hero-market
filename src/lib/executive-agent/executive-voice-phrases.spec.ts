import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  buildAnalyticsClarificationResponse,
  buildSkipperGreetingResponse,
  buildTimeAwareSkipperGreeting,
  buildVoiceAnalyticsFollowUpPrompt,
  hasSpecificAnalyticsMetric,
  isSkipperGreeting,
  isTodayAnalyticsQuestion,
  resolveAnalyticsFollowUpCategory,
} from "@/lib/executive-agent/executive-voice-phrases";
import {
  handleSkipperVoiceGreeting,
  resolveGreetingPeriodFromTranscript,
  resolveTimeOfDayPeriod,
} from "@/lib/executive-agent/executive-presence-voice";
import { resolveVoiceOperationalQuery } from "@/lib/executive-agent/executive-voice-operational-phrases";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MORNING = new Date("2026-05-18T09:30:00");
const AFTERNOON = new Date("2026-05-18T14:30:00");
const EVENING = new Date("2026-05-18T19:30:00");

describe("executive-voice-phrases", () => {
  it("detects Skipper greetings", () => {
    assert.equal(isSkipperGreeting("Hello Skipper"), true);
    assert.equal(isSkipperGreeting("hey skipper"), true);
    assert.equal(isSkipperGreeting("Hey Skipper"), true);
    assert.equal(isSkipperGreeting("Hey Skipper Boss"), true);
    assert.equal(isSkipperGreeting("hey skipper what's up"), true);
    assert.equal(isSkipperGreeting("Good morning Skipper!"), true);
    assert.equal(isSkipperGreeting("Good afternoon skipper."), true);
    assert.equal(isSkipperGreeting("Good evening Skipper?"), true);
    assert.equal(isSkipperGreeting("skipper"), true);
    assert.equal(isSkipperGreeting("Hello Skipper what are today's analytics"), false);
    assert.equal(isSkipperGreeting("Hey Skipper, has Jarva had any conversations today?"), false);
  });

  it("returns time-aware default greeting from clock", () => {
    assert.equal(buildSkipperGreetingResponse(MORNING), "Good morning Boss, what can I do for you?");
    assert.equal(buildSkipperGreetingResponse(AFTERNOON), "Good afternoon Boss, what can I do for you?");
    assert.equal(buildSkipperGreetingResponse(EVENING), "Good evening Boss, what can I do for you?");
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

describe("Skipper fresh voice greeting", () => {
  it('"Hello Skipper" returns only a natural greeting', () => {
    const result = handleSkipperVoiceGreeting("Hello Skipper", { now: MORNING, isFreshSession: true });
    assert.equal(result.answer, "Good morning Boss, what can I do for you?");
    assert.equal(result.voiceShortCircuit, "fresh_greeting");
    assert.equal(result.greetingOnly, true);
  });

  it('"Hey Skipper" on fresh session returns greeting only', () => {
    const result = handleSkipperVoiceGreeting("Hey Skipper", { now: AFTERNOON, isFreshSession: true });
    assert.equal(result.answer, "Good afternoon Boss, what can I do for you?");
    assert.equal(result.freshSession, true);
  });

  it("greeting response does not mention tool registry or insight blocks", () => {
    const result = handleSkipperVoiceGreeting("Hello Skipper", { now: MORNING });
    const lower = result.answer.toLowerCase();
    assert.ok(!lower.includes("insight block"));
    assert.ok(!lower.includes("tool registry"));
    assert.ok(!lower.includes("read-only tool"));
    assert.ok(!lower.includes("retrieve summaries"));
  });

  it("greeting handler marks fresh_greeting short-circuit for ambient skip", () => {
    const result = handleSkipperVoiceGreeting("Good evening Skipper", { now: MORNING });
    assert.equal(result.answer, "Good evening Boss, what can I do for you?");
    assert.equal(result.voiceShortCircuit, "fresh_greeting");
  });

  it('"Hey Skipper has Jarva had activity today?" is not greeting-only and routes to Jarva', () => {
    assert.equal(isSkipperGreeting("Hey Skipper, has Jarva had any conversations today?"), false);
    assert.equal(resolveVoiceOperationalQuery("Hey Skipper, has Jarva had any conversations today?"), "jarva_activity");
  });

  it("time-aware greeting respects clock and explicit hail period", () => {
    assert.equal(resolveTimeOfDayPeriod(MORNING), "morning");
    assert.equal(resolveTimeOfDayPeriod(AFTERNOON), "afternoon");
    assert.equal(resolveTimeOfDayPeriod(EVENING), "evening");
    assert.equal(resolveGreetingPeriodFromTranscript("Good evening Skipper"), "evening");
    assert.equal(buildTimeAwareSkipperGreeting("Hello Skipper", MORNING), "Good morning Boss, what can I do for you?");
    assert.equal(
      buildTimeAwareSkipperGreeting("Good morning Skipper", EVENING),
      "Good morning Boss, what can I do for you?",
    );
  });
});

describe("executive voice turn route (static)", () => {
  it("routes greetings through fresh handler without presence snapshot or orchestrator", () => {
    const p = join(__dirname, "../../app/api/admin/executive-agent/voice/turn/route.ts");
    const s = readFileSync(p, "utf8");
    assert.ok(!s.includes("executeExecutiveApprovedAction"));
    assert.ok(s.includes("isSkipperGreeting"));
    assert.ok(s.includes("handleSkipperVoiceGreeting"));
    assert.ok(!s.includes("buildExecutivePresenceSnapshot"));
    assert.ok(!s.includes("presence.voiceGuidance.greetingBriefing"));
    assert.ok(s.includes("fresh_greeting"));
    assert.ok(s.includes("getLatestExecutiveVoiceTurnForSession"));
    assert.ok(s.includes('requestedTool: "getPlatformAnalyticsSummary"'));
  });
});
