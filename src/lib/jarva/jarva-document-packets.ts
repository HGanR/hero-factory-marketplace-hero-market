import type { WorkspaceSummaryPayload } from "@/lib/trusts/build-workspace-summary";
import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import type { JarvaApplyReadiness, JarvaReadinessFull, JarvaReadinessResult } from "@/lib/jarva/jarva-readiness";
import type { JarvaDocumentAssemblyHints } from "@/lib/jarva/jarva-document-assembly-hints";
import { JARVA_ADVISORY_WORKPAPER_DISCLAIMER } from "@/lib/jarva/jarva-review-packet";

export type JarvaAdvisoryPacketType = "trust_review" | "ppm_draft" | "certificate_review" | "bond_documentation";

export type JarvaAdvisoryPacket = {
  type: JarvaAdvisoryPacketType;
  title: string;
  advisoryStatus: "draft_only";
  sections: Array<{ heading: string; body: string }>;
  disclaimers: string[];
};

export type JarvaAdvisoryPacketsInput = {
  trustId: string;
  intake: JarvaTrustIntake;
  hints: JarvaDocumentAssemblyHints;
  workProduct: WorkspaceSummaryPayload["workProduct"] | null | undefined;
  readiness: JarvaReadinessResult;
  readinessFull: JarvaReadinessFull;
  applyReadiness: JarvaApplyReadiness;
  /** From `lateStepStructuralBlockers` — informational only in packets. */
  structuralBlockers: string[];
};

const BASE_DISCLAIMERS = [
  JARVA_ADVISORY_WORKPAPER_DISCLAIMER,
  "Advisory packet — not auto-finalized. No trustee, counsel, or regulatory approval implied.",
];

function wpSummary(wp: WorkspaceSummaryPayload["workProduct"] | null | undefined): string {
  if (!wp) {
    return "No workspace **workProduct** snapshot was supplied for this bundle — open Trust Records or refresh workspace summary for execution signals.";
  }
  const lines: string[] = [];
  lines.push(`- **Finalized offerings:** ${wp.securityOfferingFinalizedCount} (hasFinalizedOffering: ${wp.hasFinalizedOffering})`);
  lines.push(`- **Draft offerings:** ${wp.securityOfferingDraftCount} (hasDraftOffering: ${wp.hasDraftOffering})`);
  lines.push(
    `- **Offerings inactive:** cancelled ${wp.securityOfferingCancelledCount}; error ${wp.securityOfferingErrorCount}`
  );
  lines.push(
    `- **Certificates (workflow + securities):** issued workflow ${wp.issuedAssetCertificateCount}; securities issued/active ${wp.securitiesCertificatesIssuedActiveCount}; voided/replaced ${wp.securitiesCertificatesVoidedOrReplacedCount} (any issued-like: ${wp.hasAnyIssuedCertificateLike})`
  );
  lines.push(
    `- **Bonds:** instruments ${wp.bondInstrumentCount}; pre-issuance ${wp.bondPreIssuanceCount}; issued ${wp.bondIssuedCount}; closed ${wp.bondClosedCount}; voided ${wp.bondVoidedCount} (active pipeline: ${wp.hasActiveBondWorkflow}, issued: ${wp.hasIssuedBond})`
  );
  return lines.join("\n");
}

/**
 * Builds zero or more advisory packets matching **true** flags in `hints`.
 * Does not generate binding legal documents — DRAFT consultant workpapers only.
 */
export function buildJarvaAdvisoryPackets(input: JarvaAdvisoryPacketsInput): JarvaAdvisoryPacket[] {
  const { trustId, intake, hints, workProduct, readiness, readinessFull, applyReadiness, structuralBlockers } = input;
  const packets: JarvaAdvisoryPacket[] = [];

  if (hints.trustReviewPacketReady) {
    packets.push({
      type: "trust_review",
      title: "Trust review packet (advisory draft assembly)",
      advisoryStatus: "draft_only",
      disclaimers: [...BASE_DISCLAIMERS],
      sections: [
        {
          heading: "Purpose",
          body:
            "Structured **review assembly** snapshot for consultant and counsel — **DRAFT — not legal advice**. Use together with the full **Jarva draft review packet** from Trust Records → Build with Jarva (merge preview + lineage) when you need the complete workpaper.",
        },
        {
          heading: "Trust workspace",
          body: `- **Trust ID:** \`${trustId}\`\n- **Matter / working name:** ${intake.matterLabel ?? "—"} / ${intake.trustName ?? "—"}\n- **Governing / situs:** ${intake.governingState ?? "—"}`,
        },
        {
          heading: "Structural readiness (platform gates only)",
          body:
            `- **Core intake OK:** ${readiness.ok ? "yes" : "no"}\n` +
            `- **Completeness:** ${applyReadiness.completenessPercent}%\n` +
            `- **Suggested apply timing (advisory):** ${readinessFull.suggestedApplyTiming.replace(/_/g, " ")}\n` +
            (readinessFull.narrative ? `- **Narrative:** ${readinessFull.narrative}\n` : "") +
            (structuralBlockers.length
              ? `- **Structural / checklist notes:** ${structuralBlockers.join(" ")}`
              : "- **Structural / checklist notes:** none recorded for this bundle."),
        },
        {
          heading: "Full review packet (existing surface)",
          body:
            "The authoritative **merge preview + lineage** review packet is produced by `buildJarvaReviewPacketMarkdown` — exposed as **POST** `/api/jarva/trust-intake/review-packet` and the download action on **Trust Records → Build with Jarva**. This advisory bundle does not replace that flow.",
        },
      ],
    });
  }

  if (hints.ppmDraftReadyForGeneration) {
    packets.push({
      type: "ppm_draft",
      title: "PPM / subscription draft packet (advisory)",
      advisoryStatus: "draft_only",
      disclaimers: [...BASE_DISCLAIMERS],
      sections: [
        {
          heading: "Purpose",
          body:
            "Advisory **draft assembly** outline for private placement / subscription materials tied to a **finalized** securities offering in workspace data — **DRAFT — not legal advice**. Distribution, filing, and counsel approval remain outside this packet.",
        },
        {
          heading: "Offering signals (from workspace summary)",
          body: wpSummary(workProduct),
        },
        {
          heading: "Intake — securities / capital (informational)",
          body:
            intake.securitiesIntentNotes?.trim() ||
            "*(No securities intent notes in intake — add in Jarva intake or Trust Records.)*",
        },
        {
          heading: "Consultant next steps (non-binding)",
          body:
            "- Confirm offering and legends in **Issue Security** (`/trusts/…/issue-security`) and Trust Records securities flows.\n- Align subscription materials with counsel before any investor-facing use.",
        },
      ],
    });
  }

  if (hints.certificatePackageReady) {
    packets.push({
      type: "certificate_review",
      title: "Certificate package — review assembly (advisory)",
      advisoryStatus: "draft_only",
      disclaimers: [...BASE_DISCLAIMERS],
      sections: [
        {
          heading: "Purpose",
          body:
            "Advisory **review assembly** checklist for issued certificate-like positions reflected in workspace data — **DRAFT — not legal advice**. Not a custody instruction or client deliverable.",
        },
        {
          heading: "Execution signals (from workspace summary)",
          body: wpSummary(workProduct),
        },
        {
          heading: "Registry & issuance surfaces",
          body:
            "- **Trust Records → Certificates** tab (`/trust-records?trustId=…&tab=registry`).\n- **Issue Security** for module-issued certificates when applicable (`/trusts/…/issue-security`).",
        },
      ],
    });
  }

  if (hints.bondDocumentationReady) {
    packets.push({
      type: "bond_documentation",
      title: "Bond documentation — draft assembly (advisory)",
      advisoryStatus: "draft_only",
      disclaimers: [...BASE_DISCLAIMERS],
      sections: [
        {
          heading: "Purpose",
          body:
            "Advisory **draft assembly** outline for bond documentation where bonds are **issued** or in the **pre-issuance** pipeline — **DRAFT — not legal advice**. Not an authorization to issue.",
        },
        {
          heading: "Bond signals (from workspace summary)",
          body: wpSummary(workProduct),
        },
        {
          heading: "Trust Records — Bonds",
          body:
            "Use **Trust Records → Bonds** (`/trust-records?trustId=…&tab=bonds`) for instrument detail, resolutions, and counsel alignment.",
        },
      ],
    });
  }

  return packets;
}

export function jarvaAdvisoryPacketToMarkdown(packet: JarvaAdvisoryPacket): string {
  const lines: string[] = [];
  lines.push(`# ${packet.title}`);
  lines.push("");
  lines.push(`**Status:** ${packet.advisoryStatus.toUpperCase()} — for legal/counsel review only — not legal advice`);
  lines.push("");
  lines.push("## Disclaimers");
  packet.disclaimers.forEach((d) => {
    lines.push(d);
    lines.push("");
  });
  for (const s of packet.sections) {
    lines.push(`## ${s.heading}`);
    lines.push("");
    lines.push(s.body);
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Single downloadable Markdown file combining all advisory packets in order. */
export function buildJarvaAdvisoryPacketsMarkdownBundle(packets: JarvaAdvisoryPacket[]): string {
  if (packets.length === 0) return "";
  return packets.map((p) => jarvaAdvisoryPacketToMarkdown(p)).join("\n\n---\n\n");
}
