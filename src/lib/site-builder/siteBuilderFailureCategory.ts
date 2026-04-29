/**
 * Maps thrown values to privacy-safe failure labels for site-builder analytics.
 * Never forwards raw Error.message (may contain API text).
 */

export type SiteBuilderFailureFields = {
  failure_category: string;
  /** Optional coarse code (e.g. http_404, invalid_schema_json) — never raw prompts or stacks */
  failure_code?: string;
};

export function deriveSiteBuilderFailureFields(err: unknown): SiteBuilderFailureFields {
  if (typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError") {
    return { failure_category: "aborted", failure_code: "abort" };
  }
  if (err instanceof TypeError) {
    return { failure_category: "network", failure_code: "type_error" };
  }
  if (err instanceof SyntaxError) {
    return { failure_category: "validation", failure_code: "invalid_json" };
  }
  if (!(err instanceof Error)) {
    return { failure_category: "unknown" };
  }
  const m = err.message;
  const http = /Request failed \((\d+)\)/.exec(m);
  if (http) {
    const code = parseInt(http[1], 10);
    const failure_category = code >= 500 ? "http_5xx" : "http_4xx";
    return { failure_category, failure_code: `http_${code}` };
  }
  if (/Schema JSON is invalid/i.test(m)) {
    return { failure_category: "validation", failure_code: "invalid_schema_json" };
  }
  if (/Select a workspace or enter Client ID/i.test(m)) {
    return { failure_category: "validation", failure_code: "link_required" };
  }
  if (/Choose a section to update/i.test(m)) {
    return { failure_category: "validation", failure_code: "section_required" };
  }
  if (/Select or create a site project/i.test(m)) {
    return { failure_category: "validation", failure_code: "no_site" };
  }
  return { failure_category: "unspecified_error" };
}
