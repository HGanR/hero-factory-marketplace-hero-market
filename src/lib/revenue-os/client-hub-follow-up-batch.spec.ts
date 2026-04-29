/**
 * @jest-environment node
 */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import * as dbMod from "@/lib/db";
import {
  SYNTHETIC_WEBCHAT_EMAIL_LIKE,
  countLeadsMissingFollowUpByClientIds,
  customFieldsIndicatesMissingClientHubFollowUp,
  emailEligibleForLeadFollowUpMetrics,
} from "@/lib/revenue-os/client-hub-intelligence";

describe("countLeadsMissingFollowUpByClientIds", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns an empty map and does not query when clientIds is empty", async () => {
    const spy = jest.spyOn(dbMod, "getDb");
    const m = await countLeadsMissingFollowUpByClientIds(1, []);
    expect(m.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("zero-fills every client id when the grouped query returns no rows", async () => {
    jest.spyOn(dbMod, "getDb").mockResolvedValue({
      execute: () => Promise.resolve([[], undefined]),
    } as never);
    const m = await countLeadsMissingFollowUpByClientIds(9, ["a", "b"]);
    expect(m.get("a")).toBe(0);
    expect(m.get("b")).toBe(0);
  });

  it("merges grouped counts and leaves unlisted ids at zero", async () => {
    jest.spyOn(dbMod, "getDb").mockResolvedValue({
      execute: () =>
        Promise.resolve([
          [
            { clientId: "c1", cnt: 2 },
            { clientId: "c2", cnt: 5 },
          ],
          undefined,
        ]),
    } as never);
    const m = await countLeadsMissingFollowUpByClientIds(3, ["c1", "c2", "c3"]);
    expect(m.get("c1")).toBe(2);
    expect(m.get("c2")).toBe(5);
    expect(m.get("c3")).toBe(0);
  });
});

describe("SYNTHETIC_WEBCHAT_EMAIL_LIKE", () => {
  it("matches the SQL NOT LIKE pattern used in batch queries", () => {
    expect(SYNTHETIC_WEBCHAT_EMAIL_LIKE).toBe("webchat+%");
  });
});

describe("emailEligibleForLeadFollowUpMetrics (synthetic webchat exclusion)", () => {
  it("treats null / undefined as eligible (same as SQL IS NULL branch)", () => {
    expect(emailEligibleForLeadFollowUpMetrics(null)).toBe(true);
    expect(emailEligibleForLeadFollowUpMetrics(undefined)).toBe(true);
  });

  it("excludes addresses that match webchat+ prefix (case-insensitive)", () => {
    expect(emailEligibleForLeadFollowUpMetrics("webchat+sess@example.com")).toBe(false);
    expect(emailEligibleForLeadFollowUpMetrics("WebChat+ABC@x")).toBe(false);
  });

  it("includes normal lead emails", () => {
    expect(emailEligibleForLeadFollowUpMetrics("lead@company.com")).toBe(true);
    expect(emailEligibleForLeadFollowUpMetrics("notwebchat+@x.com")).toBe(true);
  });
});

describe("customFieldsIndicatesMissingClientHubFollowUp", () => {
  it("detects missing or empty followUp", () => {
    expect(customFieldsIndicatesMissingClientHubFollowUp(null)).toBe(true);
    expect(customFieldsIndicatesMissingClientHubFollowUp({})).toBe(true);
    expect(customFieldsIndicatesMissingClientHubFollowUp({ clientHub: {} })).toBe(true);
    expect(customFieldsIndicatesMissingClientHubFollowUp({ clientHub: { followUp: "" } })).toBe(true);
    expect(customFieldsIndicatesMissingClientHubFollowUp({ clientHub: { followUp: "   " } })).toBe(true);
  });

  it("treats false and string false as missing", () => {
    expect(customFieldsIndicatesMissingClientHubFollowUp({ clientHub: { followUp: false } })).toBe(true);
    expect(customFieldsIndicatesMissingClientHubFollowUp({ clientHub: { followUp: "false" } })).toBe(true);
    expect(customFieldsIndicatesMissingClientHubFollowUp({ clientHub: { followUp: "FALSE" } })).toBe(true);
  });

  it("detects a logged follow-up note as present", () => {
    expect(
      customFieldsIndicatesMissingClientHubFollowUp({
        clientHub: { followUp: "Call back Tuesday" },
      }),
    ).toBe(false);
  });
});
