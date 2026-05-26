import { z } from "zod";
import { buildBentleyPlatformPromptDefaults } from "@/lib/revenue-os/bentley-platform-prompt-templates";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export const LongFormOutlineSchema = z
  .object({
    title: z.string().min(1).catch("Untitled"),
    sections: z.array(z.string()).catch([]),
    cta: z.string().min(1).catch(""),
  })
  .passthrough();

/** Canonical social execution platforms for Bentley `platformPosts` + DB post rows. */
export const BENTLEY_PLATFORM_POST_KEYS = ["instagram", "tiktok", "facebook", "reddit", "nextdoor"] as const;
export type BentleyPlatformPostKey = (typeof BENTLEY_PLATFORM_POST_KEYS)[number];

const optionalCoercedPostField = z
  .union([z.string(), z.number(), z.boolean()])
  .optional()
  .transform((v) => (v === undefined ? undefined : coerceTrimmedString(v) || undefined));

export const PlatformPostSlotSchema = z
  .object({
    caption: optionalCoercedPostField,
    hook: optionalCoercedPostField,
    cta: optionalCoercedPostField,
    promptText: optionalCoercedPostField,
    promptImage: optionalCoercedPostField,
    promptVideo: optionalCoercedPostField,
  })
  .partial();

export type PlatformPostSlot = z.infer<typeof PlatformPostSlotSchema>;

export const PlatformPostsSchema = z
  .object({
    instagram: PlatformPostSlotSchema.optional(),
    tiktok: PlatformPostSlotSchema.optional(),
    facebook: PlatformPostSlotSchema.optional(),
    reddit: PlatformPostSlotSchema.optional(),
    nextdoor: PlatformPostSlotSchema.optional(),
  })
  .partial();

export type PlatformPosts = z.infer<typeof PlatformPostsSchema>;

export const CampaignResponseSchema = z
  .object({
    industry: z.string().min(1).catch(""),
    targetAudience: z.string().min(1).catch(""),
    generatedAt: z.string().catch(() => new Date().toISOString()),
    offerStatement: z.string().min(1).catch(""),
    messagePillars: z.array(z.string()).catch([]),
    shortFormHooks: z.array(z.string()).catch([]),
    longFormOutlines: z.array(LongFormOutlineSchema).catch([]),
    objectionReplies: z.array(z.string()).catch([]),
    disclaimers: z.array(z.string()).catch([]),
    traceId: z.string().optional(),
    platformPosts: PlatformPostsSchema.optional(),
  })
  .passthrough();

export type CampaignResponse = z.infer<typeof CampaignResponseSchema> & {
  /** Always populated after `parseCampaignResponse` (defaults merged with model output). */
  platformPosts: Record<BentleyPlatformPostKey, PlatformPostSlot>;
};
export type LongFormOutline = z.infer<typeof LongFormOutlineSchema>;

/** Content safety + compliance disclaimers appended to every campaign response. */
export const COMPLIANCE_DISCLAIMERS = [
  "Compliance: Do not copy creators; emulate patterns only.",
  "Compliance: Verify claims and avoid prohibited ad categories per platform policies.",
  "Compliance: No guaranteed earnings; results vary.",
] as const;

/** Enforces exact array length: pad with fallbacks if fewer, slice if more. */
function exactArray<T>(
  arr: T[],
  exact: number,
  fallbacks: T[]
): T[] {
  const a = Array.isArray(arr) ? arr.filter(Boolean) : [];
  if (a.length >= exact) return a.slice(0, exact);
  return a.concat(fallbacks).slice(0, exact);
}

/** Default fallbacks for padding under-length arrays. */
const PAD_MESSAGE_PILLARS = [
  "Clarity over complexity.",
  "Proof-first communication.",
  "Audience-centered framing.",
];
const PAD_HOOKS = [
  "Stop guessing. Start getting results.",
  "The fastest path from zero to first win.",
  "One framework. Real results.",
  "What they don't tell you about getting started.",
  "The exact playbook I'd use if I started today.",
  "Stop doing X. Do this instead.",
  "The mistake most beginners make.",
  "How to get your first result without burning out.",
  "Why most people fail (and how to avoid it).",
  "Real results. No fluff.",
];
const PAD_OBJECTION = "Address directly with empathy and proof.";

const PLATFORM_POST_STRING_FIELDS = [
  "caption",
  "hook",
  "cta",
  "promptText",
  "promptImage",
  "promptVideo",
] as const;

/** Coerce workflow / session JSON scalars before Zod (numeric caption/hook must not reach `.trim()`). */
function normalizeCampaignResponseRaw(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };

  for (const key of ["industry", "targetAudience", "offerStatement"] as const) {
    if (key in o && o[key] != null) o[key] = coerceTrimmedString(o[key]);
  }

  const coerceStringArray = (arr: unknown): string[] | undefined => {
    if (!Array.isArray(arr)) return undefined;
    return arr.map((x) => coerceTrimmedString(x)).filter(Boolean);
  };

  if ("messagePillars" in o) o.messagePillars = coerceStringArray(o.messagePillars) ?? [];
  if ("shortFormHooks" in o) o.shortFormHooks = coerceStringArray(o.shortFormHooks) ?? [];
  if ("objectionReplies" in o) o.objectionReplies = coerceStringArray(o.objectionReplies) ?? [];
  if ("disclaimers" in o) o.disclaimers = coerceStringArray(o.disclaimers) ?? [];

  if (o.platformPosts && typeof o.platformPosts === "object" && !Array.isArray(o.platformPosts)) {
    const pp = o.platformPosts as Record<string, unknown>;
    const next: Record<string, Record<string, string>> = {};
    for (const [plat, slot] of Object.entries(pp)) {
      if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
      const s = slot as Record<string, unknown>;
      const row: Record<string, string> = {};
      for (const field of PLATFORM_POST_STRING_FIELDS) {
        if (s[field] == null) continue;
        const t = coerceTrimmedString(s[field]);
        if (t) row[field] = t;
      }
      if (Object.keys(row).length) next[plat] = row;
    }
    o.platformPosts = next;
  }

  if (Array.isArray(o.longFormOutlines)) {
    o.longFormOutlines = o.longFormOutlines.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return item;
      const row = item as Record<string, unknown>;
      return {
        ...row,
        title: coerceTrimmedString(row.title) || "Untitled",
        cta: coerceTrimmedString(row.cta),
      };
    });
  }

  return JSON.parse(JSON.stringify(o)) as unknown;
}

function mergePlatformPosts(
  industry: string,
  audience: string,
  offer: string,
  hooks: string[],
  outlines: z.infer<typeof LongFormOutlineSchema>[],
  incoming: PlatformPosts | undefined
): Record<BentleyPlatformPostKey, PlatformPostSlot> {
  const out = {} as Record<BentleyPlatformPostKey, PlatformPostSlot>;
  for (let i = 0; i < BENTLEY_PLATFORM_POST_KEYS.length; i++) {
    const k = BENTLEY_PLATFORM_POST_KEYS[i]!;
    const hook = coerceTrimmedString(hooks[i % hooks.length]);
    const cta = coerceTrimmedString(outlines[i % outlines.length]?.cta) || "Reply for details.";
    const caption =
      hook && offer ? `${hook}\n\n${offer}` : offer || hook || "Bentley campaign post";
    const inc = incoming?.[k] ?? {};
    const tmpl = buildBentleyPlatformPromptDefaults(k, { industry, audience, offer });
    out[k] = {
      caption: coerceTrimmedString(inc.caption) || caption,
      hook: coerceTrimmedString(inc.hook) || hook,
      cta: coerceTrimmedString(inc.cta) || cta,
      promptText: coerceTrimmedString(inc.promptText) || tmpl.promptText,
      promptImage: coerceTrimmedString(inc.promptImage) || tmpl.promptImage,
      promptVideo: coerceTrimmedString(inc.promptVideo) || tmpl.promptVideo,
    };
  }
  return out;
}

/**
 * Normalizes and validates parsed campaign JSON.
 * Enforces exact array lengths for UI reliability: 3 pillars, 10 hooks, 3 outlines, 5 objections.
 */
export function parseCampaignResponse(raw: unknown): CampaignResponse {
  const base = CampaignResponseSchema.parse(normalizeCampaignResponseRaw(raw));
  const outlines = (base.longFormOutlines ?? [])
    .filter((o): o is z.infer<typeof LongFormOutlineSchema> => Boolean(o))
    .map((o) => ({
      title: coerceTrimmedString(o.title) || "Untitled",
      sections: Array.isArray(o.sections) ? o.sections.filter(Boolean) : [],
      cta: coerceTrimmedString(o.cta),
    }));

  const industry = coerceTrimmedString(base.industry) || "the industry";
  const audience = coerceTrimmedString(base.targetAudience) || "your audience";
  const padOutlines: LongFormOutline[] = [
    { title: `How to Get Started in ${industry}`, sections: ["Define outcome.", "Choose one channel.", "Ship and iterate."], cta: "Grab the free checklist." },
    { title: `Top Mistakes to Avoid`, sections: ["Quitting too early.", "Wrong metrics.", "No system."], cta: "Comment 'PLAN' for the roadmap." },
    { title: `Real Results for ${audience}`, sections: ["Case study.", "What moved the needle.", "Key takeaways."], cta: "I can share the template." },
  ];

  const messagePillars = exactArray(base.messagePillars ?? [], 3, PAD_MESSAGE_PILLARS);
  const shortFormHooks = exactArray(base.shortFormHooks ?? [], 10, PAD_HOOKS);
  const longFormOutlines = exactArray(outlines, 3, padOutlines);
  const offer = coerceTrimmedString(base.offerStatement);

  return {
    ...base,
    messagePillars,
    shortFormHooks,
    longFormOutlines,
    objectionReplies: exactArray(base.objectionReplies ?? [], 5, [
      PAD_OBJECTION,
      PAD_OBJECTION,
      PAD_OBJECTION,
      PAD_OBJECTION,
      PAD_OBJECTION,
    ]),
    disclaimers: (base.disclaimers ?? []).filter(Boolean),
    platformPosts: mergePlatformPosts(
      industry,
      audience,
      offer,
      shortFormHooks,
      longFormOutlines,
      base.platformPosts
    ),
  };
}

export function generateMockCampaign(
  industry: string,
  targetAudience: string,
  notes: string
): CampaignResponse {
  return parseCampaignResponse({
    industry,
    targetAudience,
    generatedAt: new Date().toISOString(),
    offerStatement: `Get clear, actionable results in ${industry} within 30 days — backed by a simple framework tailored for ${targetAudience}.`,
    messagePillars: [
      "Clarity over complexity: one system, repeatable.",
      "Proof-first: show real constraints and outcomes.",
      "Beginner-friendly: start here, no prerequisites.",
    ],
    shortFormHooks: [
      "Stop guessing. Start getting results.",
      "The fastest path from zero to first win.",
      "What they don't tell you about starting in " + industry + ".",
      "I tried everything — this is what actually worked.",
      "One framework. 30 days. Real results.",
      "Stop doing X. Do this instead.",
      "The mistake 90% of beginners make.",
      "How to get your first result without burning out.",
      "Why most people fail (and how to avoid it).",
      "The exact playbook I'd use if I started today.",
    ],
    longFormOutlines: [
      {
        title: `How to Get Started in ${industry} (Step-by-Step)`,
        sections: [
          "Introduction: The real timeline and expectations.",
          "Step 1: Define your outcome and constraints.",
          "Step 2: Choose one channel and go deep.",
          "Step 3: Ship, measure, and iterate.",
        ],
        cta: "Grab the free checklist in the description.",
      },
      {
        title: `Top Mistakes to Avoid in ${industry}`,
        sections: [
          "Why most beginners quit too early.",
          "The complexity trap.",
          "Wrong metrics = wrong decisions.",
        ],
        cta: "Comment 'PLAN' for the one-page roadmap.",
      },
      {
        title: `Real Results: What Actually Works for ${targetAudience}`,
        sections: [
          "Case study: constraints and timeline.",
          "What moved the needle.",
          "Key takeaways you can use today.",
        ],
        cta: "If you want the template, I can share it.",
      },
    ],
    objectionReplies: [
      "Time: 'You don't need hours — start with 15 minutes a day.'",
      "Cost: 'Zero upfront. Use what you already have.'",
      "Skills: 'Designed for beginners. No prior experience needed.'",
      "Results: 'Most see first win in 2–4 weeks with consistency.'",
      "Complexity: 'One system. No overwhelm.'",
    ],
    disclaimers: [
      "Generated from consultant notes. Refine based on your specific offer and audience.",
      "Do not copy creators; produce original content inspired by patterns.",
    ],
  });
}
