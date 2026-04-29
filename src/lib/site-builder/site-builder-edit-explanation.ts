import type { SectionEditMeta } from "@/lib/site-builder/ai/regenerate-section";

export type EditExplanationScope = "section" | "multi_section" | "light_page" | "full_page" | "plan";

function clipCommand(cmd: string, max = 72): string {
  const t = cmd.trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/**
 * Short, grounded copy from prompt + scope — no fabricated diff details.
 */
export function buildSiteBuilderEditExplanation(args: {
  command: string;
  scope: EditExplanationScope;
  /** Friendly labels for affected sections (e.g. Hero, CTA). */
  friendlyLabels?: string[];
  /** When scope is light_page / multi_section */
  sectionCount?: number;
  /** Optional structured hint from pipeline */
  editMeta?: Pick<SectionEditMeta, "primaryIntent">;
}): string {
  const cmd = clipCommand(args.command);
  const labels = (args.friendlyLabels ?? []).filter(Boolean);
  const intent = args.editMeta?.primaryIntent;

  if (args.scope === "section" && intent === "design_token_update") {
    const tail = cmd ? ` — “${cmd}”` : "";
    return `Updated design tokens sitewide (from your request)${tail}.`;
  }

  if (args.scope === "section" && labels[0]) {
    const tail = cmd ? ` — “${cmd}”` : "";
    return `Updated the ${labels[0].toLowerCase()}${tail}.`;
  }

  if (args.scope === "multi_section") {
    const n = args.sectionCount ?? labels.length;
    const head = labels.slice(0, 2).join(" and ");
    const tail = cmd ? ` — “${cmd}”` : "";
    if (head && n <= 2) {
      return `Refined ${head.toLowerCase()}${tail}.`;
    }
    if (n > 0) {
      return `Refined ${n} sections together${tail}.`;
    }
    return `Refined the selected sections${tail}.`;
  }

  if (args.scope === "light_page") {
    const n = args.sectionCount ?? 0;
    const tail = cmd ? ` (“${cmd}”)` : "";
    if (n > 1) {
      return `Applied page-wide improvements across ${n} sections${tail}.`;
    }
    return `Updated the page${tail}.`;
  }

  if (args.scope === "full_page") {
    const tail = cmd ? ` (“${cmd}”)` : "";
    return `Rebuilt the page from your brief${tail}.`;
  }

  if (args.scope === "plan") {
    return cmd ? `Drafted a plan from “${cmd}”.` : "Drafted a plan from your brief.";
  }

  return "Applied your update.";
}
