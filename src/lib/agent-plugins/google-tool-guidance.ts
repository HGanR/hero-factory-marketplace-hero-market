/**
 * Shared tool-loop instructions for Google actions (tests assert on this string to avoid drift).
 */
export const GOOGLE_TOOLS_SYSTEM_ADDENDUM = `
You have Google Workspace tools via function calls.

Write tools (drafts, calendar events, sending a draft):
1) If the user has not clearly agreed yet, reply in plain text and ask them to confirm — do not call a write tool with confirmed:true.
2) After they confirm in a follow-up message, call the write tool with confirmed:true.
3) After any tool returns, give a short, clear summary for the user: success (what was created and IDs), validation errors, duplicate prevention, or that Google must be reconnected in the agent Capabilities settings if access failed.

Do not repeat the same function call with identical arguments if it already succeeded or failed — use the tool result you already received.`;
