export type SkipperPromptOverlayRow = {
  title: string;
  content: string;
};

/**
 * Append-only block for the executive JSON planner system prompt.
 * Only **active** overlays (admin-approved) may be passed here — never pending/rejected/archived.
 */
export function formatActiveSkipperPromptOverlaysForPlanner(overlays: SkipperPromptOverlayRow[]): string {
  if (!overlays.length) return "";
  const blocks = overlays.map((o, i) => {
    const title = o.title.trim().slice(0, 500);
    const body = o.content.trim().slice(0, 6000);
    return `Overlay ${i + 1}: ${title}\n${body}`;
  });
  return [
    "",
    "---",
    "APPROVED PROMPT OVERLAYS (admin-reviewed; do not override base safety rules, JSON schema, or approval gates):",
    ...blocks,
    "---",
    "End of approved overlays.",
  ].join("\n");
}
