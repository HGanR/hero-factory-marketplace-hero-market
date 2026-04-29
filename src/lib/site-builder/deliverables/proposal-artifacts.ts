/**
 * Proposal + close layer — rendered only from DeliverablesDocument + safe schema metadata.
 * Deterministic output (no timestamps). No pricing numbers. No second content pipeline.
 */

import type { DeliverablesDocument } from "@/lib/site-builder/deliverables-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { buildClosePackageModel, describeProposalPosture } from "@/lib/site-builder/deliverables/close-package-model";
import { buildClientHandoffContext } from "@/lib/site-builder/deliverables/client-handoff-render";

function firstSentences(text: string, maxSentences: number): string {
  const t = text.trim();
  if (!t) return "";
  const parts = t.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, maxSentences);
  return parts.join(" ");
}

function outcomeBulletsFromImprovements(top: string[]): string[] {
  return top.map((line) => {
    const m = /^([^:]+):\s*(.+)$/.exec(line.trim());
    if (m) {
      const theme = m[1].trim();
      const rest = m[2].trim();
      return `Strengthen **${theme.toLowerCase()}**: ${rest}`;
    }
    return line;
  });
}

/** Consultant scope memo — fixed section order. */
export function renderProposalScopeMarkdown(d: DeliverablesDocument, schema?: SiteSchemaDocumentType): string {
  const ctx = buildClientHandoffContext(schema);
  const meta = schema?.metadata;
  const imported = Boolean(meta?.siteImport);
  const auditPresent = Boolean(meta?.importedSiteAudit);
  const queue = meta?.importRestructureQueue ?? [];
  const hasSuggestedBacklog = queue.some((q) => q.status === "suggested");
  const multiPage = ctx.routeCount > 1;
  const routesPhrase = ctx.routeCount === 1 ? "a single primary route" : `**${ctx.routeCount}** primary routes across a multi-page experience`;

  const lines: string[] = [];
  lines.push(`*Project: ${ctx.siteTitle} — commercial scope summary (non-binding).*`, "");

  lines.push("# Objectives", "");
  lines.push(firstSentences(d.summary.executiveSummary, 4), "");
  lines.push("### Prioritized outcomes", "");
  for (const b of outcomeBulletsFromImprovements(d.summary.topImprovements)) {
    lines.push(`- ${b.replace(/^-\s*/, "").trim()}`);
  }
  lines.push("");

  lines.push("# Scope of Work", "");
  lines.push(
    `This engagement covers ${routesPhrase}, oriented toward **${ctx.deploymentLabel.toLowerCase()}** deployment output.`,
  );
  if (imported && auditPresent) {
    lines.push(
      "Work is grounded in a structured rebuild from an imported blueprint—prioritizing clarity, trust, and modernization rather than reusing legacy markup in client-facing materials.",
    );
  }
  if (multiPage) {
    lines.push("Multi-route alignment ensures each page supports a coherent conversion path.");
  } else {
    lines.push("Focus stays on a high-impact primary destination with clear next steps.");
  }
  if (ctx.widgetAttached) {
    lines.push(
      "Includes practical alignment for an **AI assistant embed** so post-launch conversations match your hosting and brand expectations.",
    );
  } else {
    lines.push(
      "An AI assistant embed is **not** in scope unless you request it before final acceptance—at which point hosting and placement should be confirmed together.",
    );
  }
  if (hasSuggestedBacklog) {
    lines.push(
      "Optional enhancement ideas may remain on an internal backlog as nice-to-haves—not blockers for sign-off.",
    );
  }
  lines.push("");

  lines.push("# Inclusions", "");
  lines.push("- Information architecture and on-page structure tuned to conversion and clarity");
  lines.push("- Route-level narrative alignment and stakeholder-ready documentation");
  if (imported) {
    lines.push("- Migration-minded restructuring from an imported blueprint (presentation layer—not a lift-and-shift of legacy code)");
  }
  lines.push("- Conversion-path review (calls to action, trust signals, next-step clarity)");
  if (ctx.widgetAttached) {
    lines.push("- AI assistant embed positioning and load behavior aligned with your deployment target");
  }
  lines.push("- Deployment-ready export matched to the chosen hosting posture");
  lines.push("");

  lines.push("# Out of Scope", "");
  lines.push("- Custom application backends, databases, or proprietary integrations beyond the agreed embed");
  lines.push("- Third-party SaaS wiring unless explicitly added as a change order");
  lines.push("- Ongoing content marketing, paid media, or daily site operations");
  lines.push("- Legal, compliance, or accessibility certifications (recommend specialist review where needed)");
  lines.push("");

  lines.push("# Assumptions", "");
  lines.push("- Final copy, brand assets, and approvals come from your team on an agreed cadence");
  lines.push("- Hosting, DNS, and domain access are available—or a partner is named for implementation");
  lines.push("- Revisions stay within the spirit of the agreed scope; material new surfaces may require a change order");
  lines.push("");

  lines.push("# Client Responsibilities", "");
  lines.push("Derived from launch readiness themes (your operational checklist):", "");
  for (const sec of d.launchChecklist) {
    const hint = sec.items[0] ? ` — e.g. ${sec.items[0]}` : "";
    lines.push(`- **${sec.label}**${hint}`);
  }
  lines.push("");

  lines.push("# Acceptance Criteria", "");
  lines.push(d.summary.readiness, "");
  lines.push("Sign-off when the following thematic checks are satisfied:", "");
  for (const sec of d.launchChecklist) {
    lines.push(`- ${sec.label}: key items in this group are complete and verified.`);
  }
  lines.push("");
  lines.push(
    "*This scope summary is for commercial alignment and is not legal advice. Final terms belong in your master services agreement.*",
  );
  lines.push("");
  return lines.join("\n").trim() + "\n";
}

/** Tier comparison without numeric pricing — value framing only. */
export function renderProposalPricingMarkdown(d: DeliverablesDocument, schema?: SiteSchemaDocumentType): string {
  const ctx = buildClientHandoffContext(schema);
  const themes = d.summary.topImprovements.join(" ").toLowerCase();
  const heavyConversion = themes.includes("conversion") || themes.includes("cta");
  const trust = themes.includes("trust") || themes.includes("proof");
  const widget = ctx.widgetAttached;
  const routes = ctx.routeCount;
  const broad = routes > 2;

  const essentialDesc =
    "Core clarity pass, primary destination strength, and deployment-ready export. " +
    (heavyConversion ? "Emphasis on conversion clarity and next-step discipline. " : "") +
    "Investment: **[Pricing TBD]**.";

  const standardDesc =
    "Full multi-route alignment, stakeholder documentation, and launch-readiness packaging. " +
    (broad ? "Suited when several routes must tell one coherent story. " : "Best when you want end-to-end narrative consistency. ") +
    (trust ? "Adds explicit attention to trust and proof placement. " : "") +
    "Investment: **[Pricing TBD]**.";

  const partnerDesc =
    "Hands-on partner posture for teams that want embedded support across deployment validation and iteration. " +
    (widget ? "Includes AI assistant embed alignment and live-domain verification guidance. " : "Optional AI assistant embed can be folded in if brought into scope before acceptance. ") +
    "Investment: **[Pricing TBD]**.";

  const essentialFor =
    routes <= 1 && !widget
      ? "Focused launches and single-offer pages"
      : "Teams prioritizing a tight first release without optional embed work";

  const standardFor =
    broad || trust
      ? "Growing brands balancing multiple routes and credibility"
      : "Most organizations standardizing messaging and launch readiness";

  const partnerFor = widget
    ? "Teams expecting assistant-led conversations alongside a broader footprint"
    : "Organizations wanting a closer advisory cadence through go-live";

  return [
    `# Proposal — Pricing Overview`,
    ``,
    `**Project:** ${ctx.siteTitle}`,
    ``,
    `All tiers are value descriptions only—no rates or hours are implied. Replace **[Pricing TBD]** with your firm’s numbers.`,
    ``,
    `| Tier | Description | Best For |`,
    `| --- | --- | --- |`,
    `| **Essential** | ${essentialDesc} | ${essentialFor} |`,
    `| **Standard** | ${standardDesc} | ${standardFor} |`,
    `| **Partner** | ${partnerDesc} | ${partnerFor} |`,
    ``,
    `### Notes`,
    `- Deployment posture: **${ctx.deploymentLabel}**.`,
    ctx.importedSite ? `- Based on an imported blueprint review—complexity reflects narrative restructuring, not line-item engineering.` : `- Greenfield or net-new structure—scope reflects blueprint quality, not legacy extraction.`,
    ``,
  ].join("\n");
}

/** Assumptive close + approval / onboarding handoff — placeholders only (no payment provider). */
export function renderProposalCloseEmailMarkdown(d: DeliverablesDocument, schema?: SiteSchemaDocumentType): string {
  const ctx = buildClientHandoffContext(schema);
  const pkg = buildClosePackageModel(d, schema);
  const posture = describeProposalPosture(pkg.proposalSelection);
  const recap = firstSentences(d.summary.executiveSummary, 2);
  const readinessLead = firstSentences(d.summary.readiness, 1);
  const checklistLabels = d.launchChecklist.map((s) => s.label);

  const nextBullets = checklistLabels.slice(0, 4).map((l) => `- ${l}`);

  return [
    `Hi {client_name},`,
    ``,
    `Quick note on **{project_name}** (aligned with **${ctx.siteTitle}** in our workspace).`,
    ``,
    `**Agreed posture for this thread:** ${posture}.`,
    ``,
    recap ? `Where we landed: ${recap}` : `Where we landed: the blueprint now reads with clearer hierarchy and stronger conversion discipline.`,
    ``,
    readinessLead
      ? `From a readiness standpoint: ${readinessLead}`
      : `From a readiness standpoint: you’re positioned to move once hosting and final copy are confirmed.`,
    ``,
    `Suggested next steps on your side:`,
    ...nextBullets,
    checklistLabels.length > 4 ? `- (Additional groups: ${checklistLabels.slice(4).join("; ")})` : null,
    ``,
    `**Approval:** When you’re ready to formalize, confirm in writing via **{approval_link}** (or attach your standard MSA/SOW).`,
    ``,
    `**Onboarding handoff:** After approval, we’ll align owners and dates through **{kickoff_link}** and follow the onboarding checklist already drafted for this project.`,
    ``,
    `**Payment (if applicable):** Use **{invoice_link}**, or your preferred **{stripe_payment_link}** / **{crypto_payment_link}** when your billing process is ready—structure (deposit vs. balance) stays between your firm and the client.`,
    ``,
    `If this matches your expectations, reply with a preferred start window and we’ll lock the engagement memo and timeline.`,
    ``,
    `Best,`,
    `[Your name]`,
    ``,
  ]
    .filter((x): x is string => x != null)
    .join("\n");
}

export function proposalArtifactFiles(
  d: DeliverablesDocument,
  schema?: SiteSchemaDocumentType,
): { path: string; content: string }[] {
  return [
    { path: "proposal-scope.md", content: renderProposalScopeMarkdown(d, schema) },
    { path: "proposal-pricing.md", content: renderProposalPricingMarkdown(d, schema) },
    { path: "proposal-close-email.md", content: renderProposalCloseEmailMarkdown(d, schema) },
  ];
}
