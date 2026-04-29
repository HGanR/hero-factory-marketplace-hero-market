import { ContentBriefSchema, type ContentBrief } from "@/lib/site-builder/ai/content-brief-schema";
import { scoreContentQuality } from "@/lib/site-builder/ai/content-quality";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";

export type AssistantBehaviorContext = {
  lastSectionIds: string[];
  lastPageSlug?: string;
};

export type AssistantBehaviorResult = {
  canAct: boolean;
  clarificationQuestion?: string;
  inferredIntent?: string;
  /** 0–1 — higher when we are confident the user can proceed without clarification. */
  confidence: number;
};

export type AssistantUiBuildPhase = "idle" | "building" | "critiquing" | "improving";

/** Pure helper for the Site assistant pill (Building, Critiquing, Improving, Applying edit, Ready, …). */
export function deriveAssistantStatusLabel(input: {
  nlApplying: boolean;
  busy: boolean;
  buildPhase: AssistantUiBuildPhase;
  showRefine: boolean;
}): string {
  if (input.nlApplying) return "Applying edit";
  if (input.busy) {
    if (input.buildPhase === "critiquing") return "Critiquing";
    if (input.buildPhase === "improving") return "Improving";
    if (input.buildPhase === "building") return "Building";
    return "Working";
  }
  return input.showRefine ? "Editing" : "Ready";
}

const NAMED_BLOCK_HINT =
  /\b(hero|footer|faq|pricing|stats?|testimonial|cta|call to action|headline|subhead|section \d+|section:\s*)/i;
const VAGUE_IMPROVE = /^(make it better|improve it|make this better|this is weak|this looks bad)(\s*[!.])?$/i;

export function analyzeAssistantPrompt(message: string, ctx: AssistantBehaviorContext): AssistantBehaviorResult {
  const raw = message.trim();
  if (!raw) {
    return { canAct: false, confidence: 0, clarificationQuestion: "What would you like to change?", inferredIntent: "empty" };
  }
  const lower = raw.toLowerCase();

  const looseVague =
    raw.length < 72 &&
    !NAMED_BLOCK_HINT.test(raw) &&
    /\b(make (it|everything|the site|this page) better|improve (it|this)|make (this|it) stronger)\b/i.test(lower);

  if (VAGUE_IMPROVE.test(raw) || looseVague) {
    return {
      canAct: false,
      confidence: 0.2,
      inferredIntent: "vague_improvement",
      clarificationQuestion: "Do you want me to improve copy, layout, colors, or CTA?",
    };
  }

  const deictic = /\b(change|update|edit|fix|tweak|rewrite)\s+(this|that)\b/i.test(raw);
  if (deictic && ctx.lastSectionIds.length === 0 && !NAMED_BLOCK_HINT.test(raw)) {
    return {
      canAct: false,
      confidence: 0.15,
      inferredIntent: "section_target_missing",
      clarificationQuestion: "Which section should I change?",
    };
  }

  const addForm = /\b(add|insert|put|include)\s+([a]?\s*)?form\b/i.test(lower);
  const formTypeAlready =
    /\b(lead|booking|contact|quote|demo|request|waitlist|newsletter)\b.*\bform\b|\bform\b.*\b(lead|booking|contact|quote|demo|request|waitlist)\b/i.test(
      lower,
    );
  if (addForm && !formTypeAlready) {
    return {
      canAct: false,
      confidence: 0.2,
      inferredIntent: "form_type_unspecified",
      clarificationQuestion: "Should this be a lead form, booking form, contact form, or quote form?",
    };
  }

  return { canAct: true, confidence: 0.85 };
}

function findBlock(
  doc: SiteSchemaDocumentType,
  pageSlug: string,
  sectionId: string,
): SiteSchemaDocumentType["pages"][number]["blocks"][number] | null {
  const page = doc.pages.find((p) => p.slug === pageSlug) ?? doc.pages[0];
  if (!page?.blocks) return null;
  for (const b of page.blocks) {
    const c = b.content as { aiSectionId?: string; sectionId?: string } | undefined;
    const id = (c?.aiSectionId || c?.sectionId || (b as { id?: string }).id || "").trim();
    if (id === sectionId) return b;
  }
  return null;
}

function briefFromDocument(doc: SiteSchemaDocumentType): ContentBrief {
  return ContentBriefSchema.parse({
    industry: String(doc.metadata?.title || "Page").slice(0, 200),
    audience: "Site visitors",
    primaryOffer: String(doc.metadata?.description || "").slice(0, 400) || "Your offer",
    painPoints: [],
    trustSignals: [],
    keywordTargets: [],
    ctaPrimary: "Get started",
    ctaSecondary: "Learn more",
  });
}

/**
 * Heuristic: after a successful edit, rescore affected area and suggest a single follow-up.
 */
export function buildPostEditFollowup(args: {
  actions: BuilderAction[];
  schema: SiteSchemaDocumentType;
  lastPageSlug: string;
  lastSectionIds: string[];
}): string | null {
  const { actions, schema, lastPageSlug, lastSectionIds } = args;
  if (actions.length === 0) return null;

  const pageSlug = lastPageSlug || "/";

  for (const a of actions) {
    if (a.action === "regenerate_section" && a.sectionId) {
      const b = findBlock(schema, pageSlug, a.sectionId.trim());
      const rk = String((b?.content as { aiRegistryKey?: string })?.aiRegistryKey || "").toLowerCase();
      if (b?.type === "hero" || rk.includes("hero")) {
        return "Done. I also recommend adding a proof point (logo row or stat) right under the headline if you have not already.";
      }
    }
  }

  for (const a of actions) {
    if (a.action === "set_section_background" && a.sectionId) {
      const block = findBlock(schema, pageSlug, a.sectionId.trim());
      const style = (block?.content as { style?: { backgroundColor?: string; textColor?: string } })?.style;
      const bg = String(style?.backgroundColor || "").toLowerCase();
      const fg = String(style?.textColor || "").trim();
      if (bg === "#ffffff" || bg === "#fff" || bg === "white") {
        if (!fg || /^#f[0-9a-f]{4}$/i.test(fg) || /^#e/i.test(fg) || /^#d[def]/i.test(fg) || /^white$/i.test(fg)) {
          return "Done. This section is now white. You may want darker text for contrast — ask to set the section text color to a near-black.";
        }
      }
    }
  }

  let sectionIdForRescore: string | undefined = lastSectionIds[0];
  for (const a of actions) {
    if (
      (a.action === "regenerate_section" ||
        a.action === "set_section_background" ||
        a.action === "set_section_text_color" ||
        a.action === "set_section_accent_color" ||
        a.action === "update_section_style") &&
      "sectionId" in a
    ) {
      const sid = String((a as { sectionId?: string }).sectionId || "").trim();
      if (sid) {
        sectionIdForRescore = sid;
        break;
      }
    }
  }
  if (sectionIdForRescore) {
    const block = findBlock(schema, pageSlug, sectionIdForRescore.trim());
    if (block) {
      const page = schema.pages.find((p) => p.slug === pageSlug) ?? schema.pages[0];
      const part: SiteSchemaDocumentType = {
        ...schema,
        pages: [
          {
            ...page!,
            blocks: [block],
          },
        ],
      };
      const q = scoreContentQuality(part, briefFromDocument(schema));
      if (q.score < 60 && q.suggestedFixes[0]) {
        return `Done. I also recommend: ${q.suggestedFixes[0]}.`;
      }
    }
  }

  const full = scoreContentQuality(schema, briefFromDocument(schema));
  if (full.score < 60 && full.suggestedFixes[0]) {
    return `Done. I also recommend: ${full.suggestedFixes[0]}.`;
  }

  return null;
}
