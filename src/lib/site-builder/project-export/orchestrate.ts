import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { AssetStrategy, DeploymentTarget, RoutingMode } from "@/lib/site-builder/refinement-schema";
import { assembleStaticZipProject } from "./assemble-static";
import {
  buildCustomFallbackExport,
  buildGhlEmbedExport,
  buildIpfsExport,
  buildNetlifyExport,
  buildVercelNextExport,
  buildWordPressThemeExport,
} from "./deployment-builders";
import { applySiteBuilderAssetBundle } from "./asset-bundle";
import { buildDeploymentReadme } from "./deployment-readme";
import { finalizeHandoffArtifacts } from "./handoff-manifests";
import type { ProjectExportFile } from "./types";

export function parseDeploymentFromSchema(schema: SiteSchemaDocumentType): {
  target: DeploymentTarget;
  routingMode: RoutingMode;
  assetStrategy: AssetStrategy;
} {
  const raw = schema.metadata?.builderRefinement as Record<string, unknown> | undefined;
  const validTargets: DeploymentTarget[] = [
    "static",
    "vercel_nextjs",
    "netlify_static",
    "ipfs",
    "wordpress_theme",
    "gohighlevel_embed",
    "custom",
  ];
  const t = raw?.deploymentTarget;
  const target: DeploymentTarget =
    typeof t === "string" && (validTargets as string[]).includes(t) ? (t as DeploymentTarget) : "static";

  const r = raw?.routingMode;
  const routingMode: RoutingMode = r === "multi_page" ? "multi_page" : "single_page";

  const a = raw?.assetStrategy;
  const assetStrategy: AssetStrategy = a === "remote_urls" ? "remote_urls" : "local_bundle";

  return { target, routingMode, assetStrategy };
}

/** ZIP contents for the current schema + metadata.builderRefinement deployment fields. */
export async function buildDeploymentProjectFromSchema(
  schema: SiteSchemaDocumentType,
  ctx?: { userId: number | null },
): Promise<ProjectExportFile[]> {
  const { target, routingMode, assetStrategy } = parseDeploymentFromSchema(schema);

  let files: ProjectExportFile[];
  switch (target) {
    case "vercel_nextjs":
      files = buildVercelNextExport(schema, routingMode, assetStrategy);
      break;
    case "netlify_static":
      files = buildNetlifyExport(schema, routingMode, assetStrategy);
      break;
    case "ipfs":
      files = buildIpfsExport(schema, routingMode, assetStrategy);
      break;
    case "wordpress_theme":
      files = buildWordPressThemeExport(schema, routingMode, assetStrategy);
      break;
    case "gohighlevel_embed":
      files = buildGhlEmbedExport(schema, routingMode, assetStrategy);
      break;
    case "custom":
      files = buildCustomFallbackExport(schema, routingMode, assetStrategy);
      break;
    case "static":
    default:
      files = assembleStaticZipProject(schema);
      break;
  }

  if (ctx?.userId != null) {
    await applySiteBuilderAssetBundle(files, schema, {
      userId: ctx.userId,
      assetStrategy,
      deploymentTarget: target,
    });
  }

  finalizeHandoffArtifacts(files, schema, { target, routingMode, assetStrategy }, (c) =>
    buildDeploymentReadme(c, schema),
  );

  return files;
}
