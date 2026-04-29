import { describe, it, expect } from "@jest/globals";
import { parseTrustRecordsStatePayload, mergeTrustConfigFromUnknown } from "./parse-trust-records-state-payload";
import type { TrustRecordsStatePayload } from "./parse-trust-records-state-payload";

/** Mirrors `defaultStore` in trust-records/page.tsx enough for merge + array defaults. */
function makeTestDefaults(): TrustRecordsStatePayload {
  return {
    config: {
      entityType: "Trust",
      entityName: "Trust Name Here",
      firmName: "",
      firmAddress: "",
      firmPhone: "",
      firmEmail: "",
      entityAddressLine1: "",
      entityAddressLine2: "",
      entityCity: "",
      entityState: "",
      entityPostalCode: "",
      entityCountry: "US",
      grantorName: "",
      trusteeName: "",
      grantorAddressLine1: "",
      grantorAddressLine2: "",
      grantorCity: "",
      grantorState: "",
      grantorPostalCode: "",
      grantorCountry: "US",
      trusteeAddressLine1: "",
      trusteeAddressLine2: "",
      trusteeCity: "",
      trusteeState: "",
      trusteePostalCode: "",
      trusteeCountry: "US",
      consultantName: "",
      consultantAddressLine1: "",
      consultantAddressLine2: "",
      consultantCity: "",
      consultantState: "",
      consultantPostalCode: "",
      consultantCountry: "US",
      trustProtectorName: "",
      trustProtectorAddressLine1: "",
      trustProtectorAddressLine2: "",
      trustProtectorCity: "",
      trustProtectorState: "",
      trustProtectorPostalCode: "",
      trustProtectorCountry: "US",
      managerName: "",
      managerAddressLine1: "",
      managerAddressLine2: "",
      managerCity: "",
      managerState: "",
      managerPostalCode: "",
      managerCountry: "US",
      unitsAuthorized: 100,
      certificatePrefix: "TTC",
      bondPrefix: "BND",
      sealDataUrl: undefined,
      watermarkDataUrl: undefined,
      qrDataUrl: undefined,
      barcodeDataUrl: undefined,
      noticeQrDataUrl: undefined,
      assetAddressUrl: "",
      barcodeOpacity: 1,
      watermarkOpacity: 0.12,
      watermarkScale: 1,
      watermarkRotateDeg: 0,
      trusteesDisplayName: "Board of Trustees",
      clientAuthorityTitle: "",
    },
    assets: [],
    certificates: [],
    bonds: [],
    minutes: [],
    meetings: [],
    serialCounter: 1,
    bondSerialCounter: 1,
  };
}

describe("parseTrustRecordsStatePayload", () => {
  const defaults = makeTestDefaults();

  it("returns defaults for non-object payload", () => {
    expect(parseTrustRecordsStatePayload(null, defaults)).toEqual(defaults);
    expect(parseTrustRecordsStatePayload(undefined, defaults)).toEqual(defaults);
    expect(parseTrustRecordsStatePayload("string", defaults)).toEqual(defaults);
    expect(parseTrustRecordsStatePayload(42, defaults)).toEqual(defaults);
    expect(parseTrustRecordsStatePayload([], defaults)).toEqual(defaults);
  });

  it("reverts invalid enum entityType to defaults", () => {
    const out = parseTrustRecordsStatePayload(
      { config: { ...defaults.config, entityType: "NotARealType" } },
      defaults
    );
    expect(out.config.entityType).toBe("Trust");
  });

  it("keeps valid primitive config fields", () => {
    const out = parseTrustRecordsStatePayload(
      {
        config: {
          ...defaults.config,
          entityName: "Preserved Name",
          certificatePrefix: "ZZZ",
          unitsAuthorized: 250,
        },
      },
      defaults
    );
    expect(out.config.entityName).toBe("Preserved Name");
    expect(out.config.certificatePrefix).toBe("ZZZ");
    expect(out.config.unitsAuthorized).toBe(250);
  });

  it("loads TrustRecordsJarvaDraftFields when correctly typed", () => {
    const out = parseTrustRecordsStatePayload(
      {
        config: {
          ...defaults.config,
          jarvaObjectivesDraft: "Avoid probate",
          jarvaBeneficiariesSummaryDraft: "Kids",
          jarvaPourOverWillIntentFlag: true,
          jarvaTrustRecordsSyncedAt: "2025-01-01T00:00:00.000Z",
        },
      },
      defaults
    );
    expect(out.config.jarvaObjectivesDraft).toBe("Avoid probate");
    expect(out.config.jarvaBeneficiariesSummaryDraft).toBe("Kids");
    expect(out.config.jarvaPourOverWillIntentFlag).toBe(true);
    expect(out.config.jarvaTrustRecordsSyncedAt).toBe("2025-01-01T00:00:00.000Z");
  });

  it("ignores unknown config keys on the payload", () => {
    const out = parseTrustRecordsStatePayload(
      {
        config: {
          ...defaults.config,
          unknownInjectedKey: "should-not-appear",
        },
      } as Record<string, unknown>,
      defaults
    );
    expect((out.config as Record<string, unknown>).unknownInjectedKey).toBeUndefined();
  });

  it("drops invalid asset rows", () => {
    const goodAsset = {
      id: "a1",
      type: "Cash",
      name: "C",
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    const out = parseTrustRecordsStatePayload(
      {
        assets: [goodAsset, { id: "bad" }],
      },
      defaults
    );
    expect(out.assets).toHaveLength(1);
    expect((out.assets as { id: string }[])[0].id).toBe("a1");
  });

  it("uses empty backingAssetIds when certificate row omits or invalid backing", () => {
    const cert = {
      id: "c1",
      serialNumber: "S1",
      issuedAt: "2020-01-01T00:00:00.000Z",
      denominationUSD: 1,
      ownerName: "O",
      status: "Active",
      documentHash: "h",
    };
    const outMissing = parseTrustRecordsStatePayload({ certificates: [cert] }, defaults);
    expect((outMissing.certificates as { backingAssetIds: string[] }[])[0].backingAssetIds).toEqual([]);

    const outInvalid = parseTrustRecordsStatePayload(
      { certificates: [{ ...cert, backingAssetIds: "nope" }] },
      defaults
    );
    expect((outInvalid.certificates as { backingAssetIds: string[] }[])[0].backingAssetIds).toEqual([]);
  });

  it("clamps oversized Jarva strings", () => {
    const long = "x".repeat(30_000);
    const out = parseTrustRecordsStatePayload(
      { config: { ...defaults.config, jarvaObjectivesDraft: long } },
      defaults
    );
    expect((out.config.jarvaObjectivesDraft as string).length).toBe(25_000);
  });

  it("legacy drafts without Jarva fields still load (merge keeps base config)", () => {
    const out = parseTrustRecordsStatePayload(
      {
        config: {
          entityName: "Legacy Only",
        },
      },
      defaults
    );
    expect(out.config.entityName).toBe("Legacy Only");
    expect(out.config.jarvaObjectivesDraft).toBeUndefined();
  });
});

describe("mergeTrustConfigFromUnknown", () => {
  it("sanitizes moduleType enum", () => {
    const defaults = makeTestDefaults();
    const out = mergeTrustConfigFromUnknown(
      { moduleType: "not-a-module" },
      defaults.config as Record<string, unknown>
    );
    expect(out.moduleType).toBeUndefined();
  });
});
