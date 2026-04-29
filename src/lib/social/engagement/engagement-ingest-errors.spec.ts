import { describe, expect, it } from "@jest/globals";
import { buildEngagementIngestErrorFingerprint, recordEngagementIngestError } from "./engagement-ingest-errors";

describe("engagement-ingest-errors", () => {
  it("buildEngagementIngestErrorFingerprint is stable for same inputs", () => {
    const a = buildEngagementIngestErrorFingerprint({
      provider: "meta",
      clientId: "c1",
      errorCode: "VALIDATION",
      socialAccountId: "s1",
    });
    const b = buildEngagementIngestErrorFingerprint({
      provider: "meta",
      clientId: "c1",
      errorCode: "VALIDATION",
      socialAccountId: "s1",
    });
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });

  it("recordEngagementIngestError calls insert with onDuplicateKeyUpdate", async () => {
    const onDuplicateKeyUpdate = jest.fn();
    const values = jest.fn().mockReturnValue({ onDuplicateKeyUpdate });
    const insert = jest.fn().mockReturnValue({ values });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = { insert };
    await recordEngagementIngestError(db, {
      userId: "u1",
      clientId: "c1",
      provider: "meta",
      socialAccountId: null,
      errorCode: "VALIDATION",
      errorMessage: "bad",
    });
    expect(insert).toHaveBeenCalled();
    expect(values).toHaveBeenCalled();
    expect(onDuplicateKeyUpdate).toHaveBeenCalled();
  });
});
