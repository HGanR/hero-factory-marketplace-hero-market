/**
 * @jest-environment node
 */
import { describe, it, expect } from "@jest/globals";
import { renderToStaticMarkup } from "react-dom/server";
import { RevenueOsInboxPanel } from "./RevenueOsInboxPanel";

describe("RevenueOsInboxPanel", () => {
  it("renders smart inbox title and empty state (no live fetch in SSR static markup)", () => {
    const h = renderToStaticMarkup(<RevenueOsInboxPanel clientId="client-1" />);
    expect(h).toContain('id="smart-inbox"');
    expect(h).toContain("Smart Inbox");
    expect(h).toContain("No threads yet");
    expect(h).toContain("inbox-tab-threads");
    expect(h).toContain("inbox-tab-rules");
  });
});
