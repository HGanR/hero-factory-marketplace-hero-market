import { hashSiteSchema } from "@/lib/site-builder/hash";
import type { SitePlannerOutput } from "@/lib/site-builder/ai/schemas";

/** Structural snapshot only — no page copy body text. */
export type SiteSchemaMetadataSnapshot = {
  schemaHash: string;
  pageCount: number;
  homeBlockCount: number;
  title?: string;
  descriptionSnippet?: string;
  styleMode?: string;
  hasWidget: boolean;
};

export function extractSectionRegistryKeys(planner: SitePlannerOutput): string[] {
  return (planner.sectionPlan ?? [])
    .map((s) => String(s.registryKey ?? "").trim())
    .filter(Boolean);
}

export function extractSchemaMetadataSnapshot(schema: unknown, planner: SitePlannerOutput): SiteSchemaMetadataSnapshot {
  const hash = hashSiteSchema(schema);
  const doc = schema as {
    pages?: unknown[];
    metadata?: {
      title?: string;
      description?: string;
      theme?: { styleMode?: string };
      widgetIntegration?: { widgetKey?: string };
    };
  };
  const pages = Array.isArray(doc.pages) ? doc.pages : [];
  const home = pages[0] as { blocks?: unknown[] } | undefined;
  const blocks = Array.isArray(home?.blocks) ? home!.blocks! : [];
  const desc = typeof doc.metadata?.description === "string" ? doc.metadata.description.trim() : "";
  return {
    schemaHash: hash,
    pageCount: pages.length,
    homeBlockCount: blocks.length,
    title: typeof doc.metadata?.title === "string" ? doc.metadata.title.slice(0, 200) : undefined,
    descriptionSnippet: desc ? desc.slice(0, 200) : undefined,
    styleMode: typeof doc.metadata?.theme?.styleMode === "string" ? doc.metadata.theme.styleMode : undefined,
    hasWidget: Boolean(
      doc.metadata?.widgetIntegration && String((doc.metadata.widgetIntegration as { widgetKey?: string }).widgetKey ?? "").trim(),
    ),
  };
}

export function layoutFingerprintFromPlanner(planner: SitePlannerOutput): { registryOrder: string[]; intent: string } {
  return {
    registryOrder: extractSectionRegistryKeys(planner),
    intent: String(planner.intent ?? ""),
  };
}
