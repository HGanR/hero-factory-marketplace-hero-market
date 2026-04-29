import {
  fetchTrustRecordsMeActive,
  handleTrustRecordsMeActiveCrossTabStorageEvent,
  invalidateTrustRecordsMeActiveCache,
  resetTrustRecordsMeActiveClientForTests,
  subscribeTrustRecordsMeActiveInvalidation,
  subscribeTrustRecordsServerActiveUpdated,
  TRUST_RECORDS_SERVER_ACTIVE_CROSS_TAB_KEY,
  TRUST_RECORDS_SERVER_ACTIVE_UPDATED_EVENT,
  type TrustRecordsMeActive,
} from "@/lib/trust-records-me-client";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}

describe("fetchTrustRecordsMeActive", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetTrustRecordsMeActiveClientForTests();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    resetTrustRecordsMeActiveClientForTests();
    global.fetch = originalFetch;
  });

  it("parses ok response into TrustRecordsMeActive (shape unchanged)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: "trust-uuid", clientId: "client-uuid" },
      })
    );

    const snap = await fetchTrustRecordsMeActive();
    expect(snap).toEqual({
      trustId: "trust-uuid",
      clientId: "client-uuid",
    } satisfies TrustRecordsMeActive);
  });

  it("converts ids to string and allows null active ids on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: null, clientId: null },
      })
    );

    const snap = await fetchTrustRecordsMeActive();
    expect(snap).toEqual({ trustId: null, clientId: null });
  });

  it("concurrent calls reuse one in-flight request", async () => {
    let release!: (r: Response) => void;
    const barrier = new Promise<Response>((res) => {
      release = res;
    });

    (global.fetch as jest.Mock).mockImplementation(() => barrier);

    const p1 = fetchTrustRecordsMeActive();
    const p2 = fetchTrustRecordsMeActive();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    release(
      jsonResponse({
        ok: true,
        active: { trustId: "t-concurrent", clientId: "c1" },
      })
    );

    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toEqual(b);
    expect(a).toEqual({ trustId: "t-concurrent", clientId: "c1" });
  });

  it("reuses a recent successful snapshot within TTL", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: "t-ttl", clientId: null },
      })
    );

    await fetchTrustRecordsMeActive({ ttlMs: 60_000 });
    await fetchTrustRecordsMeActive({ ttlMs: 60_000 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("force: true bypasses TTL and fetches again", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: "first", clientId: null },
      })
    );

    await fetchTrustRecordsMeActive({ ttlMs: 60_000 });

    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: "second", clientId: null },
      })
    );

    const snap = await fetchTrustRecordsMeActive({ force: true, ttlMs: 60_000 });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(snap).toEqual({ trustId: "second", clientId: null });
  });

  it("does not cache HTTP or ok:false failures (null returns)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ ok: false }, { status: 401 }));

    await fetchTrustRecordsMeActive();
    await fetchTrustRecordsMeActive();

    expect(global.fetch).toHaveBeenCalledTimes(2);

    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: "recovered", clientId: null },
      })
    );
    const snap = await fetchTrustRecordsMeActive();
    expect(snap?.trustId).toBe("recovered");
  });

  it("does not cache network throw failures", async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network"));

    await expect(fetchTrustRecordsMeActive()).resolves.toBeNull();
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({ ok: true, active: { trustId: "ok-after-network", clientId: null } })
    );
    const snap = await fetchTrustRecordsMeActive();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(snap?.trustId).toBe("ok-after-network");
  });

  it("invalidateTrustRecordsMeActiveCache clears TTL so next read refetches without force", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: "before-inv", clientId: null },
      })
    );

    await fetchTrustRecordsMeActive({ ttlMs: 60_000 });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    invalidateTrustRecordsMeActiveCache({ notify: false });

    (global.fetch as jest.Mock).mockResolvedValue(
      jsonResponse({
        ok: true,
        active: { trustId: "after-inv", clientId: null },
      })
    );

    const snap = await fetchTrustRecordsMeActive({ ttlMs: 60_000 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(snap?.trustId).toBe("after-inv");
  });

  it("invalidateTrustRecordsMeActiveCache dispatches same-tab event by default", () => {
    const dispatch = jest.fn();
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Record<string, unknown> }).window = {
      dispatchEvent: dispatch,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      localStorage: { setItem: jest.fn() },
    };
    try {
      invalidateTrustRecordsMeActiveCache();
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0][0]).toMatchObject({ type: TRUST_RECORDS_SERVER_ACTIVE_UPDATED_EVENT });
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });

  it("invalidateTrustRecordsMeActiveCache with notify:false does not dispatch (failed-mutation paths use this pattern via omission of invalidate)", () => {
    const dispatch = jest.fn();
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Record<string, unknown> }).window = {
      dispatchEvent: dispatch,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      localStorage: { setItem: jest.fn() },
    };
    try {
      invalidateTrustRecordsMeActiveCache({ notify: false });
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });

  it("invalidateTrustRecordsMeActiveCache passes detail on CustomEvent when provided", () => {
    const dispatch = jest.fn((ev: CustomEvent) => ev);
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Record<string, unknown> }).window = {
      dispatchEvent: dispatch,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      localStorage: { setItem: jest.fn() },
    };
    try {
      invalidateTrustRecordsMeActiveCache({ detail: { source: "test" } });
      expect(dispatch).toHaveBeenCalledTimes(1);
      const ev = dispatch.mock.calls[0][0] as CustomEvent;
      expect(ev.detail).toEqual({ source: "test" });
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });

  it("subscribeTrustRecordsMeActiveInvalidation is an alias of subscribeTrustRecordsServerActiveUpdated", () => {
    expect(subscribeTrustRecordsMeActiveInvalidation).toBe(subscribeTrustRecordsServerActiveUpdated);
  });

  it("invalidateTrustRecordsMeActiveCache writes cross-tab localStorage key by default", () => {
    const setItem = jest.fn();
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Record<string, unknown> }).window = {
      localStorage: { setItem },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    try {
      invalidateTrustRecordsMeActiveCache({ notify: false });
      expect(setItem).toHaveBeenCalledWith(TRUST_RECORDS_SERVER_ACTIVE_CROSS_TAB_KEY, expect.any(String));
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });

  it("invalidateTrustRecordsMeActiveCache with syncCrossTab:false does not write localStorage", () => {
    const setItem = jest.fn();
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Record<string, unknown> }).window = {
      localStorage: { setItem },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    try {
      invalidateTrustRecordsMeActiveCache({ notify: false, syncCrossTab: false });
      expect(setItem).not.toHaveBeenCalled();
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });

  it("handleTrustRecordsMeActiveCrossTabStorageEvent clears TTL cache so next read refetches (cross-tab path)", async () => {
    const mockLS = {} as Storage;
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Record<string, unknown> }).window = {
      localStorage: mockLS,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    try {
      (global.fetch as jest.Mock).mockResolvedValue(
        jsonResponse({
          ok: true,
          active: { trustId: "tab-a", clientId: null },
        })
      );
      await fetchTrustRecordsMeActive({ ttlMs: 60_000 });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      handleTrustRecordsMeActiveCrossTabStorageEvent({
        key: TRUST_RECORDS_SERVER_ACTIVE_CROSS_TAB_KEY,
        newValue: "999",
        oldValue: "888",
        storageArea: mockLS,
      } as StorageEvent);

      (global.fetch as jest.Mock).mockResolvedValue(
        jsonResponse({
          ok: true,
          active: { trustId: "tab-b", clientId: null },
        })
      );
      const snap = await fetchTrustRecordsMeActive({ ttlMs: 60_000 });
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(snap?.trustId).toBe("tab-b");
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });

  it("handleTrustRecordsMeActiveCrossTabStorageEvent ignores unrelated keys", async () => {
    const mockLS = {} as Storage;
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Record<string, unknown> }).window = {
      localStorage: mockLS,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    try {
      (global.fetch as jest.Mock).mockResolvedValue(
        jsonResponse({
          ok: true,
          active: { trustId: "only", clientId: null },
        })
      );
      await fetchTrustRecordsMeActive({ ttlMs: 60_000 });

      handleTrustRecordsMeActiveCrossTabStorageEvent({
        key: "another_key",
        newValue: "1",
        oldValue: "0",
        storageArea: mockLS,
      } as StorageEvent);

      await fetchTrustRecordsMeActive({ ttlMs: 60_000 });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });

  it("subscribeTrustRecordsServerActiveUpdated runs listener when invalidate dispatches", () => {
    const store: Record<string, Set<EventListener>> = {};
    const prev = (global as unknown as { window?: unknown }).window;
    (global as unknown as { window: Window & typeof globalThis }).window = {
      addEventListener(t: string, fn: EventListener) {
        if (!store[t]) store[t] = new Set();
        store[t].add(fn);
      },
      removeEventListener(t: string, fn: EventListener) {
        store[t]?.delete(fn);
      },
      dispatchEvent(ev: Event) {
        store[ev.type]?.forEach((fn) => fn(ev));
        return true;
      },
    } as unknown as Window & typeof globalThis;
    try {
      let n = 0;
      const unsub = subscribeTrustRecordsServerActiveUpdated(() => {
        n++;
      });
      invalidateTrustRecordsMeActiveCache();
      expect(n).toBe(1);
      unsub();
      invalidateTrustRecordsMeActiveCache();
      expect(n).toBe(1);
    } finally {
      (global as unknown as { window?: unknown }).window = prev;
    }
  });
});
