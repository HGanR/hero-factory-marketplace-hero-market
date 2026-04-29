import type { BuilderActionsRequest } from "@/lib/site-builder/builder-actions/action-schemas";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";
import type { SessionEditContext } from "@/lib/site-builder/ai/regenerate-section";
import type { BuilderActionResult } from "@/lib/site-builder/builder-actions/execute-builder-actions";

export type PostBuilderActionsResponse = {
  ok: boolean;
  schema?: SiteSchemaDocumentType;
  results?: BuilderActionResult[];
  sessionEditContext?: SessionEditContext;
  abortedAt?: number;
  error?: string;
  issues?: unknown;
};

/**
 * Browser / Route Handler helper: POST canonical builder tool actions.
 * Keeps chat UI separate from deterministic mutations (MCP-friendly boundary).
 */
export async function postBuilderActions(
  body: BuilderActionsRequest,
  init?: RequestInit,
): Promise<PostBuilderActionsResponse> {
  const res = await fetch("/api/site-builder/builder-actions", {
    ...init,
    method: "POST",
    credentials: init?.credentials ?? "include",
    headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as PostBuilderActionsResponse & {
    issues?: unknown;
  };
  if (!res.ok && !json.results) {
    return {
      ok: false,
      error:
        typeof json.error === "string"
          ? json.error
          : res.status === 400
            ? "Invalid request"
            : `HTTP ${res.status}`,
      issues: json.issues,
    };
  }
  return json;
}
