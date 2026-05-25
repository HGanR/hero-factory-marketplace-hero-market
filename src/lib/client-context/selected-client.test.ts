import test from "node:test";
import assert from "node:assert/strict";
import {
  getSelectedClientId,
  SELECTED_CLIENT_STORAGE_KEY,
  setSelectedClientId,
} from "./selected-client";

test("setSelectedClientId stores and getSelectedClientId retrieves", () => {
  const store = new Map<string, string>();
  const events: string[] = [];
  (globalThis as unknown as { window: Window & typeof globalThis }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: () => null,
      clear: () => store.clear(),
      length: 0,
    },
    dispatchEvent: () => {
      events.push("event");
      return true;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as Window & typeof globalThis;

  assert.equal(getSelectedClientId(), null);
  setSelectedClientId("abc-def-uuid");
  assert.equal(store.get(SELECTED_CLIENT_STORAGE_KEY), "abc-def-uuid");
  assert.equal(getSelectedClientId(), "abc-def-uuid");
  assert.ok(events.length >= 1);
  setSelectedClientId(null);
  assert.equal(store.has(SELECTED_CLIENT_STORAGE_KEY), false);
  assert.equal(getSelectedClientId(), null);

  delete (globalThis as unknown as { window?: unknown }).window;
});
