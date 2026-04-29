import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";

export type JarvaReadinessResult = {
  ok: boolean;
  missing: string[];
  blockers: string[];
  advisories: string[];
};

/** Soft = some structural data worth syncing; hard = full apply gate. */
export type JarvaReadinessFull = {
  hardBlockers: string[];
  softReady: boolean;
  softMissing: string[];
  suggestedApplyTiming: "now" | "soon" | "after_core_fields" | "not_ready";
  narrative: string;
};

/** Bridge for apply / auto-apply UI — does not bypass Smart Trust export or counsel gates. */
export type JarvaApplyReadiness = {
  canApply: boolean;
  missing: string[];
  blockers: string[];
  completenessPercent: number;
  /** Structural intake ready; platform may still require counsel/trustee approval for issuance. */
  autoApplyAllowed: boolean;
  /** Some data captured — partial merge may be possible with `force` (use sparingly). */
  softReady: boolean;
  suggestedApplyTiming: JarvaReadinessFull["suggestedApplyTiming"];
};

/** Completeness 0–100 for consultant progress (core parties + state + intent signals). */
export function computeJarvaIntakeCompletenessPercent(intake: Partial<JarvaTrustIntake>): number {
  let n = 0;
  const total = 5;
  if (intake.grantor?.name?.trim()) n++;
  if (intake.trustee?.name?.trim()) n++;
  if (intake.governingState?.trim()) n++;
  if (intake.objectives?.trim()) n++;
  if (intake.trustName?.trim() || intake.matterLabel?.trim()) n++;
  return Math.round((n / total) * 100);
}

export function buildJarvaApplyReadiness(intake: JarvaTrustIntake): JarvaApplyReadiness {
  const r = evaluateJarvaIntakeReadiness(intake);
  const full = evaluateJarvaReadinessFull(intake);
  const completenessPercent = computeJarvaIntakeCompletenessPercent(intake);
  return {
    canApply: r.ok,
    missing: r.missing,
    blockers: r.blockers,
    completenessPercent,
    /** Same as structural readiness; never bypasses authority/counsel/trustee workflows. */
    autoApplyAllowed: r.ok,
    softReady: full.softReady,
    suggestedApplyTiming: full.suggestedApplyTiming,
  };
}

/**
 * MVP readiness: required fields before applying intake to workspace.
 * Does not replace Smart Trust provision engine or export gates.
 */
export function evaluateJarvaIntakeReadiness(intake: JarvaTrustIntake): JarvaReadinessResult {
  const missing: string[] = [];
  const blockers: string[] = [];
  const advisories: string[] = [];

  const g = intake.grantor;
  const t = intake.trustee;

  if (!g?.name?.trim()) missing.push("Grantor name");
  if (!t?.name?.trim()) missing.push("Trustee name");
  if (!intake.governingState?.trim()) missing.push("Governing / situs state");

  if (!intake.objectives?.trim()) advisories.push("Objectives are empty — consider adding client goals for drafting context.");

  if (intake.securitiesIntentNotes?.trim()) {
    advisories.push(
      "Securities / capital-raising notes were captured. Issuance remains subject to existing counsel approval, trustee approval, and platform controls."
    );
  }

  if (intake.spiritualOrEcclesiasticalNotes?.trim()) {
    advisories.push("Spiritual/ecclesiastical notes captured — verify against current ecclesiastical draft and governance package in Smart Trust.");
  }

  const ok = missing.length === 0;
  if (!ok) blockers.push(...missing.map((m) => `Incomplete: ${m}`));

  return { ok, missing, blockers, advisories };
}

export function evaluateJarvaReadinessFull(intake: JarvaTrustIntake): JarvaReadinessFull {
  const hard = evaluateJarvaIntakeReadiness(intake);
  const softMissing: string[] = [];
  if (!intake.grantor?.name?.trim()) softMissing.push("Grantor name");
  if (!intake.trustee?.name?.trim()) softMissing.push("Trustee name");
  if (!intake.governingState?.trim()) softMissing.push("Governing / situs state");

  const filledCore = [intake.grantor?.name, intake.trustee?.name, intake.governingState].filter((x) => String(x ?? "").trim()).length;
  const softReady = filledCore >= 1 || Boolean(intake.objectives?.trim()) || Boolean(intake.matterLabel?.trim() || intake.trustName?.trim());

  let suggestedApplyTiming: JarvaReadinessFull["suggestedApplyTiming"] = "not_ready";
  if (hard.ok) {
    suggestedApplyTiming = "now";
  } else if (filledCore >= 2) {
    suggestedApplyTiming = "soon";
  } else if (filledCore >= 1) {
    suggestedApplyTiming = "after_core_fields";
  }

  let narrative = "";
  if (hard.ok) {
    narrative = "Core intake fields are present — safe to apply workspace drafts (DRAFT; counsel review still required).";
  } else if (suggestedApplyTiming === "soon") {
    narrative = "Add remaining core fields before apply, or use partial data only with counsel awareness.";
  } else if (softReady) {
    narrative = "Partial intake — continue collecting grantor, trustee, and situs state.";
  } else {
    narrative = "Intake is sparse — use labeled chat lines or the intake form to add parties and jurisdiction.";
  }

  return {
    hardBlockers: hard.missing.map((m) => `Incomplete: ${m}`),
    softReady,
    softMissing,
    suggestedApplyTiming,
    narrative,
  };
}
