/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { BentleyNotificationCenter } from "./BentleyNotificationCenter";

function mockJsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("BentleyNotificationCenter", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders empty state in dropdown", async () => {
    jest.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/notifications") && !url.includes("/e1")) {
        return Promise.resolve(mockJsonResponse({ events: [] }));
      }
      return Promise.resolve(mockJsonResponse({}, 404));
    });

    await act(async () => {
      root.render(<BentleyNotificationCenter />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      (container.querySelector('[data-testid="bentley-notification-bell"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="bentley-notification-empty"]')?.textContent).toContain(
      "No notifications"
    );
  });

  it("renders campaign_publish_approval messages in the list", async () => {
    jest.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes("/api/notifications") && url.includes("limit=25")) {
        return Promise.resolve(
          mockJsonResponse({
            events: [
              {
                id: "ap1",
                sourceType: "campaign_publish_approval",
                campaignId: "camp-z",
                message: 'Pat approved post abc in campaign "Q1".',
                createdAt: "2026-03-01T12:00:00.000Z",
                readAt: null,
              },
            ],
          })
        );
      }
      return Promise.resolve(mockJsonResponse({}, 404));
    });

    await act(async () => {
      root.render(<BentleyNotificationCenter />);
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      (container.querySelector('[data-testid="bentley-notification-bell"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("approved post abc");
  });

  it("shows unread badge and mark-read updates row", async () => {
    const ev = {
      id: "n1",
      sourceType: "campaign_reviewer_assignment",
      campaignId: "c1",
      message: "You were added",
      createdAt: "2026-01-01T00:00:00.000Z",
      readAt: null as string | null,
    };
    const evRead = { ...ev, readAt: "2026-01-02T00:00:00.000Z" };

    let patchDone = false;
    jest.mocked(fetch).mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/api/notifications") && url.includes("limit=25") && (!init?.method || init.method === "GET")) {
        return Promise.resolve(mockJsonResponse({ events: patchDone ? [evRead] : [ev] }));
      }
      if (url.includes("/api/notifications/n1") && init?.method === "PATCH") {
        patchDone = true;
        return Promise.resolve(mockJsonResponse({ ok: true, event: evRead }));
      }
      return Promise.resolve(mockJsonResponse({}, 404));
    });

    await act(async () => {
      root.render(<BentleyNotificationCenter />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="bentley-notification-unread-badge"]')).toBeTruthy();

    await act(async () => {
      (container.querySelector('[data-testid="bentley-notification-bell"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="bentley-notification-row-n1"]')?.textContent).toContain(
      "You were added"
    );

    await act(async () => {
      (container.querySelector('[data-testid="bentley-notification-mark-read-n1"]') as HTMLButtonElement).click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Read");
    expect(fetch).toHaveBeenCalledWith(
      "/api/notifications/n1",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});
