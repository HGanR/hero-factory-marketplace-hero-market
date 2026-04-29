/**
 * Runtime parsing for `trust-records-state` draft payloads (and same-shaped snapshots).
 * Merges with the caller-provided defaults so legacy drafts and partial API payloads load safely.
 */

import type { TrustRecordsJarvaDraftFields } from "@/lib/trust-records/trust-records-jarva-fields";

const MAX_CONFIG_STRING = 2_500_000; // data URLs / long notes
const MAX_JARVA_STRING = 25_000;

const ENTITY_TYPES = [
  "Trust",
  "LLC",
  "Corporation",
  "Partnership",
  "Foundation",
  "Nonprofit",
  "Estate",
  "Sole Proprietorship",
  "Grantor",
  "Other",
] as const;

const MODULE_TYPES = [
  "revocable_living_trust",
  "private_express_trust",
  "irrevocable_trust",
  "religious_foundation",
  "family_office",
  "parent_company",
  "testamentary_trust",
  "special_purpose_trust",
] as const;

const TRUST_CATEGORY = ["private", "charitable", "statutory"] as const;
const FORMATION_MODE = ["express", "resulting", "constructive"] as const;
const GOVERNANCE_MODE = ["simple", "complex"] as const;
const TRUST_SUBTYPE = ["standard", "grantor", "QSST", "ESBT"] as const;

const ASSET_TYPES = [
  "Cash",
  "Real Estate",
  "Security",
  "Promissory Note",
  "Digital Asset",
  "Intellectual Property",
  "Other",
] as const;

const CERT_STATUSES = ["Active", "Voided", "Transferred"] as const;
const MINUTE_KINDS = ["Minutes", "Resolution", "Amendment"] as const;
const BOND_INTEREST = ["fixed", "variable"] as const;
const BOND_FREQ = ["monthly", "quarterly", "annual"] as const;
const BOND_SENIORITY = ["senior", "subordinated"] as const;
const BOND_STATUS = ["Active", "Matured", "Redeemed", "Defaulted", "Voided"] as const;

const JARVA_KEYS: (keyof TrustRecordsJarvaDraftFields)[] = [
  "jarvaObjectivesDraft",
  "jarvaBeneficiariesSummaryDraft",
  "jarvaSuccessorTrusteeNote",
  "jarvaJurisdictionAmbiguityNote",
  "jarvaAssetScheduleNotesDraft",
  "jarvaPourOverWillIntentFlag",
  "jarvaTrustRecordsSyncedAt",
];

function clampStr(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function mergeJarvaFields(r: Record<string, unknown>, target: Record<string, unknown>): void {
  for (const k of JARVA_KEYS) {
    if (!(k in r)) continue;
    const v = r[k];
    if (k === "jarvaPourOverWillIntentFlag") {
      if (typeof v === "boolean") target[k] = v;
      continue;
    }
    if (typeof v === "string") {
      const max =
        k === "jarvaObjectivesDraft" ||
        k === "jarvaBeneficiariesSummaryDraft" ||
        k === "jarvaAssetScheduleNotesDraft"
          ? MAX_JARVA_STRING
          : k === "jarvaSuccessorTrusteeNote" || k === "jarvaJurisdictionAmbiguityNote"
            ? Math.min(MAX_JARVA_STRING, 5000)
            : MAX_JARVA_STRING;
      target[k] = clampStr(v, max);
    }
  }
}

/**
 * Merge `raw` config onto `defaults` with per-key type checks. Unknown keys are ignored.
 * Legacy drafts missing newer fields keep defaults; invalid types fall back to defaults per key.
 */
export function mergeTrustConfigFromUnknown<C extends Record<string, unknown>>(raw: unknown, defaults: C): C {
  if (!isPlainObject(raw)) return { ...defaults };
  const r = raw;
  const out = { ...defaults } as Record<string, unknown>;

  const enumKeys = new Set([
    "entityType",
    "moduleType",
    "trustCategory",
    "formationMode",
    "governanceMode",
    "trustSubtype",
  ]);

  for (const key of Object.keys(defaults) as (keyof C & string)[]) {
    if (enumKeys.has(key)) continue;
    if (!(key in r)) continue;
    const rv = r[key];
    const dv = defaults[key];

    if (typeof dv === "string") {
      if (typeof rv === "string") out[key] = clampStr(rv, MAX_CONFIG_STRING);
      continue;
    }
    if (typeof dv === "number" && typeof rv === "number" && Number.isFinite(rv)) {
      out[key] = rv;
      continue;
    }
    if (typeof dv === "boolean" && typeof rv === "boolean") {
      out[key] = rv;
      continue;
    }
    if (dv === undefined) {
      if (typeof rv === "string") out[key] = clampStr(rv, MAX_CONFIG_STRING);
      else if (typeof rv === "number" && Number.isFinite(rv)) out[key] = rv;
      else if (typeof rv === "boolean") out[key] = rv;
    }
  }

  if (typeof r.entityType === "string" && (ENTITY_TYPES as readonly string[]).includes(r.entityType)) {
    out.entityType = r.entityType;
  }
  if (typeof r.moduleType === "string" && (MODULE_TYPES as readonly string[]).includes(r.moduleType)) {
    out.moduleType = r.moduleType;
  }
  if (typeof r.trustCategory === "string" && (TRUST_CATEGORY as readonly string[]).includes(r.trustCategory)) {
    out.trustCategory = r.trustCategory;
  }
  if (typeof r.formationMode === "string" && (FORMATION_MODE as readonly string[]).includes(r.formationMode)) {
    out.formationMode = r.formationMode;
  }
  if (typeof r.governanceMode === "string" && (GOVERNANCE_MODE as readonly string[]).includes(r.governanceMode)) {
    out.governanceMode = r.governanceMode;
  }
  if (typeof r.trustSubtype === "string" && (TRUST_SUBTYPE as readonly string[]).includes(r.trustSubtype)) {
    out.trustSubtype = r.trustSubtype;
  }

  mergeJarvaFields(r, out);

  return out as C;
}

function parseAsset(x: unknown): unknown | null {
  if (!isPlainObject(x)) return null;
  const id = x.id;
  const type = x.type;
  const name = x.name;
  const createdAt = x.createdAt;
  if (typeof id !== "string" || typeof name !== "string" || typeof createdAt !== "string") return null;
  if (typeof type !== "string" || !(ASSET_TYPES as readonly string[]).includes(type)) return null;
  const o: Record<string, unknown> = {
    id,
    type,
    name,
    createdAt,
  };
  if (typeof x.identifier === "string") o.identifier = clampStr(x.identifier, 20_000);
  if (typeof x.valuationUSD === "number" && Number.isFinite(x.valuationUSD)) o.valuationUSD = x.valuationUSD;
  if (typeof x.valuationAsOf === "string") o.valuationAsOf = x.valuationAsOf;
  if (typeof x.encumbrances === "string") o.encumbrances = clampStr(x.encumbrances, 50_000);
  if (typeof x.evidenceNotes === "string") o.evidenceNotes = clampStr(x.evidenceNotes, 50_000);
  return o;
}

function parseCertificate(x: unknown): unknown | null {
  if (!isPlainObject(x)) return null;
  const required = ["id", "serialNumber", "issuedAt", "denominationUSD", "ownerName", "status", "documentHash"] as const;
  for (const k of required) {
    if (!(k in x)) return null;
  }
  if (typeof x.id !== "string" || typeof x.serialNumber !== "string" || typeof x.issuedAt !== "string") return null;
  if (typeof x.ownerName !== "string" || typeof x.documentHash !== "string") return null;
  if (typeof x.denominationUSD !== "number" || !Number.isFinite(x.denominationUSD)) return null;
  if (typeof x.status !== "string" || !(CERT_STATUSES as readonly string[]).includes(x.status)) return null;
  const backing = x.backingAssetIds;
  const backingAssetIds =
    Array.isArray(backing) && backing.every((b) => typeof b === "string") ? backing : [];

  const o: Record<string, unknown> = {
    id: x.id,
    serialNumber: x.serialNumber,
    issuedAt: x.issuedAt,
    denominationUSD: x.denominationUSD,
    ownerName: x.ownerName,
    status: x.status,
    backingAssetIds,
    documentHash: x.documentHash,
  };
  const optStr = (k: string) => {
    if (typeof x[k] === "string") o[k] = clampStr(x[k] as string, MAX_CONFIG_STRING);
  };
  optStr("notes");
  optStr("signedBy");
  optStr("signatureHint");
  optStr("signedAt");
  optStr("signatureHash");
  optStr("signatureSealDataUrl");
  if (isPlainObject(x.xrplIou)) {
    const xi = x.xrplIou;
    if (
      typeof xi.txHash === "string" &&
      typeof xi.currency === "string" &&
      typeof xi.amount === "string" &&
      typeof xi.recipient === "string" &&
      typeof xi.issuer === "string" &&
      typeof xi.issuedAt === "string"
    ) {
      o.xrplIou = {
        txHash: xi.txHash,
        currency: xi.currency,
        amount: xi.amount,
        recipient: xi.recipient,
        issuer: xi.issuer,
        issuedAt: xi.issuedAt,
        ...(typeof xi.memo === "string" ? { memo: clampStr(xi.memo, 10_000) } : {}),
      };
    }
  }
  return o;
}

function parseBond(x: unknown): unknown | null {
  if (!isPlainObject(x)) return null;
  const nums = ["principalAmountUSD", "interestRatePct"] as const;
  for (const k of nums) {
    if (typeof x[k] !== "number" || !Number.isFinite(x[k])) return null;
  }
  const strs = [
    "id",
    "bondNumber",
    "issuedAt",
    "holderName",
    "maturityDate",
    "governingLaw",
    "ppmDocumentId",
    "documentHash",
  ] as const;
  for (const k of strs) {
    if (typeof x[k] !== "string") return null;
  }
  if (typeof x.interestType !== "string" || !(BOND_INTEREST as readonly string[]).includes(x.interestType)) return null;
  if (typeof x.paymentFrequency !== "string" || !(BOND_FREQ as readonly string[]).includes(x.paymentFrequency))
    return null;
  if (typeof x.seniority !== "string" || !(BOND_SENIORITY as readonly string[]).includes(x.seniority)) return null;
  if (typeof x.status !== "string" || !(BOND_STATUS as readonly string[]).includes(x.status)) return null;
  if (typeof x.callable !== "boolean") return null;

  const o: Record<string, unknown> = {
    id: x.id,
    bondNumber: x.bondNumber,
    issuedAt: x.issuedAt,
    holderName: x.holderName,
    principalAmountUSD: x.principalAmountUSD,
    interestRatePct: x.interestRatePct,
    interestType: x.interestType,
    paymentFrequency: x.paymentFrequency,
    maturityDate: x.maturityDate,
    seniority: x.seniority,
    callable: x.callable,
    governingLaw: x.governingLaw,
    ppmDocumentId: x.ppmDocumentId,
    status: x.status,
    documentHash: x.documentHash,
  };
  if (typeof x.collateralDescription === "string") o.collateralDescription = clampStr(x.collateralDescription, 50_000);
  if (typeof x.notes === "string") o.notes = clampStr(x.notes, 50_000);
  return o;
}

function parseMinute(x: unknown): unknown | null {
  if (!isPlainObject(x)) return null;
  const keys = ["id", "kind", "title", "meetingDate", "body", "adoptedBy", "createdAt", "hash"] as const;
  for (const k of keys) {
    if (typeof x[k] !== "string") return null;
  }
  if (!(MINUTE_KINDS as readonly string[]).includes(x.kind as string)) return null;
  const rc = x.relatedCertificateIds;
  const ra = x.relatedAssetIds;
  if (!Array.isArray(rc) || !rc.every((c) => typeof c === "string")) return null;
  if (!Array.isArray(ra) || !ra.every((a) => typeof a === "string")) return null;
  return {
    id: x.id,
    kind: x.kind,
    title: x.title,
    meetingDate: x.meetingDate,
    body: clampStr(x.body, 500_000),
    relatedCertificateIds: rc,
    relatedAssetIds: ra,
    adoptedBy: x.adoptedBy,
    createdAt: x.createdAt,
    hash: x.hash,
  };
}

function parseMeeting(x: unknown): unknown | null {
  if (!isPlainObject(x)) return null;
  const keys = ["id", "title", "meetingDate", "attendees", "location", "agenda", "notes", "resolutions", "createdAt"] as const;
  for (const k of keys) {
    if (typeof x[k] !== "string") return null;
  }
  const o: Record<string, unknown> = {
    id: x.id,
    title: x.title,
    meetingDate: x.meetingDate,
    attendees: clampStr(x.attendees, 100_000),
    location: clampStr(x.location, 20_000),
    agenda: clampStr(x.agenda, 200_000),
    notes: clampStr(x.notes, 200_000),
    resolutions: clampStr(x.resolutions, 200_000),
    createdAt: x.createdAt,
  };
  for (const img of ["sealDataUrl", "watermarkDataUrl", "qrDataUrl", "barcodeDataUrl", "noticeQrDataUrl", "renderData"] as const) {
    if (typeof x[img] === "string") o[img] = clampStr(x[img] as string, MAX_CONFIG_STRING);
  }
  return o;
}

function sanitizeArray<T>(raw: unknown, parseItem: (x: unknown) => T | null, fallback: T[]): T[] {
  if (!Array.isArray(raw)) return fallback;
  const out: T[] = [];
  for (const item of raw) {
    const p = parseItem(item);
    if (p !== null) out.push(p);
  }
  return out.length ? out : fallback;
}

export type TrustRecordsStatePayload = {
  config: Record<string, unknown>;
  assets: unknown[];
  certificates: unknown[];
  bonds: unknown[];
  minutes: unknown[];
  meetings: unknown[];
  serialCounter: number;
  bondSerialCounter: number;
};

/**
 * Parse and validate a trust-records-state payload. Unknown top-level keys are ignored.
 * Arrays drop invalid elements; empty array after filtering falls back to `defaults` for that array when
 * the raw array was missing or empty — when raw was present but all invalid, use [].
 */
export function parseTrustRecordsStatePayload<T extends TrustRecordsStatePayload>(payload: unknown, defaults: T): T {
  if (!isPlainObject(payload)) {
    return { ...defaults } as T;
  }

  const p = payload;
  const configIn = "config" in p ? p.config : undefined;
  const config = mergeTrustConfigFromUnknown(configIn, defaults.config as Record<string, unknown>) as T["config"];

  const assets = sanitizeArray(p.assets, parseAsset, defaults.assets as unknown[]) as T["assets"];
  const certificates = sanitizeArray(p.certificates, parseCertificate, defaults.certificates as unknown[]) as T["certificates"];
  const bonds = sanitizeArray(p.bonds, parseBond, defaults.bonds as unknown[]) as T["bonds"];
  const minutes = sanitizeArray(p.minutes, parseMinute, defaults.minutes as unknown[]) as T["minutes"];
  const meetings = sanitizeArray(p.meetings, parseMeeting, defaults.meetings as unknown[]) as T["meetings"];

  const serialCounter =
    typeof p.serialCounter === "number" && Number.isFinite(p.serialCounter) && p.serialCounter >= 0
      ? Math.floor(p.serialCounter)
      : defaults.serialCounter;

  const bondSerialCounter =
    typeof p.bondSerialCounter === "number" && Number.isFinite(p.bondSerialCounter) && p.bondSerialCounter >= 0
      ? Math.floor(p.bondSerialCounter)
      : defaults.bondSerialCounter;

  return {
    ...defaults,
    config,
    assets,
    certificates,
    bonds,
    minutes,
    meetings,
    serialCounter,
    bondSerialCounter,
  } as T;
}
