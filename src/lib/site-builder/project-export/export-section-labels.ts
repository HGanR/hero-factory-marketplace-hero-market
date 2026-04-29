/**
 * Shared section → React file naming for Next.js export and site.content-map.json.
 * Keeps filenames predictable and more descriptive than generic SectionN where we can infer block type.
 */

export const HANDOFF_MANIFEST_SCHEMA_VERSION = "1.0";

/** PascalCase component base from exported HTML chunk. */
export function exportSectionBasePascal(i: number, chunk: string): string {
  if (i === 0 && /hero-rich|\bhero\b/i.test(chunk)) {
    const h1 = chunk.match(/<h1[^>]*>\s*([^<]+)/i);
    const t = (h1?.[1] || "").trim().toLowerCase();
    if (/\b(launch|ship|drop|mint|protocol|chain)\b/.test(t)) return "LaunchHero";
    if (/\b(service|services|solutions|consulting|agency)\b/.test(t)) return "ServiceHero";
    return "Hero";
  }
  if (/<footer\b/i.test(chunk)) return "Footer";
  if (/class="[^"]*text-block/i.test(chunk)) return "BodyCopy";
  if (/class="[^"]*paragraph-block/i.test(chunk)) return "RichParagraph";
  if (/class="[^"]*image-block/i.test(chunk)) return "FigureImage";
  if (/class="[^"]*button-block/i.test(chunk)) return "PrimaryCta";
  if (/class="[^"]*heading-block/i.test(chunk)) return "SectionHeading";
  if (/class="[^"]*section-block/i.test(chunk)) return "FeatureSection";
  if (/class="[^"]*cta-block/i.test(chunk)) return "CallToAction";
  return `ExportedSection${i + 1}`;
}

/** File slug for a PascalCase export component (App Router / TSX). */
export function toKebabExportName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

export function uniquePascalNamesForChunks(chunks: string[]): string[] {
  const used = new Set<string>();
  return chunks.map((chunk, i) => {
    const base = exportSectionBasePascal(i, chunk);
    let pascal = base;
    let n = 2;
    while (used.has(pascal)) {
      pascal = `${base}${n}`;
      n += 1;
    }
    used.add(pascal);
    return pascal;
  });
}

export type NextSectionExportDescriptor = {
  componentPascal: string;
  kebabFile: string;
  componentFile: string;
};

export function nextSectionDescriptorsForRoute(chunks: string[], routeFolder: string): NextSectionExportDescriptor[] {
  const names = uniquePascalNamesForChunks(chunks);
  return names.map((pascal) => {
    const kebabFile = toKebabExportName(pascal);
    return {
      componentPascal: pascal,
      kebabFile,
      componentFile: `components/site-builder-export/${routeFolder}/${kebabFile}.tsx`,
    };
  });
}
