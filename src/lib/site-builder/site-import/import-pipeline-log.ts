export type SiteImportPipelineStage =
  | "request_received"
  | "fetch_html"
  | "html_to_blueprint"
  | "blueprint_to_schema"
  | "finalize_document"
  | "response_ready"
  | "error";

export function logSiteImportStage(stage: SiteImportPipelineStage, detail: Record<string, unknown>): void {
  try {
    console.info(
      `[site-builder-import] ${stage}`,
      JSON.stringify({ at: new Date().toISOString(), ...detail }),
    );
  } catch {
    console.info(`[site-builder-import] ${stage}`, detail);
  }
}
