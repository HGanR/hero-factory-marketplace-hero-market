/**
 * Consultant journey — pure outcome contracts (no HTTP).
 * Complements `route.jarva.spec.ts` API tests and panel/helper specs.
 *
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals";
import { resolveJarvaWorkflowDestination } from "@/lib/jarva/jarva-workflow-destinations";
import {
  appendJarvaHandoffParams,
  JARVA_HANDOFF_FROM,
  JARVA_HANDOFF_LANE,
  parseJarvaHandoff,
} from "@/lib/jarva/jarva-handoff";
import { jarvaAssemblyReadinessHref } from "@/lib/jarva/jarva-document-assembly-destinations";
import { jarvaDocumentAssemblyHintsHaveSignals, parseJarvaDocumentAssemblyHintsFromApi } from "@/lib/jarva/jarva-document-assembly-hints";

const TID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("Consultant journey — destination & handoff (FloatingNPCChat / router.push)", () => {
  it("revocable lane with trustId → Build with Jarva (auto-open eligible)", () => {
    const d = resolveJarvaWorkflowDestination("trust_revocable", { trustId: TID });
    expect(d.href).toBe(`/trust-records/jarva?trustId=${encodeURIComponent(TID)}`);
    expect(d.autoOpenEligible).toBe(true);
    const withHandoff = appendJarvaHandoffParams(d.href, "trust_revocable");
    expect(withHandoff).toContain(`${JARVA_HANDOFF_FROM}=1`);
    expect(withHandoff).toContain(`${JARVA_HANDOFF_LANE}=trust_revocable`);
    const parsed = parseJarvaHandoff(new URLSearchParams(withHandoff.split("?")[1] ?? ""));
    expect(parsed?.lane).toBe("trust_revocable");
  });

  it("bond lane → Trust Records bonds tab (execution / documentation surface)", () => {
    const d = resolveJarvaWorkflowDestination("trust_bond", { trustId: TID });
    expect(d.href).toContain("tab=bonds");
    expect(d.href).toContain(`trustId=${encodeURIComponent(TID)}`);
    expect(d.autoOpenEligible).toBe(true);
    const withHandoff = appendJarvaHandoffParams(d.href, "trust_bond");
    expect(parseJarvaHandoff(new URLSearchParams(withHandoff.split("?")[1] ?? ""))?.lane).toBe("trust_bond");
  });

  it("PPM lane with trustId → Issue Security (same as readiness panel PPM link)", () => {
    const d = resolveJarvaWorkflowDestination("trust_ppm", { trustId: TID });
    expect(d.href).toBe(`/trusts/${encodeURIComponent(TID)}/issue-security`);
    expect(jarvaAssemblyReadinessHref(TID, "ppmDraftReadyForGeneration")).toBe(d.href);
  });
});

describe("Consultant journey — readiness panel & advisory CTA (logic contracts)", () => {
  it("advisory packet / panel signals: any true flag or line → haveSignals", () => {
    expect(
      jarvaDocumentAssemblyHintsHaveSignals(
        parseJarvaDocumentAssemblyHintsFromApi({
          ppmDraftReadyForGeneration: true,
          certificatePackageReady: false,
          bondDocumentationReady: false,
          trustReviewPacketReady: false,
          lines: [],
        })
      )
    ).toBe(true);
    expect(
      jarvaDocumentAssemblyHintsHaveSignals(
        parseJarvaDocumentAssemblyHintsFromApi({
          ppmDraftReadyForGeneration: false,
          certificatePackageReady: false,
          bondDocumentationReady: false,
          trustReviewPacketReady: false,
          lines: [],
        })
      )
    ).toBe(false);
  });

  it("readiness panel links match Trust Records allow-listed tabs for cert/bond", () => {
    expect(jarvaAssemblyReadinessHref(TID, "certificatePackageReady")).toContain("tab=registry");
    expect(jarvaAssemblyReadinessHref(TID, "bondDocumentationReady")).toContain("tab=bonds");
  });
});
