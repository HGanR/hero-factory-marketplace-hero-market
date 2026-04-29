import { describe, expect, it } from "@jest/globals";
import {
  jarvaAssemblyReadinessHref,
  JARVA_ASSEMBLY_READINESS_ROWS,
} from "./jarva-document-assembly-destinations";

const TID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("jarva-document-assembly-destinations", () => {
  it("maps each readiness key to an existing app route pattern", () => {
    expect(jarvaAssemblyReadinessHref(TID, "ppmDraftReadyForGeneration")).toBe(
      `/trusts/${encodeURIComponent(TID)}/issue-security`
    );
    expect(jarvaAssemblyReadinessHref(TID, "certificatePackageReady")).toBe(
      `/trust-records?trustId=${encodeURIComponent(TID)}&tab=registry`
    );
    expect(jarvaAssemblyReadinessHref(TID, "bondDocumentationReady")).toBe(
      `/trust-records?trustId=${encodeURIComponent(TID)}&tab=bonds`
    );
    expect(jarvaAssemblyReadinessHref(TID, "trustReviewPacketReady")).toBe(
      `/trust-records/jarva?trustId=${encodeURIComponent(TID)}`
    );
  });

  it("has one meta row per readiness boolean key", () => {
    const keys = new Set(JARVA_ASSEMBLY_READINESS_ROWS.map((r) => r.key));
    expect(keys.size).toBe(4);
    expect(keys.has("ppmDraftReadyForGeneration")).toBe(true);
    expect(keys.has("certificatePackageReady")).toBe(true);
    expect(keys.has("bondDocumentationReady")).toBe(true);
    expect(keys.has("trustReviewPacketReady")).toBe(true);
  });
});
