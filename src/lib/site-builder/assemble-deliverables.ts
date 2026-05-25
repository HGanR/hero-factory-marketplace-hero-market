/**
 * Client deliverables assembly — reads SiteSchemaDocument + safe metadata only.
 * Does not use raw HTML, prompts, or internal registry keys in output.
 */

import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { DeploymentTarget } from "@/lib/site-builder/refinement-schema";
import type { ImportRestructureQueueItem } from "@/lib/site-builder/import-restructure-schema";
import { inferRouteFamilyFromPath } from "@/lib/site-builder/site-import/route-family";
import {
  DeliverablesDocumentSchema,
  type DeliverablesDocument,
} from "@/lib/site-builder/deliverables-schema";
import {
  buildClientHandoffContext,
  renderClientHandoffHtml,
  renderClientHandoffMarkdown,
} from "@/lib/site-builder/deliverables/client-handoff-render";
import { closePackageArtifactFiles } from "@/lib/site-builder/deliverables/close-package-artifacts";
import { proposalArtifactFiles } from "@/lib/site-builder/deliverables/proposal-artifacts";

/** Metadata slice used for client deliverables copy (optional fields only). */
type DeliverablesMetadataSource = Partial<NonNullable<SiteSchemaDocumentType["metadata"]>>;

function safeStr(v: unknown, max: number): string {
  const s = typeof v === "string" ? v.trim() : "";
  return s.slice(0, max);
}

function deploymentTargetFromSchema(doc: SiteSchemaDocumentType): DeploymentTarget {
  const valid: DeploymentTarget[] = [
    "static",
    "vercel_nextjs",
    "netlify_static",
    "ipfs",
    "wordpress_theme",
    "gohighlevel_embed",
    "custom",
  ];
  const t = (doc.metadata?.builderRefinement as { deploymentTarget?: string } | undefined)?.deploymentTarget;
  return typeof t === "string" && (valid as string[]).includes(t) ? (t as DeploymentTarget) : "static";
}

function deploymentLabelPlain(target: DeploymentTarget): string {
  switch (target) {
    case "static":
      return "standard static files you can upload anywhere";
    case "vercel_nextjs":
      return "a modern app-style export suited to Vercel or similar hosts";
    case "netlify_static":
      return "a static bundle suited to Netlify or similar hosts";
    case "ipfs":
      return "a static bundle packaged for IPFS-style hosting";
    case "wordpress_theme":
      return "a WordPress theme-style folder layout";
    case "gohighlevel_embed":
      return "embed-oriented assets for your CRM or funnel platform";
    case "custom":
      return "a flexible bundle—confirm the final host with your team";
    default:
      return "your chosen hosting path";
  }
}

const PRI: Record<ImportRestructureQueueItem["priority"], number> = { high: 0, medium: 1, low: 2 };

function sortedQueueForSummary(queue: ImportRestructureQueueItem[]): ImportRestructureQueueItem[] {
  return [...queue]
    .filter((q) => q.status !== "dismissed")
    .sort((a, b) => PRI[a.priority] - PRI[b.priority] || a.opportunityCode.localeCompare(b.opportunityCode))
    .slice(0, 5);
}

function outcomePrefix(code: string): string {
  const c = code.toLowerCase();
  if (c.includes("cta") || c.includes("conversion")) return "Conversion";
  if (c.includes("proof") || c.includes("trust")) return "Trust";
  if (c.includes("visual") || c.includes("hero") || c.includes("motion")) return "Modernization";
  if (c.includes("nav") || c.includes("section") || c.includes("structure")) return "Clarity";
  return "Consistency";
}

export function buildImprovementSummary(doc: SiteSchemaDocumentType): DeliverablesDocument["summary"] {
  const meta: DeliverablesMetadataSource = doc.metadata ?? {};
  const audit = meta.importedSiteAudit;
  const queue = meta.importRestructureQueue ?? [];
  const siteTitle = safeStr(meta.title, 200);
  const bb = meta.brandBrain;
  const al = meta.agencyLaunch;

  const topImprovements: string[] = [];
  const qTop = sortedQueueForSummary(queue);
  for (const item of qTop) {
    const line = safeStr(item.consultantLine ?? item.recommendation, 480);
    if (!line) continue;
    const prefix = outcomePrefix(item.opportunityCode);
    topImprovements.push(`${prefix}: ${line}`);
  }
  if (topImprovements.length < 3 && audit?.opportunities?.length) {
    for (const o of audit.opportunities) {
      if (topImprovements.length >= 5) break;
      const rec = safeStr(o.recommendation, 400);
      if (!rec) continue;
      topImprovements.push(`${outcomePrefix(o.code)}: ${rec}`);
    }
  }
  if (topImprovements.length < 3 && meta.siteImport) {
    topImprovements.push(
      "Consistency: presentation now follows a single design system so pages feel cohesive end to end.",
    );
  }

  let executiveSummary = "";
  if (audit?.summary) {
    const base = safeStr(audit.summary, 1800);
    const sentences = base.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 5);
    executiveSummary = sentences.join(" ");
  } else if (meta.siteImport) {
    executiveSummary =
      "Your site was rebuilt as a structured blueprint with clearer hierarchy and stronger conversion cues than a legacy layout typically allows. ";
    executiveSummary +=
      "The focus is on visitor clarity, trust, and a clean path to action—without shipping outdated markup in client materials.";
  } else {
    executiveSummary =
      "This deliverable summarizes improvements and launch readiness from your current builder state.";
  }

  if (bb?.scorecard && executiveSummary.length < 400) {
    executiveSummary += " Brand alignment was reviewed for consistency with your stated direction.";
  }
  if (al?.readiness === "launch_ready" && executiveSummary.length < 500) {
    executiveSummary += " Launch sequencing looks broadly ready—confirm hosting and final copy before go-live.";
  } else if (al?.readiness === "needs_attention" && executiveSummary.length < 500) {
    executiveSummary +=
      " A few orchestration items may still need attention—use the checklist before publishing.";
  }

  let readiness = "";
  if (al?.readiness === "launch_ready") readiness = "Overall readiness: strong for launch after hosting and widget checks.";
  else if (al?.readiness === "needs_attention") readiness = "Overall readiness: good progress—resolve open items in the checklist before launch.";
  else if (al?.readiness) readiness = "Overall readiness: still in draft—plan final review before external handoff.";
  else readiness = "Review the checklist against your deployment target before client sign-off.";
  const ds = meta.designSystem;
  if (ds?.density) {
    readiness += ` Layout density is set to ${ds.density === "compact" ? "tighter" : ds.density === "spacious" ? "more open" : "balanced"} spacing for readability.`;
  }

  return DeliverablesDocumentSchema.shape.summary.parse({
    title: `${siteTitle || "Site"} — improvement summary`.slice(0, 200),
    executiveSummary: executiveSummary.slice(0, 4000),
    topImprovements: topImprovements.slice(0, 5),
    readiness: readiness.slice(0, 1200),
  });
}

function roleLabel(family: string): string {
  if (family === "home") return "Primary landing";
  if (family === "services") return "Offer / services";
  if (family === "contact") return "Contact / booking";
  if (family === "faq") return "Help / objections";
  if (family === "about") return "Trust / story";
  if (family === "blog") return "Content / updates";
  return "Supporting page";
}

function queueItemsForRoute(path: string, queue: ImportRestructureQueueItem[]): string[] {
  const norm = path.replace(/\/+$/, "") || "/";
  const out: string[] = [];
  for (const q of queue) {
    if (q.status === "dismissed") continue;
    const qr = safeStr(q.route, 200);
    if (qr && (qr === norm || qr === path || norm.endsWith(qr.replace(/\/+$/, "")))) {
      out.push(safeStr(q.consultantLine ?? q.recommendation, 400));
    }
  }
  return [...new Set(out)].slice(0, 4);
}

function auditCuesForRoute(path: string, doc: SiteSchemaDocumentType): string {
  const opps = doc.metadata?.importedSiteAudit?.opportunities ?? [];
  const norm = path.replace(/\/+$/, "") || "/";
  const hits = opps.filter((o) => {
    const r = safeStr(o.route, 200);
    return r && (r === norm || r === path);
  });
  if (!hits.length) {
    return "Imported blueprint page—structure reflected the prior site’s information hierarchy.";
  }
  const t = hits.map((h) => safeStr(h.recommendation, 280)).join(" ");
  return t.slice(0, 600);
}

export function buildRouteOutline(doc: SiteSchemaDocumentType): DeliverablesDocument["routeOutline"] {
  const meta: DeliverablesMetadataSource = doc.metadata ?? {};
  const siteImport = meta.siteImport;
  const queue = meta.importRestructureQueue ?? [];
  const out: DeliverablesDocument["routeOutline"] = [];

  for (const page of doc.pages.slice(0, 30)) {
    const slug = page.slug.startsWith("/") ? page.slug : `/${page.slug}`;
    const family = inferRouteFamilyFromPath(slug);
    const types = page.blocks.map((b) => b.type);
    const hasStub = page.blocks.some(
      (b) => String((b.content as Record<string, unknown>)?.aiRegistryKey) === "import_route_stub",
    );

    const before =
      siteImport
        ? hasStub
          ? "Route surfaced from import; initial content was a short placeholder ready for your narrative."
          : auditCuesForRoute(slug, doc)
        : "Page composed for this project in the current site plan.";

    const intents: string[] = [];
    if (types.includes("call_to_action") || types.includes("button")) intents.push("clear next step");
    if (types.includes("hero")) intents.push("primary promise up front");
    if (family === "contact" || family === "faq") intents.push("questions and actions in one flow");

    const after = intents.length
      ? `Now emphasizes ${intents.join(", ")} in the rebuilt layout.`
      : "Structured sections clarify what this page is for and what to do next.";

    let routeImprovements = queueItemsForRoute(slug, queue);
    if (!routeImprovements.length && family === "home") {
      routeImprovements = queueItemsForRoute("/", queue);
    }
    if (!routeImprovements.length) {
      routeImprovements = ["Flow aligned with current section structure and design tokens."];
    }

    out.push({
      route: slug.slice(0, 200),
      role: roleLabel(family).slice(0, 200),
      before: before.slice(0, 800),
      after: after.slice(0, 800),
      improvements: routeImprovements.slice(0, 6).map((s) => s.slice(0, 500)),
    });
  }

  return DeliverablesDocumentSchema.shape.routeOutline.parse(out);
}

export function buildStakeholderFaq(doc: SiteSchemaDocumentType): DeliverablesDocument["stakeholderFaq"] {
  const meta: DeliverablesMetadataSource = doc.metadata ?? {};
  const target = deploymentTargetFromSchema(doc);
  const deploy = deploymentLabelPlain(target);
  const widgetAttached = Boolean(meta.widgetIntegration?.widgetKey);
  const placement = meta.widgetIntegration?.placement ?? "body_end";
  const queue = meta.importRestructureQueue ?? [];
  const suggested = queue.filter((q) => q.status === "suggested").length;
  const al = meta.agencyLaunch;

  const faq: DeliverablesDocument["stakeholderFaq"] = [
    {
      question: "What changed on the site?",
      answer:
        "We rebuilt the experience as a structured blueprint so navigation, emphasis, and calls to action are clearer. You get cleaner storytelling and a more dependable path to contact or purchase—without pasting old markup into client-facing documents.",
    },
    {
      question: "How does the AI assistant or embed fit in?",
      answer: widgetAttached
        ? `When configured, your project can include an assistant embed (${placement === "head_script" ? "loaded in the page head" : "loaded before the closing body"}). After launch, confirm it loads on the live domain you expect.`
        : "No assistant embed was attached in this project. If your engagement includes one, configure it before go-live so hosting and keys stay aligned.",
    },
    {
      question: "What still needs review?",
      answer:
        suggested > 0
          ? "Some optional improvements remain on the list—you should still review headlines, imagery, legal text, and forms outside this summary."
          : "Do a final pass on copy, media, forms, and compliance language in your own voice.",
    },
    {
      question: "How will deployment happen?",
      answer: `The export is prepared for ${deploy}. Upload or connect the bundle using your host’s standard steps, then verify the main routes in a fresh browser session.`,
    },
    {
      question: "What happens after we approve this version?",
      answer:
        "You or your implementation partner publishes the bundle, validates key pages live, and monitors inquiries and conversions—small copy tweaks can follow in a later revision.",
    },
  ];

  if (al?.readiness && al.readiness !== "launch_ready") {
    faq.push({
      question: "Are we ready to launch today?",
      answer:
        "We’re close—finish the checklist items for hosting, content, and (if used) the assistant embed before switching DNS or announcing widely.",
    });
  }

  return DeliverablesDocumentSchema.shape.stakeholderFaq.parse(faq.slice(0, 8));
}

export function buildLaunchChecklist(doc: SiteSchemaDocumentType): DeliverablesDocument["launchChecklist"] {
  const target = deploymentTargetFromSchema(doc);
  const widgetAttached = Boolean(doc.metadata?.widgetIntegration?.widgetKey);
  const routeCount = doc.pages.length;

  const deployment: DeliverablesDocument["launchChecklist"][number] = {
    label: "Deployment readiness",
    items: [
      `Confirm the export matches your intended target (${deploymentLabelPlain(target)}).`,
      "Verify domain, HTTPS, and DNS (or platform project settings) before cutover.",
      "Keep a rollback plan if you are replacing an existing live site.",
    ],
  };

  const content: DeliverablesDocument["launchChecklist"][number] = {
    label: "Content verification",
    items: [
      "Proofread headlines, body copy, and button labels on key pages.",
      "Replace placeholder images or media with final brand assets.",
      "Check phone, email, and address snippets for accuracy.",
    ],
  };

  const conversion: DeliverablesDocument["launchChecklist"][number] = {
    label: "Conversion flow validation",
    items: [
      routeCount > 1
        ? "Click through home → primary offer → contact in one sitting."
        : "Walk the primary call to action end to end (including mobile).",
      "Confirm form destinations, thank-you behavior, and tracking tags (if used).",
    ],
  };

  const widget: DeliverablesDocument["launchChecklist"][number] = {
    label: "Widget / agent validation",
    items: widgetAttached
      ? [
          "Confirm the embed key and loader domain match production.",
          "After publish, run one live conversation in an incognito window.",
        ]
      : ["Decide whether an assistant embed is in scope; if yes, configure it before launch."],
  };

  const finalR: DeliverablesDocument["launchChecklist"][number] = {
    label: "Final review",
    items: [
      "Stakeholder sign-off on messaging and offer framing.",
      "Export or hand off the bundle to implementation with this summary attached.",
    ],
  };

  return DeliverablesDocumentSchema.shape.launchChecklist.parse([deployment, content, conversion, widget, finalR]);
}

export function buildSocialSnippets(doc: SiteSchemaDocumentType): string[] {
  const snippets: string[] = [];
  for (const page of doc.pages) {
    for (const b of page.blocks) {
      if (snippets.length >= 3) break;
      const c = b.content as Record<string, unknown> | undefined;
      if (!c) continue;
      if (b.type === "hero") {
        const t = [safeStr(c.title, 220), safeStr(c.subtitle, 400)].filter(Boolean).join(" — ");
        if (t.length > 24) snippets.push(t.slice(0, 600));
      } else if (b.type === "call_to_action") {
        const t = [safeStr(c.title, 200), safeStr(c.label, 120)].filter(Boolean).join(": ");
        if (t.length > 16) snippets.push(t.slice(0, 600));
      }
    }
  }
  return [...new Set(snippets)].slice(0, 3);
}

export function assembleDeliverablesFromSchema(doc: SiteSchemaDocumentType): DeliverablesDocument {
  const summary = buildImprovementSummary(doc);
  const routeOutline = buildRouteOutline(doc);
  const stakeholderFaq = buildStakeholderFaq(doc);
  const launchChecklist = buildLaunchChecklist(doc);
  const social = buildSocialSnippets(doc);

  return DeliverablesDocumentSchema.parse({
    summary,
    routeOutline,
    stakeholderFaq,
    launchChecklist,
    socialSnippets: social.length ? social : undefined,
  });
}

/** Export bundle + UI: true when import audit exists (consultant deliverables scope). */
export function shouldIncludeDeliverablesInExport(doc: SiteSchemaDocumentType): boolean {
  return Boolean(doc.metadata?.siteImport && doc.metadata?.importedSiteAudit);
}

/** @deprecated Use shouldIncludeDeliverablesInExport */
export function shouldIncludeDeliverablesPack(doc: SiteSchemaDocumentType): boolean {
  return shouldIncludeDeliverablesInExport(doc);
}

export function renderDeliverablesSummaryMarkdown(summary: DeliverablesDocument["summary"]): string {
  const lines: string[] = [];
  lines.push(`# ${summary.title}`, "", "## Executive summary", "", summary.executiveSummary, "");
  lines.push("## Readiness", "", summary.readiness, "");
  lines.push("## Top improvements", "");
  for (const t of summary.topImprovements) {
    lines.push(`- ${t}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * Bundled deliverables for export/download. When `schema` is passed, includes branded
 * `client-handoff.md` / `client-handoff.html`, proposal artifacts (`proposal-*.md`),
 * and close/onboarding artifacts (`approval-summary.md`, etc.).
 */
export function deliverablesToBundledFiles(
  d: DeliverablesDocument,
  schema?: SiteSchemaDocumentType,
): { path: string; content: string }[] {
  const ctx = buildClientHandoffContext(schema);
  const files: { path: string; content: string }[] = [
    { path: "client-handoff.md", content: renderClientHandoffMarkdown(d, ctx) },
    { path: "client-handoff.html", content: renderClientHandoffHtml(d, ctx) },
    { path: "summary.md", content: renderDeliverablesSummaryMarkdown(d.summary) },
    { path: "route-outline.json", content: `${JSON.stringify(d.routeOutline, null, 2)}\n` },
    { path: "faq.json", content: `${JSON.stringify(d.stakeholderFaq, null, 2)}\n` },
    { path: "checklist.json", content: `${JSON.stringify(d.launchChecklist, null, 2)}\n` },
    ...proposalArtifactFiles(d, schema),
    ...closePackageArtifactFiles(d, schema),
  ];
  if (d.socialSnippets?.length) {
    files.push({ path: "social.txt", content: `${d.socialSnippets.join("\n\n")}\n` });
  }
  return files;
}
