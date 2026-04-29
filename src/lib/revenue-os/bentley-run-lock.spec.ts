/**
 * @jest-environment jsdom
 */
import {
  BENTLEY_RUN_LOCK_STORAGE_KEY,
  isRunLockHeld,
  releaseRunLock,
  tryAcquireRunLock,
} from "./bentley-run-lock";

describe("bentley-run-lock", () => {
  beforeEach(() => {
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  it("acquires when empty and reports held until released", () => {
    expect(isRunLockHeld()).toBe(false);
    expect(tryAcquireRunLock(60_000)).toBe(true);
    expect(isRunLockHeld()).toBe(true);
    const raw = sessionStorage.getItem(BENTLEY_RUN_LOCK_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const { expiresAt } = JSON.parse(raw!);
    expect(expiresAt).toBeGreaterThan(Date.now());

    releaseRunLock();
    expect(isRunLockHeld()).toBe(false);
    expect(sessionStorage.getItem(BENTLEY_RUN_LOCK_STORAGE_KEY)).toBeNull();
  });

  it("fails to acquire when an unexpired lock exists", () => {
    expect(tryAcquireRunLock(60_000)).toBe(true);
    expect(tryAcquireRunLock(60_000)).toBe(false);
    releaseRunLock();
  });

  it("allows acquire after TTL expiry", () => {
    const past = Date.now() - 1000;
    sessionStorage.setItem(BENTLEY_RUN_LOCK_STORAGE_KEY, JSON.stringify({ expiresAt: past }));
    expect(tryAcquireRunLock(60_000)).toBe(true);
    releaseRunLock();
  });

  it("recovers from corrupt lock JSON by acquiring", () => {
    sessionStorage.setItem(BENTLEY_RUN_LOCK_STORAGE_KEY, "not-json");
    expect(tryAcquireRunLock(60_000)).toBe(true);
    releaseRunLock();
  });
});
