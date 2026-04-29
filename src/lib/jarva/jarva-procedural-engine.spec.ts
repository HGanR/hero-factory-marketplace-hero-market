import { describe, expect, it } from "@jest/globals";
import {
  evaluateJarvaProceduralStep,
  formatProceduralJarvaBanner,
  JARVA_PROCEDURAL_TOTAL_STEPS,
  lateStepStructuralBlockers,
} from "./jarva-procedural-engine";

describe("evaluateJarvaProceduralStep", () => {
  it("starts at workspace without trust id when no entry router", () => {
    const e = evaluateJarvaProceduralStep({});
    expect(e.step).toBe("workspace");
    expect(e.stepIndex).toBe(4);
    expect(e.totalSteps).toBe(JARVA_PROCEDURAL_TOTAL_STEPS);
  });

  it("front door when unbound trust and first message with unknown entry", () => {
    const e = evaluateJarvaProceduralStep({
      jarvaEntryRoute: { intent: "unknown", needsTrustTypeChoice: false },
      priorSessionUserMessageCount: 0,
    });
    expect(e.step).toBe("front_door");
    expect(e.stepIndex).toBe(1);
  });

  it("trust type choice when trust_general needs choice", () => {
    const e = evaluateJarvaProceduralStep({
      jarvaEntryRoute: { intent: "trust_general", needsTrustTypeChoice: true },
      priorSessionUserMessageCount: 0,
    });
    expect(e.step).toBe("trust_type_choice");
    expect(e.stepIndex).toBe(2);
  });

  it("specialty guidance for PPM without trust id", () => {
    const e = evaluateJarvaProceduralStep({
      jarvaEntryRoute: { intent: "trust_ppm", needsTrustTypeChoice: false },
      priorSessionUserMessageCount: 1,
    });
    expect(e.step).toBe("specialty_guidance");
    expect(e.stepIndex).toBe(3);
  });

  it("requires client after trust", () => {
    const e = evaluateJarvaProceduralStep({ trustId: "t1", clientId: "" });
    expect(e.step).toBe("client");
    expect(e.stepIndex).toBe(5);
  });

  it("requires parties before assets", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 1, assets: 0 },
    });
    expect(e.step).toBe("parties");
  });

  it("requires assets when parties sufficient", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 0 },
    });
    expect(e.step).toBe("assets");
  });

  it("provisions when core intake incomplete", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1 },
      jarvaIntakeCompletenessPct: 40,
      jarvaIntakeCoreComplete: false,
    });
    expect(e.step).toBe("provisions");
  });

  it("certificate milestone when core ok and completeness mid", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1 },
      jarvaIntakeCompletenessPct: 80,
      jarvaIntakeCoreComplete: true,
    });
    expect(e.step).toBe("certificate");
  });

  it("review when intake largely complete", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1 },
      jarvaIntakeCompletenessPct: 95,
      jarvaIntakeCoreComplete: true,
    });
    expect(e.step).toBe("review");
  });

  it("keeps threshold-only certificate when no workspace checklist or beneficiary count signal", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1 },
      jarvaIntakeCompletenessPct: 80,
      jarvaIntakeCoreComplete: true,
    });
    expect(e.step).toBe("certificate");
  });

  it("does not advance to certificate when workspace checklist shows missing beneficiaries (strong signal)", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 80,
      jarvaIntakeCoreComplete: true,
      workspaceChecklist: {
        partiesAndRoles: true,
        beneficiaries: false,
        assetsAndFundingPlan: true,
      },
    });
    expect(e.step).toBe("provisions");
    expect(e.blockers.length).toBeGreaterThan(0);
  });

  it("does not advance to certificate when beneficiary count is zero but reported", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 0 },
      jarvaIntakeCompletenessPct: 85,
      jarvaIntakeCoreComplete: true,
    });
    expect(e.step).toBe("provisions");
    expect(e.title).toContain("Workspace readiness");
  });

  it("does not advance to review at 95% completeness when apply blockers are present", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 95,
      jarvaIntakeCoreComplete: true,
      jarvaApplyBlockers: ["Incomplete: Grantor name"],
    });
    expect(e.step).toBe("provisions");
  });

  it("structural blockers override PPM execution-stage signals (finalized + certs)", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 95,
      jarvaIntakeCoreComplete: true,
      workspaceChecklist: {
        partiesAndRoles: true,
        beneficiaries: false,
        assetsAndFundingPlan: true,
      },
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingFinalizedCount: 1,
      securitiesCertificatesIssuedActiveCount: 1,
    });
    expect(e.step).toBe("provisions");
    expect(e.blockers.length).toBeGreaterThan(0);
  });

  it("allows review when checklist is complete and intake is complete", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 95,
      jarvaIntakeCoreComplete: true,
      workspaceChecklist: {
        partiesAndRoles: true,
        beneficiaries: true,
        assetsAndFundingPlan: true,
      },
      jarvaHardBlockers: [],
      jarvaApplyBlockers: [],
    });
    expect(e.step).toBe("review");
  });

  it("skips certificate milestone when issued asset certificates exist (workProduct signal)", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 80,
      jarvaIntakeCoreComplete: true,
      issuedAssetCertificateCount: 1,
    });
    expect(e.step).toBe("provisions");
    expect(e.title).toContain("Refine intake");
  });

  it("skips certificate milestone when only securities module executed certificates exist (combined signal)", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 80,
      jarvaIntakeCoreComplete: true,
      securitiesCertificatesIssuedCount: 1,
    });
    expect(e.step).toBe("provisions");
    expect(e.title).toContain("Refine intake");
  });

  it("at high completeness, issued certificates advance to review instead of certificate step", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 95,
      jarvaIntakeCoreComplete: true,
      issuedAssetCertificateCount: 2,
    });
    expect(e.step).toBe("review");
  });

  it("forces certificate milestone when DB shows zero issued certificates but intake completeness is high", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 100,
      jarvaIntakeCoreComplete: true,
      issuedAssetCertificateCount: 0,
    });
    expect(e.step).toBe("certificate");
  });

  it("uses threshold review when certificate count signal is absent (fallback)", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 95,
      jarvaIntakeCoreComplete: true,
    });
    expect(e.step).toBe("review");
  });

  it("review still blocked when apply blockers exist even with certificates issued", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
      jarvaIntakeCompletenessPct: 95,
      jarvaIntakeCoreComplete: true,
      issuedAssetCertificateCount: 1,
      jarvaApplyBlockers: ["Blocked"],
    });
    expect(e.step).toBe("provisions");
  });

  it("lateStepStructuralBlockers aggregates checklist and counts", () => {
    const b = lateStepStructuralBlockers({
      workspaceChecklist: { beneficiaries: false },
      workspaceCounts: { beneficiaries: 0 },
      jarvaHardBlockers: ["x"],
    });
    expect(b.length).toBeGreaterThanOrEqual(2);
  });

  it("appends jarvaWorkflowPath focus lines to procedural instructions", () => {
    const e = evaluateJarvaProceduralStep({
      trustId: "t1",
      clientId: "c1",
      workspaceCounts: { parties: 2, assets: 0 },
      jarvaWorkflowPath: "trust_ppm",
    });
    expect(e.instructions.some((s) => /PPM/i.test(s))).toBe(true);
  });

  const lateReadyBase = {
    trustId: "t1",
    clientId: "c1",
    workspaceCounts: { parties: 2, assets: 1, beneficiaries: 1 },
    jarvaIntakeCoreComplete: true,
    workspaceChecklist: {
      partiesAndRoles: true,
      beneficiaries: true,
      assetsAndFundingPlan: true,
    },
    jarvaHardBlockers: [] as string[],
    jarvaApplyBlockers: [] as string[],
  };

  it("PPM lane with draft-only offering (explicit draft count) asks to continue structuring", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 1,
      securityOfferingFinalizedCount: 0,
    });
    expect(e.step).toBe("provisions");
    expect(e.title).toMatch(/structuring/i);
  });

  it("PPM lane: draft vs finalized produce different primary titles", () => {
    const draft = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 1,
      securityOfferingFinalizedCount: 0,
    });
    const fin = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 0,
      securityOfferingFinalizedCount: 1,
      securitiesCertificatesIssuedActiveCount: 0,
    });
    expect(draft.title).toMatch(/structuring/i);
    expect(fin.title).toMatch(/issuance next/i);
  });

  it("PPM lane with finalized offering and no certificates pushes to issuance step at high completeness", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 95,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 0,
      securityOfferingFinalizedCount: 1,
      securitiesCertificatesIssuedActiveCount: 0,
    });
    expect(e.step).toBe("certificate");
    expect(e.title).toMatch(/issuance/i);
  });

  it("PPM lane with finalized offering and issued certificates advances to review at high completeness", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 95,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingFinalizedCount: 1,
      securitiesCertificatesIssuedActiveCount: 1,
    });
    expect(e.step).toBe("review");
  });

  it("PPM lane with legacy draft-only signal (no draft count) still treats as structuring", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 95,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingFinalizedCount: 0,
    });
    expect(e.step).toBe("provisions");
    expect(e.title).toMatch(/structuring/i);
  });

  it("bond lane falls back to legacy behavior when bond status counts are absent", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 95,
      jarvaWorkflowPath: "trust_bond",
      bondInstrumentCount: 1,
    });
    expect(e.step).toBe("review");
  });

  it("bond lane with pre-issuance instrument focuses on continuing bond workflow", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_bond",
      bondInstrumentCount: 1,
      bondPreIssuanceCount: 1,
      bondIssuedCount: 0,
    });
    expect(e.step).toBe("provisions");
    expect(e.title).toMatch(/underway/i);
  });

  it("bond lane with issued bond only moves toward review at high completeness", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 95,
      jarvaWorkflowPath: "trust_bond",
      bondInstrumentCount: 1,
      bondPreIssuanceCount: 0,
      bondIssuedCount: 1,
    });
    expect(e.step).toBe("review");
    expect(e.title).toMatch(/review/i);
  });

  it("prepends progress-aware execution cue for PPM draft offering", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 1,
      securityOfferingFinalizedCount: 0,
    });
    expect(e.instructions[0]).toMatch(/draft/i);
  });

  it("PPM lane: inactive cancelled-only offerings are explicit (not active issuance)", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 0,
      securityOfferingFinalizedCount: 0,
      securityOfferingCancelledCount: 1,
      securityOfferingErrorCount: 0,
    });
    expect(e.title).toMatch(/inactive/i);
    expect(e.instructions.some((s) => /cancelled/i.test(s))).toBe(true);
    expect(e.instructions.some((s) => /not active issuance/i.test(s))).toBe(true);
  });

  it("PPM lane: inactive error-only offerings name the error state", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 0,
      securityOfferingFinalizedCount: 0,
      securityOfferingCancelledCount: 0,
      securityOfferingErrorCount: 1,
    });
    expect(e.instructions.some((s) => /in error/i.test(s))).toBe(true);
  });

  it("PPM lane: draft vs finalized vs issued produce distinct execution cues", () => {
    const draft = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 1,
      securityOfferingFinalizedCount: 0,
    });
    const finNoCert = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingDraftCount: 0,
      securityOfferingFinalizedCount: 1,
      securitiesCertificatesIssuedActiveCount: 0,
    });
    const finCert = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 95,
      jarvaWorkflowPath: "trust_ppm",
      securityOfferingCount: 1,
      securityOfferingFinalizedCount: 1,
      securitiesCertificatesIssuedActiveCount: 1,
    });
    expect(draft.instructions.some((s) => /draft offering/i.test(s))).toBe(true);
    expect(finNoCert.instructions.some((s) => /finalized/i.test(s) && /issuance/i.test(s))).toBe(true);
    expect(finCert.instructions.some((s) => /issued certificate/i.test(s))).toBe(true);
  });

  it("bond lane: closed-only (no issued row) still reads as issuance complete", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_bond",
      bondInstrumentCount: 1,
      bondPreIssuanceCount: 0,
      bondIssuedCount: 0,
      bondClosedCount: 1,
      bondVoidedCount: 0,
      hasIssuedBond: false,
    });
    expect(e.title).toMatch(/complete/i);
    expect(e.instructions.some((s) => /closed/i.test(s))).toBe(true);
  });

  it("bond lane: voided-only instruments are isolated (not active issuance)", () => {
    const e = evaluateJarvaProceduralStep({
      ...lateReadyBase,
      jarvaIntakeCompletenessPct: 80,
      jarvaWorkflowPath: "trust_bond",
      bondInstrumentCount: 1,
      bondPreIssuanceCount: 0,
      bondIssuedCount: 0,
      bondClosedCount: 0,
      bondVoidedCount: 1,
    });
    expect(e.title).toMatch(/voided/i);
    expect(e.instructions.some((s) => /voided/i.test(s) && /active issuance/i.test(s))).toBe(true);
  });
});

describe("formatProceduralJarvaBanner", () => {
  it("includes step title and gate", () => {
    const e = evaluateJarvaProceduralStep({});
    const b = formatProceduralJarvaBanner(e);
    expect(b).toContain("Trust workflow");
    expect(b).toContain("Gate");
  });
});
