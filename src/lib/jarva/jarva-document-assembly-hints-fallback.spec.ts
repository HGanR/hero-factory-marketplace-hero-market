/**
 * @jest-environment node
 */
import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import { computeJarvaDocumentAssemblyHintsFallback } from "./jarva-document-assembly-hints-fallback";

const loadLatestJarvaIntakePayloadMock = jest.fn();
const buildWorkspaceSummaryForTrustMock = jest.fn();

jest.mock("@/lib/jarva/persist-jarva-intake-draft", () => ({
  loadLatestJarvaIntakePayload: (...a: unknown[]) => loadLatestJarvaIntakePayloadMock(...a),
}));

jest.mock("@/lib/trusts/build-workspace-summary", () => ({
  buildWorkspaceSummaryForTrust: (...a: unknown[]) => buildWorkspaceSummaryForTrustMock(...a),
}));

const fullWorkProduct = {
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
};

describe("computeJarvaDocumentAssemblyHintsFallback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when no persisted intake", async () => {
    loadLatestJarvaIntakePayloadMock.mockResolvedValue({ payload: null, version: 0 });
    const r = await computeJarvaDocumentAssemblyHintsFallback({
      db: {} as never,
      userId: 1,
      trustId: "t1",
      context: { trustId: "t1" },
      priorSessionUserMessageCount: 0,
    });
    expect(r).toBeNull();
    expect(buildWorkspaceSummaryForTrustMock).not.toHaveBeenCalled();
  });

  it("returns null when workspace summary cannot be loaded", async () => {
    loadLatestJarvaIntakePayloadMock.mockResolvedValue({
      payload: {
        intake: {
          grantor: { name: "G" },
          trustee: { name: "T" },
          governingState: "NY",
          objectives: "x",
          trustName: "TN",
        },
        schemaVersion: 1,
      },
      version: 1,
    });
    buildWorkspaceSummaryForTrustMock.mockResolvedValue(null);
    const r = await computeJarvaDocumentAssemblyHintsFallback({
      db: {} as never,
      userId: 1,
      trustId: "t1",
      context: {
        trustId: "t1",
        workspaceChecklist: { partiesAndRoles: true, beneficiaries: true, assetsAndFundingPlan: true },
        workspaceCounts: { parties: 2, beneficiaries: 1, assets: 1 },
      },
      priorSessionUserMessageCount: 0,
    });
    expect(r).toBeNull();
  });

  it("returns hints when intake + workspace summary load successfully", async () => {
    loadLatestJarvaIntakePayloadMock.mockResolvedValue({
      payload: {
        intake: {
          grantor: { name: "G" },
          trustee: { name: "T" },
          governingState: "NY",
          objectives: "x",
          trustName: "TN",
        },
        schemaVersion: 1,
      },
      version: 1,
    });
    buildWorkspaceSummaryForTrustMock.mockResolvedValue({
      trust: { id: "t1", clientId: null, name: null, trustType: null, jurisdictionState: "NY", workspaceStatus: null },
      client: null,
      parties: { grantorName: "G", trusteeName: "T", grantorAddress: null, trusteeAddress: null },
      firm: { name: null, address: null, phone: null, email: null },
      counts: { parties: 2, beneficiaries: 1, assets: 1 },
      checklist: {
        partiesAndRoles: true,
        beneficiaries: true,
        assetsAndFundingPlan: true,
        generateDraftDocuments: false,
      },
      workProduct: fullWorkProduct,
    });
    const r = await computeJarvaDocumentAssemblyHintsFallback({
      db: {} as never,
      userId: 1,
      trustId: "t1",
      context: {
        trustId: "t1",
        workspaceChecklist: { partiesAndRoles: true, beneficiaries: true, assetsAndFundingPlan: true },
        workspaceCounts: { parties: 2, beneficiaries: 1, assets: 1 },
      },
      priorSessionUserMessageCount: 0,
    });
    expect(r).not.toBeNull();
    expect(r!.ppmDraftReadyForGeneration).toBe(true);
    expect(r!.lines.length).toBeGreaterThan(0);
  });
});
