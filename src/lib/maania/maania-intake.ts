/**
 * MAANIA — client intake routing (sell vs buy). Structured buyer state lives in `buyer-draft.ts`.
 */

export type MaaniaIntakePath = "unknown" | "sell" | "buy";

export const MAANIA_OPENING_HOOK =
  "I can help match you with the right property and build a full buying strategy in under a minute. Let's start with a few quick questions.";

export const MAANIA_WELCOME_MARKDOWN = `I'm **MAANIA**, your intake and demo assistant for this workspace. I help turn a short conversation into structured summaries — not legal or tax advice.

${MAANIA_OPENING_HOOK}

**First:** Are you here to **sell a property**, or **purchase a property**?`;
