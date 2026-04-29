import type { z } from "zod";
import {
  ClientPortalInviteStatusSchema,
  SiteMetadataAiAgentSchema,
  SiteMetadataClientPortalSchema,
  SiteMetadataLeadCaptureSchema,
  SiteSchemaDocument,
  type SiteSchemaDocumentType,
} from "@/lib/site-builder/schema";

export type ClientPortalInviteStatus = z.infer<typeof ClientPortalInviteStatusSchema>;
export type SiteMetadataClientPortal = z.infer<typeof SiteMetadataClientPortalSchema>;
export type SiteMetadataLeadCapture = z.infer<typeof SiteMetadataLeadCaptureSchema>;
export type SiteMetadataAiAgent = z.infer<typeof SiteMetadataAiAgentSchema>;

export type ClientLifecycleMergeInput = {
  buildForClient: boolean;
  siteClientId: string | null | undefined;
  agencyBindings?: Array<{
    agentId: string;
    widgetKey: string;
    agentStatus?: string | null;
    clientId?: string | null;
    isActive: boolean;
  }>;
};

function effectiveClientId(input: ClientLifecycleMergeInput, doc: SiteSchemaDocumentType): string | null {
  const fromSite = input.siteClientId?.trim() || "";
  const fromMeta = doc.metadata?.clientId?.trim() || "";
  const pick = fromSite || fromMeta;
  return pick || null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mergeClientLifecycleMetadataIntoDocument(
  doc: SiteSchemaDocumentType,
  input: ClientLifecycleMergeInput,
): SiteSchemaDocumentType {
  const clientId = effectiveClientId(input, doc);
  /** Consultant path: explicit “build for client” toggle or any linked hub client id. */
  const clientSiteBuild = Boolean(input.buildForClient) || Boolean(clientId);
  const m = { ...(doc.metadata ?? { title: doc.metadata?.title ?? "Site", governance: {} }) };
  if (!m.title?.trim()) {
    m.title = "Site";
  }
  if (m.governance === undefined) {
    m.governance = {};
  }
  if (clientId && !UUID_RE.test(clientId)) {
    return SiteSchemaDocument.parse({ ...doc, metadata: m });
  }

  if (clientId) {
    m.clientId = clientId;
    const prevPortal = m.clientPortal as Partial<SiteMetadataClientPortal> | undefined;
    const inviteStatus =
      prevPortal?.inviteStatus && ClientPortalInviteStatusSchema.safeParse(prevPortal.inviteStatus).success
        ? prevPortal.inviteStatus
        : "not_invited";
    m.clientPortal = SiteMetadataClientPortalSchema.parse({
      enabled: true,
      clientId,
      portalUrl: prevPortal?.portalUrl ?? "/client-portal",
      inviteStatus,
      showLoginLinkOnSite: prevPortal?.showLoginLinkOnSite ?? false,
    });
    m.leadCapture = SiteMetadataLeadCaptureSchema.parse({
      crmEnabled: (m.leadCapture as { crmEnabled?: boolean } | undefined)?.crmEnabled ?? true,
      clientHubEnabled: (m.leadCapture as { clientHubEnabled?: boolean } | undefined)?.clientHubEnabled ?? true,
      portalVisible: (m.leadCapture as { portalVisible?: boolean } | undefined)?.portalVisible ?? true,
      clientId,
    });
  } else {
    delete m.clientPortal;
    delete m.leadCapture;
  }

  const widgetKey = m.widgetIntegration?.widgetKey?.trim();
  const bind = input.agencyBindings?.find((b) => b.isActive && b.widgetKey?.trim());
  if (widgetKey && bind?.agentId) {
    const cid = clientId ?? bind.clientId ?? undefined;
    m.aiAgent = SiteMetadataAiAgentSchema.parse({
      agentId: bind.agentId,
      widgetKey: widgetKey.slice(0, 80),
      status: bind.agentStatus ?? undefined,
      ...(cid && UUID_RE.test(cid) ? { clientId: cid } : {}),
    });
  } else if (!widgetKey && bind?.agentId && bind.widgetKey) {
    const cid = clientId ?? bind.clientId ?? undefined;
    m.aiAgent = SiteMetadataAiAgentSchema.parse({
      agentId: bind.agentId,
      widgetKey: bind.widgetKey.slice(0, 80),
      status: bind.agentStatus ?? undefined,
      ...(cid && UUID_RE.test(cid) ? { clientId: cid } : {}),
    });
  }

  const next: SiteSchemaDocumentType = {
    ...doc,
    metadata: m,
    ...(clientSiteBuild ? { clientSiteBuild: true } : {}),
  };
  return SiteSchemaDocument.parse(next);
}

export function stripSensitiveClientLifecycleForPublicExport(doc: SiteSchemaDocumentType): SiteSchemaDocumentType {
  const m = { ...(doc.metadata ?? {}) } as Record<string, unknown>;
  const show = Boolean((m.clientPortal as { showLoginLinkOnSite?: boolean } | undefined)?.showLoginLinkOnSite);
  delete m.clientId;
  delete m.leadCapture;
  delete m.aiAgent;
  if (!show) {
    delete m.clientPortal;
  } else {
    const cp = (m.clientPortal ?? {}) as Record<string, unknown>;
    m.clientPortal = {
      enabled: true,
      portalUrl: typeof cp.portalUrl === "string" ? cp.portalUrl : "/client-portal",
      showLoginLinkOnSite: true,
    };
  }
  const { clientSiteBuild: _c, ...rest } = doc;
  return SiteSchemaDocument.parse({ ...rest, metadata: m } as SiteSchemaDocumentType);
}

export function mergeClientLifecycleMetadataJson(
  schemaJson: unknown,
  input: ClientLifecycleMergeInput,
): { ok: true; schema: SiteSchemaDocumentType } | { ok: false; error: string } {
  const parsed = SiteSchemaDocument.safeParse(schemaJson);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.message };
  }
  try {
    const merged = mergeClientLifecycleMetadataIntoDocument(parsed.data, input);
    return { ok: true, schema: merged };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "merge failed" };
  }
}
