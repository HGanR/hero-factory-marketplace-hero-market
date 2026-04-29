/**
 * @jest-environment node
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { runJarvaTrustApply } from "./run-jarva-apply";
import type { JarvaTrustIntake } from "./trust-intake-schema";
import { persistSmartTrustDraft } from "@/lib/trusts/persist-smart-trust-draft";
import {
  loadLatestTrustRecordsStore,
  mergeTrustRecordsStoreFromIntake,
  persistTrustRecordsStateDraft,
} from "@/lib/jarva/jarva-trust-records-sync";
import { buildWorkspaceSummaryForTrust } from "@/lib/trusts/build-workspace-summary";

jest.mock("@/lib/trusts/persist-smart-trust-draft", () => ({
  persistSmartTrustDraft: jest.fn(),
}));

jest.mock("@/lib/jarva/jarva-trust-records-sync", () => ({
  loadLatestTrustRecordsStore: jest.fn(),
  mergeTrustRecordsStoreFromIntake: jest.fn((prev, intake) => ({ ...((prev as object) ?? {}), fromIntake: intake })),
  persistTrustRecordsStateDraft: jest.fn(),
}));

jest.mock("@/lib/trusts/build-workspace-summary", () => ({
  buildWorkspaceSummaryForTrust: jest.fn(),
}));

const persistSmartTrustDraftMock = persistSmartTrustDraft as jest.MockedFunction<typeof persistSmartTrustDraft>;
const loadLatestTrustRecordsStoreMock = loadLatestTrustRecordsStore as jest.MockedFunction<
  typeof loadLatestTrustRecordsStore
>;
const persistTrustRecordsStateDraftMock = persistTrustRecordsStateDraft as jest.MockedFunction<
  typeof persistTrustRecordsStateDraft
>;
const buildWorkspaceSummaryForTrustMock = buildWorkspaceSummaryForTrust as jest.MockedFunction<
  typeof buildWorkspaceSummaryForTrust
>;

const TRUST_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = 42;

const validIntake: JarvaTrustIntake = {
  schemaVersion: 1,
  grantor: { name: "Grantor G" },
  trustee: { name: "Trustee T" },
  governingState: "NY",
  objectives: "Probate avoidance",
};

function makeDb(smartDraftRows: unknown[] = []) {
  let selectCount = 0;
  return {
    select: jest.fn(() => {
      selectCount += 1;
      if (selectCount === 1) {
        return {
          from: jest.fn(() => ({
            where: jest.fn(() => ({
              limit: jest.fn(() =>
                Promise.resolve([{ id: TRUST_ID, userId: USER_ID, source: null as string | null }])
              ),
            })),
          })),
        };
      }
      return {
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            orderBy: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve(smartDraftRows)),
            })),
          })),
        })),
      };
    }),
  } as unknown as import("@/lib/db").getDb extends () => Promise<infer R> ? R : never;
}

describe("runJarvaTrustApply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    persistSmartTrustDraftMock.mockResolvedValue({
      draftId: "smart-draft-1",
      nextVersion: 7,
      createdAtIso: new Date().toISOString(),
    });
    loadLatestTrustRecordsStoreMock.mockResolvedValue(null);
    persistTrustRecordsStateDraftMock.mockResolvedValue({ draftId: "tr-state-1", nextVersion: 3 });
    buildWorkspaceSummaryForTrustMock.mockResolvedValue({
      trust: { id: TRUST_ID, clientId: null, name: "T", trustType: null, jurisdictionState: "NY", workspaceStatus: null },
      counts: { parties: 2, beneficiaries: 0, assets: 0 },
      checklist: {
        partiesAndRoles: true,
        beneficiaries: false,
        assetsAndFundingPlan: false,
        generateDraftDocuments: false,
      },
      workProduct: {
        issuedAssetCertificateCount: 0,
        securitiesCertificatesIssuedCount: 0,
        securitiesCertificatesIssuedActiveCount: 0,
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
        hasIssuedSecuritiesCertificate: false,
        hasIssuedWorkflowAssetCertificate: false,
        hasAnyIssuedCertificateLike: false,
        hasBondInstrument: false,
        hasActiveBondWorkflow: false,
        hasIssuedBond: false,
      },
    } as Awaited<ReturnType<typeof buildWorkspaceSummaryForTrust>>);
  });

  it("calls persistSmartTrustDraft with merged draft for valid intake", async () => {
    const db = makeDb([]);
    const result = await runJarvaTrustApply({ db, userId: USER_ID, trustId: TRUST_ID, intake: validIntake });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(persistSmartTrustDraftMock).toHaveBeenCalledTimes(1);
    expect(persistSmartTrustDraftMock.mock.calls[0]![0].trustId).toBe(TRUST_ID);
    expect(persistSmartTrustDraftMock.mock.calls[0]![0].draft).toBeDefined();
    expect(result.smartTrustVersion).toBe(7);
    expect(result.smartDraftId).toBe("smart-draft-1");
  });

  it("merges trust-records-state and calls persistTrustRecordsStateDraft when syncTrustRecords is true", async () => {
    const db = makeDb([]);
    await runJarvaTrustApply({ db, userId: USER_ID, trustId: TRUST_ID, intake: validIntake, syncTrustRecords: true });

    expect(loadLatestTrustRecordsStoreMock).toHaveBeenCalledWith(db, TRUST_ID);
    expect(mergeTrustRecordsStoreFromIntake).toHaveBeenCalled();
    expect(persistTrustRecordsStateDraftMock).toHaveBeenCalledTimes(1);
    expect(persistTrustRecordsStateDraftMock.mock.calls[0]![0].store).toMatchObject({ fromIntake: validIntake });
  });

  it("skips trust-records persistence when syncTrustRecords is false", async () => {
    const db = makeDb([]);
    const result = await runJarvaTrustApply({
      db,
      userId: USER_ID,
      trustId: TRUST_ID,
      intake: validIntake,
      syncTrustRecords: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(loadLatestTrustRecordsStoreMock).not.toHaveBeenCalled();
    expect(persistTrustRecordsStateDraftMock).not.toHaveBeenCalled();
    expect(result.trustRecordsSynced).toBe(false);
  });

  it("builds workspace summary and returns it on success", async () => {
    const db = makeDb([]);
    const result = await runJarvaTrustApply({ db, userId: USER_ID, trustId: TRUST_ID, intake: validIntake });

    expect(buildWorkspaceSummaryForTrustMock).toHaveBeenCalledWith(db, TRUST_ID, USER_ID);
    if (!result.ok) throw new Error("expected ok");
    expect(result.workspaceSummary).toBeDefined();
    expect(result.workspaceSummary.trust?.id).toBe(TRUST_ID);
    expect(result.workspaceSummary.counts?.parties).toBe(2);
    expect(result.workspaceSummary.checklist?.partiesAndRoles).toBe(true);
  });

  it("returns READINESS_BLOCKED without persisting when intake incomplete and not forced", async () => {
    const db = makeDb([]);
    const bad: JarvaTrustIntake = { schemaVersion: 1, grantor: { name: "G" } };
    const result = await runJarvaTrustApply({ db, userId: USER_ID, trustId: TRUST_ID, intake: bad });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected blocked");
    expect(result.error).toBe("READINESS_BLOCKED");
    expect(persistSmartTrustDraftMock).not.toHaveBeenCalled();
    expect(buildWorkspaceSummaryForTrustMock).not.toHaveBeenCalled();
  });
});
