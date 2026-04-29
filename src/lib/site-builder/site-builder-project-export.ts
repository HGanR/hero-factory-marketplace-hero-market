import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import { assembleStaticZipProject } from "./project-export/assemble-static";
import { buildDeploymentReadme } from "./project-export/deployment-readme";
import { finalizeHandoffArtifacts } from "./project-export/handoff-manifests";
import { buildDeploymentProjectFromSchema, parseDeploymentFromSchema } from "./project-export/orchestrate";
import type { ProjectExportFile } from "./project-export/types";

export type { ProjectExportFile };

/**
 * Default static ZIP (index.html, styles.css, scripts.js, assets/*).
 * Same as deployment target `static`.
 */
export function buildStaticProjectFromSchema(schema: SiteSchemaDocumentType): ProjectExportFile[] {
  const files = assembleStaticZipProject(schema);
  const { routingMode, assetStrategy } = parseDeploymentFromSchema(schema);
  finalizeHandoffArtifacts(files, schema, { target: "static", routingMode, assetStrategy }, (c) =>
    buildDeploymentReadme(c, schema),
  );
  return files;
}

/** Uses `metadata.builderRefinement.deploymentTarget` (defaults to static). */
export { buildDeploymentProjectFromSchema };
