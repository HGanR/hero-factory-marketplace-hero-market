/**
 * Pure stale detection: saved cycle vs current plan / readiness / signals / intake.
 */

import type { RevenueOsLaunchCycleProgress } from "@/lib/revenue-os/launch-progress-types";
import { systemSignalsMaterialKey } from "@/lib/revenue-os/bentley-system-signal-diagnostics";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import type { RevenueOsLaunchSharedProfile } from "@/lib/revenue-os/launch-mode-types";

function norm(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export function diffLaunchProgressAgainstCurrent(args: {
  cycle: RevenueOsLaunchCycleProgress;
  currentPlanSummary: string;
  currentReadiness: { isReady: boolean; blockerCount: number };
  systemSignals: RevenueOsSystemSignals;
  sharedProfile: RevenueOsLaunchSharedProfile;
}): { hasMeaningfulChange: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const { cycle, currentPlanSummary, currentReadiness, systemSignals, sharedProfile } = args;

  const a = norm(cycle.launchPlanSummary);
  const b = norm(currentPlanSummary);
  if (a && b && a !== b) {
    reasons.push("Launch plan summary changed since this cycle was started — refresh recommended.");
  }

  const bc = cycle.readinessAtCreation.blockerCount;
  const nowC = currentReadiness.blockerCount;
  if (Math.abs(nowC - bc) >= 2) {
    reasons.push("Readiness blockers moved materially — your environment may have shifted.");
  }

  if (cycle.readinessAtCreation.isReady !== currentReadiness.isReady) {
    reasons.push("Launch-ready status flipped since cycle creation.");
  }

  const sigNow = systemSignalsMaterialKey(systemSignals);
  if (cycle.trackingSnapshot?.signalMaterialKey && cycle.trackingSnapshot.signalMaterialKey !== sigNow) {
    reasons.push("Five-system scores changed since this cycle was captured.");
  }

  const offerNow = norm(sharedProfile.coreOffer).slice(0, 240);
  const audNow = norm(sharedProfile.targetAudience).slice(0, 240);
  if (cycle.trackingSnapshot?.coreOfferNorm && offerNow && cycle.trackingSnapshot.coreOfferNorm !== offerNow) {
    reasons.push("Core offer text changed — campaign messaging may be out of sync with this cycle.");
  }
  if (cycle.trackingSnapshot?.audienceNorm && audNow && cycle.trackingSnapshot.audienceNorm !== audNow) {
    reasons.push("Target audience changed — revisit positioning for this cycle.");
  }

  return {
    hasMeaningfulChange: reasons.length > 0,
    reasons,
  };
}
