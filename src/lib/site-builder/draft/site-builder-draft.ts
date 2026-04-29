/**
 * Site Builder draft mode: NL edits before a project is saved (no `builderSiteId`).
 * Persistence is sessionStorage only; no DB writes from draft routes.
 */

import { SiteSchemaDocument } from "@/lib/site-builder/schema";
import type { BuilderAction } from "@/lib/site-builder/builder-actions/action-schemas";

export const DRAFT_SCHEMA_STORAGE_KEY = "site-builder-draft-schema:v1";
export const DRAFT_CONTEXT_STORAGE_KEY = "site-builder-draft-context:v1";

export type SiteBuilderDraftContextV1 = {
  updatedAt: string;
  lastAssistantReply?: string;
  lastUserMessage?: string;
};

/** Valid JSON site schema present but no saved site id → draft mode for NL assist. */
export function isSiteBuilderDraftMode(schemaText: string, builderSiteId: string | null | undefined): boolean {
  if (builderSiteId?.trim()) return false;
  try {
    const raw = JSON.parse(schemaText) as unknown;
    return SiteSchemaDocument.safeParse(raw).success;
  } catch {
    return false;
  }
}

const DRAFT_ALLOWED_ACTIONS = new Set<BuilderAction["action"]>([
  "validate_schema",
  "create_page",
  "update_page_metadata",
  "apply_seo_enrichment",
  "add_section",
  "remove_section",
  "move_section",
  "update_copy",
  "set_theme_tokens",
  "set_footer",
  "set_nav_text_block",
  "save_project",
  "render_preview_ack",
  "prepare_client_portal",
  "export_project_validate",
]);

/**
 * Strip server-only or unsafe actions for pre-save draft application.
 * Does not call attach / import / LLM regen in draft.
 */
export function filterDraftSafeBuilderActions(actions: BuilderAction[]): {
  safe: BuilderAction[];
  dropped: string[];
} {
  const safe: BuilderAction[] = [];
  const dropped: string[] = [];
  for (const a of actions) {
    if (DRAFT_ALLOWED_ACTIONS.has(a.action)) {
      safe.push(a);
    } else {
      dropped.push(a.action);
    }
  }
  return { safe, dropped };
}

export function persistDraftSchemaToSession(schemaText: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_SCHEMA_STORAGE_KEY, schemaText);
  } catch {
    /* quota / private mode */
  }
}

export function persistDraftContextToSession(ctx: SiteBuilderDraftContextV1): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_CONTEXT_STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    /* */
  }
}

export function readDraftSchemaFromSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(DRAFT_SCHEMA_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readDraftContextFromSession(): SiteBuilderDraftContextV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.sessionStorage.getItem(DRAFT_CONTEXT_STORAGE_KEY);
    if (!s) return null;
    return JSON.parse(s) as SiteBuilderDraftContextV1;
  } catch {
    return null;
  }
}

export function clearSiteBuilderDraftSessionStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_SCHEMA_STORAGE_KEY);
    window.sessionStorage.removeItem(DRAFT_CONTEXT_STORAGE_KEY);
  } catch {
    /* */
  }
}

/**
 * If NL mapped to attach_agent only, try to move appearance colors to theme (preview-only).
 */
export function tryAttachToThemeOnlyDraft(actions: BuilderAction[]): BuilderAction[] {
  const hasAttach = actions.some((a) => a.action === "attach_agent_to_client_site");
  if (!hasAttach) return actions;
  const attach = actions.find((a) => a.action === "attach_agent_to_client_site") as
    | Extract<BuilderAction, { action: "attach_agent_to_client_site" }>
    | undefined;
  if (!attach) return actions;
  const rest = actions.filter((a) => a.action !== "attach_agent_to_client_site");
  const bubble = attach.widgetBubbleColor?.trim();
  const accent = bubble && /^#/i.test(bubble) ? bubble : attach.avatarBorderColor?.trim();
  if (accent && /^#([0-9a-f]{3,8})$/i.test(accent)) {
    const token: BuilderAction = {
      action: "set_theme_tokens",
      gradientStart: accent,
      gradientEnd: "#0f172a",
      styleMode: "web3",
    };
    return [...rest, token];
  }
  return rest;
}
