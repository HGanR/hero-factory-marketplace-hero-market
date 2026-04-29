import type { AgentExecutionContext } from "@/lib/agent-plugins/types";
import { safeGoogleErrorMessage } from "@/lib/agent-plugins/google-api-errors";

export type GoogleFetchInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

/**
 * Authenticated Google HTTP fetch; throws Error with a runtime-safe message on failure.
 */
export async function fetchGoogleJson(
  ctx: AgentExecutionContext,
  url: string,
  init: GoogleFetchInit = {}
): Promise<unknown> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      ...init.headers,
    },
    body: init.body,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = safeGoogleErrorMessage(json, res.status);
    throw new Error(msg);
  }
  return json;
}
