import { describe, expect, it } from "@jest/globals";
import {
  buildJarvaAdvisoryPackets,
  buildJarvaAdvisoryPacketsMarkdownBundle,
  jarvaAdvisoryPacketToMarkdown,
} from "./jarva-document-packets";
import type { JarvaDocumentAssemblyHints } from "./jarva-document-assembly-hints";
import type { JarvaTrustIntake } from "./trust-intake-schema";
import type { JarvaReadinessFull, JarvaReadinessResult } from "./jarva-readiness";
import type { JarvaApplyReadiness } from "./jarva-readiness";
import type { WorkspaceSummaryPayload } from "@/lib/trusts/build-workspace-summary";

const baseIntake = {
  grantor: { name: "G" },
  trustee: { name: "T" },
  governingState: "NY",
  objectives: "Goals",
  trustName: "TN",
} as unknown as JarvaTrustIntake;

const readiness: JarvaReadinessResult = {
  ok: true,
  missing: [],
  blockers: [],
  advisories: [],
};

const readinessFull: JarvaReadinessFull = {
  hardBlockers: [],
  softReady: true,
  softMissing: [],
  suggestedApplyTiming: "now",
  narrative: "ok",
};

const applyReadiness: JarvaApplyReadiness = {
  canApply: true,
  missing: [],
  blockers: [],
  completenessPercent: 95,
  autoApplyAllowed: true,
  softReady: true,
  suggestedApplyTiming: "now",
};

const wp: WorkspaceSummaryPayload["workProduct"] = {
  issuedAssetCertificateCount: 1,
  securitiesCertificatesIssuedCount: 1,
  securitiesCertificatesIssuedActiveCount: 1,
  securityOfferingCount: 1,
  securityOfferingDraftCount: 0,
  securityOfferingFinalizedCount: 1,
  bondInstrumentCount: 1,
  bondPreIssuanceCount: 0,
  bondIssuedCount: 1,
  securityOfferingCancelledCount: 0,
  securityOfferingErrorCount: 0,
  securitiesCertificatesVoidedOrReplacedCount: 0,
  bondClosedCount: 0,
  bondVoidedCount: 0,
  hasDraftOffering: false,
  hasFinalizedOffering: true,
  hasIssuedSecuritiesCertificate: true,
  hasIssuedWorkflowAssetCertificate: true,
  hasAnyIssuedCertificateLike: true,
  hasBondInstrument: true,
  hasActiveBondWorkflow: false,
  hasIssuedBond: true,
};

function hints(p: Partial<JarvaDocumentAssemblyHints>): JarvaDocumentAssemblyHints {
  return {
    ppmDraftReadyForGeneration: false,
    certificatePackageReady: false,
    bondDocumentationReady: false,
    trustReviewPacketReady: false,
    lines: [],
    ...p,
  };
}

describe("buildJarvaAdvisoryPackets", () => {
  const baseInput = {
    trustId: "tid",
    intake: baseIntake,
    workProduct: wp,
    readiness,
    readinessFull,
    applyReadiness,
    structuralBlockers: [],
  };

  it("assembles trust review packet when trustReviewPacketReady", () => {
    const packets = buildJarvaAdvisoryPackets({
      ...baseInput,
      hints: hints({ trustReviewPacketReady: true }),
    });
    expect(packets).toHaveLength(1);
    expect(packets[0]!.type).toBe("trust_review");
    expect(packets[0]!.advisoryStatus).toBe("draft_only");
    expect(packets[0]!.disclaimers.join(" ")).toMatch(/NOT LEGAL ADVICE/i);
    expect(jarvaAdvisoryPacketToMarkdown(packets[0]!)).toMatch(/Trust review packet/i);
  });

  it("assembles ppm draft packet when ppmDraftReadyForGeneration", () => {
    const packets = buildJarvaAdvisoryPackets({
      ...baseInput,
      hints: hints({ ppmDraftReadyForGeneration: true }),
    });
    expect(packets.some((p) => p.type === "ppm_draft")).toBe(true);
    const md = jarvaAdvisoryPacketToMarkdown(packets.find((p) => p.type === "ppm_draft")!);
    expect(md).toMatch(/PPM|subscription/i);
    expect(md).toMatch(/DRAFT/i);
  });

  it("assembles certificate review packet when certificatePackageReady", () => {
    const packets = buildJarvaAdvisoryPackets({
      ...baseInput,
      hints: hints({ certificatePackageReady: true }),
    });
    expect(packets.some((p) => p.type === "certificate_review")).toBe(true);
  });

  it("assembles bond documentation packet when bondDocumentationReady", () => {
    const packets = buildJarvaAdvisoryPackets({
      ...baseInput,
      hints: hints({ bondDocumentationReady: true }),
    });
    expect(packets.some((p) => p.type === "bond_documentation")).toBe(true);
    const md = jarvaAdvisoryPacketToMarkdown(packets.find((p) => p.type === "bond_documentation")!);
    expect(md).toMatch(/Bonds/i);
  });

  it("returns no packets when no readiness flags are true", () => {
    const packets = buildJarvaAdvisoryPackets({
      ...baseInput,
      hints: hints({}),
    });
    expect(packets).toHaveLength(0);
    expect(buildJarvaAdvisoryPacketsMarkdownBundle(packets)).toBe("");
  });

  it("bundle markdown joins packets with separators", () => {
    const packets = buildJarvaAdvisoryPackets({
      ...baseInput,
      hints: hints({ trustReviewPacketReady: true, ppmDraftReadyForGeneration: true }),
    });
    const bundle = buildJarvaAdvisoryPacketsMarkdownBundle(packets);
    expect(bundle).toContain("---");
    expect(bundle.length).toBeGreaterThan(100);
  });
});
