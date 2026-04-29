import { mutateVisualSchema } from "@/lib/site-builder/visual-editor";

export type ConversionGoal =
  | "lead_capture"
  | "booking"
  | "consultation"
  | "purchase"
  | "newsletter"
  | "call_request";

export type ConversionAuditResult = {
  score: number;
  issues: string[];
  recommendedActions: string[];
};

type Block = { type?: string; content?: Record<string, any> };

function parseDoc(schemaText: string): { pages?: Array<{ blocks?: Block[] }>; metadata?: Record<string, any> } {
  try {
    return JSON.parse(schemaText);
  } catch {
    return { pages: [{ blocks: [] }], metadata: {} };
  }
}

function blocksFromSchema(schemaText: string): Block[] {
  const doc = parseDoc(schemaText);
  return doc.pages?.[0]?.blocks ?? [];
}

function isCtaBlock(block: Block): boolean {
  const type = String(block.type || "").toLowerCase();
  const c = block.content || {};
  return type === "call_to_action" || (typeof c.label === "string" && typeof c.href === "string");
}

function isTrustBlock(block: Block): boolean {
  const type = String(block.type || "").toLowerCase();
  const full = `${block.content?.title ?? ""} ${block.content?.body ?? ""} ${block.content?.text ?? ""}`.toLowerCase();
  return type === "testimonials" || type === "stat_band" || /trust|proof|review|testimonial|case study/.test(full);
}

function isContactOrBookingBlock(block: Block): boolean {
  const type = String(block.type || "").toLowerCase();
  const href = String(block.content?.href || "").toLowerCase();
  return type === "form" || /calendly|book|consult|contact|call/.test(href);
}

export function evaluateConversionPath(schemaText: string): ConversionAuditResult {
  const blocks = blocksFromSchema(schemaText);
  const issues: string[] = [];
  const recommendedActions: string[] = [];
  const ctaIndices = blocks.map((b, i) => (isCtaBlock(b) ? i : -1)).filter((i) => i >= 0);
  const trustIndices = blocks.map((b, i) => (isTrustBlock(b) ? i : -1)).filter((i) => i >= 0);
  const hasContact = blocks.some(isContactOrBookingBlock);
  const hasWidget = /"widgetIntegration"\s*:\s*\{/.test(schemaText);
  const ctaVisibleOnMobile = blocks.some((b) => isCtaBlock(b) && !Boolean(b.content?.responsive?.mobile?.hidden));

  let score = 100;
  if (ctaIndices.length === 0) {
    score -= 30;
    issues.push("Missing clear primary CTA");
    recommendedActions.push("Add a primary CTA in hero and final section.");
  }
  if (!hasContact) {
    score -= 18;
    issues.push("No contact or booking mechanism");
    recommendedActions.push("Add contact/booking section with form or booking link.");
  }
  if (!trustIndices.some((idx) => ctaIndices.some((ctaIdx) => idx < ctaIdx))) {
    score -= 15;
    issues.push("Trust/proof section should appear before a CTA");
    recommendedActions.push("Add testimonials or proof section above CTA.");
  }
  if (ctaIndices.length < 2) {
    score -= 14;
    issues.push("CTA rhythm is weak");
    recommendedActions.push("Repeat CTA in at least two key sections.");
  }
  if (!hasWidget && !hasContact) {
    score -= 10;
    issues.push("No form/widget capture path");
    recommendedActions.push("Enable AI widget or add lead form.");
  }
  if (!ctaVisibleOnMobile) {
    score -= 12;
    issues.push("CTA hidden on mobile");
    recommendedActions.push("Ensure at least one CTA is visible on mobile.");
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
    recommendedActions,
  };
}

function newSectionId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function autoFixConversionPath(schemaText: string): { schemaText: string; audit: ConversionAuditResult } {
  const next = mutateVisualSchema(schemaText, (doc) => {
    if (!doc.metadata) doc.metadata = {};
    const blocks = doc.pages?.[0]?.blocks ?? [];
    if (blocks.length === 0) return;

    const hero = blocks[0];
    hero.content = hero.content || {};
    if (!hero.content.label || !hero.content.href) {
      hero.content.label = "Get started";
      hero.content.href = "#contact";
    }

    const hasTrust = blocks.some(isTrustBlock);
    if (!hasTrust) {
      blocks.splice(1, 0, {
        type: "section",
        content: {
          aiSectionId: newSectionId("trust"),
          title: "Trusted by clients",
          body: "Verified outcomes, testimonials, and social proof.",
        },
      });
    }

    const hasContact = blocks.some(isContactOrBookingBlock);
    if (!hasContact) {
      blocks.push({
        type: "section",
        content: {
          aiSectionId: newSectionId("contact"),
          title: "Let’s talk",
          body: "Share your goals and we’ll respond quickly.",
          label: "Book consultation",
          href: "#contact",
        },
      });
    }

    const hasFinalCta = blocks
      .slice(-2)
      .some((b) => String(b.type || "").toLowerCase() === "call_to_action");
    if (!hasFinalCta) {
      blocks.push({
        type: "call_to_action",
        content: {
          aiSectionId: newSectionId("final-cta"),
          title: "Ready to move forward?",
          body: "Take the next step with a quick conversion-focused call.",
          label: "Start now",
          href: "#contact",
        },
      });
    }

    const hasWidget = Boolean((doc.metadata as any)?.widgetIntegration?.widgetKey);
    if (hasWidget) {
      const finalCta = blocks.find((b) => String(b.type || "").toLowerCase() === "call_to_action");
      if (finalCta) {
        finalCta.content = finalCta.content || {};
        const body = String(finalCta.content.body || "");
        if (!/ai agent|assistant|chat/i.test(body)) {
          finalCta.content.body = `${body} Chat with our AI assistant for instant answers.`.trim();
        }
      }
    }
  });

  return { schemaText: next, audit: evaluateConversionPath(next) };
}
