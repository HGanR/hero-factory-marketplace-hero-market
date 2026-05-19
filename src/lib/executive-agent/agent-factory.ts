import type { ExecutiveWriteActionName } from "@/lib/executive-agent/executive-agent-policy";

export type ExecutiveAgentTemplateKey =
  | "sales_follow_up"
  | "client_onboarding"
  | "credit_readiness"
  | "website_builder"
  | "social_media"
  | "trust_intake"
  | "support";

export type SpecializedAgentSpec = {
  templateKey: ExecutiveAgentTemplateKey;
  purpose: string;
  permissions: string[];
  knowledgeSources: string[];
  clientWorkspaceScope: { clientId: string | null; workspaceId: string | null };
  voiceProfile?: { provider: string; voiceId: string | null } | null;
  auditLogEnabled: true;
  /** Always queued for approval before any persistence side-effects. */
  requiresApprovalAction: ExecutiveWriteActionName;
};

const TEMPLATE_LIBRARY: Record<
  ExecutiveAgentTemplateKey,
  Omit<SpecializedAgentSpec, "clientWorkspaceScope" | "voiceProfile">
> = {
  sales_follow_up: {
    templateKey: "sales_follow_up",
    purpose: "Prioritize CRM follow-ups, proposals, and renewal nudges.",
    permissions: ["read:crm", "read:analytics", "write:todos"],
    knowledgeSources: ["crm_clients", "engagement_threads"],
    auditLogEnabled: true,
    requiresApprovalAction: "createSpecializedAgent",
  },
  client_onboarding: {
    templateKey: "client_onboarding",
    purpose: "Guide new clients through intake, documents, and first wins.",
    permissions: ["read:crm", "read:agents", "write:todos"],
    knowledgeSources: ["client_notes", "trust_intake"],
    auditLogEnabled: true,
    requiresApprovalAction: "createSpecializedAgent",
  },
  credit_readiness: {
    templateKey: "credit_readiness",
    purpose: "Surface financing readiness signals without making credit decisions.",
    permissions: ["read:crm", "read:analytics"],
    knowledgeSources: ["accounting_signals"],
    auditLogEnabled: true,
    requiresApprovalAction: "createSpecializedAgent",
  },
  website_builder: {
    templateKey: "website_builder",
    purpose: "Translate brand briefs into structured Site Builder tasks.",
    permissions: ["read:site-builder", "read:crm", "write:todos"],
    knowledgeSources: ["web3_sites", "site_versions"],
    auditLogEnabled: true,
    requiresApprovalAction: "createSpecializedAgent",
  },
  social_media: {
    templateKey: "social_media",
    purpose: "Plan cadences and review Bentley / social outputs (no auto-publish).",
    permissions: ["read:bentley", "read:analytics", "write:todos"],
    knowledgeSources: ["campaigns", "campaign_posts"],
    auditLogEnabled: true,
    requiresApprovalAction: "createSpecializedAgent",
  },
  trust_intake: {
    templateKey: "trust_intake",
    purpose: "Assist trust workspace intake and checklist completion.",
    permissions: ["read:crm", "write:todos"],
    knowledgeSources: ["trusts", "trust_drafts"],
    auditLogEnabled: true,
    requiresApprovalAction: "createSpecializedAgent",
  },
  support: {
    templateKey: "support",
    purpose: "Triage support themes and suggest human-readable next steps.",
    permissions: ["read:crm", "read:agents", "read:analytics"],
    knowledgeSources: ["engagement_threads", "client_notes"],
    auditLogEnabled: true,
    requiresApprovalAction: "createSpecializedAgent",
  },
};

export function listExecutiveAgentTemplates(): ExecutiveAgentTemplateKey[] {
  return Object.keys(TEMPLATE_LIBRARY) as ExecutiveAgentTemplateKey[];
}

export function buildSpecializedAgentSpec(params: {
  templateKey: ExecutiveAgentTemplateKey;
  clientId: string | null;
  workspaceId?: string | null;
  voiceProvider?: string | null;
  voiceId?: string | null;
}): SpecializedAgentSpec {
  const base = TEMPLATE_LIBRARY[params.templateKey];
  if (!base) {
    throw new Error(`Unknown template: ${params.templateKey}`);
  }
  return {
    ...base,
    clientWorkspaceScope: {
      clientId: params.clientId?.trim() || null,
      workspaceId: params.workspaceId?.trim() || null,
    },
    voiceProfile:
      params.voiceProvider?.trim() ?
        { provider: params.voiceProvider.trim(), voiceId: params.voiceId?.trim() ?? null }
      : null,
  };
}
