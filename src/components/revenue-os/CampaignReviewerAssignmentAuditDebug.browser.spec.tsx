/**
 * @jest-environment jsdom
 */
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, jest, beforeEach, afterEach } from "@jest/globals";
import { CampaignReviewerAssignmentAuditDebug } from "./CampaignReviewerAssignmentAuditDebug";

describe("CampaignReviewerAssignmentAuditDebug", () => {
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

  it("renders nothing when disabled", () => {
    act(() => {
      root.render(<CampaignReviewerAssignmentAuditDebug campaignId="c1" enabled={false} />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when campaignId is null", () => {
    act(() => {
      root.render(<CampaignReviewerAssignmentAuditDebug campaignId={null} enabled />);
    });
    expect(container.innerHTML).toBe("");
  });

  it("shows empty state when API returns no events", async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ events: [] }),
    } as Response);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentAuditDebug campaignId="c1" enabled />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("No events yet");
    expect(jest.mocked(fetch)).toHaveBeenCalledWith(
      "/api/campaigns/c1/reviewer-audit",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("renders audit rows when present", async () => {
    jest.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          {
            id: "e1",
            action: "reviewer_added",
            targetUserId: 5,
            actorUserId: 1,
            previousRole: null,
            nextRole: "approver",
            createdAt: "2026-04-01T10:00:00.000Z",
          },
        ],
      }),
    } as Response);

    await act(async () => {
      root.render(<CampaignReviewerAssignmentAuditDebug campaignId="c1" enabled />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain("reviewer_added");
    expect(container.textContent).toContain("target=5");
    expect(container.textContent).toContain("next=approver");
    expect(container.textContent).toContain("2026-04-01T10:00:00");
  });
});
