/**
 * Approval, onboarding, and kickoff markdown — from ClosePackageModel + deliverables (deterministic).
 */

import type { DeliverablesDocument } from "@/lib/site-builder/deliverables-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { buildClosePackageModel, describeProposalPosture } from "@/lib/site-builder/deliverables/close-package-model";

/** Client-safe approval memo for sign-off. */
export function renderApprovalSummaryMarkdown(d: DeliverablesDocument, schema?: SiteSchemaDocumentType): string {
  const m = buildClosePackageModel(d, schema);
  const a = m.approvalSummary;
  const postureLine = describeProposalPosture(m.proposalSelection);
  const lines: string[] = [];
  lines.push(`# Approval summary`, "");
  lines.push(`**Project:** ${a.projectName}`, "");
  lines.push(`## Selected posture`, "", postureLine, "");
  if (m.proposalSelection.notes) {
    lines.push("### Consultant notes", "", m.proposalSelection.notes, "");
  }
  lines.push("## Overview", "", a.summary, "");
  lines.push("## Included outcomes", "");
  for (const o of a.includedOutcomes) {
    lines.push(`- ${o}`);
  }
  lines.push("");
  lines.push("## Deployment and assistant", "");
  lines.push(`- **Deployment target:** ${a.deploymentTarget ?? "As agreed in your export settings."}`);
  lines.push(
    `- **AI assistant embed:** ${a.widgetIncluded ? "Included in scope—confirm live-domain behavior after approval." : "Not in current scope unless added before sign-off."}`,
  );
  const pay = schema?.metadata?.paymentIntegration;
  if (pay?.provider === "paypal") {
    lines.push(
      `- **PayPal payment surface:** Enabled (${pay.mode.replace(/_/g, " ")}, ${pay.intent.replace(/_/g, " ")} intent, ${pay.placement.replace(/_/g, " ")} placement). Confirm the hosted experience on the production domain.`,
    );
  } else {
    lines.push(`- **PayPal payment surface:** Not attached in metadata—add in Refine if the site should collect payment on-page.`);
  }
  lines.push("");
  lines.push("## Assumptions", "");
  lines.push("- Final written approval authorizes implementation against this summary.");
  lines.push("- Hosting, DNS, and content approvals follow your firm’s standard process.");
  lines.push("- Material scope changes after approval may require a short change memo.");
  lines.push("");
  lines.push("## Immediate next steps after approval", "");
  lines.push("- Share **{approval_link}** (or your MSA/SOW) for signature when ready.");
  lines.push("- Schedule **{kickoff_link}** to align owners, dates, and communication rhythm.");
  lines.push("- When billing applies, use **{invoice_link}** or your chosen **{stripe_payment_link}** / **{crypto_payment_link}** placeholders.");
  lines.push("");
  lines.push(m.paymentReadiness.depositOrFullNote);
  lines.push("");
  lines.push(
    "*This summary supports commercial alignment; it is not legal advice. Use your master agreement for binding terms.*",
    "",
  );
  return lines.join("\n").trim() + "\n";
}

/** Structured onboarding checklist for post-sale execution. */
export function renderOnboardingChecklistMarkdown(d: DeliverablesDocument, schema?: SiteSchemaDocumentType): string {
  const m = buildClosePackageModel(d, schema);
  const lines: string[] = [];
  lines.push(`# Onboarding checklist`, "");
  lines.push(
    "Use this after verbal or written approval—before DNS cutover or public launch announcements.",
    "",
  );
  for (const sec of m.onboardingChecklist) {
    lines.push(`## ${sec.label}`, "");
    for (const it of sec.items) {
      lines.push(`- [ ] ${it}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

/** Kickoff execution brief — consultant vs client responsibilities. */
export function renderKickoffPacketMarkdown(d: DeliverablesDocument, schema?: SiteSchemaDocumentType): string {
  const m = buildClosePackageModel(d, schema);
  const k = m.kickoffPacket;
  const lines: string[] = [];
  lines.push(`# Kickoff packet`, "");
  lines.push("Calm execution view—what happens first, what we need from you, and what we verify before launch.", "");
  lines.push("## What the consultant does first", "");
  for (const x of k.consultantActions) {
    lines.push(`- ${x}`);
  }
  lines.push("");
  lines.push("## What the client provides", "");
  for (const x of k.clientInputsNeeded) {
    lines.push(`- ${x}`);
  }
  lines.push("");
  lines.push("## What we review before launch", "");
  lines.push("- Key routes, forms, and calls to action in a fresh browser session.");
  lines.push("- Consistency of messaging, trust elements, and next-step clarity.");
  if (m.approvalSummary.widgetIncluded) {
    lines.push("- AI assistant embed: one live conversation path end to end.");
  }
  lines.push("");
  lines.push("## Deployment sequence", "");
  lines.push("- Export or hand off the bundle in line with the agreed hosting posture.");
  lines.push("- Confirm production URLs, HTTPS, and rollback expectations.");
  lines.push("");
  lines.push("## Next steps after kickoff", "");
  for (const x of k.nextSteps) {
    lines.push(`- ${x}`);
  }
  lines.push("");
  return lines.join("\n").trim() + "\n";
}

export function closePackageArtifactFiles(
  d: DeliverablesDocument,
  schema?: SiteSchemaDocumentType,
): { path: string; content: string }[] {
  return [
    { path: "approval-summary.md", content: renderApprovalSummaryMarkdown(d, schema) },
    { path: "onboarding-checklist.md", content: renderOnboardingChecklistMarkdown(d, schema) },
    { path: "kickoff-packet.md", content: renderKickoffPacketMarkdown(d, schema) },
  ];
}
