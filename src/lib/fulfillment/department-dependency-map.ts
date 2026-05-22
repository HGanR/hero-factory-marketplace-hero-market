import type {
  CrossDepartmentDependency,
  FulfillmentOrchestrationDepartment,
} from "@/lib/fulfillment/fulfillment-orchestration-types";
import {
  FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
  FULFILLMENT_PRIMARY_SERVICE_TRUST,
  FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
} from "@/lib/fulfillment/fulfillment-types";

/** Static cross-department dependency model — planning only; no runtime enforcement or auto-routing. */
export const FULFILLMENT_DEPARTMENT_DEPENDENCIES: CrossDepartmentDependency[] = [
  {
    from: FULFILLMENT_PRIMARY_SERVICE_TRUST,
    to: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
    kind: "downstream_benefit",
    summary:
      "After trust structure is reviewed by counsel, WEBSITE can reflect accurate entity/disclaimer language — coordination recommended, not required for Slice 1.",
    optional: true,
  },
  {
    from: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
    to: FULFILLMENT_PRIMARY_SERVICE_TRUST,
    kind: "informational",
    summary:
      "WEBSITE intake may surface business entity questions that TRUST legal-review packets should address — informational cross-link only.",
    optional: true,
  },
  {
    from: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
    to: "AI_REVENUE_OS",
    kind: "downstream_benefit",
    summary:
      "When WEBSITE draft is approved for release, AI Revenue OS onboarding may help drive traffic — advisory recommendation only.",
    optional: true,
  },
  {
    from: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
    to: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
    kind: "soft_prerequisite",
    summary:
      "Campaign landing experiences benefit from WEBSITE progress — recommend site release before heavy paid spend.",
    optional: true,
  },
  {
    from: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
    to: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
    kind: "informational",
    summary: "REVENUE_OS fulfillment may surface landing-page gaps for WEBSITE coordination — informational only.",
    optional: true,
  },
  {
    from: FULFILLMENT_PRIMARY_SERVICE_TRUST,
    to: "AI_REVENUE_OS",
    kind: "parallel_safe",
    summary:
      "TRUST and AI Revenue OS can proceed independently; no hard dependency. Do not conflate legal-review packets with campaign execution.",
    optional: true,
  },
  {
    from: FULFILLMENT_PRIMARY_SERVICE_TRUST,
    to: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
    kind: "parallel_safe",
    summary:
      "TRUST and REVENUE_OS governed fulfillment are isolated — coordinate disclaimers only; no trust apply from campaign desk.",
    optional: true,
  },
  {
    from: FULFILLMENT_PRIMARY_SERVICE_REVENUE_OS,
    to: FULFILLMENT_PRIMARY_SERVICE_TRUST,
    kind: "informational",
    summary: "Campaign creative may reference entity structure reviewed in TRUST packets — informational only.",
    optional: true,
  },
  {
    from: "AI_REVENUE_OS",
    to: FULFILLMENT_PRIMARY_SERVICE_WEBSITE,
    kind: "soft_prerequisite",
    summary:
      "Campaign landing experiences benefit from a published or near-release WEBSITE — recommend WEBSITE progress before heavy paid spend.",
    optional: true,
  },
];

export function getDependenciesForDepartment(
  department: FulfillmentOrchestrationDepartment
): CrossDepartmentDependency[] {
  return FULFILLMENT_DEPARTMENT_DEPENDENCIES.filter(
    (d) => d.from === department || d.to === department
  );
}

export function resolveCrossDepartmentDependencyNarrative(input: {
  websiteOrderActive: boolean;
  trustOrderActive: boolean;
  revenueOsOrderActive?: boolean;
  websiteStage: string | null;
  trustStage: string | null;
  revenueOsStage?: string | null;
  revenueOsLaunchReadinessApproved?: boolean;
}): {
  websiteDependsOnTrust: boolean;
  trustDependsOnWebsite: boolean;
  revenueOsDependsOnWebsite: boolean;
  websiteBenefitsFromRevenueOs: boolean;
  narrative: string;
} {
  const trustSubstantiallyComplete =
    input.trustOrderActive &&
    (input.trustStage === "approved_for_release" || input.trustStage === "released");
  const websiteEarly =
    input.websiteOrderActive &&
    (input.websiteStage === "executive_handoff_received" ||
      input.websiteStage === "fulfillment_queued" ||
      input.websiteStage === "service_drafting");

  const websiteDependsOnTrust = websiteEarly && input.trustOrderActive && !trustSubstantiallyComplete;
  const trustDependsOnWebsite = false;

  const websiteReleased =
    input.websiteStage === "approved_for_release" || input.websiteStage === "released";
  const revenueOsDependsOnWebsite =
    Boolean(input.revenueOsOrderActive) &&
    input.websiteOrderActive &&
    !websiteReleased;
  const websiteBenefitsFromRevenueOs =
    Boolean(input.revenueOsOrderActive) &&
    input.websiteOrderActive &&
    websiteEarly &&
    !input.revenueOsLaunchReadinessApproved;

  const parts: string[] = [
    "WEBSITE, TRUST, and REVENUE_OS fulfillment are isolated spines with optional coordination — no autonomous launch or publish.",
  ];
  if (websiteDependsOnTrust) {
    parts.push(
      "WEBSITE may benefit from TRUST legal-review progress before publishing entity-sensitive copy — recommendation only, not a hard gate."
    );
  } else if (input.websiteOrderActive && input.trustOrderActive) {
    parts.push(
      "Both departments are active; parallel desk work is allowed. Align disclaimers and entity naming during owner review."
    );
  } else if (input.trustOrderActive && !input.websiteOrderActive) {
    parts.push(
      "TRUST is active without WEBSITE — no WEBSITE dependency. Smart Trust apply and trust execution remain out of scope."
    );
  } else if (input.websiteOrderActive && !input.trustOrderActive) {
    parts.push(
      "WEBSITE is active without TRUST — no TRUST dependency required for Site Builder fulfillment."
    );
  }

  parts.push("TRUST does not depend on WEBSITE for legal-review packet fulfillment in Slice 1.");

  if (input.revenueOsOrderActive) {
    if (revenueOsDependsOnWebsite) {
      parts.push(
        "REVENUE_OS launch readiness benefits from WEBSITE release — soft prerequisite only; Bentley sync-launch remains owner-approved separately."
      );
    } else if (input.revenueOsLaunchReadinessApproved) {
      parts.push(
        "REVENUE_OS launch readiness checkpoint is recorded — campaign sync/publish still requires Bentley approval queue (no Content360 bypass)."
      );
    } else {
      parts.push(
        "REVENUE_OS campaign fulfillment active — complete campaign review packet and launch readiness checkpoint before any paid launch."
      );
    }
  }

  return {
    websiteDependsOnTrust,
    trustDependsOnWebsite,
    revenueOsDependsOnWebsite,
    websiteBenefitsFromRevenueOs,
    narrative: parts.join(" "),
  };
}

export function listAllDepartmentDependencies(): CrossDepartmentDependency[] {
  return [...FULFILLMENT_DEPARTMENT_DEPENDENCIES];
}
