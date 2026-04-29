/**
 * Maps legacy import-only registry keys to planner/registry keys so Refine and batch regen work.
 */

export const IMPORT_SECTION_REGISTRY_ALIASES: Readonly<Record<string, string>> = {
  import_hero: "hero_primary",
  import_content: "paragraph_intro",
  import_media: "image_spotlight",
  import_cta: "mid_cta",
  import_footer: "footer_standard",
  import_route_stub: "paragraph_intro",
  import_misc: "paragraph_intro",
};

export function resolveImportRegistryKey(raw: string): string {
  const k = raw.trim();
  return IMPORT_SECTION_REGISTRY_ALIASES[k] ?? k;
}
