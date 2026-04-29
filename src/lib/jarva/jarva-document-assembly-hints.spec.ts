import { describe, expect, it } from "@jest/globals";
import {
  computeJarvaDocumentAssemblyHints,
  jarvaDocumentAssemblyHintsHaveSignals,
  parseJarvaDocumentAssemblyHintsFromApi,
} from "./jarva-document-assembly-hints";
import type { JarvaProceduralInput } from "./jarva-procedural-engine";

function clearProceduralInput(overrides: Partial<JarvaProceduralInput> = {}): JarvaProceduralInput {
  return {
    trustId: "t1",
    clientId: "c1",
    workspaceCounts: { parties: 2, beneficiaries: 1, assets: 1 },
    workspaceChecklist: {
      partiesAndRoles: true,
      beneficiaries: true,
      assetsAndFundingPlan: true,
    },
    jarvaHardBlockers: [],
    jarvaApplyBlockers: [],
    ...overrides,
  };
}

describe("parseJarvaDocumentAssemblyHintsFromApi / jarvaDocumentAssemblyHintsHaveSignals", () => {
  it("parses API shape and detects signals when any boolean or line is set", () => {
    const p = parseJarvaDocumentAssemblyHintsFromApi({
      ppmDraftReadyForGeneration: true,
      certificatePackageReady: false,
      bondDocumentationReady: false,
      trustReviewPacketReady: false,
      lines: [],
    });
    expect(p).not.toBeNull();
    expect(jarvaDocumentAssemblyHintsHaveSignals(p)).toBe(true);
  });

  it("returns no signals when all booleans false and no lines", () => {
    const p = parseJarvaDocumentAssemblyHintsFromApi({
      ppmDraftReadyForGeneration: false,
      certificatePackageReady: false,
      bondDocumentationReady: false,
      trustReviewPacketReady: false,
      lines: [],
    });
    expect(p).not.toBeNull();
    expect(jarvaDocumentAssemblyHintsHaveSignals(p)).toBe(false);
  });

  it("detects signals from lines alone", () => {
    const p = parseJarvaDocumentAssemblyHintsFromApi({
      ppmDraftReadyForGeneration: false,
      certificatePackageReady: false,
      bondDocumentationReady: false,
      trustReviewPacketReady: false,
      lines: ["Advisory line"],
    });
    expect(jarvaDocumentAssemblyHintsHaveSignals(p)).toBe(true);
  });
});

describe("computeJarvaDocumentAssemblyHints", () => {
  it("sets ppmDraftReadyForGeneration when offering is finalized and gates are clear", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 0,
        securitiesCertificatesIssuedActiveCount: 0,
        securityOfferingCount: 1,
        securityOfferingDraftCount: 0,
        securityOfferingFinalizedCount: 1,
        bondInstrumentCount: 0,
        bondPreIssuanceCount: 0,
        bondIssuedCount: 0,
        securityOfferingCancelledCount: 0,
        securityOfferingErrorCount: 0,
        securitiesCertificatesVoidedOrReplacedCount: 0,
        bondClosedCount: 0,
        bondVoidedCount: 0,
        hasDraftOffering: false,
        hasFinalizedOffering: true,
        hasIssuedSecuritiesCertificate: false,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: false,
        hasBondInstrument: false,
        hasActiveBondWorkflow: false,
        hasIssuedBond: false,
      },
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 80,
      applyReadinessBlockers: [],
    });
    expect(h.ppmDraftReadyForGeneration).toBe(true);
    expect(h.lines.some((l) => /finalized/i.test(l) && /PPM|subscription/i.test(l))).toBe(true);
  });

  it("sets certificatePackageReady when issued certificate-like rows exist and gates are clear", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 1,
        securitiesCertificatesIssuedActiveCount: 1,
        securityOfferingCount: 0,
        securityOfferingDraftCount: 0,
        securityOfferingFinalizedCount: 0,
        bondInstrumentCount: 0,
        bondPreIssuanceCount: 0,
        bondIssuedCount: 0,
        securityOfferingCancelledCount: 0,
        securityOfferingErrorCount: 0,
        securitiesCertificatesVoidedOrReplacedCount: 0,
        bondClosedCount: 0,
        bondVoidedCount: 0,
        hasDraftOffering: false,
        hasFinalizedOffering: false,
        hasIssuedSecuritiesCertificate: true,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: true,
        hasBondInstrument: false,
        hasActiveBondWorkflow: false,
        hasIssuedBond: false,
      },
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 70,
      applyReadinessBlockers: [],
    });
    expect(h.certificatePackageReady).toBe(true);
    expect(h.lines.some((l) => /certificate package/i.test(l))).toBe(true);
  });

  it("sets bondDocumentationReady for issued bond or active bond workflow", () => {
    const issued = computeJarvaDocumentAssemblyHints({
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 0,
        securitiesCertificatesIssuedActiveCount: 0,
        securityOfferingCount: 0,
        securityOfferingDraftCount: 0,
        securityOfferingFinalizedCount: 0,
        bondInstrumentCount: 1,
        bondPreIssuanceCount: 0,
        bondIssuedCount: 1,
        securityOfferingCancelledCount: 0,
        securityOfferingErrorCount: 0,
        securitiesCertificatesVoidedOrReplacedCount: 0,
        bondClosedCount: 0,
        bondVoidedCount: 0,
        hasDraftOffering: false,
        hasFinalizedOffering: false,
        hasIssuedSecuritiesCertificate: false,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: false,
        hasBondInstrument: true,
        hasActiveBondWorkflow: false,
        hasIssuedBond: true,
      },
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 50,
      applyReadinessBlockers: [],
    });
    expect(issued.bondDocumentationReady).toBe(true);

    const active = computeJarvaDocumentAssemblyHints({
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 0,
        securitiesCertificatesIssuedActiveCount: 0,
        securityOfferingCount: 0,
        securityOfferingDraftCount: 0,
        securityOfferingFinalizedCount: 0,
        bondInstrumentCount: 1,
        bondPreIssuanceCount: 1,
        bondIssuedCount: 0,
        securityOfferingCancelledCount: 0,
        securityOfferingErrorCount: 0,
        securitiesCertificatesVoidedOrReplacedCount: 0,
        bondClosedCount: 0,
        bondVoidedCount: 0,
        hasDraftOffering: false,
        hasFinalizedOffering: false,
        hasIssuedSecuritiesCertificate: false,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: false,
        hasBondInstrument: true,
        hasActiveBondWorkflow: true,
        hasIssuedBond: false,
      },
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 50,
      applyReadinessBlockers: [],
    });
    expect(active.bondDocumentationReady).toBe(true);
  });

  it("does not set bondDocumentationReady when only voided bond rows exist", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 0,
        securitiesCertificatesIssuedActiveCount: 0,
        securityOfferingCount: 0,
        securityOfferingDraftCount: 0,
        securityOfferingFinalizedCount: 0,
        bondInstrumentCount: 1,
        bondPreIssuanceCount: 0,
        bondIssuedCount: 0,
        securityOfferingCancelledCount: 0,
        securityOfferingErrorCount: 0,
        securitiesCertificatesVoidedOrReplacedCount: 0,
        bondClosedCount: 0,
        bondVoidedCount: 1,
        hasDraftOffering: false,
        hasFinalizedOffering: false,
        hasIssuedSecuritiesCertificate: false,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: false,
        hasBondInstrument: true,
        hasActiveBondWorkflow: false,
        hasIssuedBond: false,
      },
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 95,
      applyReadinessBlockers: [],
    });
    expect(h.bondDocumentationReady).toBe(false);
  });

  it("sets trustReviewPacketReady at high completeness when intake and gates are clear", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: undefined,
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 95,
      applyReadinessBlockers: [],
    });
    expect(h.trustReviewPacketReady).toBe(true);
    expect(h.lines.some((l) => /trust review packet/i.test(l))).toBe(true);
  });

  it("suppresses readiness flags when structural or apply blockers exist", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 0,
        securitiesCertificatesIssuedActiveCount: 0,
        securityOfferingCount: 1,
        securityOfferingDraftCount: 0,
        securityOfferingFinalizedCount: 1,
        bondInstrumentCount: 0,
        bondPreIssuanceCount: 0,
        bondIssuedCount: 0,
        securityOfferingCancelledCount: 0,
        securityOfferingErrorCount: 0,
        securitiesCertificatesVoidedOrReplacedCount: 0,
        bondClosedCount: 0,
        bondVoidedCount: 0,
        hasDraftOffering: false,
        hasFinalizedOffering: true,
        hasIssuedSecuritiesCertificate: false,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: false,
        hasBondInstrument: false,
        hasActiveBondWorkflow: false,
        hasIssuedBond: false,
      },
      proceduralInput: clearProceduralInput({
        workspaceChecklist: { partiesAndRoles: true, beneficiaries: false, assetsAndFundingPlan: true },
      }),
      intakeReadinessOk: true,
      completenessPercent: 95,
      applyReadinessBlockers: [],
    });
    expect(h.ppmDraftReadyForGeneration).toBe(false);
    expect(h.trustReviewPacketReady).toBe(false);
    expect(h.lines.length).toBe(0);
  });

  it("suppresses when apply readiness blockers are non-empty", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 0,
        securitiesCertificatesIssuedActiveCount: 0,
        securityOfferingCount: 1,
        securityOfferingDraftCount: 0,
        securityOfferingFinalizedCount: 1,
        bondInstrumentCount: 0,
        bondPreIssuanceCount: 0,
        bondIssuedCount: 0,
        securityOfferingCancelledCount: 0,
        securityOfferingErrorCount: 0,
        securitiesCertificatesVoidedOrReplacedCount: 0,
        bondClosedCount: 0,
        bondVoidedCount: 0,
        hasDraftOffering: false,
        hasFinalizedOffering: true,
        hasIssuedSecuritiesCertificate: false,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: false,
        hasBondInstrument: false,
        hasActiveBondWorkflow: false,
        hasIssuedBond: false,
      },
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 95,
      applyReadinessBlockers: ["Incomplete: Grantor name"],
    });
    expect(h.ppmDraftReadyForGeneration).toBe(false);
    expect(h.lines.length).toBe(0);
  });

  it("suppresses all flags when core intake readiness is not OK", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: undefined,
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: false,
      completenessPercent: 100,
      applyReadinessBlockers: [],
    });
    expect(h.ppmDraftReadyForGeneration).toBe(false);
    expect(h.certificatePackageReady).toBe(false);
    expect(h.bondDocumentationReady).toBe(false);
    expect(h.trustReviewPacketReady).toBe(false);
    expect(h.lines.length).toBe(0);
  });

  it("when workProduct is absent, only trust-review-style readiness can still be true", () => {
    const h = computeJarvaDocumentAssemblyHints({
      workProduct: undefined,
      proceduralInput: clearProceduralInput(),
      intakeReadinessOk: true,
      completenessPercent: 95,
      applyReadinessBlockers: [],
    });
    expect(h.ppmDraftReadyForGeneration).toBe(false);
    expect(h.certificatePackageReady).toBe(false);
    expect(h.bondDocumentationReady).toBe(false);
    expect(h.trustReviewPacketReady).toBe(true);
  });
});
