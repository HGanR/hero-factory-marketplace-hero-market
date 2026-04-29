/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import { ClientReviewLinkOperatorSection } from "./ClientReviewLinkOperatorSection";

const POST_ID = "33333333-3333-4333-8333-333333333333";

describe("ClientReviewLinkOperatorSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    global.fetch = jest.fn(async (input: RequestInfo, init?: RequestInit) => {
      const u = typeof input === "string" ? input : input.url;
      if (u.includes("/api/social/external-review-tokens/bulk-revoke") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            revokedCount: 2,
            remainingActiveCount: 0,
            revokedTokenIds: ["a", "b"],
          }),
        } as Response;
      }
      if (u.includes("/api/social/external-review-tokens?")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            tokens: [
              {
                id: "tok-1",
                label: "Test label",
                allowedRoles: ["approver"],
                createdAt: "2026-06-01T12:00:00.000Z",
                expiresAt: "2026-07-01T12:00:00.000Z",
                revokedAt: null,
                status: "active",
                createdByUserId: "99",
              },
              {
                id: "tok-2",
                label: "Older",
                allowedRoles: ["approver"],
                createdAt: "2026-05-01T12:00:00.000Z",
                expiresAt: "2026-07-01T12:00:00.000Z",
                revokedAt: null,
                status: "active",
                createdByUserId: "99",
              },
            ],
            primaryActiveToken: {
              id: "tok-1",
              label: "Test label",
              allowedRoles: ["approver"],
              createdAt: "2026-06-01T12:00:00.000Z",
              expiresAt: "2026-07-01T12:00:00.000Z",
              revokedAt: null,
              status: "active",
              createdByUserId: "99",
            },
            activeTokenCount: 2,
            lastExternalClientReview: null,
            postContext: {
              postId: POST_ID,
              pendingApproval: true,
              clientLinkCanAct: true,
              clientLinkGatedReason: null,
            },
          }),
        } as Response;
      }
      if (u.includes("/api/social/external-review-tokens") && init?.method === "POST") {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            id: "tok-new",
            reviewUrl: "https://example.com/review?t=new",
            expiresAt: "2026-08-01T00:00:00.000Z",
            label: "L",
          }),
        } as Response;
      }
      if (u.includes("/revoke") && init?.method === "POST") {
        return { ok: true, json: async () => ({ ok: true }) } as Response;
      }
      return { ok: true, json: async () => ({}) } as Response;
    });

    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(async () => undefined) },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("renders token list row and mint label field", async () => {
    await act(async () => {
      root.render(
        <ClientReviewLinkOperatorSection
          campaignId="11111111-1111-4111-8111-111111111111"
          postId={POST_ID}
          approvalStatus="pending_approval"
          campaignName="Test campaign"
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-client-review-token-row-tok-1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="planner-client-review-mint-label"]')).toBeTruthy();
    expect(container.textContent).toContain("Test label");
  });

  it("POST mint sends contextPostId and allowedRoles", async () => {
    await act(async () => {
      root.render(
        <ClientReviewLinkOperatorSection
          campaignId="11111111-1111-4111-8111-111111111111"
          postId={POST_ID}
          approvalStatus="pending_approval"
          campaignName="Test campaign"
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });

    const mintBtn = container.querySelector('[data-testid="planner-client-review-mint-copy"]') as HTMLButtonElement;
    await act(async () => {
      mintBtn.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    const calls = (global.fetch as jest.Mock).mock.calls;
    const postCall = calls.find(
      (c) =>
        typeof c[0] === "string" &&
        c[0].includes("/external-review-tokens") &&
        !c[0].includes("?") &&
        (c[1] as { method?: string })?.method === "POST"
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse((postCall![1] as { body: string }).body);
    expect(body.campaignId).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.contextPostId).toBe(POST_ID);
    expect(body.allowedRoles).toContain("approver");
  });

  it("bulk revoke all posts to bulk-revoke API after confirm", async () => {
    const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
    await act(async () => {
      root.render(
        <ClientReviewLinkOperatorSection
          campaignId="11111111-1111-4111-8111-111111111111"
          postId={POST_ID}
          approvalStatus="pending_approval"
          campaignName="Test campaign"
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    const bulkBtn = container.querySelector('[data-testid="planner-client-review-bulk-revoke-all"]') as HTMLButtonElement;
    expect(bulkBtn.disabled).toBe(false);
    await act(async () => {
      bulkBtn.click();
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });
    const calls = (global.fetch as jest.Mock).mock.calls;
    const bulkCall = calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("bulk-revoke") && (c[1] as { method?: string })?.method === "POST"
    );
    expect(bulkCall).toBeTruthy();
    const body = JSON.parse((bulkCall![1] as { body: string }).body);
    expect(body.campaignId).toBe("11111111-1111-4111-8111-111111111111");
    expect(body.mode).toBe("all_active");
    expect(body.contextPostId).toBe(POST_ID);
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("shows email delivery panel when toggled", async () => {
    await act(async () => {
      root.render(
        <ClientReviewLinkOperatorSection
          campaignId="11111111-1111-4111-8111-111111111111"
          postId={POST_ID}
          approvalStatus="pending_approval"
          campaignName="C"
        />
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    const toggle = container.querySelector('[data-testid="planner-client-review-email-toggle"]') as HTMLButtonElement;
    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="planner-client-review-email-panel"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="planner-client-review-email-to"]')).toBeTruthy();
  });
});
