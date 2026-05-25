import test from "node:test";
import assert from "node:assert/strict";
import { microTerminalServiceProgress } from "./micro-terminal-service-progress";

test("microTerminalServiceProgress is 0% when no services", () => {
  const r = microTerminalServiceProgress(0, 0);
  assert.equal(r.progressPercent, 0);
  assert.equal(r.totalServices, 0);
  assert.equal(r.completedServices, 0);
});

test("microTerminalServiceProgress placeholder completion is 0%", () => {
  const r = microTerminalServiceProgress(4, 0);
  assert.equal(r.progressPercent, 0);
  assert.equal(r.totalServices, 4);
  assert.equal(r.completedServices, 0);
});
