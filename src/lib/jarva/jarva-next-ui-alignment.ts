import type { JarvaNextUiAction } from "@/lib/jarva/jarva-next-ui-actions";
import { isJarvaWorkflowPath, type JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

/** Optional context for inferring Issue Security wizard step (A–F). */
export type JarvaWizardStepContext = {
  currentStep?: string | null;
  stepFocus?: string | null;
};

export const JARVA_NEXT_UI_COPY = {
  tabAlreadyAlignedLine: "Tab already matches this lane.",
  focusStepAlreadyAlignedLine: "This step is already active for this lane.",
  focusStepStripAlignedLine: "Step already matches this lane.",
  handoffLaneMatchesLine: "Handoff lane matches this workspace — continue here.",
} as const;

/**
 * Best-effort wizard letter when the user is on Issue Security (route or shell context).
 */
export function inferWizardStepLetter(pathname: string, ctx?: JarvaWizardStepContext | null): string | null {
  if (!pathname.includes("/issue-security")) return null;
  const focus = (ctx?.stepFocus ?? "").trim().toUpperCase();
  if (/^[A-F]$/.test(focus)) return focus;
  const step = (ctx?.currentStep ?? "").trim();
  const head = step.match(/^([A-F])[\s.:]/i);
  if (head) return head[1]!.toUpperCase();
  const any = step.match(/\b([A-F])\b/);
  if (any) return any[1]!.toUpperCase();
  return null;
}

export function isJarvaFocusStepAligned(action: JarvaNextUiAction, wizardStepLetter: string | null | undefined): boolean {
  if (action.kind !== "focus_step") return false;
  const w = (wizardStepLetter ?? "").trim().toUpperCase();
  if (!w || !/^[A-F]$/.test(w)) return false;
  return action.target.trim().toUpperCase() === w;
}

export function jarvaHandoffLaneMatchesBundle(searchParams: URLSearchParams, bundleLane: JarvaWorkflowPath | null): boolean {
  if (!bundleLane) return false;
  const raw = searchParams.get("jarvaLane") ?? searchParams.get("jarva_lane");
  if (!raw || !isJarvaWorkflowPath(raw)) return false;
  return raw === bundleLane;
}
