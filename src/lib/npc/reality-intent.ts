/**
 * REALITY Intent Detection
 * Classify user intent BEFORE answering for accurate routing.
 */

export type Intent =
  | "what_is_this"
  | "how_it_works"
  | "pricing"
  | "start"
  | "trust_question"
  | "technical"
  | "objection"
  | "greeting"
  | "thanks"
  | "appointment"
  | "features"
  | "other";

const INTENT_PATTERNS: { intent: Intent; patterns: RegExp[] }[] = [
  {
    intent: "what_is_this",
    patterns: [
      /what\s+is\s+(this|troothhurtz|hero\s+market|the\s+platform)/i,
      /tell\s+me\s+about/i,
      /explain\s+(this|the\s+platform)/i,
      /^what\s+is\s+it\s*\??$/i,
      /what\s+do\s+you\s+do/i,
      /what\s+are\s+you\s*\??$/i,
    ],
  },
  {
    intent: "how_it_works",
    patterns: [
      /how\s+(does\s+it\s+work|do\s+i\s+start|do\s+i\s+use)/i,
      /how\s+does\s+this\s+work/i,
      /walk\s+me\s+through/i,
      /explain\s+the\s+process/i,
    ],
  },
  {
    intent: "pricing",
    patterns: [
      /how\s+much/i,
      /cost|price|pricing|fee/i,
      /what\s+does\s+it\s+cost/i,
      /\$\d+/,
      /pay\s+for/i,
    ],
  },
  {
    intent: "start",
    patterns: [
      /how\s+do\s+i\s+(start|begin|get\s+started)/i,
      /i\s+want\s+to\s+start/i,
      /ready\s+to\s+(start|begin)/i,
      /sign\s+up|register/i,
      /get\s+started/i,
    ],
  },
  {
    intent: "trust_question",
    patterns: [
      /do\s+i\s+need\s+(an\s+)?llc/i,
      /trust|family\s+office|estate|governance/i,
      /entity|structur/i,
    ],
  },
  {
    intent: "technical",
    patterns: [
      /blockchain|nft|crypto|wallet|web3/i,
      /api|integration|technical/i,
    ],
  },
  {
    intent: "objection",
    patterns: [
      /is\s+this\s+legit|legitimate|scam/i,
      /trust\s+you|believe|real/i,
      /too\s+good\s+to\s+be\s+true/i,
      /skeptical|doubt/i,
    ],
  },
  {
    intent: "greeting",
    patterns: [
      /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|yo|sup)\s*!?\s*$/i,
      /^hi\s+there\s*!?\s*$/i,
    ],
  },
  {
    intent: "thanks",
    patterns: [
      /thank\s+you|thanks|appreciate|thx/i,
    ],
  },
  {
    intent: "appointment",
    patterns: [
      /schedule|book|appointment|meet|speak\s+.*\s+specialist|consultation\s+time/i,
    ],
  },
  {
    intent: "features",
    patterns: [
      /what\s+(features|tools|can\s+i\s+do)/i,
      /ai\s+revenue|campaign|revenue\s+os/i,
    ],
  },
];

/**
 * Detect user intent from normalized query.
 */
export function detectIntent(normalizedQuery: string): Intent {
  const q = normalizedQuery.trim();
  if (!q) return "other";

  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const p of patterns) {
      if (p.test(q)) return intent;
    }
  }

  return "other";
}
