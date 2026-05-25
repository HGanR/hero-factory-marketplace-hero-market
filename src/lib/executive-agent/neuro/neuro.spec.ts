import test from "node:test";
import assert from "node:assert/strict";
import { chunkNeuroDocumentText, estimateTokens } from "@/lib/executive-agent/neuro/neuro-chunking";
import {
  NEURO_NO_SOURCE_MESSAGE,
  neuroDisclaimerForSubject,
} from "@/lib/executive-agent/neuro/neuro-governance";
import {
  inferNeuroSourceType,
  isNeuroAssignedAgent,
  isNeuroSubjectArea,
  mapSubjectToDefaultAgent,
} from "@/lib/executive-agent/neuro/neuro-types";
import { validateNeuroUploadFile } from "@/lib/executive-agent/neuro/neuro-upload-validation";
import { pickExecutiveReadTools } from "@/lib/executive-agent/executive-agent-read-tool-picker";

test("chunkNeuroDocumentText creates indexed chunks with citation labels", () => {
  const text = "Section A\n\n" + "Trustee duties include loyalty. ".repeat(40);
  const chunks = chunkNeuroDocumentText(text, { fileName: "trust-guide.pdf", chunkSize: 200, overlap: 40 });
  assert.ok(chunks.length >= 2);
  assert.match(chunks[0]!.citationLabel, /trust-guide/);
  assert.ok(estimateTokens(chunks[0]!.text) > 0);
});

test("inferNeuroSourceType detects pdf and markdown", () => {
  assert.equal(inferNeuroSourceType("policy.pdf", "application/pdf"), "pdf");
  assert.equal(inferNeuroSourceType("notes.md", "text/markdown"), "markdown");
});

test("mapSubjectToDefaultAgent maps trust to JARVA", () => {
  assert.equal(mapSubjectToDefaultAgent("TRUST"), "JARVA");
  assert.equal(mapSubjectToDefaultAgent("AI_REVENUE_OS"), "BENTLEY");
});

test("isNeuroSubjectArea and isNeuroAssignedAgent validate enums", () => {
  assert.equal(isNeuroSubjectArea("TRUST"), true);
  assert.equal(isNeuroSubjectArea("INVALID"), false);
  assert.equal(isNeuroAssignedAgent("SKIPPER"), true);
});

test("validateNeuroUploadFile rejects empty files", () => {
  const f = new File([], "empty.pdf", { type: "application/pdf" });
  assert.equal(validateNeuroUploadFile(f).ok, false);
});

test("neuroDisclaimerForSubject applies to sensitive subjects", () => {
  assert.ok(neuroDisclaimerForSubject("TRUST")?.includes("not legal"));
  assert.equal(neuroDisclaimerForSubject("GENERAL"), null);
});

test("pickExecutiveReadTools selects getNeuroSourceAnswer for NEURO queries", () => {
  const tools = pickExecutiveReadTools("what do our trust law sources say about trustees?", null, null);
  assert.ok(tools.includes("getNeuroSourceAnswer"));
});

test("NEURO_NO_SOURCE_MESSAGE is governance-safe", () => {
  assert.match(NEURO_NO_SOURCE_MESSAGE, /do not have a NEURO source/i);
});
