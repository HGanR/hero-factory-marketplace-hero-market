import type { WorkspaceSummaryPayload } from "@/lib/trusts/build-workspace-summary";
import { lateStepStructuralBlockers, type JarvaProceduralInput } from "@/lib/jarva/jarva-procedural-engine";

export type JarvaDocumentAssemblyHints = {
  ppmDraftReadyForGeneration: boolean;
  certificatePackageReady: boolean;
  bondDocumentationReady: boolean;
  trustReviewPacketReady: boolean;
  /** Advisory lines for NPC/LLM — DRAFT / counsel framing only. */
  lines: string[];
};

/** True when the API returned at least one advisory signal worth surfacing in UI. */
export function jarvaDocumentAssemblyHintsHaveSignals(
  h: JarvaDocumentAssemblyHints | null | undefined
): boolean {
  if (!h) return false;
  return (
    Boolean(h.ppmDraftReadyForGeneration) ||
    Boolean(h.certificatePackageReady) ||
    Boolean(h.bondDocumentationReady) ||
    Boolean(h.trustReviewPacketReady) ||
    (Array.isArray(h.lines) && h.lines.length > 0)
  );
}

/** Parse `/api/npc/chat` payload field — invalid shapes yield null. */
export function parseJarvaDocumentAssemblyHintsFromApi(raw: unknown): JarvaDocumentAssemblyHints | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    ppmDraftReadyForGeneration: Boolean(o.ppmDraftReadyForGeneration),
    certificatePackageReady: Boolean(o.certificatePackageReady),
    bondDocumentationReady: Boolean(o.bondDocumentationReady),
    trustReviewPacketReady: Boolean(o.trustReviewPacketReady),
    lines: Array.isArray(o.lines) ? o.lines.map((x) => String(x ?? "")).filter(Boolean) : [],
  };
}

const TRUST_REVIEW_MIN_COMPLETENESS = 90;

/**
 * Derived projection for safe Jarva messaging about document *assembly readiness*.
 * Does not generate documents, approve offerings, or bypass counsel review.
 */
export function computeJarvaDocumentAssemblyHints(params: {
  workProduct: WorkspaceSummaryPayload["workProduct"] | null | undefined;
  proceduralInput: JarvaProceduralInput;
  intakeReadinessOk: boolean;
  completenessPercent: number;
  applyReadinessBlockers: string[];
}): JarvaDocumentAssemblyHints {
  const { workProduct, proceduralInput, intakeReadinessOk, completenessPercent, applyReadinessBlockers } = params;

  const structuralBlockers = lateStepStructuralBlockers(proceduralInput);
  const structuralClear = structuralBlockers.length === 0;
  const applyClear = applyReadinessBlockers.length === 0;
  const baseReady = structuralClear && intakeReadinessOk && applyClear;

  const wp = workProduct;

  const hasFinalizedOffering = Boolean(
    wp?.hasFinalizedOffering ?? (wp?.securityOfferingFinalizedCount ?? 0) > 0
  );

  const hasCertificateLike = wp
    ? Boolean(
        wp.hasAnyIssuedCertificateLike ||
          wp.issuedAssetCertificateCount > 0 ||
          wp.securitiesCertificatesIssuedActiveCount > 0
      )
    : false;

  const bondOnlyVoided =
    wp &&
    wp.bondInstrumentCount > 0 &&
    wp.bondVoidedCount === wp.bondInstrumentCount &&
    wp.bondPreIssuanceCount === 0 &&
    wp.bondIssuedCount === 0 &&
    wp.bondClosedCount === 0;

  const bondDocSignals = wp
    ? Boolean(
        !bondOnlyVoided &&
          (wp.hasIssuedBond ||
            wp.hasActiveBondWorkflow ||
            (wp.bondClosedCount ?? 0) > 0 ||
            (wp.bondIssuedCount ?? 0) > 0)
      )
    : false;

  const ppmDraftReadyForGeneration = baseReady && hasFinalizedOffering;
  const certificatePackageReady = baseReady && hasCertificateLike;
  const bondDocumentationReady = baseReady && bondDocSignals;
  const trustReviewPacketReady =
    baseReady && completenessPercent >= TRUST_REVIEW_MIN_COMPLETENESS;

  const lines: string[] = [];

  if (ppmDraftReadyForGeneration) {
    lines.push(
      "**Finalized offering on file** — PPM draft assembly may proceed for consultant workflow; **DRAFT — not legal advice**; counsel review and distribution rules still apply."
    );
  }
  if (certificatePackageReady) {
    lines.push(
      "**Issued certificate(s) on file** — certificate package **review assembly** may proceed (DRAFT — not legal advice; not a client deliverable)."
    );
  }
  if (bondDocumentationReady) {
    lines.push(
      "**Bond issuance or pre-issuance pipeline** — bond documentation **draft assembly** may proceed (DRAFT — not legal advice; not issuance authority)."
    );
  }
  if (trustReviewPacketReady) {
    lines.push(
      "**Structural intake and workspace gates clear** — trust review packet **review assembly** may proceed (DRAFT — not legal advice; counsel sign-off still required)."
    );
  }

  return {
    ppmDraftReadyForGeneration,
    certificatePackageReady,
    bondDocumentationReady,
    trustReviewPacketReady,
    lines,
  };
}
