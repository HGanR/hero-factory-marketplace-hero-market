import test from "node:test";
import assert from "node:assert/strict";
import {
  applyExecutiveBentleyIntakeAnswer,
  executiveBentleyIntakeComplete,
} from "@/lib/revenue-os/executive-bentley-intake";
import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import {
  isExecutiveBentleyCampaignStartPhrase,
  isExecutiveBentleyPipelineRunPhrase,
  tryExecutiveBentleyClientVoiceTurn,
} from "@/lib/revenue-os/executive-bentley-voice-orchestrator";
import { buildExecutiveBentleyWorkflowStages } from "@/lib/revenue-os/executive-bentley-workflow-state";
import { assessExecutiveBentleyLaunchGovernance } from "@/lib/revenue-os/executive-bentley-launch-governance";

function baseSnap(): BentleySnapshot {
  return {
    industryKey: null,
    contentIndustry: "",
    targetAudience: "",
    traffic: 0,
    conversionRate: 0,
    aov: 0,
    businessName: "",
    coreOffer: "",
    transformation: "",
    platforms: [],
    postingPlatforms: [],
    tone: "Professional",
    contentType: "Full Post",
    imageStyle: "cinematic",
    campaignNotes: "",
  };
}

test("executive bentley voice detects campaign start phrases", () => {
  assert.equal(isExecutiveBentleyCampaignStartPhrase("let's create an afternoon campaign"), true);
  assert.equal(isExecutiveBentleyCampaignStartPhrase("open analytics"), false);
});

test("applyExecutiveBentleyIntakeAnswer uses real orchestrator for industry", () => {
  const snap = baseSnap();
  const r = applyExecutiveBentleyIntakeAnswer(snap, "Consulting");
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.match(r.confirm, /industry/i);
    assert.equal(r.patch?.contentIndustry, "Consulting");
  }
});

test("launch governance blocks auto publish", () => {
  const snap = { ...baseSnap(), businessName: "Acme", contentIndustry: "Consulting", targetAudience: "Founders" };
  const gov = assessExecutiveBentleyLaunchGovernance(snap);
  assert.equal(gov.canAutoPublish, false);
  assert.equal(gov.canBypassApproval, false);
  assert.equal(gov.canProposeLaunch, false);
});

test("workflow stages include intake and approval queue", () => {
  const snap = { ...baseSnap(), businessName: "Acme", contentIndustry: "SaaS", targetAudience: "SMB" };
  const stages = buildExecutiveBentleyWorkflowStages(snap, {
    completed: {},
    artifacts: {},
    phase: "intake",
  } as import("@/lib/revenue-os/bentley-workflow").BentleyWorkflowState);
  assert.ok(stages.some((s) => s.id === "intake"));
  assert.ok(stages.some((s) => s.id === "approval_queue"));
});

test("voice orchestrator handles pipeline run phrase when intake incomplete", () => {
  const r = tryExecutiveBentleyClientVoiceTurn({
    transcript: "run the pipeline",
    getSnapshot: baseSnap,
    adminUserId: "admin-1",
    clientId: "client-1",
    intakeActive: false,
    campaignModeActive: true,
  });
  assert.equal(r.handled, true);
  assert.match(r.answer, /isn't complete/i);
});

test("pipeline run phrase detected", () => {
  assert.equal(isExecutiveBentleyPipelineRunPhrase("run full analysis"), true);
});
