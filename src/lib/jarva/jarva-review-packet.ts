import type { JarvaLineageEntry } from "@/lib/jarva/jarva-lineage";
import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import type { JarvaApplyReadiness, JarvaReadinessFull, JarvaReadinessResult } from "@/lib/jarva/jarva-readiness";

/** Shared across review packet markdown and advisory bundle packets — DRAFT / counsel review only. */
export const JARVA_ADVISORY_WORKPAPER_DISCLAIMER = `
DRAFT CONSULTANT WORKPAPER — NOT LEGAL ADVICE
This packet is generated for consultant and counsel review only. It is not a final trust instrument,
will, securities offering, or binding legal document. Jurisdiction-specific counsel must review and
approve before execution, filing, or issuance. The platform does not provide legal advice.
All Smart Trust and Trust Records drafts remain subject to existing readiness, counsel, and trustee gates.
`.trim();

const DISCLAIMER = JARVA_ADVISORY_WORKPAPER_DISCLAIMER;

export type JarvaReviewPacketInput = {
  trustId: string;
  intake: JarvaTrustIntake;
  /** Smart Trust merge preview summary lines */
  mappedSummaryLines: string[];
  readiness: JarvaReadinessResult;
  readinessFull?: JarvaReadinessFull | null;
  /** Structural apply readiness (completeness %, missing) */
  applyReadiness?: JarvaApplyReadiness | null;
  /** Optional lineage tail (last N shown) */
  lineage?: JarvaLineageEntry[];
  lineageMax?: number;
};

function partyLines(intake: JarvaTrustIntake): string[] {
  const lines: string[] = [];
  if (intake.grantor?.name) {
    const g = intake.grantor;
    lines.push(`- **Grantor:** ${g.name}`);
    if (g.email) lines.push(`  - Email: ${g.email}`);
    if (g.phone) lines.push(`  - Phone: ${g.phone}`);
    if (g.addressLine1 || g.city || g.state) {
      lines.push(
        `  - Address: ${[g.addressLine1, g.addressLine2, [g.city, g.state, g.postalCode].filter(Boolean).join(", ")].filter(Boolean).join("; ")}`
      );
    }
  }
  if (intake.trustee?.name) {
    const t = intake.trustee;
    lines.push(`- **Trustee:** ${t.name}`);
    if (t.email) lines.push(`  - Email: ${t.email}`);
    if (t.phone) lines.push(`  - Phone: ${t.phone}`);
  }
  if (intake.successorTrusteeNote?.trim()) {
    lines.push(`- **Successor trustee (notes):** ${intake.successorTrusteeNote.slice(0, 2000)}`);
  }
  if (intake.beneficiariesSummary) lines.push(`- **Beneficiaries (summary):** ${intake.beneficiariesSummary.slice(0, 2000)}`);
  if (intake.jurisdictionAmbiguityNote?.trim()) {
    lines.push(`- **Jurisdiction note (draft):** ${intake.jurisdictionAmbiguityNote.slice(0, 2000)}`);
  }
  if (intake.assetScheduleNotesDraft?.trim()) {
    lines.push(`- **Asset / schedule notes (draft, non-authoritative):** ${intake.assetScheduleNotesDraft.slice(0, 2000)}`);
  }
  if (lines.length === 0) lines.push("- *(No party names captured in intake snapshot)*");
  return lines;
}

/**
 * Structured markdown review packet: trust summary, parties, readiness, missing, disclaimers.
 */
export function buildJarvaReviewPacketMarkdown(input: JarvaReviewPacketInput): string {
  const { trustId, intake, mappedSummaryLines, readiness, readinessFull, applyReadiness, lineage, lineageMax = 12 } =
    input;
  const lines: string[] = [];

  lines.push(`# Jarva — Draft review packet`);
  lines.push("");
  lines.push(`**Status:** DRAFT — for legal/counsel review only`);
  lines.push(`**Trust workspace ID:** \`${trustId}\``);
  lines.push(`**Matter:** ${intake.matterLabel ?? "(not set)"}`);
  lines.push(`**Trust name (working):** ${intake.trustName ?? "—"}`);
  lines.push(`**Governing / situs state:** ${intake.governingState ?? "—"}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");

  lines.push("## Disclaimer");
  lines.push(DISCLAIMER);
  lines.push("");

  lines.push("## Readiness summary (DRAFT — not legal advice)");
  lines.push(
    `- **Structural apply:** ${readiness.ok ? "Ready for workspace draft merge (platform structural gate only)" : "Not ready — core parties / situs incomplete"}`
  );
  if (readinessFull?.narrative) {
    lines.push(`- **Consultant narrative:** ${readinessFull.narrative}`);
  }
  if (readinessFull?.suggestedApplyTiming) {
    lines.push(`- **Suggested apply timing (advisory):** ${readinessFull.suggestedApplyTiming.replace(/_/g, " ")}`);
  }
  lines.push("");

  lines.push("## Missing & severity (structural / advisory)");
  const severe = readiness.missing.length ? readiness.missing : [];
  const advisoryOnly = readiness.advisories.filter((a) => !readiness.missing.some((m) => a.includes(m)));
  if (severe.length) {
    lines.push("### Blocking structural gaps (must fix for default apply)");
    severe.forEach((m) => lines.push(`- **${m}**`));
    lines.push("");
  }
  if (readinessFull?.softMissing?.length) {
    lines.push("### Soft gaps (improve packet before counsel handoff)");
    readinessFull.softMissing.forEach((m) => lines.push(`- ${m}`));
    lines.push("");
  }
  if (advisoryOnly.length) {
    lines.push("### Advisories (non-blocking)");
    advisoryOnly.forEach((a) => lines.push(`- ${a}`));
    lines.push("");
  }

  lines.push("### Apply metrics");
  lines.push(`- **OK to apply (structural):** ${readiness.ok ? "Yes" : "No"}`);
  if (applyReadiness) {
    lines.push(`- **Completeness (consultant progress):** ${applyReadiness.completenessPercent}%`);
    lines.push(
      `- **Auto-apply allowed (structural only):** ${applyReadiness.autoApplyAllowed ? "Yes" : "No"} — does not waive counsel/trustee/export gates.`
    );
  }
  if (readiness.blockers.length) {
    lines.push("- **Structural blockers:**");
    readiness.blockers.forEach((b) => lines.push(`  - ${b}`));
  }
  lines.push("");

  lines.push("## Population source (DRAFT — legal review required)");
  lines.push(
    "- **Populated automatically (platform):** labeled chat extraction, deterministic parsing, and optional LLM-assisted gap-fill when enabled — all require human verification."
  );
  lines.push(
    "- **Requires human / legal completion:** dispositive percentages, tax elections, titling, funding, and execution — not inferred by Jarva."
  );
  lines.push(
    "- **Not legal advice:** this packet is an internal workpaper; counsel must approve before client reliance or filing."
  );
  lines.push("");

  lines.push("## Jurisdiction");
  lines.push(
    `- **Governing / situs:** ${intake.governingState ?? "—"} (verify against client domicile and counsel guidance).`
  );
  if (intake.grantor?.state?.trim()) {
    lines.push(`- **Grantor state (reference):** ${intake.grantor.state}`);
  }
  lines.push("");

  lines.push("## Parties & roles");
  lines.push(...partyLines(intake));
  lines.push("");

  lines.push("## Trust purpose / governing intent");
  lines.push(intake.objectives?.trim() || "*(Not provided)*");
  lines.push("");

  lines.push("## Firm / consultant header (if any)");
  if (intake.firm?.name || intake.firm?.email || intake.firm?.phone) {
    lines.push(`- **Firm:** ${intake.firm?.name ?? "—"}`);
    if (intake.firm?.email) lines.push(`  - Email: ${intake.firm.email}`);
    if (intake.firm?.phone) lines.push(`  - Phone: ${intake.firm.phone}`);
    if (intake.firm?.address) lines.push(`  - Address: ${intake.firm.address.slice(0, 1500)}`);
  } else {
    lines.push("- *(Not set)*");
  }
  lines.push("");

  lines.push("## Mapped workspace preview (Smart Trust merge)");
  mappedSummaryLines.forEach((l) => lines.push(`- ${l}`));
  lines.push("");

  lines.push("## Asset / schedule (informational)");
  lines.push(
    "- Confirm tangible and intangible assets in **Trust Records → Assets** and Smart Trust funding flows; this packet does not replace the asset registry."
  );
  lines.push("");

  lines.push("## Provisions / special notes");
  lines.push(`- Pour-over will flag: ${intake.pourOverWillNeeded === true ? "yes" : intake.pourOverWillNeeded === false ? "no" : "—"}`);
  if (intake.spiritualOrEcclesiasticalNotes?.trim()) {
    lines.push(`- Spiritual / ecclesiastical: ${intake.spiritualOrEcclesiasticalNotes.slice(0, 3000)}`);
  }
  if (intake.securitiesIntentNotes?.trim()) {
    lines.push(`- Securities / capital (informational only): ${intake.securitiesIntentNotes.slice(0, 2000)}`);
  }
  lines.push("");

  if (lineage?.length) {
    const tail = lineage.slice(-lineageMax);
    const lastApply = [...tail].reverse().find((e) => e.applyKind === "auto_apply" || e.applyKind === "manual_apply");
    lines.push("## Lineage (concise)");
    lines.push(
      lastApply
        ? `Last workspace merge: **${lastApply.at}** (${lastApply.applyKind}). Chat and form edits flow into jarva-trust-intake lineage; apply events sync Smart Trust and Trust Records drafts — still DRAFT.`
        : "No apply events in this lineage window — intake may be chat-only or not yet applied."
    );
    lines.push("");
    lines.push("## Lineage detail (how Jarva filled this)");
    tail.forEach((e) => {
      lines.push(`- **${e.at}** — ${e.messageSnippet.slice(0, 120)}${e.messageSnippet.length > 120 ? "…" : ""}`);
      lines.push(`  - Fields: ${e.extractedFieldKeys.join(", ") || "—"}`);
      lines.push(`  - Targets: ${e.targets.join(", ")}`);
      if (e.sourceMessageId) lines.push(`  - Source message id: ${e.sourceMessageId}`);
      if (e.mappedDestinationHints?.length) lines.push(`  - Map hints: ${e.mappedDestinationHints.join("; ")}`);
      if (e.applyKind) lines.push(`  - Kind: ${e.applyKind}`);
      if (e.note) lines.push(`  - _${e.note}_`);
    });
    lines.push("");
  }

  lines.push("## Full intake JSON (audit)");
  lines.push("```json");
  lines.push(JSON.stringify(intake, null, 2));
  lines.push("```");
  lines.push("");

  lines.push("## Next steps for counsel");
  lines.push("- [ ] Verify parties, jurisdiction, and dispositive intent against client instructions.");
  lines.push("- [ ] Reconcile Smart Trust workspace and Trust Records UI with this snapshot.");
  lines.push("- [ ] Run export / legal packet workflows only after internal review and applicable approvals.");
  lines.push("");

  return lines.join("\n");
}
