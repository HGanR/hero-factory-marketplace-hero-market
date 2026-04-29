import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";

/** Section ids touched by actions that target a single block (for canvas pulse). */
export function builderActionTouchSectionIds(actions: BuilderAction[]): string[] {
  const out: string[] = [];
  for (const a of actions) {
    if (a.action === "regenerate_section" && a.sectionId?.trim()) out.push(a.sectionId.trim());
    if (a.action === "update_copy" && a.aiSectionId?.trim()) out.push(a.aiSectionId.trim());
    if (
      (a.action === "set_section_background" ||
        a.action === "set_section_text_color" ||
        a.action === "set_section_accent_color" ||
        a.action === "update_section_style") &&
      a.sectionId?.trim()
    ) {
      out.push(a.sectionId.trim());
    }
  }
  return [...new Set(out)];
}
