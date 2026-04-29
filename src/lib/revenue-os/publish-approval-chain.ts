/**
 * Campaign-level multi-step publish approval chains (ordered reviewer roles per step).
 */

export type PublishApprovalChainRequiredRole = "editor" | "approver" | "owner";

export type PublishApprovalChainStep = {
  stepIndex: number;
  requiredReviewerRole: PublishApprovalChainRequiredRole;
  label?: string;
};

export type PublishApprovalChain = {
  steps: PublishApprovalChainStep[];
};

const REQUIRED_ROLES: PublishApprovalChainRequiredRole[] = ["editor", "approver", "owner"];

function normRole(s: string): PublishApprovalChainRequiredRole | null {
  const t = s.trim().toLowerCase();
  return REQUIRED_ROLES.includes(t as PublishApprovalChainRequiredRole)
    ? (t as PublishApprovalChainRequiredRole)
    : null;
}

/**
 * Parse and normalize chain JSON from DB or API. Invalid / empty → null (legacy single-step).
 */
export function parseCampaignPublishApprovalChainJson(raw: unknown): PublishApprovalChain | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      return parseCampaignPublishApprovalChainJson(JSON.parse(raw));
    } catch {
      return null;
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const stepsRaw = (raw as { steps?: unknown }).steps;
  if (!Array.isArray(stepsRaw) || stepsRaw.length === 0) return null;

  const out: PublishApprovalChainStep[] = [];
  for (let i = 0; i < stepsRaw.length; i += 1) {
    const row = stepsRaw[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    const o = row as { stepIndex?: unknown; requiredReviewerRole?: unknown; label?: unknown };
    const role = normRole(String(o.requiredReviewerRole ?? ""));
    if (!role) return null;
    let stepIndex = i;
    if (o.stepIndex != null) {
      const n = Number(o.stepIndex);
      if (!Number.isFinite(n) || n < 0) return null;
      stepIndex = n;
    }
    const label = o.label != null ? String(o.label).trim().slice(0, 120) : undefined;
    out.push({
      stepIndex,
      requiredReviewerRole: role,
      ...(label ? { label } : {}),
    });
  }

  out.sort((a, b) => a.stepIndex - b.stepIndex);
  for (let i = 0; i < out.length; i += 1) {
    if (out[i].stepIndex !== i) return null;
  }
  return { steps: out };
}

export function isMultiStepPublishApprovalChain(chain: PublishApprovalChain | null | undefined): boolean {
  return chain != null && chain.steps.length > 1;
}

/** 0-based index of the step currently awaiting action (explicit UTM or 0 when keys absent). */
export function clampAwaitingChainStepIndex(
  chain: PublishApprovalChain | null,
  utmCurrentStepIndex: number | null
): number {
  if (!isMultiStepPublishApprovalChain(chain)) return 0;
  const max = chain!.steps.length - 1;
  if (utmCurrentStepIndex == null || !Number.isFinite(utmCurrentStepIndex)) return 0;
  return Math.min(Math.max(0, Math.floor(utmCurrentStepIndex)), max);
}

export function requiredReviewerRoleForChainStep(
  chain: PublishApprovalChain,
  stepIndex: number
): PublishApprovalChainRequiredRole | null {
  return chain.steps[stepIndex]?.requiredReviewerRole ?? null;
}
