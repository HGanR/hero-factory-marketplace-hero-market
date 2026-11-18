import assert from "node:assert/strict";
import test from "node:test";
import { canManagePropertyAssignments, canPublishAssignedAgent, validateAssignment, visiblePropertyAssignment } from "./property-agent-assignment";

const base = { worldId: "default", buildingId: "nexus-tower", source: "npc" as const, agentId: "npc-1", status: "published" as const };

test("only administrators manage assignments", () => {
  assert.equal(canManagePropertyAssignments(null), false);
  assert.equal(canManagePropertyAssignments({ isAdmin: false }), false);
  assert.equal(canManagePropertyAssignments({ isAdmin: true }), true);
});
test("unlisted properties have no public sign", () => {
  assert.equal(visiblePropertyAssignment({ ...base, status: "unlisted" }, { source: "npc" }), null);
});
test("AI Agency drafts never publish", () => {
  const draft = { ...base, source: "ai-agency" as const };
  assert.equal(canPublishAssignedAgent({ source: "ai-agency", activationStatus: "draft" }), false);
  assert.equal(visiblePropertyAssignment(draft, { source: "ai-agency", activationStatus: "draft" }), null);
  assert.deepEqual(visiblePropertyAssignment(draft, { source: "ai-agency", activationStatus: "active" }), draft);
});
test("existing NPC assignments can publish", () => {
  assert.deepEqual(visiblePropertyAssignment(base, { source: "npc" }), base);
});
test("rejects invalid assignment values", () => {
  assert.throws(() => validateAssignment({ ...base, source: "unknown" }));
  assert.throws(() => validateAssignment({ ...base, buildingId: "../bad" }));
  assert.deepEqual(validateAssignment(base), base);
});
