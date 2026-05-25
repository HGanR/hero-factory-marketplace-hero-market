/** User-facing Skipper orchestrator answer text — no server-only (testable). */

export type OrchestratorInsightLine = {
  title: string;
  detail: string;
};

const GENERIC_REASONING_PATTERNS = [/^deterministic routing from keywords/i];

export function isGenericOrchestratorReasoningSummary(summary: string): boolean {
  const t = summary.trim();
  if (!t) return true;
  return GENERIC_REASONING_PATTERNS.some((re) => re.test(t));
}

export function isInternalOrchestratorBoilerplate(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("executive summary (read-only tools)") ||
    t.includes("insight block") ||
    t.includes("tool registry") ||
    t.includes("read-only tools). collected")
  );
}

function readableInsightDetail(detail: string): string | null {
  const t = detail.trim();
  if (!t || t.startsWith("{") || t.startsWith("[")) return null;
  if (isInternalOrchestratorBoilerplate(t)) return null;
  if (t.length > 480) return `${t.slice(0, 477)}…`;
  return t;
}

/** Build a voice/chat answer from planner reasoning + tool insight lines (never internal registry boilerplate). */
export function composeExecutiveOrchestratorAnswer(input: {
  reasoningSummary: string;
  insights: OrchestratorInsightLine[];
  requiresApprovalCount: number;
  dryRunWriteDetected: boolean;
  maxInsightLines?: number;
}): string {
  const maxLines = input.maxInsightLines ?? 3;
  const parts: string[] = [];

  if (!isGenericOrchestratorReasoningSummary(input.reasoningSummary)) {
    const rs = input.reasoningSummary.trim();
    if (!isInternalOrchestratorBoilerplate(rs)) parts.push(rs);
  }

  const insightTexts = input.insights
    .map((i) => readableInsightDetail(i.detail))
    .filter((d): d is string => d != null);

  if (parts.length === 0 && insightTexts.length > 0) {
    parts.push(insightTexts.slice(0, maxLines).join(" "));
  }

  if (parts.length === 0) {
    parts.push("Desk signals are in the Dynamic HUD. Ask a focused follow-up for one area in detail.");
  }

  if (input.requiresApprovalCount > 0) {
    parts.push(`${input.requiresApprovalCount} proposal(s) queued for your approval.`);
  } else if (input.dryRunWriteDetected) {
    parts.push("Dry run: write proposal(s) were detected but not queued.");
  }

  return parts.join(" ").trim();
}
