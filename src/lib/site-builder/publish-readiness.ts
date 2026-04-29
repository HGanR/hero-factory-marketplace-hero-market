/**
 * Pure helpers for Site Builder Ship-stage readiness (checklist + light warnings).
 */

export type PublishReadinessBinding = { isActive: boolean };

export type PublishReadinessInput = {
  buildForClient: boolean;
  siteClientId: string | null | undefined;
  /** Current editor schema (parsed JSON or null). */
  parsedSchema: unknown;
  agencyBindings: PublishReadinessBinding[];
  /** In-session skip from agent wizard. */
  postLayoutAgentSkipped: boolean;
  /** User chose “I’ll handle the portal invite later” on Ship (sessionStorage-backed). */
  portalInviteBypass: boolean;
  /** User switched preview to Phone while on Ship, or persisted session flag. */
  mobilePreviewOk: boolean;
  /** True after layout pick / full build completion for this session. */
  layoutGenComplete: boolean;
  versionsCount: number;
};

export type PublishChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  /** Short hint for tooltips / screen readers when not done. */
  hint?: string;
};

function homeBlockCount(doc: unknown): number {
  const pages = (doc as { pages?: Array<{ blocks?: unknown[] }> })?.pages;
  const blocks = pages?.[0]?.blocks;
  return Array.isArray(blocks) ? blocks.length : 0;
}

function readSeoStrings(parsedSchema: unknown): { title: string; desc: string } {
  const meta = (parsedSchema as { metadata?: Record<string, unknown> } | null)?.metadata;
  const title = meta?.title;
  const desc = meta?.description;
  return {
    title: typeof title === "string" ? title : "",
    desc: typeof desc === "string" ? desc : "",
  };
}

export function isSeoBasicsPresent(parsedSchema: unknown, minLen = 3): boolean {
  const { title, desc } = readSeoStrings(parsedSchema);
  return title.trim().length >= minLen && desc.trim().length >= minLen;
}

export function hasWidgetInSchema(parsedSchema: unknown): boolean {
  const wk = (parsedSchema as { metadata?: { widgetIntegration?: { widgetKey?: string } } } | null)?.metadata
    ?.widgetIntegration?.widgetKey;
  return typeof wk === "string" && wk.trim().length > 0;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when portal + lead-capture metadata matches the linked hub client (Ship checklist). */
export function clientPortalHandoffSynced(parsedSchema: unknown, siteClientId: string | null | undefined): boolean {
  const cid = siteClientId?.trim();
  if (!cid || !UUID_RE.test(cid)) return false;
  const cp = (parsedSchema as { metadata?: { clientPortal?: { enabled?: boolean; clientId?: string } } } | null)
    ?.metadata?.clientPortal;
  return Boolean(cp?.enabled && typeof cp.clientId === "string" && cp.clientId === cid);
}

/** Invite sent, portal active, or operator skipped the checklist row for this browser session. */
export function clientPortalInviteSatisfied(parsedSchema: unknown, portalInviteBypass: boolean): boolean {
  if (portalInviteBypass) return true;
  const st = (parsedSchema as { metadata?: { clientPortal?: { inviteStatus?: string } } } | null)?.metadata
    ?.clientPortal?.inviteStatus;
  return st === "invited" || st === "active";
}

function wantsClientPortalShipExtras(input: PublishReadinessInput): boolean {
  const cid = input.siteClientId?.trim();
  if (!cid) return false;
  return Boolean(input.buildForClient) || Boolean((input.parsedSchema as { clientSiteBuild?: boolean } | null)?.clientSiteBuild);
}

export function computePublishChecklist(input: PublishReadinessInput): PublishChecklistItem[] {
  const versionSaved = input.versionsCount > 0;
  const draftVisible =
    input.layoutGenComplete || homeBlockCount(input.parsedSchema) > 0 || versionSaved;

  const siteClientOk = !input.buildForClient || Boolean(input.siteClientId?.trim());

  const widgetInSchema = hasWidgetInSchema(input.parsedSchema);
  const bindingActive = input.agencyBindings.some((b) => b.isActive);
  const agentOk = input.postLayoutAgentSkipped || widgetInSchema || bindingActive;

  const seoOk = isSeoBasicsPresent(input.parsedSchema);

  const portalExtras = wantsClientPortalShipExtras(input);
  const portalSynced = !portalExtras || clientPortalHandoffSynced(input.parsedSchema, input.siteClientId);
  const portalInviteOk = !portalExtras || clientPortalInviteSatisfied(input.parsedSchema, input.portalInviteBypass);

  const base: PublishChecklistItem[] = [
    {
      id: "version",
      label: "Saved server version",
      done: versionSaved,
      hint: "Use “Save version” in Edit, or Advanced → Versions, so deploy has a snapshot.",
    },
    {
      id: "draft",
      label: "Draft in editor",
      done: draftVisible,
      hint: "Generate from Outline/Edit or paste JSON so the preview has a page to ship.",
    },
    {
      id: "client",
      label: input.buildForClient ? "Revenue OS client" : "Client (optional)",
      done: siteClientOk,
      hint: input.buildForClient ? "Pick a hub client in Brief when “Build for client” is on." : undefined,
    },
    {
      id: "agent",
      label: "AI widget or skipped",
      done: agentOk,
      hint: "Attach an agent from the post-layout card, bind in Advanced, or choose Skip.",
    },
    {
      id: "seo",
      label: "SEO title & description",
      done: seoOk,
      hint: "Set metadata title and description (≥3 characters each) in the Ship panel.",
    },
    {
      id: "mobile",
      label: "Mobile preview checked",
      done: input.mobilePreviewOk,
      hint: "Switch the preview toolbar to Phone once before deploy.",
    },
  ];

  if (portalExtras) {
    base.push(
      {
        id: "client_portal",
        label: "Client portal metadata synced",
        done: portalSynced,
        hint: "Schema should include metadata.clientPortal for the linked client (auto-synced when you pick a hub client).",
      },
      {
        id: "client_portal_invite",
        label: "Client portal invite sent or skipped",
        done: portalInviteOk,
        hint: "Send from Client Hub → portal, mark invited in schema, or choose “skip for now” below.",
      },
    );
  }

  return base;
}

/** Large schema JSON can slow deploy/export — soft threshold for UI warnings only. */
export const SCHEMA_SIZE_WARN_BYTES = 350_000;

export function schemaSizeWarning(schemaText: string): { warn: boolean; bytes: number } {
  const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(schemaText).length : schemaText.length;
  return { warn: bytes > SCHEMA_SIZE_WARN_BYTES, bytes };
}
