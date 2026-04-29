import type { DeploymentTarget, RequiredRecordsPayload } from "@/lib/site-builder/domain-connection-shared";
import type { DomainProvider, DomainType } from "@/lib/site-builder/domain-connection-shared";
import { buildFreenameWeb3SetupInstructions } from "@/lib/site-builder/domain-connection-freename";
import { sanitizeDomainName, sanitizeTargetUrlInput } from "@/lib/site-builder/domain-connection-sanitize";
import {
  getVercelApiToken,
  getVercelProjectIdForSiteBuilder,
  vercelAddProjectDomain,
  vercelConfigToRecordHints,
  vercelGetDomainConfig,
} from "@/lib/site-builder/vercel-site-domain-api";
import type { SiteDomainConnectionsDb } from "@/lib/site-builder/site-domain-connections-repository";
import {
  upsertSiteDomainConnection,
  type SiteDomainConnectionRow,
} from "@/lib/site-builder/site-domain-connections-repository";
import type { DomainConnectionStatus } from "@/lib/site-builder/domain-connection-shared";

export type CreateDomainConnectionParams = {
  db: SiteDomainConnectionsDb;
  ownerUserId: number;
  siteId: string;
  siteClientId: string | null;
  domain: string;
  domainType: DomainType;
  /** UI: who sold the name / DNS path */
  providerHint: DomainProvider;
  deploymentTarget: DeploymentTarget;
  targetUrlRaw: string;
};

function inferProvider(args: {
  domainType: DomainType;
  providerHint: DomainProvider;
  usedVercelApi: boolean;
}): DomainProvider {
  if (args.usedVercelApi) return "vercel";
  if (args.domainType === "freename_web3") return "freename";
  if (args.providerHint === "freename") return "freename";
  return "external";
}

/**
 * Creates or replaces the single `site_domain_connections` row for a site and returns the row.
 * Does not sync schema — caller should call `mergeDomainConnectionIntoCurrentSiteVersion`.
 */
export async function createOrUpdateDomainConnection(
  params: CreateDomainConnectionParams,
): Promise<{ row: SiteDomainConnectionRow; requiredPayload: RequiredRecordsPayload }> {
  const dom = sanitizeDomainName(params.domain);
  if (!dom.ok) {
    throw new Error(dom.error);
  }
  const tgt = sanitizeTargetUrlInput(params.targetUrlRaw);
  if (!tgt.ok) {
    throw new Error(tgt.error);
  }

  const token = getVercelApiToken();
  const projectId = getVercelProjectIdForSiteBuilder();
  let usedVercelApi = false;
  let vercelProjectId: string | null = projectId;
  let vercelDeploymentUrl: string | null =
    params.deploymentTarget === "vercel_deployment_url" || params.deploymentTarget === "vercel_custom_domain"
      ? tgt.url
      : null;

  let requiredPayload: RequiredRecordsPayload = {};
  let status: DomainConnectionStatus = "draft";
  let verificationMethod: string | null = "none";

  if (params.domainType === "freename_web3" || params.domainType === "other_web3") {
    requiredPayload = buildFreenameWeb3SetupInstructions({ domain: dom.domain, targetUrl: tgt.url });
    status = "instructions_ready";
    verificationMethod = "web3_dns";
  } else {
    /* web2 */
    if (token && projectId && params.deploymentTarget !== "static_export_url") {
      try {
        await vercelAddProjectDomain(projectId, dom.domain, token);
        usedVercelApi = true;
        const cfg = await vercelGetDomainConfig(dom.domain, token);
        const hints = vercelConfigToRecordHints(cfg);
        requiredPayload = {
          records: hints.map((h) => ({
            type: h.type,
            name: h.name,
            value: h.value,
            ttl: h.ttl,
            purpose: "Vercel-recommended DNS",
          })),
          vercelDomainResponse: cfg as Record<string, unknown>,
        };
        status = "instructions_ready";
        verificationMethod = "vercel_dns";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Vercel API error";
        requiredPayload = {
          instructionsMarkdown: `Vercel API could not add or load this domain automatically: ${msg}\n\nAdd the domain manually in the Vercel dashboard, then use the DNS records shown there with your registrar.`,
        };
        status = "instructions_ready";
        verificationMethod = "vercel_error";
      }
    } else {
      requiredPayload = {
        instructionsMarkdown: [
          `## Connect ${dom.domain} to your deployment`,
          ``,
          `**Target:** ${tgt.url}`,
          ``,
          `1. In Vercel → Project → Domains, add \`${dom.domain}\`.`,
          `2. Apply the DNS records Vercel shows (usually CNAME to \`cname.vercel-dns.com\` or A records).`,
          `3. Return here and run **Re-check** after DNS propagates.`,
        ].join("\n"),
      };
      status = "instructions_ready";
      verificationMethod = "manual_vercel_ui";
    }
  }

  const provider = inferProvider({
    domainType: params.domainType,
    providerHint: params.providerHint,
    usedVercelApi,
  });

  const row = await upsertSiteDomainConnection(params.db, {
    siteId: params.siteId,
    clientId: params.siteClientId,
    ownerUserId: params.ownerUserId,
    domain: dom.domain,
    domainType: params.domainType,
    provider,
    targetUrl: tgt.url,
    vercelProjectId: usedVercelApi ? vercelProjectId : null,
    vercelDeploymentUrl,
    status,
    verificationMethod,
    requiredRecords: requiredPayload,
    lastCheckedAt: null,
  });

  return { row, requiredPayload };
}
