/**
 * Migrate persisted state from older shapes (v2 → v3 vault + cases).
 */

import type { DocumentKind } from "./documentModels";
import { computeFollowUpDueAt } from "./dueDateLogic";
import { inferPrimaryParty } from "./vaultParty";
import type { FinancialReadinessState } from "./state";
import type { VaultDocument, VaultDocumentType } from "./vaultTypes";

function mapKindToVaultType(kind: DocumentKind): VaultDocumentType {
  switch (kind) {
    case "dispute_letter":
      return "bureau_dispute";
    case "creditor_verification_letter":
      return "creditor_verification";
    case "debt_validation_letter":
      return "debt_validation";
    case "cease_communication_notice":
      return "cease_communication";
  }
}

function inferModuleFromKind(kind: DocumentKind): VaultDocument["module"] {
  if (kind === "debt_validation_letter" || kind === "cease_communication_notice") return "resolution";
  return "optimization";
}

type LegacyDoc = {
  id: string;
  kind: DocumentKind;
  title?: string;
  text: string;
  sources: VaultDocument["sources"];
  createdAt: string;
  updatedAt: string;
};

export function migrateVaultDocumentFromLegacy(d: LegacyDoc | VaultDocument): VaultDocument {
  if (!("kind" in d) && "type" in d) {
    const v = d as VaultDocument;
    return {
      ...v,
      caseId: v.caseId ?? null,
      tags: Array.isArray(v.tags) ? v.tags : [],
    };
  }
  const legacy = d as LegacyDoc;
  const type = mapKindToVaultType(legacy.kind);
  const module = inferModuleFromKind(legacy.kind);
  return {
    id: legacy.id,
    type,
    module,
    status: "awaiting_response",
    primaryParty: inferPrimaryParty(type, legacy.sources),
    createdAt: legacy.createdAt,
    updatedAt: legacy.updatedAt,
    followUpDueAt: computeFollowUpDueAt(type, legacy.createdAt),
    tags: [],
    text: legacy.text,
    sources: legacy.sources,
    caseId: null,
  };
}

export function migrateV2ToV3(partial: Partial<FinancialReadinessState>): Partial<FinancialReadinessState> {
  return {
    ...partial,
    activities: Array.isArray(partial.activities) ? partial.activities : [],
    cases: Array.isArray(partial.cases) ? partial.cases : [],
    optimization: partial.optimization
      ? {
          ...partial.optimization,
          activeCaseId:
            (partial.optimization as { activeCaseId?: string | null }).activeCaseId ?? null,
        }
      : undefined,
    resolution: partial.resolution
      ? {
          ...partial.resolution,
          activeCaseId:
            (partial.resolution as { activeCaseId?: string | null }).activeCaseId ?? null,
        }
      : undefined,
  };
}
