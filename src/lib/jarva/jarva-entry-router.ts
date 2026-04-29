/**
 * Deterministic front-door classification for Jarva (trust-advisor) — intake router before workspace binding.
 * Does not replace counsel, readiness gates, or Trust Records authority controls.
 */

export type JarvaEntryIntent =
  | "trust_general"
  | "trust_revocable"
  | "trust_irrevocable"
  | "trust_ecclesiastical"
  | "trust_certificate"
  | "trust_ppm"
  | "trust_bond"
  | "trust_estate"
  | "unknown";

export type JarvaTrustStyleHint = "revocable" | "irrevocable" | "ecclesiastical";

export type JarvaEntryRoute = {
  intent: JarvaEntryIntent;
  /** True when the consultant said "trust" without a clear type — ask Revocable / Irrevocable / Ecclesiastical. */
  needsTrustTypeChoice: boolean;
  /** Short prompt for NPC layer (optional). */
  prompt?: string;
  trustStyle?: JarvaTrustStyleHint;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Last N user lines (current + prior) for multi-turn resolution, e.g. "trust" then "revocable". */
export function classifyJarvaEntry(combinedRecentUserText: string): JarvaEntryRoute {
  const n = normalize(combinedRecentUserText);
  if (!n) {
    return { intent: "unknown", needsTrustTypeChoice: false };
  }

  // Product / specialty (before generic "trust")
  if (/\b(ppm|private placement|regulation d|reg d|offering memorandum)\b/.test(n)) {
    return {
      intent: "trust_ppm",
      needsTrustTypeChoice: false,
      prompt: "PPM / private placement",
    };
  }
  if (/\b(bond|bonds|indenture|debenture)\b/.test(n)) {
    return {
      intent: "trust_bond",
      needsTrustTypeChoice: false,
      prompt: "Bond / indenture",
    };
  }
  if (/\b(trust certificate|certificate issuance|issue certificate|asset certificate)\b/.test(n) || (/\bcertificate\b/.test(n) && /\btrust\b/.test(n))) {
    return {
      intent: "trust_certificate",
      needsTrustTypeChoice: false,
      prompt: "Trust certificate",
    };
  }
  if (/\b(estate|will|testament|probate)\b/.test(n)) {
    return {
      intent: "trust_estate",
      needsTrustTypeChoice: false,
      prompt: "Estate / will",
    };
  }

  const hasTrustWord = /\btrust\b/.test(n) || /\btrusts\b/.test(n);
  const ecclesiastical = /\becclesiastical\b/.test(n) || /\bchurch trust\b/.test(n) || /\bministry trust\b/.test(n);
  const revocable = /\brevocable\b/.test(n);
  const irrevocable = /\birrevocable\b/.test(n);

  if (ecclesiastical && (hasTrustWord || /\breligious\b/.test(n))) {
    return { intent: "trust_ecclesiastical", needsTrustTypeChoice: false, trustStyle: "ecclesiastical" };
  }
  if (revocable && (hasTrustWord || /\bliving trust\b/.test(n))) {
    return { intent: "trust_revocable", needsTrustTypeChoice: false, trustStyle: "revocable" };
  }
  if (irrevocable && hasTrustWord) {
    return { intent: "trust_irrevocable", needsTrustTypeChoice: false, trustStyle: "irrevocable" };
  }

  // "revocable" / "irrevocable" / "ecclesiastical" alone after a prior "trust" message (combined text)
  if (revocable && !irrevocable) {
    return { intent: "trust_revocable", needsTrustTypeChoice: false, trustStyle: "revocable" };
  }
  if (irrevocable && !revocable) {
    return { intent: "trust_irrevocable", needsTrustTypeChoice: false, trustStyle: "irrevocable" };
  }
  if (ecclesiastical) {
    return { intent: "trust_ecclesiastical", needsTrustTypeChoice: false, trustStyle: "ecclesiastical" };
  }

  if (
    hasTrustWord ||
    /\b(create|start|set up|establish|need|draft|build)\b/.test(n) && /\b(a trust|trust workspace|trust plan)\b/.test(n)
  ) {
    const onlyGenericTrust =
      /^(trust|trusts|a trust|the trust)[\s?!.,]*$/i.test(combinedRecentUserText.trim()) ||
      (hasTrustWord && !revocable && !irrevocable && !ecclesiastical && n.split(/\btrust\b/).join("").trim().length < 8);

    return {
      intent: "trust_general",
      needsTrustTypeChoice: onlyGenericTrust || (!revocable && !irrevocable && !ecclesiastical && hasTrustWord),
    };
  }

  return { intent: "unknown", needsTrustTypeChoice: false };
}

const DRAFT = "All outputs stay **DRAFT** for legal/counsel review — not legal advice.";

/**
 * When non-null, replaces the default trust-advisor rule/LLM body for this turn (procedural banner still prepends).
 */
export function formatJarvaEntryRouterReply(args: {
  message: string;
  combinedUserText: string;
  entryRoute: JarvaEntryRoute;
  hasTrustId: boolean;
  isFirstSessionMessage: boolean;
}): string | null {
  if (args.hasTrustId) return null;

  const { entryRoute, isFirstSessionMessage, combinedUserText } = args;
  const intent = entryRoute.intent;

  const greeting =
    "Hello — what can I help you with today?\n\nI'm Jarva, your **trust intake operator** on this platform. I route you through **Trust Records**, **Smart Trust**, and **Ecclesiastical Trust** using the flows already in the product — nothing parallel. " +
    DRAFT;

  const typeQuestion =
    "What type of trust are you creating today — **Revocable**, **Irrevocable**, or **Ecclesiastical**?\n\nOnce you say, I’ll align intake and next steps with the right module (Trust Records / Smart Trust vs `/ecclesiastical`). " +
    DRAFT;

  // First message: pure greeting if nothing classified
  if (isFirstSessionMessage && intent === "unknown") {
    const m = args.message.trim().toLowerCase();
    if (/^(hi|hello|hey|good (morning|afternoon|evening))[!.?\s]*$/i.test(m)) {
      return greeting;
    }
    return greeting;
  }

  if (intent === "trust_general" && entryRoute.needsTrustTypeChoice) {
    if (isFirstSessionMessage) {
      return `${greeting}\n\n${typeQuestion}`;
    }
    return typeQuestion;
  }

  if (intent === "trust_revocable") {
    return [
      "**Revocable (living-style) trust** — we’ll use **Trust Records** and **Smart Trust** for workspace binding, parties, assets, and drafts.",
      "",
      "1. Create or open a **Trust workspace** (Smart Trust home or Trust Records).",
      "2. Bind a **Client ID** to the matter.",
      "3. Use **labeled chat lines** here so Jarva can extract grantor, trustee, governing state, and objectives — I save as we go.",
      "",
      DRAFT,
    ].join("\n");
  }

  if (intent === "trust_irrevocable") {
    return [
      "**Irrevocable trust** planning — same platform paths (**Trust Records** / **Smart Trust**), with attention to terms that counsel will review before execution.",
      "",
      "Open a **Trust workspace**, bind a **Client**, then walk intake with me in chat (labeled fields). I’ll sync drafts only when you apply — still **DRAFT** for counsel.",
      "",
      DRAFT,
    ].join("\n");
  }

  if (intent === "trust_ecclesiastical") {
    return [
      "**Ecclesiastical trust** — use the **Ecclesiastical Trust** app at **`/ecclesiastical`** after you have a workspace and client bound.",
      "",
      "1. **Trust Records** or **Smart Trust**: create/open workspace + client.",
      "2. Go to **`/ecclesiastical`** → **Wizard** for mission, parties, corporate trustee, EIN strategy, and assets.",
      "",
      "I’ll mirror procedural guidance here; governance and counsel gates still apply. " + DRAFT,
    ].join("\n");
  }

  if (intent === "trust_certificate") {
    return [
      "**Trust certificates (asset certificates)** — use **Trust Records** → **Issue** / **Certificates** and **Settings** (prefix, seal) as your workflow requires.",
      "",
      "Prerequisites: a **Trust workspace**, **assets** in the registry, and usually parties/beneficiaries captured — I’ll keep collecting intake in parallel so drafts stay aligned.",
      "",
      DRAFT,
    ].join("\n");
  }

  if (intent === "trust_ppm") {
    return [
      "**Private placement / PPM-style materials** — use the platform’s **securities / offerings** flows under **Trust Records** and **Issue** where your workspace has offerings configured.",
      "",
      "I’m not authorizing any offering; counsel and trustee approvals still gate issuance. I can help structure **intake and drafts** as **DRAFT** workpapers. " + DRAFT,
    ].join("\n");
  }

  if (intent === "trust_bond") {
    return [
      "**Bonds / indenture-related instruments** — use **Trust Records** tabs for **Bonds** and related **Issue** / governance flows already in the workspace.",
      "",
      "We’ll keep trust structure and party data in sync via Jarva intake; nothing executes without your normal approvals. " + DRAFT,
    ].join("\n");
  }

  if (intent === "trust_estate") {
    return [
      "**Estate / will coordination** — Trust Records includes **Estate**-oriented instruments; tie them to the same client and trust workspace.",
      "",
      "Tell me what you’re drafting; I’ll route intake and remind you that instruments remain **DRAFT** until counsel review. " + DRAFT,
    ].join("\n");
  }

  return null;
}
