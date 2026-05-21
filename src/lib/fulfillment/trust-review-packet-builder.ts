import { TRUST_FULFILLMENT_LEGAL_DISCLAIMER } from "@/lib/fulfillment/fulfillment-trust-legal";
import type { TrustIntakeNormalized, TrustIntakeReadiness } from "@/lib/fulfillment/trust-intake-types";
import type { FulfillmentTrustArtifactType } from "@/lib/fulfillment/fulfillment-types";
import {
  FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF,
  FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET,
} from "@/lib/fulfillment/fulfillment-types";

export function buildFulfillmentTrustReviewPacketMarkdown(input: {
  orderId: string;
  clientId: string;
  intake: TrustIntakeNormalized;
  readiness: TrustIntakeReadiness;
  deliverableType: FulfillmentTrustArtifactType;
  salesSummaryExcerpt?: string | null;
}): string {
  const lines: string[] = [];
  const isBrief = input.deliverableType === FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF;

  lines.push(isBrief ? "# Smart Trust setup brief (fulfillment)" : "# Trust review packet (fulfillment)");
  lines.push("");
  lines.push("**Status:** DRAFT — PREPARED FOR LEGAL REVIEW — NOT LEGAL ADVICE");
  lines.push(`**Fulfillment order:** \`${input.orderId}\``);
  lines.push(`**CRM client:** \`${input.clientId}\``);
  lines.push(`**Package type:** ${input.deliverableType}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Legal disclaimer");
  lines.push(TRUST_FULFILLMENT_LEGAL_DISCLAIMER);
  lines.push("");

  lines.push("## Trust readiness (structural — not legal advice)");
  lines.push(`- Score: ${input.readiness.score}/100 (${input.readiness.tier})`);
  lines.push(
    `- Fulfillment-ready: ${input.readiness.fulfillmentReady ? "yes" : "no — complete intake before proposing packet"}`
  );
  if (input.readiness.missingFields.length) {
    lines.push(`- Missing: ${input.readiness.missingFields.join(", ")}`);
  }
  if (input.readiness.legalAdvisories.length) {
    lines.push("- Legal advisories:");
    for (const a of input.readiness.legalAdvisories.slice(0, 8)) {
      lines.push(`  - ${a}`);
    }
  }
  lines.push("");

  lines.push("## Matter summary");
  lines.push(`- **Purpose:** ${input.intake.trustPurpose ?? "—"}`);
  lines.push(`- **Jurisdiction / state:** ${input.intake.jurisdictionState ?? "—"}`);
  lines.push(`- **Urgency:** ${input.intake.urgency ?? "—"}`);
  lines.push(`- **Family/business context:** ${input.intake.familyBusinessContext ?? "—"}`);
  lines.push("");

  lines.push("## Parties (draft snapshot)");
  lines.push(`- **Grantor:** ${input.intake.grantorName ?? "—"}`);
  lines.push(`- **Trustee:** ${input.intake.trusteeName ?? "—"}`);
  lines.push(`- **Beneficiaries (summary):** ${input.intake.beneficiariesSummary ?? "—"}`);
  if (input.intake.successorTrusteeNote) {
    lines.push(`- **Successor trustee notes:** ${input.intake.successorTrusteeNote.slice(0, 2000)}`);
  }
  if (input.intake.protectorNote) {
    lines.push(`- **Protector notes:** ${input.intake.protectorNote.slice(0, 2000)}`);
  }
  lines.push("");

  if (input.intake.assetCategories.length) {
    lines.push("## Asset categories (non-authoritative schedule)");
    for (const a of input.intake.assetCategories) lines.push(`- ${a}`);
    lines.push("");
  }

  lines.push("## Existing documents (intake flags)");
  const d = input.intake.existingDocuments;
  lines.push(`- Pour-over will noted: ${d.hasPourOverWill === true ? "yes" : d.hasPourOverWill === false ? "no" : "—"}`);
  lines.push(`- Prior trust noted: ${d.hasPriorTrust === true ? "yes" : d.hasPriorTrust === false ? "no" : "—"}`);
  lines.push(`- Attorney engaged: ${d.attorneyEngaged === true ? "yes" : d.attorneyEngaged === false ? "no" : "—"}`);
  if (d.documentNotes) lines.push(`- Notes: ${d.documentNotes.slice(0, 2000)}`);
  lines.push("");

  if (isBrief) {
    lines.push("## Smart Trust setup brief (consultant routing only)");
    lines.push(
      "Use Trust Records / Smart Trust UI manually after counsel review. This fulfillment step does **not** apply intake to a workspace."
    );
    lines.push("- Confirm grantor/trustee parties in Trust Records");
    lines.push("- Capture asset schedule in the asset registry (not this note)");
    lines.push("- Run Jarva procedural workflow only under existing platform gates");
    lines.push("");
  } else {
    lines.push("## Review packet scope");
    lines.push(
      "Internal workpaper for owner desk and counsel coordination. Not a client deliverable until owner explicitly generates a delivery link (Slice 2+)."
    );
    lines.push("");
  }

  if (input.salesSummaryExcerpt?.trim()) {
    lines.push("## Sales summary excerpt");
    lines.push(input.salesSummaryExcerpt.slice(0, 3000));
    lines.push("");
  }

  lines.push("## Counsel recommendation");
  lines.push(
    "Engage licensed estate planning counsel in the stated jurisdiction before any execution, signature, or filing."
  );

  return lines.join("\n").slice(0, 50_000);
}

export function resolveTrustArtifactType(
  requestedType: string | undefined,
  intakePackage: TrustIntakeNormalized["desiredOutputPackage"]
): FulfillmentTrustArtifactType {
  const t = requestedType?.trim();
  if (t === FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF) {
    return FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF;
  }
  if (t === FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET) {
    return FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET;
  }
  if (intakePackage === "smart_trust_setup_brief") {
    return FULFILLMENT_ARTIFACT_SMART_TRUST_SETUP_BRIEF;
  }
  return FULFILLMENT_ARTIFACT_TRUST_REVIEW_PACKET;
}
