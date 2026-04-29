import type { InspirationBrief } from "@/lib/site-builder/inspiration/inspiration-brief-schema";
import type { InspirationPageSignals } from "@/lib/site-builder/inspiration/extract-inspiration-signals";

const GENERIC = /\b(learn more|read more|click here|get started|contact us|submit|sign up)\b/i;

/**
 * Produces a brief of *patterns* — not copy to paste. Transformative, non-verbatim.
 */
export function summarizeInspirationSignals(
  combined: InspirationPageSignals,
  opts?: { industry?: string; sourceHint?: string },
): InspirationBrief {
  const h1 = combined.headings.find((h) => h.level === 1);
  const heroText = h1?.text || combined.pageTitle || combined.paragraphs[0] || "value-forward homepage";

  let heroPattern = "Hero uses a direct headline for the first screen.";
  if (h1) {
    const w = h1.text.split(/\s+/).length;
    if (w < 6) heroPattern = "Hero headline is very short and punchy, leading with a core outcome or claim.";
    else if (w > 14) heroPattern = "Hero leans on a long-form value statement in the H1, with detail above the fold.";
  }
  if (/[0-9%]/.test(heroText)) {
    heroPattern = "Hero emphasizes a measurable claim or number near the top.";
  }

  const ctaStripped = combined.ctaLabels
    .filter((c) => !GENERIC.test(c) || c.length < 20)
    .filter((c) => c.length > 2);
  const ctaPatterns: string[] = [];
  if (ctaStripped.length) {
    ctaPatterns.push("Primary actions favor concrete verbs over bare labels; repeated button labels are consistent.");
  }
  if (combined.ctaLabels.some((c) => /book|schedule|call|demo|consult/i.test(c))) {
    ctaPatterns.push("CTA style stresses booking or a live consult.");
  } else if (combined.ctaLabels.some((c) => /get|start|try|build/i.test(c))) {
    ctaPatterns.push("CTA style emphasizes product motion (start / get / build).");
  } else {
    ctaPatterns.push("CTA labels cluster around a small vocabulary—good for a single next step story.");
  }

  const h2s = combined.headings.filter((h) => h.level === 2).map((h) => h.text);
  const sectionPatterns: string[] = [];
  if (h2s.length >= 2) {
    if (/how|work|process|step/i.test(h2s.join(" "))) {
      sectionPatterns.push("Mid-page explains process or 'how it works' before the proof.");
    }
    if (/trust|logo|client|case|stories|proof|results/i.test(h2s.join(" "))) {
      sectionPatterns.push("A proof or results band appears in the first half of the page.");
    }
  }

  const trustSignals: string[] = [
    "Trust language appears through headings, not a wall of copy.",
    h2s.some((t) => /trust|client|awards|certif|secure/i.test(t))
      ? "Headings call out social proof, credentials, or customer outcomes."
      : "Proof is implied; consider explicit credibility in your generated site.",
  ].filter(Boolean) as string[];

  const navDense = combined.navLabels.length;
  const layoutPatterns: string[] = [
    navDense > 6
      ? "Top navigation is information-dense, suggesting a broad product surface."
      : "Navigation is compact, suggesting a lead-gen or service homepage.",
  ];
  if (combined.sectionHeadings.length >= 4) {
    layoutPatterns.push("Multiple distinct band-style sections, driven by H2s as story beats.");
  }
  if (h2s.find((t) => /pricing|plan|fee/i.test(t))) {
    layoutPatterns.push("A pricing or plans section appears, tightening conversion to commercial intent.");
  }
  if (h2s.find((t) => /faq|question|answer/i.test(t))) {
    layoutPatterns.push("An FAQ or objections section appears in the page flow.");
  }
  if (h2s.find((t) => /trust|security|compliance|audit/i.test(t))) {
    layoutPatterns.push("A trust, security, or risk section is visible before or alongside features.");
  }

  const tone = inferTone(combined, opts?.industry);
  const colorDirection = buildColorDirection(combined.colorHints);
  const keywordThemes = extractKeywordThemes(combined, opts?.industry);
  const detectedIndustry = (opts?.industry || inferIndustryHeuristic(combined) || "general b2b services").trim().slice(0, 200);

  return {
    detectedIndustry,
    tone,
    colorDirection,
    layoutPatterns,
    heroPattern,
    ctaPatterns: ctaPatterns.slice(0, 5),
    trustSignals: trustSignals.slice(0, 5),
    sectionPatterns: sectionPatterns.slice(0, 5),
    keywordThemes,
    doNotCopyNotice: true,
    robotsNote: opts?.sourceHint,
  };
}

export function summarizeIndustryOnly(industry: string): InspirationBrief {
  const t = industry.trim() || "your industry";
  return {
    detectedIndustry: t.slice(0, 200),
    tone: `Professional, audience-aware, aligned with typical ${t} web expectations (without copying a single competitor page).`,
    colorDirection: "Default to a calm neutral surface with a single clear accent; refine after first preview.",
    layoutPatterns: [
      "Lead with outcome-first hero, then trust and proof, then how it works, then a strong call-to-action.",
    ],
    heroPattern: "Hero should state who it is for, what they get, and a credible next step.",
    ctaPatterns: ["Favor a primary CTA tied to sales motion (book / apply / get audit) and one secondary (learn / resources)."],
    trustSignals: [
      "Include proof in headings (metrics, logos, certifications) appropriate to the industry.",
    ],
    sectionPatterns: [
      "Expect common beats: value props, proof, case patterns, process, and FAQ in long-form b2b flows.",
    ],
    keywordThemes: t
      .toLowerCase()
      .split(/[^a-z0-9+]+/i)
      .filter((w) => w.length > 3)
      .slice(0, 8)
      .map((w) => w[0]!.toUpperCase() + w.slice(1)),
    doNotCopyNotice: true,
  };
}

function inferTone(s: InspirationPageSignals, industry?: string): string {
  const text = [s.pageTitle, s.metaDescription, ...s.paragraphs.slice(0, 3)].join(" ").toLowerCase();
  if (/\b(enterprise|secure|governance|compliance|operator)\b/.test(text)) return "Premium, direct, and risk-aware; minimal fluff.";
  if (/\b(world-class|curated|craft|artisan|bespoke|atelier|studio)\b/.test(text)) return "Premium and editorial, with a crafted voice.";
  if (/\b(fast|ship|today|minutes|now)\b/.test(text)) return "Energetic and product-led, emphasizing speed and action.";
  if (industry) return `Credible, industry-appropriate, matching typical ${industry} positioning.`;
  return "Clear and conversion-minded, with plain language in the hero and structured proof lower on the page.";
}

function buildColorDirection(hex: string[]): string {
  if (!hex.length) return "Clean neutral canvas with a single accent; refine after the first build from your brand token.";
  const hasDark = hex.some((h) => h.toLowerCase().match(/^#(0|1|2)/));
  if (hasDark) return "Dark-leaning surfaces and strong type contrast, with a highlight accent (see sampled palette hints in brief only).";
  return "Light background with a saturated accent; sampled hex hints from the page suggest a high-contrast marketing layout.";
}

function extractKeywordThemes(s: InspirationPageSignals, industry?: string): string[] {
  const fromTitle = s.pageTitle.split(/[^a-z0-9+]+/i).filter((w) => w.length > 3);
  const fromH2 = s.headings
    .filter((h) => h.level === 2)
    .map((h) => h.text.split(/[^a-z0-9+]+/i).filter((w) => w.length > 3))
    .flat();
  const set = new Set([...(industry ? industry.split(/[^a-z0-9+]+/i) : []), ...fromTitle, ...fromH2].map((w) => w.toLowerCase()));
  return [...set]
    .filter((w) => w.length > 2 && w.length < 40)
    .slice(0, 12)
    .map((w) => w[0]!.toUpperCase() + w.slice(1));
}

function inferIndustryHeuristic(s: InspirationPageSignals): string {
  const blob = [s.metaDescription, s.pageTitle, ...s.paragraphs.slice(0, 2)].join(" ").toLowerCase();
  if (/\b(web3|on-?chain|defi|wallet|token|nft|dao)\b/.test(blob)) return "Web3 / on-chain product";
  if (/\b(saas|b2b|api|cloud|platform)\b/.test(blob)) return "B2B software";
  if (/\b(clinic|health|medical|wellness|patient)\b/.test(blob)) return "Healthcare or wellness";
  if (/\b(agency|consult|advisory|services|firm)\b/.test(blob)) return "Professional services";
  if (/\b(shop|store|commerce|cart|shipping)\b/.test(blob)) return "Commerce or retail";
  return "";
}
