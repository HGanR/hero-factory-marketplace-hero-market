/**
 * Branded client handoff — rendered only from DeliverablesDocument + safe schema metadata.
 * No second content pipeline; no raw prompts or internal registry keys in output.
 */

import type { DeliverablesDocument } from "@/lib/site-builder/deliverables-schema";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { DeploymentTarget } from "@/lib/site-builder/refinement-schema";

const DEFAULT_FIRM = "TROOTHHERTZ";

/** Single source of truth for consultant-facing copy shared by Markdown + HTML renderers. */
const STRATEGIC_IMPROVEMENTS_FRAMING =
  "These highlights connect the rebuild to business outcomes—trust, clarity, and stronger conversion paths.";

const ROUTE_EVOLUTION_FRAMING =
  "Each route is framed as a strategic improvement: what visitors experienced before, and how the rebuilt structure supports the next step.";

const LAUNCH_CHECKLIST_FRAMING =
  "Use this as a practical sign-off list before DNS cutover or a public announcement—not a technical runbook.";

function safeStr(v: unknown, max: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.slice(0, max);
}

function deploymentTargetFromDoc(doc: SiteSchemaDocumentType | undefined): DeploymentTarget {
  const valid: DeploymentTarget[] = [
    "static",
    "vercel_nextjs",
    "netlify_static",
    "ipfs",
    "wordpress_theme",
    "gohighlevel_embed",
    "custom",
  ];
  const t = doc?.metadata?.builderRefinement as { deploymentTarget?: string } | undefined;
  return typeof t?.deploymentTarget === "string" && (valid as string[]).includes(t.deploymentTarget)
    ? (t.deploymentTarget as DeploymentTarget)
    : "static";
}

function deploymentLabelPlain(target: DeploymentTarget): string {
  switch (target) {
    case "static":
      return "Standard static files (upload to any host)";
    case "vercel_nextjs":
      return "Modern app-style export (e.g. Vercel or similar)";
    case "netlify_static":
      return "Static bundle (e.g. Netlify or similar)";
    case "ipfs":
      return "Static bundle packaged for IPFS-style hosting";
    case "wordpress_theme":
      return "WordPress theme–style folder layout";
    case "gohighlevel_embed":
      return "Embed-oriented assets for CRM or funnel platforms";
    case "custom":
      return "Flexible bundle—confirm the final host with your team";
    default:
      return "Your chosen hosting path";
  }
}

export type ClientHandoffRenderContext = {
  firmName: string;
  siteTitle: string;
  handoffDocumentTitle: string;
  deploymentTarget: DeploymentTarget;
  deploymentLabel: string;
  widgetAttached: boolean;
  widgetSummaryLine: string;
  importedSite: boolean;
  routeCount: number;
  generatedAtLabel: string;
  generatedAtIso: string;
};

/** Safe metadata for branding — works without importedSiteAudit (greenfield / tests). */
export function buildClientHandoffContext(schema?: SiteSchemaDocumentType): ClientHandoffRenderContext {
  const meta = schema?.metadata;
  const siteTitle = safeStr(meta?.title, 200) || "Your site";
  const target = deploymentTargetFromDoc(schema);
  const widgetAttached = Boolean(meta?.widgetIntegration?.widgetKey);
  const placement = meta?.widgetIntegration?.placement ?? "body_end";
  const routeCount = schema?.pages?.length ?? 0;
  const importedSite = Boolean(meta?.siteImport);
  const now = new Date();
  const generatedAtIso = now.toISOString();
  const generatedAtLabel = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const widgetSummaryLine = widgetAttached
    ? `An AI assistant embed is included (${placement === "head_script" ? "loaded in the document head" : "loaded before the closing body"}). After launch, confirm it appears on the live domain you expect.`
    : "No AI assistant embed is attached in this project. If your engagement includes one, configure it before go-live so hosting stays aligned.";

  return {
    firmName: DEFAULT_FIRM,
    siteTitle,
    handoffDocumentTitle: `${siteTitle} — engagement handoff`,
    deploymentTarget: target,
    deploymentLabel: deploymentLabelPlain(target),
    widgetAttached,
    widgetSummaryLine,
    importedSite,
    routeCount,
    generatedAtLabel,
    generatedAtIso,
  };
}

function handoffIntroMarkdown(ctx: ClientHandoffRenderContext): string {
  return (
    `This document summarizes outcomes, strategic route improvements, and launch readiness for **${ctx.siteTitle}**. ` +
    "It is written for stakeholders—focused on clarity, trust, modernization, and conversion paths—not implementation detail."
  );
}

function handoffIntroPlain(ctx: ClientHandoffRenderContext): string {
  return (
    `This document summarizes outcomes, strategic route improvements, and launch readiness for ${ctx.siteTitle}. ` +
    "It is written for stakeholders—focused on clarity, trust, modernization, and conversion paths—not implementation detail."
  );
}

/** Consultant- and client-facing Markdown handoff (single document). */
export function renderClientHandoffMarkdown(d: DeliverablesDocument, ctx: ClientHandoffRenderContext): string {
  const lines: string[] = [];
  lines.push(`# ${ctx.handoffDocumentTitle}`, "");
  lines.push(
    `*Prepared by ${ctx.firmName} · ${ctx.generatedAtLabel} · Deployment target: ${ctx.deploymentLabel}*`,
    "",
  );
  lines.push("## Overview", "", handoffIntroMarkdown(ctx), "");
  lines.push("*" + ctx.widgetSummaryLine + "*", "");
  lines.push("## Executive summary", "", d.summary.executiveSummary, "");
  lines.push("## Strategic improvements", "", STRATEGIC_IMPROVEMENTS_FRAMING, "");
  for (const t of d.summary.topImprovements) {
    lines.push(`- ${t}`);
  }
  lines.push("");
  lines.push("## Readiness snapshot", "", d.summary.readiness, "");
  lines.push("## Route evolution", "", ROUTE_EVOLUTION_FRAMING, "");
  for (const r of d.routeOutline) {
    lines.push(`### ${r.route} — ${r.role}`, "");
    lines.push("**Before**", "", r.before, "");
    lines.push("**After**", "", r.after, "");
    lines.push("**Improvements**", "");
    for (const im of r.improvements) {
      lines.push(`- ${im}`);
    }
    lines.push("");
  }
  lines.push("## Stakeholder questions", "");
  for (const f of d.stakeholderFaq) {
    lines.push(`### ${f.question}`, "", f.answer, "");
  }
  lines.push("## Launch checklist — your next steps", "");
  lines.push(LAUNCH_CHECKLIST_FRAMING, "");
  for (const section of d.launchChecklist) {
    lines.push(`### ${section.label}`, "");
    for (const item of section.items) {
      lines.push(`- [ ] ${item}`);
    }
    lines.push("");
  }
  if (d.socialSnippets?.length) {
    lines.push("## Appendix — social-ready snippets", "");
    lines.push("Optional short lines you can adapt for campaigns or announcements.", "");
    let i = 1;
    for (const s of d.socialSnippets) {
      lines.push(`${i}. ${s}`, "");
      i += 1;
    }
  }
  const year = new Date(ctx.generatedAtIso).getFullYear();
  lines.push("---", "", `© ${year} ${ctx.firmName}. Confidential handout for client use.`);
  return lines.join("\n").trim() + "\n";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlParagraphs(text: string): string {
  const parts = text.split(/\n\n+/).filter(Boolean);
  return parts.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br />")}</p>`).join("\n");
}

function printStyles(): string {
  return `
:root {
  --ink: #1a1f26;
  --muted: #5c6570;
  --rule: #d8dee6;
  --accent: #2c3e50;
  --bg: #ffffff;
}
@page { margin: 16mm 14mm; }
* { box-sizing: border-box; }
html { font-size: 15px; }
body {
  margin: 0;
  padding: 0;
  font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  line-height: 1.55;
  color: var(--ink);
  background: var(--bg);
}
.doc {
  max-width: 48rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}
.handoff-header {
  border-bottom: 2px solid var(--accent);
  padding-bottom: 1rem;
  margin-bottom: 1.75rem;
}
.handoff-header .firm {
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 0.35rem;
}
.handoff-header h1 {
  font-size: 1.65rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
  line-height: 1.25;
  color: var(--accent);
}
.handoff-header .meta {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 0;
}
.widget-note {
  font-size: 0.92rem;
  color: var(--muted);
  font-style: italic;
  margin: 1rem 0 1.5rem;
  padding: 0.75rem 1rem;
  background: #f6f8fa;
  border-left: 3px solid var(--rule);
  border-radius: 2px;
}
section { margin-bottom: 1.75rem; }
section h2 {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--accent);
  margin: 0 0 0.75rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--rule);
}
section h3 {
  font-size: 1.02rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
  color: var(--ink);
}
.route-card {
  margin-bottom: 1.25rem;
  padding: 1rem 1rem 0.25rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  page-break-inside: avoid;
}
.route-card .path {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.35rem;
}
.faq-item { margin-bottom: 1rem; }
.faq-item .q { font-weight: 600; margin-bottom: 0.35rem; }
.checklist-section { margin-bottom: 1rem; }
.checklist-section h3 { font-size: 0.98rem; }
.checklist-section ul { margin: 0.25rem 0 0 1.1rem; padding: 0; }
.checklist-section li { margin-bottom: 0.35rem; }
.appendix { font-size: 0.95rem; }
.handoff-footer {
  margin-top: 2.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
  font-size: 0.8rem;
  color: var(--muted);
}
@media print {
  body { background: #fff; }
  .doc { padding: 0; max-width: none; }
  a { color: inherit; text-decoration: none; }
}
`.trim();
}

/** Single-file, print/PDF-ready HTML handoff. */
export function renderClientHandoffHtml(d: DeliverablesDocument, ctx: ClientHandoffRenderContext): string {
  const intro = escapeHtml(handoffIntroPlain(ctx));
  const exec = htmlParagraphs(d.summary.executiveSummary);
  const readiness = htmlParagraphs(d.summary.readiness);

  const improvements = d.summary.topImprovements.map((t) => `<li>${escapeHtml(t)}</li>`).join("\n");

  const routes = d.routeOutline
    .map((r) => {
      const im = r.improvements.map((x) => `<li>${escapeHtml(x)}</li>`).join("\n");
      return `<div class="route-card">
  <div class="path">${escapeHtml(r.route)} · ${escapeHtml(r.role)}</div>
  <h3>Before</h3>
  ${htmlParagraphs(r.before)}
  <h3>After</h3>
  ${htmlParagraphs(r.after)}
  <h3>Improvements</h3>
  <ul>${im}</ul>
</div>`;
    })
    .join("\n");

  const faq = d.stakeholderFaq
    .map(
      (f) => `<div class="faq-item">
  <div class="q">${escapeHtml(f.question)}</div>
  ${htmlParagraphs(f.answer)}
</div>`,
    )
    .join("\n");

  const checklist = d.launchChecklist
    .map((sec) => {
      const items = sec.items.map((it) => `<li>${escapeHtml(it)}</li>`).join("\n");
      return `<div class="checklist-section">
  <h3>${escapeHtml(sec.label)}</h3>
  <ul>${items}</ul>
</div>`;
    })
    .join("\n");

  let appendix = "";
  if (d.socialSnippets?.length) {
    const items = d.socialSnippets.map((s, i) => `<p><strong>${i + 1}.</strong> ${escapeHtml(s)}</p>`).join("\n");
    appendix = `<section class="appendix" aria-labelledby="appendix-h">
  <h2 id="appendix-h">Appendix — social-ready snippets</h2>
  <p>Optional lines you can adapt for campaigns or announcements.</p>
  ${items}
</section>`;
  }

  const footerYear = String(new Date(ctx.generatedAtIso).getFullYear());

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(ctx.handoffDocumentTitle)}</title>
<style>
${printStyles()}
</style>
</head>
<body>
<div class="doc">
  <header class="handoff-header">
    <p class="firm">${escapeHtml(ctx.firmName)}</p>
    <h1>${escapeHtml(ctx.handoffDocumentTitle)}</h1>
    <p class="meta">${escapeHtml(ctx.generatedAtLabel)} · ${escapeHtml(ctx.deploymentLabel)}</p>
  </header>

  <p class="widget-note">${escapeHtml(ctx.widgetSummaryLine)}</p>

  <section aria-labelledby="overview-h">
    <h2 id="overview-h">Overview</h2>
    <p>${intro}</p>
  </section>

  <section aria-labelledby="exec-h">
    <h2 id="exec-h">Executive summary</h2>
    ${exec}
  </section>

  <section aria-labelledby="imp-h">
    <h2 id="imp-h">Strategic improvements</h2>
    <p>${escapeHtml(STRATEGIC_IMPROVEMENTS_FRAMING)}</p>
    <ul>${improvements}</ul>
  </section>

  <section aria-labelledby="ready-h">
    <h2 id="ready-h">Readiness snapshot</h2>
    ${readiness}
  </section>

  <section aria-labelledby="routes-h">
    <h2 id="routes-h">Route evolution</h2>
    <p>${escapeHtml(ROUTE_EVOLUTION_FRAMING)}</p>
    ${routes}
  </section>

  <section aria-labelledby="faq-h">
    <h2 id="faq-h">Stakeholder questions</h2>
    ${faq}
  </section>

  <section aria-labelledby="check-h">
    <h2 id="check-h">Launch checklist — next steps</h2>
    <p>${escapeHtml(LAUNCH_CHECKLIST_FRAMING)}</p>
    ${checklist}
  </section>

  ${appendix}

  <footer class="handoff-footer">
    © ${footerYear} ${escapeHtml(ctx.firmName)} · Confidential handout for client use.
  </footer>
</div>
</body>
</html>
`;
}
