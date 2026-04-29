import { SiteSchemaDocument, type SiteSchemaDocumentType } from "@/lib/site-builder/schema";

export function mergeWidgetIntegrationIntoSiteSchema(
  doc: unknown,
  opts: { widgetKey: string; loaderOrigin?: string },
): { ok: true; schema: SiteSchemaDocumentType } | { ok: false; error: string } {
  const parsed = SiteSchemaDocument.safeParse(doc);
  if (!parsed.success) {
    return { ok: false, error: "Invalid site schema" };
  }
  const key = opts.widgetKey.trim();
  if (key.length < 8) {
    return { ok: false, error: "widgetKey too short" };
  }
  const prevMeta = parsed.data.metadata;
  if (!prevMeta?.title) {
    return { ok: false, error: "Schema must include metadata.title" };
  }
  const next: SiteSchemaDocumentType = {
    ...parsed.data,
    metadata: {
      ...prevMeta,
      widgetIntegration: {
        ...(prevMeta.widgetIntegration ?? {}),
        widgetKey: key.slice(0, 80),
        ...(opts.loaderOrigin?.trim()
          ? { loaderOrigin: opts.loaderOrigin.trim().slice(0, 500) }
          : {}),
      },
    },
  };
  const again = SiteSchemaDocument.safeParse(next);
  if (!again.success) {
    return { ok: false, error: "Schema validation failed after merge" };
  }
  return { ok: true, schema: again.data };
}
