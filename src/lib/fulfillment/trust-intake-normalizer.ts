import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import {
  ClaudeTrustIntakeSchema,
  type ClaudeTrustIntake,
  type TrustIntakeNormalized,
} from "@/lib/fulfillment/trust-intake-types";

function dedupeStrings(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function extractFromSalesText(text: string): Partial<ClaudeTrustIntake> {
  const out: Partial<ClaudeTrustIntake> = {};
  const state = text.match(/\b(?:state of|governing|jurisdiction)\s+([A-Z]{2})\b/i)?.[1];
  if (state) out.jurisdictionState = state.toUpperCase().slice(0, 10);
  const urgency =
    /\brush\b/i.test(text) ? "rush" : /\burgent|asap/i.test(text) ? "high" : null;
  if (urgency) out.urgency = urgency;
  if (/\btrust\b/i.test(text) && !out.trustPurpose) {
    out.trustPurpose = text.slice(0, 2000);
  }
  return out;
}

function mergeTrustIntake(
  structured: Partial<ClaudeTrustIntake>,
  salesSummary?: string | null
): ClaudeTrustIntake {
  const fromSales = salesSummary?.trim() ? extractFromSalesText(salesSummary) : {};
  const parsed = ClaudeTrustIntakeSchema.safeParse({
    ...fromSales,
    ...structured,
    partiesInvolved: {
      ...fromSales.partiesInvolved,
      ...structured.partiesInvolved,
    },
    trusteePreferences: {
      ...fromSales.trusteePreferences,
      ...structured.trusteePreferences,
    },
    existingDocuments: {
      ...fromSales.existingDocuments,
      ...structured.existingDocuments,
    },
  });
  return parsed.success ? parsed.data : ClaudeTrustIntakeSchema.parse({});
}

export function toNormalizedTrustProfile(raw: ClaudeTrustIntake): TrustIntakeNormalized {
  const parties = raw.partiesInvolved;
  const docs = raw.existingDocuments;
  let desired: TrustIntakeNormalized["desiredOutputPackage"] = "trust_review_packet";
  if (raw.desiredOutputPackage === "smart_trust_setup_brief") desired = "smart_trust_setup_brief";
  if (raw.desiredOutputPackage === "both") desired = "both";

  return {
    trustPurpose: raw.trustPurpose?.trim() || null,
    grantorName: parties?.grantor?.name?.trim() || null,
    trusteeName: parties?.trustee?.name?.trim() || null,
    beneficiariesSummary: parties?.beneficiariesSummary?.trim() || null,
    successorTrusteeNote:
      raw.trusteePreferences?.successorTrusteeNote?.trim() ||
      parties?.protectorNote?.trim() ||
      null,
    protectorNote: raw.protectorPreferences?.trim() || null,
    assetCategories: dedupeStrings(raw.assetCategories ?? [], 20),
    familyBusinessContext: raw.familyBusinessContext?.trim() || null,
    jurisdictionState: raw.jurisdictionState?.trim().toUpperCase() || null,
    urgency: raw.urgency ?? null,
    existingDocuments: {
      hasPourOverWill: docs?.hasPourOverWill ?? null,
      hasPriorTrust: docs?.hasPriorTrust ?? null,
      attorneyEngaged: docs?.attorneyEngaged ?? null,
      documentNotes: docs?.documentNotes?.trim() || null,
    },
    desiredOutputPackage: desired,
  };
}

/** Map fulfillment intake → Jarva shape for readiness evaluation reuse. */
export function normalizedToJarvaIntake(profile: TrustIntakeNormalized): JarvaTrustIntake {
  return {
    schemaVersion: 1,
    matterLabel: profile.trustPurpose?.slice(0, 500) ?? undefined,
    objectives: profile.trustPurpose ?? undefined,
    governingState: profile.jurisdictionState ?? undefined,
    trustName: profile.familyBusinessContext?.slice(0, 200) ?? undefined,
    grantor: profile.grantorName ? { name: profile.grantorName } : undefined,
    trustee: profile.trusteeName ? { name: profile.trusteeName } : undefined,
    successorTrusteeNote: profile.successorTrusteeNote ?? undefined,
    beneficiariesSummary: profile.beneficiariesSummary ?? undefined,
    assetScheduleNotesDraft:
      profile.assetCategories.length > 0
        ? profile.assetCategories.join("; ")
        : undefined,
    pourOverWillNeeded: profile.existingDocuments.hasPourOverWill ?? undefined,
    jurisdictionAmbiguityNote: profile.protectorNote ?? undefined,
  };
}

export function normalizeTrustIntake(input: {
  trustIntake?: unknown;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): TrustIntakeNormalized {
  let structured: Partial<ClaudeTrustIntake> = {};
  if (input.trustIntake && typeof input.trustIntake === "object") {
    const p = ClaudeTrustIntakeSchema.safeParse(input.trustIntake);
    if (p.success) structured = p.data;
  }
  if (input.requestedDeliverableJson?.trim()) {
    try {
      const d = JSON.parse(input.requestedDeliverableJson) as { type?: string };
      const t = typeof d.type === "string" ? d.type.trim() : "";
      if (t === "smart_trust_setup_brief") structured.desiredOutputPackage = "smart_trust_setup_brief";
      else if (t === "trust_review_packet") structured.desiredOutputPackage = "trust_review_packet";
    } catch {
      /* ignore */
    }
  }
  const merged = mergeTrustIntake(structured, input.salesSummaryText);
  return toNormalizedTrustProfile(merged);
}

export function parseTrustIntakeFromHandoffJson(
  executiveHandoffJson: string | null | undefined
): ClaudeTrustIntake | null {
  if (!executiveHandoffJson?.trim()) return null;
  try {
    const h = JSON.parse(executiveHandoffJson) as {
      trustIntake?: unknown;
      intake?: { normalized?: TrustIntakeNormalized };
    };
    if (h.trustIntake) {
      const p = ClaudeTrustIntakeSchema.safeParse(h.trustIntake);
      if (p.success) return p.data;
    }
    return null;
  } catch {
    return null;
  }
}
