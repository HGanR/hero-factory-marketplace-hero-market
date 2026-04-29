import { describe, it, expect } from "@jest/globals";
import {
  buildClientReviewShareEmailHtml,
  buildClientReviewShareEmailSubject,
  buildClientReviewShareMessage,
  plainTextShareMessageToEmailHtml,
  prependRecipientGreeting,
} from "@/lib/social/client-review-share-message";

describe("buildClientReviewShareMessage", () => {
  it("includes label, url, and expiry", () => {
    const s = buildClientReviewShareMessage({
      reviewUrl: "https://x.example/review?t=abc",
      expiresAt: "2026-12-01T00:00:00.000Z",
      label: "Round 1",
    });
    expect(s).toContain("Round 1");
    expect(s).toContain("https://x.example/review?t=abc");
    expect(s.toLowerCase()).toMatch(/expires/);
  });

  it("handles no label and no expiry", () => {
    const s = buildClientReviewShareMessage({
      reviewUrl: "https://x.example/r",
      expiresAt: null,
      label: null,
    });
    expect(s).toContain("https://x.example/r");
    expect(s).toContain("does not expire");
  });

  it("buildClientReviewShareEmailSubject includes label and campaign", () => {
    expect(buildClientReviewShareEmailSubject({ label: "L1", campaignName: "C1" })).toContain("L1");
    expect(buildClientReviewShareEmailSubject({ label: "L1", campaignName: "C1" })).toContain("C1");
  });

  it("prependRecipientGreeting adds Hi line", () => {
    expect(prependRecipientGreeting("Body", "Pat")).toMatch(/^Hi Pat/);
    expect(prependRecipientGreeting("Body", null)).toBe("Body");
  });

  it("plainTextShareMessageToEmailHtml escapes HTML", () => {
    const h = plainTextShareMessageToEmailHtml("a < b\nok");
    expect(h).toContain("&lt;");
    expect(h).toContain("<br/>");
  });

  it("buildClientReviewShareEmailHtml includes CTA href, expiry, campaign/label, and escaped plain body", () => {
    const plain = prependRecipientGreeting(
      buildClientReviewShareMessage({
        reviewUrl: "https://app.example/review?t=1",
        expiresAt: "2026-12-01T00:00:00.000Z",
        label: "Round 1",
      }),
      "Sam"
    );
    const html = buildClientReviewShareEmailHtml({
      plainBody: plain,
      reviewUrl: "https://app.example/review?t=1",
      expiresAt: "2026-12-01T00:00:00.000Z",
      label: "Round 1",
      campaignName: "Spring",
    });
    expect(html).toContain('href="https://app.example/review?t=1"');
    expect(html).toContain("Open review page");
    expect(html).toMatch(/expires/i);
    expect(html).toContain("Spring");
    expect(html).toContain("Round 1");
    expect(html).toContain("Hi Sam");
    expect(html).not.toContain("<script");
  });
});
