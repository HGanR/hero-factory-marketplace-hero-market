/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { CampaignReviewerAssignmentsPanel } from "./CampaignReviewerAssignmentsPanel";

/** jsdom has no global `Response`; match fetch return shape the panel uses. */
function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function setInputValue(el: HTMLInputElement, value: string) {
  const proto = window.HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  desc?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CampaignReviewerAssignmentsPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    jest.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    jest.useRealTimers();
  });

  function mockFetchSequence(
    handlers: Array<{
      match: (url: string, init?: RequestInit) => boolean;
      response: ReturnType<typeof mockJsonResponse>;
    }>
  ) {
    jest.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const h = handlers.find((x) => x.match(url, init));
      return Promise.resolve(h?.response ?? mockJsonResponse({ error: "unmocked" }, 500));
    });
  }

  it("loads reviewers on mount", async () => {
    mockFetchSequence([
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ reviewers: [] }, 200),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(fetch)).toHaveBeenCalledWith("/api/campaigns/c1/reviewers");
  });

  it("searches and selects a candidate then POSTs add with selected userId", async () => {
    mockFetchSequence([
      {
        match: (u, init) =>
          init?.method === "POST" &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ ok: true }, 200),
      },
      {
        match: (u) => u.includes("/reviewers/lookup"),
        response: mockJsonResponse({
          candidates: [{ userId: 5, displayName: "Pat", email: "pat@example.com" }],
        }),
      },
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ reviewers: [] }, 200),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const search = container.querySelector('[data-testid="reviewer-lookup-search"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(search, "pa");
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/reviewers/lookup?q=pa"),
      expect.anything()
    );

    const opt = container.querySelector('[data-testid="reviewer-lookup-option-5"]') as HTMLButtonElement;
    await act(async () => {
      opt.click();
    });

    expect(container.querySelector('[data-testid="reviewer-selected-summary"]')?.textContent).toContain("Pat");
    expect(container.querySelector('[data-testid="reviewer-selected-summary"]')?.textContent).toContain(
      "pat@example.com"
    );

    await act(async () => {
      (container.querySelector('[data-testid="reviewer-add-submit"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(fetch)).toHaveBeenCalledWith(
      "/api/campaigns/c1/reviewers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: 5, role: "approver" }),
      })
    );
  });

  it("shows empty lookup state when API returns no candidates", async () => {
    mockFetchSequence([
      {
        match: (u) => u.includes("/reviewers/lookup"),
        response: mockJsonResponse({ candidates: [] }),
      },
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ reviewers: [] }, 200),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const search = container.querySelector('[data-testid="reviewer-lookup-search"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(search, "zz");
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="reviewer-lookup-empty"]')?.textContent).toContain(
      "No matching user found"
    );
    expect(container.querySelector('[data-testid="reviewer-invite-placeholder"]')).toBeTruthy();
  });

  it("manual user id fallback POSTs without lookup selection", async () => {
    mockFetchSequence([
      {
        match: (u, init) =>
          init?.method === "POST" &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ ok: true }, 200),
      },
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ reviewers: [] }, 200),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('[data-testid="reviewer-manual-toggle"]') as HTMLButtonElement).click();
    });

    const manual = container.querySelector('[data-testid="reviewer-manual-userid"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(manual, "99");
    });

    await act(async () => {
      const sel = container.querySelector('[data-testid="reviewer-add-role"]') as HTMLSelectElement;
      sel.value = "editor";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      (container.querySelector('[data-testid="reviewer-add-submit"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(fetch)).toHaveBeenCalledWith(
      "/api/campaigns/c1/reviewers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: 99, role: "editor" }),
      })
    );
  });

  it("sorts reviewer rows approver → editor → reviewer by user id", async () => {
    mockFetchSequence([
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({
          reviewers: [
            {
              id: "r3",
              campaignId: "c1",
              userId: 30,
              role: "reviewer",
              createdAt: "",
              updatedAt: "",
            },
            {
              id: "r1",
              campaignId: "c1",
              userId: 10,
              role: "approver",
              createdAt: "",
              updatedAt: "",
            },
            {
              id: "r2",
              campaignId: "c1",
              userId: 20,
              role: "editor",
              createdAt: "",
              updatedAt: "",
            },
          ],
        }),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const list = container.querySelector('[data-testid="reviewers-list"]');
    expect(list).toBeTruthy();
    const ordered = [...list!.querySelectorAll("[data-reviewer-user-id]")].map((el) =>
      Number((el as HTMLElement).getAttribute("data-reviewer-user-id"))
    );
    expect(ordered).toEqual([10, 20, 30]);
  });

  it("remove uses confirm step before DELETE", async () => {
    mockFetchSequence([
      {
        match: (u, init) =>
          init?.method === "DELETE" && u.includes("/reviewers/rm1"),
        response: mockJsonResponse({ ok: true }, 200),
      },
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({
          reviewers: [
            {
              id: "rm1",
              campaignId: "c1",
              userId: 7,
              role: "approver",
              createdAt: "",
              updatedAt: "",
            },
          ],
        }),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(fetch).mock.calls.filter((c) => String(c[0]).includes("DELETE"))).toHaveLength(0);

    await act(async () => {
      (container.querySelector('[data-testid="reviewer-remove-rm1"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('[data-testid="reviewer-remove-confirm-rm1"]')).toBeTruthy();

    await act(async () => {
      (container.querySelector('[data-testid="reviewer-remove-confirm-rm1"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(fetch).mock.calls.some((c) => c[0] === "/api/campaigns/c1/reviewers/rm1")).toBe(true);
  });

  it("disables add while row PATCH is in flight", async () => {
    let resolvePatch: (v: unknown) => void = () => {};
    const patchPromise = new Promise((res) => {
      resolvePatch = res;
    });

    mockFetchSequence([
      {
        match: (u, init) =>
          init?.method === "PATCH" && u.includes("/reviewers/rx"),
        response: patchPromise.then(() => mockJsonResponse({ ok: true }, 200)),
      },
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({
          reviewers: [
            {
              id: "rx",
              campaignId: "c1",
              userId: 3,
              role: "approver",
              createdAt: "",
              updatedAt: "",
            },
          ],
        }),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const sel = container.querySelector('[data-testid="reviewer-row-role-rx"]') as HTMLSelectElement;
    await act(async () => {
      sel.value = "editor";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const submit = container.querySelector('[data-testid="reviewer-add-submit"]') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    await act(async () => {
      resolvePatch(undefined);
      await patchPromise;
      await Promise.resolve();
    });
  });

  it("duplicate assignment still issues POST and relies on 409 response", async () => {
    mockFetchSequence([
      {
        match: (u, init) =>
          init?.method === "POST" &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ error: "duplicate", message: "Already assigned" }, 409),
      },
      {
        match: (u, init) =>
          (!init?.method || init.method === "GET") &&
          u.includes("/campaigns/c1/reviewers") &&
          !u.includes("lookup"),
        response: mockJsonResponse({ reviewers: [] }, 200),
      },
    ]);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentsPanel campaignId="c1" canManage />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('[data-testid="reviewer-manual-toggle"]') as HTMLButtonElement).click();
    });
    const manual = container.querySelector('[data-testid="reviewer-manual-userid"]') as HTMLInputElement;
    await act(async () => {
      setInputValue(manual, "7");
    });
    await act(async () => {
      (container.querySelector('[data-testid="reviewer-add-submit"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(jest.mocked(fetch)).toHaveBeenCalledWith(
      "/api/campaigns/c1/reviewers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ userId: 7, role: "approver" }),
      })
    );

    expect(container.querySelector('[data-testid="reviewer-add-inline-error"]')?.textContent).toContain(
      "Already assigned"
    );
  });
});
