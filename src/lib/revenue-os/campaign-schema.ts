import { z } from "zod";

export const LongFormOutlineSchema = z
  .object({
    title: z.string().min(1).catch("Untitled"),
    sections: z.array(z.string()).catch([]),
    cta: z.string().min(1).catch(""),
  })
  .passthrough();

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
  })
  .passthrough();

export type CampaignResponse = z.infer<typeof CampaignResponseSchema>;
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

/**
 * Normalizes and validates parsed campaign JSON.
 * Enforces exact array lengths for UI reliability: 3 pillars, 10 hooks, 3 outlines, 5 objections.
 */
export function parseCampaignResponse(raw: unknown): CampaignResponse {
  const base = CampaignResponseSchema.parse(raw);
  const outlines = (base.longFormOutlines ?? [])
    .filter((o): o is z.infer<typeof LongFormOutlineSchema> => Boolean(o))
    .map((o) => ({
      title: (o.title || "").trim() || "Untitled",
      sections: Array.isArray(o.sections) ? o.sections.filter(Boolean) : [],
      cta: (o.cta || "").trim(),
    }));

  const industry = (base.industry || "").trim() || "the industry";
  const audience = (base.targetAudience || "").trim() || "your audience";
  const padOutlines: LongFormOutline[] = [
    { title: `How to Get Started in ${industry}`, sections: ["Define outcome.", "Choose one channel.", "Ship and iterate."], cta: "Grab the free checklist." },
    { title: `Top Mistakes to Avoid`, sections: ["Quitting too early.", "Wrong metrics.", "No system."], cta: "Comment 'PLAN' for the roadmap." },
    { title: `Real Results for ${audience}`, sections: ["Case study.", "What moved the needle.", "Key takeaways."], cta: "I can share the template." },
  ];

  return {
    ...base,
    messagePillars: exactArray(
      base.messagePillars ?? [],
      3,
      PAD_MESSAGE_PILLARS
    ),
    shortFormHooks: exactArray(base.shortFormHooks ?? [], 10, PAD_HOOKS),
    longFormOutlines: exactArray(outlines, 3, padOutlines),
    objectionReplies: exactArray(base.objectionReplies ?? [], 5, [
      PAD_OBJECTION,
      PAD_OBJECTION,
      PAD_OBJECTION,
      PAD_OBJECTION,
      PAD_OBJECTION,
    ]),
    disclaimers: (base.disclaimers ?? []).filter(Boolean),
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
