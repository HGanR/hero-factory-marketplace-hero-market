import test from "node:test";
import assert from "node:assert/strict";
import { resolveMicroTerminalClientIdForFetch } from "@/lib/dashboard/micro-terminal-client-id";

test("resolveMicroTerminalClientIdForFetch prefers selected when binding diverges", () => {
  assert.equal(
    resolveMicroTerminalClientIdForFetch("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "11111111-2222-3333-4444-555555555555"),
    "11111111-2222-3333-4444-555555555555"
  );
});

test("resolveMicroTerminalClientIdForFetch uses binding when alone", () => {
  assert.equal(resolveMicroTerminalClientIdForFetch("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", null), "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
});

test("resolveMicroTerminalClientIdForFetch uses selected when binding empty", () => {
  assert.equal(resolveMicroTerminalClientIdForFetch(null, "11111111-2222-3333-4444-555555555555"), "11111111-2222-3333-4444-555555555555");
});

test("resolveMicroTerminalClientIdForFetch uses binding when both match", () => {
  const id = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  assert.equal(resolveMicroTerminalClientIdForFetch(id, id), id);
});
