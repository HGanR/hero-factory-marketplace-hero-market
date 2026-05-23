import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAffirmativeVoice,
  isRegistrationPhoneRequest,
  resolvePhoneQueueVoiceCommand,
  resolveVoiceOperationalQuery,
} from "@/lib/executive-agent/executive-voice-operational-phrases";
import {
  buildExecutiveInboxVoiceAnswer,
  buildJarvaActivityVoiceAnswer,
  buildNewRegistrationsVoiceAnswer,
} from "@/lib/executive-agent/executive-voice-operational-voice";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";

describe("executive-voice-operational-phrases", () => {
  it("detects Jarva and Smart Trust activity questions", () => {
    assert.equal(
      resolveVoiceOperationalQuery("Hey Skipper, has Jarva had any conversations today?"),
      "jarva_activity",
    );
    assert.equal(resolveVoiceOperationalQuery("what's the jarva activity today"), "jarva_activity");
    assert.equal(
      resolveVoiceOperationalQuery("has there been any Smart Trust activity"),
      "smart_trust_activity",
    );
  });

  it("detects inbox, reality, and registration queries", () => {
    assert.equal(
      resolveVoiceOperationalQuery("are there any new messages in the Executive Inbox"),
      "executive_inbox",
    );
    assert.equal(resolveVoiceOperationalQuery("anything in my inbox today"), "executive_inbox");
    assert.equal(resolveVoiceOperationalQuery("has Reality had any activity today"), "reality_activity");
    assert.equal(
      resolveVoiceOperationalQuery("has there been any new visitors or new registrations"),
      "new_registrations",
    );
    assert.equal(resolveVoiceOperationalQuery("new registrations today"), "new_registrations");
    assert.ok(isRegistrationPhoneRequest("what is the phone number for the new accounts"));
  });

  it("maps phone queue voice commands", () => {
    assert.equal(resolvePhoneQueueVoiceCommand("next number"), "next");
    assert.equal(resolvePhoneQueueVoiceCommand("repeat number"), "repeat");
    assert.equal(resolvePhoneQueueVoiceCommand("skip"), "skip");
    assert.equal(resolvePhoneQueueVoiceCommand("stop"), "stop");
  });

  it("recognizes affirmative voice", () => {
    assert.ok(isAffirmativeVoice("yes"));
    assert.ok(isAffirmativeVoice("yes boss"));
  });
});

describe("executive-voice-operational-voice copy", () => {
  it("builds natural empty Jarva response", () => {
    const answer = buildJarvaActivityVoiceAnswer([]);
    assert.match(answer, /Jarva's desk/i);
    assert.doesNotMatch(answer, /Smart Trust/i);
    assert.doesNotMatch(answer, /tool/i);
  });

  it("builds Jarva activity summary with account name", () => {
    const answer = buildJarvaActivityVoiceAnswer([
      {
        sessionId: "s1",
        accountDisplayName: "AcmeTrust",
        identityStatus: "approved",
        timestamp: new Date().toISOString(),
        conversationSummary: "trust structuring steps",
        userRequestExcerpts: ["How do I set up a trust?"],
        jarvaWorkflowPath: "trust_records",
        marketplaceUserId: 1,
      },
    ]);
    assert.match(answer, /AcmeTrust/);
    assert.match(answer, /trust structuring/i);
    assert.match(answer, /Jarva spoke with/i);
  });

  it("offers audio playback for inbox with natural phrasing", () => {
    const { answer, pendingAudio } = buildExecutiveInboxVoiceAnswer([
      {
        messageId: "m1",
        senderName: "Pat",
        subjectOrPreview: "Voice note attached",
        receivedAt: new Date().toISOString(),
        hasAttachment: true,
        hasAudioAttachment: true,
        firstAudioAttachmentId: "a1",
        attachmentCount: 1,
      },
    ]);
    assert.match(answer, /your inbox/i);
    assert.match(answer, /voice note/i);
    assert.doesNotMatch(answer, /inbox signal/i);
    assert.equal(pendingAudio?.attachmentId, "a1");
  });

  it("uses sign-up language for registrations and offers phone naturally", () => {
    const { answer, offerPhone } = buildNewRegistrationsVoiceAnswer(
      [
        {
          userId: 2,
          accountDisplayName: "jo***n",
          createdAt: new Date().toISOString(),
          emailMasked: "j***@e***.com",
          phoneAvailable: true,
          isApproved: false,
        },
      ],
      3,
    );
    assert.match(answer, /sign-up/i);
    assert.match(answer, /visitor/i);
    assert.match(answer, /follow-up/i);
    assert.equal(offerPhone, true);
    assert.doesNotMatch(answer, /\d{3}-\d{3}-\d{4}/);
  });
});

describe("read-tool-picker operational tools", () => {
  it("routes jarva and registration prompts", () => {
    const jarva = pickExecutiveReadTools("has jarva had conversations today", null);
    assert.ok(jarva.includes("getJarvaActivityToday"));
    const reg = pickExecutiveReadTools("any new registrations today", null);
    assert.ok(reg.includes("getNewRegistrationsToday"));
  });
});
