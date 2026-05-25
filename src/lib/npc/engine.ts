import type { KnowledgeEntry, NPCProfile, NPCResponse, NPCRole, PersonalityTraits } from "./types";
import { matchTrustObjectives, formatDecisionTreeOutput } from "./trust";
import { EXECUTIVE_ADMIN_NPC_RULE_FALLBACKS, isSkipperExecutiveNpcProfile } from "@/lib/agents/executive-admin-system-prompt";

type NpcContext = {
  source?: "trust-records" | "smart-trust" | "ecclesiastical" | "oasis-world" | "unknown";
  trustId?: string;
  workspaceId?: string;
  clientId?: string;
  clientName?: string;
  trustName?: string;
  moduleType?: string;
  currentStep?: string;
  stepFocus?: string;
  completionPct?: number;
  blockers?: string[];
  advisories?: string[];
  /** Specialist lane from Jarva entry routing (trust-advisor); server-set. */
  jarvaWorkflowPath?: string;
};

export const DEFAULT_PERSONALITY: PersonalityTraits = {
  friendliness: 70,
  formality: 50,
  verbosity: 50,
  humor: 30,
  patience: 70,
  expertise: 50,
};

const INTENT_RULES: Array<{ intent: string; keywords: string[] }> = [
  { intent: "greeting", keywords: ["hello", "hi", "hey", "good morning", "good afternoon"] },
  { intent: "schedule", keywords: ["schedule", "appointment", "book", "meeting", "calendar"] },
  { intent: "tour", keywords: ["tour", "show me", "walkthrough", "around", "guide"] },
  { intent: "pricing", keywords: ["price", "cost", "fee", "buy", "purchase"] },
  { intent: "ownership", keywords: ["owner", "creator", "built", "who made"] },
  { intent: "navigation", keywords: ["where", "location", "find", "map", "direction"] },
  { intent: "support", keywords: ["help", "support", "issue", "problem"] },
  { intent: "trust_selection", keywords: ["what trust", "which trust", "kind of trust", "type of trust", "trust for", "trust to"] },
  { intent: "trust_general", keywords: ["trust", "revocable", "irrevocable", "grantor", "beneficiary", "trustee", "asset protection", "estate tax", "probate"] },
];

const ROLE_SUGGESTIONS: Record<NPCRole, string[]> = {
  secretary: ["Schedule a meeting", "Contact the owner", "Office hours"],
  avatar: ["Tell me your story", "What is for sale?", "How does ownership work?"],
  guide: ["Start the tour", "Show me the buildings", "Any hidden spots?"],
  voice_agent: ["Schedule an appointment", "Leave a message", "Speak with a consultant"],
  executive_admin: [
    "Summarize agent activity",
    "What needs approval?",
    "Surface CRM follow-ups",
  ],
};

export const ROLE_FALLBACKS: Record<NPCRole, string[]> = {
  secretary: [
    "I can help with scheduling, introductions, and general questions. What do you need?",
    "Happy to assist. Would you like to set up a meeting or learn about this space?",
  ],
  avatar: [
    "Thanks for stopping by. I can share the story behind this world or answer questions.",
    "Glad you are here. Ask me anything about what I built or what is available here.",
  ],
  guide: [
    "I can show you around and point out interesting places. Where should we start?",
    "Ready for a tour? Tell me what you want to see first.",
  ],
  voice_agent: [
    "Thank you for calling. How can I help you today? I can schedule appointments or take a message.",
    "I am your virtual receptionist. Would you like to book a consultation or leave a callback request?",
  ],
  executive_admin: [...EXECUTIVE_ADMIN_NPC_RULE_FALLBACKS],
};

function normalize(text: string) {
  return text.toLowerCase();
}

/** Expands user message with synonyms so more phrasings hit knowledge (no external APIs) */
const QUERY_SYNONYMS: Array<{ from: string[]; to: string[] }> = [
  { from: ["get started", "begin", "start", "beginning"], to: ["where to start", "next steps"] },
  { from: ["res", "trust property", "trust res", "corpus"], to: ["assets", "property"] },
  { from: ["what now", "now what", "where do i go"], to: ["next steps", "what next"] },
  { from: ["instructions", "directions", "walk me through"], to: ["guide me", "workflow"] },
  { from: ["without api", "no api", "local only", "offline", "self-hosted"], to: ["platform"] },
];

function expandForMatching(message: string): string {
  let expanded = normalize(message);
  for (const { from, to } of QUERY_SYNONYMS) {
    if (from.some((f) => expanded.includes(f))) {
      expanded += " " + to.join(" ");
    }
  }
  return expanded;
}

function detectIntent(message: string): string {
  const lower = normalize(message);
  for (const rule of INTENT_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      return rule.intent;
    }
  }
  return "unknown";
}

function matchKnowledge(message: string, knowledge: KnowledgeEntry[]): KnowledgeEntry | null {
  if (!knowledge.length) return null;
  const expanded = expandForMatching(message);
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of knowledge) {
    const hits = entry.keywords.filter((k) => expanded.includes(normalize(k))).length;
    if (!hits) continue;
    const score = hits * 10 + entry.priority;
    if (!best || score > best.score) {
      best = { entry, score };
    }
  }

  return best?.entry ?? null;
}

function pickMoodFromIntent(intent: string): NPCResponse["mood"] {
  if (intent === "greeting") return "happy";
  if (intent === "support") return "concerned";
  if (intent === "tour" || intent === "navigation") return "excited";
  if (intent === "trust_selection" || intent === "trust_general") return "formal";
  return "neutral";
}

function getSuggestions(profile: NPCProfile): string[] {
  const role: NPCRole = isSkipperExecutiveNpcProfile(profile) ? "executive_admin" : profile.role;
  return ROLE_SUGGESTIONS[role] || ["Tell me more", "What else can you do?", "Thanks!"];
}

function pickFallback(profile: NPCProfile): string {
  if (isSkipperExecutiveNpcProfile(profile)) {
    const options = EXECUTIVE_ADMIN_NPC_RULE_FALLBACKS;
    return options[Math.floor(Math.random() * options.length)]!;
  }
  const options = ROLE_FALLBACKS[profile.role] || ROLE_FALLBACKS.secretary;
  return options[Math.floor(Math.random() * options.length)]!;
}

function buildTrustAdvisorFallback(message: string, context?: NpcContext): string {
  const lower = normalize(message);
  const blockers = (context?.blockers ?? []).filter(Boolean);
  const advisories = (context?.advisories ?? []).filter(Boolean);
  const completion =
    typeof context?.completionPct === "number" && Number.isFinite(context.completionPct)
      ? Math.max(0, Math.min(100, Math.round(context.completionPct)))
      : null;
  const step = context?.currentStep?.trim() || "current workspace step";
  const trustId = (context?.trustId || "").trim() || "Not set";
  const workspaceId = (context?.workspaceId || context?.trustId || "").trim() || "Not set";
  const clientId = (context?.clientId || "").trim() || "Not set";
  const clientName = (context?.clientName || "").trim() || "Not set";
  const trustName = (context?.trustName || "").trim() || "Not set";
  const source = context?.source;
  const hasWorkspace = trustId !== "Not set" || workspaceId !== "Not set";
  const hasClient = clientId !== "Not set";

  const isEcclesiasticalInterest =
    lower.includes("ecclesiastical") ||
    (lower.includes("religious") && (lower.includes("trust") || lower.includes("structure") || lower.includes("set up") || lower.includes("create"))) ||
    (lower.includes("church trust") || lower.includes("ministry trust")) ||
    (lower.includes("structure") || lower.includes("set up") || lower.includes("create") || lower.includes("get started") || lower.includes("interested")) &&
      (lower.includes("ecclesiastical") || lower.includes("religious") || lower.includes("church") || lower.includes("ministry"));

  if (isEcclesiasticalInterest) {
    if (!hasWorkspace || !hasClient) {
      return [
        "To structure an Ecclesiastical Trust on this platform, you need a workspace and a client first.",
        "",
        "**Steps:**",
        "1. Go to **Trust Records** and open or create a trust workspace.",
        "2. Ensure a **Client** is bound (Client ID linked to the workspace). Use the platform binding or Trust Records → Settings.",
        "3. Once workspace and client are set, go to the **Ecclesiastical Trust** page at **/ecclesiastical**.",
        "4. Start with the **Wizard** to capture the trust name, parties (Grantor, Executive Steward/Minister, Corporate Trustee), mission, and assets.",
        "",
        "I can guide you through each section once you're on the Ecclesiastical page. Ask \"what should I enter?\" when you're there.",
      ].join("\n");
    }
    if (source !== "ecclesiastical") {
      return [
        "You have a workspace and client. You're ready to structure the Ecclesiastical Trust.",
        "",
        "**Proceed to the Ecclesiastical Trust page:** `/ecclesiastical`",
        "",
        "Start with the **Wizard** (click Wizard in the nav) to enter:",
        "- Trust name and religious mission",
        "- Settlor/Grantor, Executive Steward (Minister), Corporate Trustee",
        "- Governing state, trust type (revocable/irrevocable), EIN strategy",
        "- Initial assets (corpus)",
        "",
        "Once you're on the Ecclesiastical page, I can see which step you're on and prompt you for the data needed. Ask \"what do I need to enter here?\"",
      ].join("\n");
    }
  }

  const sectionAliases = [
    "issue",
    "assets",
    "registry",
    "bonds",
    "minutes",
    "resolutions",
    "estate",
    "meetings",
    "settings",
  ];

  if (
    lower.includes("client id") ||
    lower.includes("trust id") ||
    lower.includes("workspace id") ||
    lower.includes("what client") ||
    lower.includes("who is the client") ||
    lower.includes("what trust") ||
    lower.includes("current section") ||
    sectionAliases.some((alias) => lower.includes(alias))
  ) {
    return [
      "Current workspace context:",
      `- Client Name: ${clientName}`,
      `- Client ID: ${clientId}`,
      `- Trust Name: ${trustName}`,
      `- Trust ID: ${trustId}`,
      `- Workspace ID: ${workspaceId}`,
      `- Active Section: ${step}`,
      completion !== null ? `- Completion: ${completion}%` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const isAskClientQuery =
    lower.includes("ask client") ||
    lower.includes("ask my client") ||
    lower.includes("what should i ask") ||
    lower.includes("questions to ask") ||
    lower.includes("client interview") ||
    lower.includes("what to ask client");

  if (isAskClientQuery) {
    const stepQuestions: Record<string, string> = {
      settings:
        "Ask your client: (1) Full legal name and complete mailing address. (2) Who will be trustee—same as grantor? If yes, use Fill from client. (3) Trustee name and address if different. (4) Governing state/jurisdiction. (5) Trust objectives to confirm trust type. Then enter in Settings or click Fill from client.",
      assets:
        'Ask your client: (1) "What property will fund this trust?" (cash, real estate, securities, etc.) (2) Description and approximate value for each. (3) How will title be transferred? Enter each in the Asset Registry.',
      issue:
        "Before Issue: ensure Assets are added. Ask your client the beneficial owner name and denomination for each certificate.",
      registry:
        "Certificates show issued units. To issue new ones, gather from your client: beneficial owner name, denomination, and which assets back the certificate.",
      bonds: "For Bonds: ask client for bondholder name, principal amount, interest rate, maturity date, and PPM reference.",
      governance:
        "Before Minutes/Resolutions: confirm meeting date, attendees, and key decisions with your client.",
      estate: "For Estate instruments: ask about will provisions, executor, and testamentary trust beneficiaries.",
      meetings: "For Meetings: ask client for meeting date, attendees, agenda, and resolutions adopted.",
      // Ecclesiastical steps
      "/": "Start with the Wizard. Ask your client: (1) Official trust name. (2) Who is the Settlor/Grantor? (3) What is the religious mission? (4) Who is the Executive Steward (Minister)? (5) Who is the Corporate Trustee? (6) Is the trust Irrevocable? (7) What is the initial asset corpus? (8) Confirm banking under Corporate Trustee's EIN (no separate EIN)? Enter these in the Wizard.",
      "/wizard":
        "In the Wizard, enter: Trust name, Settlor/Grantor, Executive Steward (Minister), Corporate Trustee, governing state, trust type (revocable/irrevocable), tax posture, EIN strategy (use Corporate Trustee's EIN vs apply for trust EIN), custody model, initial assets. Add parties (Settlor, Trustee, Corporate Trustee, Beneficiary, Protector). Ask your client for each field.",
      "/compliance":
        "On Compliance: complete the compliance checklist. Ensure no private inurement, mission is clearly religious, and Corporate Trustee authority is documented. Review EIN/custody decisions.",
      "/validator":
        "On Validator: run validation checks. Ensure all required fields from the Wizard are complete before validating.",
      "/custodians":
        "On Custodians: specify who holds assets—Corporate Trustee, third-party custodian, or self-custody. This should align with your EIN strategy.",
      "/clauses":
        "On Clauses: add or edit trust clauses. Include the No-EIN provision if using Corporate Trustee's standing, and Powers of the Trustee for asset sales.",
      "/trustee-onboarding":
        "On Trustee Onboarding: complete the trustee packet. The Corporate Trustee and Executive Steward need to sign or acknowledge their roles.",
      "/guardrails":
        "On Guardrails: review legal guardrails. Ensure no sovereign immunity claims; trust remains under civil law.",
    };
    const stepQuestion =
      source === "ecclesiastical"
        ? stepQuestions[step] || stepQuestions[step.replace(/^\/ecclesiastical/, "")] || stepQuestions["/wizard"]
        : stepQuestions[step];
    if (stepQuestion) return `You are on ${step}. ${stepQuestion}`;
    return `Ask your client for the information needed to complete ${step}. Then enter it in the platform. Ask "client interview" or "what to ask before [step]" for the full checklist.`;
  }

  const isNextStepsQuery =
    lower.includes("what next") ||
    lower.includes("next step") ||
    lower.includes("next steps") ||
    lower.includes("what should i do") ||
    lower.includes("what do i need") ||
    lower.includes("what do i enter") ||
    lower.includes("what should i enter") ||
    lower.includes("data needed") ||
    lower.includes("where am i") ||
    lower.includes("construct") ||
    lower.includes("constructing") ||
    lower.includes("how do i build") ||
    lower.includes("how do i create") ||
    (lower.includes("trust") && (lower.includes("build") || lower.includes("create") || lower.includes("start")));

  if (isNextStepsQuery) {
    const pathHint = context?.jarvaWorkflowPath
      ? `Workflow path: **${context.jarvaWorkflowPath.replace(/^trust_/, "")}** — `
      : "";
    if (blockers.length > 0) {
      return [
        `${pathHint}You are on ${step}${completion !== null ? ` (${completion}% complete)` : ""}.`,
        "Resolve these items first:",
        ...blockers.slice(0, 4).map((item) => `- ${item}`),
      ].join("\n");
    }
    const stepGuidance: Record<string, string> = {
      settings:
        "In Settings: ask your client for grantor/trustee names and addresses, then set Entity Type, Entity Name, grantor and trustee (or use Fill from client), Trust Category, Formation Mode.",
      assets:
        "In Assets: ask your client what property will fund the trust, then add each asset—cash, real estate, securities, etc.—with name and valuation. Backing assets are required before issuing certificates.",
      issue:
        "In Issue: select backing assets, enter denomination and beneficial owner name (ask your client if needed), then issue. Ensure assets exist in the registry first.",
      registry:
        "In Certificates: review issued certificates. To issue new ones, go to the Issue tab and complete the form with backing assets.",
      bonds: "In Bonds: ask client for bondholder details, then add bond instruments. Complete PPM reference before issuance.",
      governance:
        "In Minutes: confirm meeting details with your client, then record trustee meetings and resolutions.",
      estate: "In Estate: manage estate instruments (wills, testamentary trusts).",
      meetings: "In Meetings: track meeting records.",
      // Ecclesiastical steps – data needed to proceed
      "/":
        "You're on the Ecclesiastical Home. Go to the **Wizard** first to capture: trust name, parties (Settlor, Executive Steward, Corporate Trustee), religious mission, governing state, trust type, EIN strategy, and initial assets. Click Wizard in the nav.",
      "/wizard":
        "In the Wizard: enter trust name, add parties (Settlor/Grantor, Trustee, Corporate Trustee, Executive Steward, Beneficiary, Protector), set governing state, trust type (revocable/irrevocable), tax posture, EIN strategy (Corporate Trustee's EIN vs trust EIN), custody model, and initial assets. Complete each section before moving to Compliance.",
      "/compliance":
        "On Compliance: run the checklist. Ensure mission is clearly religious, no private inurement, and Corporate Trustee authority is documented. Then proceed to Validator or Custodians.",
      "/validator":
        "On Validator: run validation. Ensure Wizard fields are complete. Fix any flagged issues before Trustee Onboarding.",
      "/custodians":
        "On Custodians: specify custody model (Corporate Trustee, third-party, or self-custody). Align with your EIN strategy from the Wizard.",
      "/clauses":
        "On Clauses: add trust provisions. Include No-EIN language if using Corporate Trustee, and Powers of the Trustee for asset sales.",
      "/memo":
        "On Memo: add attorney notes or memos for the ecclesiastical structure.",
      "/trustee-onboarding":
        "On Trustee Onboarding: complete the trustee packet for Corporate Trustee and Executive Steward sign-off.",
      "/guardrails":
        "On Guardrails: review legal guardrails. Ensure no sovereign immunity claims. Trust operates under civil law.",
    };
    const stepHint =
      source === "ecclesiastical"
        ? stepGuidance[step] || stepGuidance["/wizard"] || `Complete the Wizard first, then move through Compliance → Validator → Custodians → Clauses. Ask "what do I need to enter here?" for step-specific prompts.`
        : stepGuidance[step] || `Complete the required fields in ${step}, then move to the next tab (Settings → Assets → Issue → Certificates). Ask "What should I ask my client?" for interview questions.`;
    return `${pathHint}You are on ${step}${completion !== null ? ` (${completion}% complete)` : ""}. ${stepHint}`;
  }

  if (blockers.length > 0) {
    return [
      `I can guide this workspace from ${step}.`,
      "Current blockers:",
      ...blockers.slice(0, 4).map((item) => `- ${item}`),
      "After those are complete, I can guide issue flow and compliance checks.",
    ].join("\n");
  }

  if (advisories.length > 0) {
    return [
      `Workspace status: ${step}${completion !== null ? ` (${completion}% complete)` : ""}.`,
      "Advisories to review:",
      ...advisories.slice(0, 3).map((item) => `- ${item}`),
    ].join("\n");
  }

  return `I can guide the trust workflow in this workspace, including required fields, next actions, and pre-issue checks. Ask "what should I do next?" and I will provide a step-by-step checklist from your current tab.`;
}

function isEcclesiasticalStructuringIntent(message: string): boolean {
  const lower = normalize(message);
  if (lower.includes("ecclesiastical")) return true;
  if (lower.includes("church trust") || lower.includes("ministry trust")) return true;
  if (lower.includes("religious") && (lower.includes("trust") || lower.includes("structure") || lower.includes("set up") || lower.includes("create"))) return true;
  const wantsToStart = lower.includes("structure") || lower.includes("set up") || lower.includes("create") || lower.includes("get started") || lower.includes("interested");
  const ecclesiasticalTopic = lower.includes("ecclesiastical") || lower.includes("religious") || lower.includes("church") || lower.includes("ministry");
  return !!(wantsToStart && ecclesiasticalTopic);
}

export function buildNpcResponse(params: {
  message: string;
  profile: NPCProfile;
  knowledge: KnowledgeEntry[];
  context?: NpcContext;
}): NPCResponse {
  const { message, profile, knowledge, context } = params;
  const intent = detectIntent(message);

  if (profile.id === "trust-advisor" && isEcclesiasticalStructuringIntent(message)) {
    const text = buildTrustAdvisorFallback(message, context);
    return {
      text,
      mood: pickMoodFromIntent(intent),
      source: "rule",
      intent,
      suggestions: ["Proceed to Ecclesiastical page", "What do I need to enter here?", "Ecclesiastical onboarding questions"],
    };
  }

  const knowledgeHit = matchKnowledge(message, knowledge);
  if (knowledgeHit) {
    return {
      text: knowledgeHit.content,
      mood: pickMoodFromIntent(intent),
      source: "knowledge",
      intent,
      suggestions: getSuggestions(profile),
    };
  }

  if (profile.id === "trust-advisor") {
    const decisionNodes = matchTrustObjectives(message);
    if (decisionNodes.length > 0) {
      const treeOutput = formatDecisionTreeOutput(decisionNodes);
      const text =
        treeOutput +
        "\n\nThis is general guidance only. Consult a licensed attorney or tax professional for your specific situation.";
      return {
        text,
        mood: pickMoodFromIntent(intent),
        source: "rule",
        intent,
        suggestions: [
          "What trust for estate tax?",
          "Explain revocable vs irrevocable",
          "Check issue certificate readiness",
        ],
      };
    }
    return {
      text: buildTrustAdvisorFallback(message, context),
      mood: pickMoodFromIntent(intent),
      source: "rule",
      intent,
      suggestions: [
        "Show missing required fields",
        "Give me next 3 actions",
        "Check issue certificate readiness",
      ],
    };
  }

  return {
    text: pickFallback(profile),
    mood: pickMoodFromIntent(intent),
    source: "rule",
    intent,
    suggestions: getSuggestions(profile),
  };
}
