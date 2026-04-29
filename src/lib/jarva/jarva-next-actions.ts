import type { JarvaTrustIntake } from "@/lib/jarva/trust-intake-schema";
import { evaluateJarvaIntakeReadiness, evaluateJarvaReadinessFull } from "@/lib/jarva/jarva-readiness";
import type { JarvaProceduralStep } from "@/lib/jarva/jarva-procedural-engine";
import type { JarvaWorkflowPath } from "@/lib/jarva/jarva-workflow-path";

export type JarvaQuestionCategory = "hard_blocker" | "apply_required" | "packet_quality";

export type JarvaNextQuestionItem = {
  question: string;
  category: JarvaQuestionCategory;
  /** Lower sorts first (1 = ask first). */
  priority: number;
};

export type JarvaNextActions = {
  /** Backward-compatible flat list (priority order). */
  nextQuestions: string[];
  nextQuestionItems: JarvaNextQuestionItem[];
  suggestions: string[];
  warnings: string[];
};

export type BuildJarvaNextActionsOptions = {
  /** Specialist lane after entry classification — adds path-specific questions (priorities 7–8). */
  workflowPath?: JarvaWorkflowPath | null;
};

const DRAFT = "Outputs stay **DRAFT** for counsel review — not legal advice.";

/**
 * Path-specific next questions (priorities 7–8 = after structural 1–3, before generic apply tier 10+).
 * Exported for tests.
 */
export function buildPathSpecificJarvaQuestionItems(
  path: JarvaWorkflowPath,
  _intake: JarvaTrustIntake
): JarvaNextQuestionItem[] {
  switch (path) {
    case "trust_revocable":
      return [
        {
          question: `Revocable trust path: confirm **grantor**, **trustee**, **successor trustees**, and **beneficiaries** are being captured; note **pour-over will** coordination as routing-only. ${DRAFT}`,
          category: "apply_required",
          priority: 7,
        },
      ];
    case "trust_irrevocable":
      return [
        {
          question: `Irrevocable trust path: capture **funding intent** and transfer/control considerations as **DRAFT** workpapers (not titling or tax advice). ${DRAFT}`,
          category: "apply_required",
          priority: 7,
        },
        {
          question:
            "Irrevocable path: confirm **beneficiaries** and distribution intent at a high level for draft alignment.",
          category: "apply_required",
          priority: 8,
        },
      ];
    case "trust_ecclesiastical":
      return [
        {
          question: `Ecclesiastical path: capture **religious purpose**, affiliation/structure, and trustee/custodian roles for **\`/ecclesiastical\`** wizard alignment. ${DRAFT}`,
          category: "apply_required",
          priority: 7,
        },
      ];
    case "trust_ppm":
      return [
        {
          question: `PPM / private-placement path: confirm **trust/workspace** context and **issuer / offering** intent as **DRAFT** materials only — counsel and approvals still gate issuance. ${DRAFT}`,
          category: "apply_required",
          priority: 7,
        },
      ];
    case "trust_bond":
      return [
        {
          question: `Bond / indenture path: confirm **obligor/trust authority**, indenture purpose, and whether a **PPM reference** is expected before Trust Records bond workflow steps. ${DRAFT}`,
          category: "apply_required",
          priority: 7,
        },
      ];
    case "trust_certificate":
      return [
        {
          question: `Certificate path: verify workspace readiness (parties/assets) before **Trust Records → Issue / Certificates**; Jarva does not issue certificates automatically. ${DRAFT}`,
          category: "apply_required",
          priority: 7,
        },
      ];
    case "trust_estate":
      return [
        {
          question: `Estate / will path: capture **testamentary intent** and executor-style facts as **DRAFT** notes; use Trust Records **Estate** when applicable. ${DRAFT}`,
          category: "apply_required",
          priority: 7,
        },
      ];
    default:
      return [];
  }
}

function pathLeadSuggestion(path: JarvaWorkflowPath): string {
  switch (path) {
    case "trust_revocable":
      return "Path: **Revocable** — prioritize successor trustees and pour-over coordination in intake (DRAFT).";
    case "trust_irrevocable":
      return "Path: **Irrevocable** — prioritize funding intent and beneficiary/distribution notes (DRAFT).";
    case "trust_ecclesiastical":
      return "Path: **Ecclesiastical** — align chat intake with `/ecclesiastical` wizard fields (DRAFT).";
    case "trust_ppm":
      return "Path: **PPM / securities** — keep offering materials as DRAFT workpapers; approvals gate issuance.";
    case "trust_bond":
      return "Path: **Bonds** — confirm PPM/indents prerequisites in Trust Records before issuance steps.";
    case "trust_certificate":
      return "Path: **Certificates** — use Trust Records Issue / Certificates when the workspace is ready.";
    case "trust_estate":
      return "Path: **Estate** — use Trust Records Estate / will flows for testamentary drafts (DRAFT).";
    default:
      return "";
  }
}

/**
 * Drive trust-build completion: questions, platform suggestions, compliance warnings.
 * Questions are ordered: structural blockers → apply completeness → packet quality.
 */
function buildJarvaNextActionsBase(intake: JarvaTrustIntake): JarvaNextActions {
  const readiness = evaluateJarvaIntakeReadiness(intake);
  const full = evaluateJarvaReadinessFull(intake);

  const items: JarvaNextQuestionItem[] = [];

  const push = (q: string, category: JarvaQuestionCategory, priority: number) => {
    items.push({ question: q, category, priority });
  };

  // Tier 1 — hard blockers (structural apply gate)
  if (!intake.grantor?.name?.trim()) {
    push("What is the grantor / settlor’s full legal name?", "hard_blocker", 1);
  }
  if (!intake.trustee?.name?.trim()) {
    push("Who will serve as initial trustee (name and whether individual or entity)?", "hard_blocker", 2);
  }
  if (!intake.governingState?.trim()) {
    push("What governing / situs state should apply (2-letter code)?", "hard_blocker", 3);
  }

  // Tier 2 — required for a coherent apply / workspace sync (same structural set if any still soft-missing)
  if (!intake.objectives?.trim()) {
    push(
      "What are the client’s primary objectives (probate avoidance, succession, tax planning, etc.)?",
      "apply_required",
      10
    );
  }
  if (!intake.trustName?.trim() && !intake.matterLabel?.trim()) {
    push("What matter label or working trust name should appear on drafts?", "apply_required", 11);
  }
  if (!intake.beneficiariesSummary?.trim()) {
    push(
      "Who are the beneficiaries (names or classes), and are there percentages, conditions, or staged distributions?",
      "apply_required",
      12
    );
  }
  if (!intake.successorTrusteeNote?.trim()) {
    push(
      "Who are successor or backup trustees, and in what order should they succeed?",
      "apply_required",
      13
    );
  }

  // Tier 3 — packet / counsel workflow quality
  if (intake.pourOverWillNeeded !== true && intake.pourOverWillNeeded !== false) {
    push(
      "Is a pour-over will expected to coordinate with this trust (yes/no — for routing only)?",
      "packet_quality",
      20
    );
  }
  if (!intake.jurisdictionAmbiguityNote?.trim() && /\b(FL|NY|TX|CA)\b.*\b(FL|NY|TX|CA)\b/.test(intake.objectives ?? "")) {
    push(
      "Multiple states appear in the notes — which is governing situs vs domicile, and should we flag ambiguity?",
      "packet_quality",
      21
    );
  }
  if (!intake.assetScheduleNotesDraft?.trim()) {
    push(
      "Are there specific assets or schedule items to track as draft notes (without treating chat as titling authority)?",
      "packet_quality",
      22
    );
  }
  if (!intake.firm?.name?.trim() && !intake.firm?.email?.trim()) {
    push("Should the consultant firm header (name / email) appear on internal drafts?", "packet_quality", 23);
  }

  items.sort((a, b) => a.priority - b.priority || a.question.localeCompare(b.question));

  const suggestions: string[] = [];
  const warnings: string[] = [];

  if (full.suggestedApplyTiming === "now") {
    suggestions.push("Structural intake is complete — consider **Apply via Jarva** to sync Smart Trust and Trust Records drafts (still DRAFT for review).");
  } else if (full.suggestedApplyTiming === "soon") {
    suggestions.push("You’re close — add the remaining core fields, then apply to sync workspace drafts.");
  } else {
    suggestions.push("Complete grantor, trustee, and governing state before applying; use labeled lines in chat for best extraction.");
  }

  suggestions.push("Open **Trust Records → Build with Jarva** to review mapped fields and lineage.");
  suggestions.push("Use **Smart Trust** to refine parties, assets, and provisions after apply.");

  if (intake.securitiesIntentNotes?.trim()) {
    warnings.push("Securities / capital notes present — issuance requires counsel and trustee approvals; Jarva does not authorize offerings.");
  }
  if (intake.spiritualOrEcclesiasticalNotes?.trim()) {
    warnings.push("Ecclesiastical / spiritual notes present — reconcile with governance package and counsel.");
  }
  for (const a of readiness.advisories) {
    warnings.push(a);
  }

  if (!readiness.ok && full.softReady) {
    warnings.push("Partial data captured — full apply is blocked until core fields are complete (or use force apply only with counsel awareness).");
  }

  const nextQuestions = items.slice(0, 8).map((i) => i.question);

  return {
    nextQuestions,
    nextQuestionItems: items.slice(0, 12),
    suggestions: suggestions.slice(0, 6),
    warnings: [...new Set(warnings)].slice(0, 8),
  };
}

export function buildJarvaNextActions(intake: JarvaTrustIntake, options?: BuildJarvaNextActionsOptions): JarvaNextActions {
  const base = buildJarvaNextActionsBase(intake);
  const path = options?.workflowPath ?? null;
  if (!path) return base;

  const extras = buildPathSpecificJarvaQuestionItems(path, intake);
  const mergedItems = [...extras, ...base.nextQuestionItems];
  mergedItems.sort((a, b) => a.priority - b.priority || a.question.localeCompare(b.question));

  const lead = pathLeadSuggestion(path);
  const suggestions = [...(lead ? [lead] : []), ...base.suggestions].slice(0, 6);

  const nextQuestions = mergedItems.slice(0, 8).map((i) => i.question);

  return {
    ...base,
    nextQuestions,
    nextQuestionItems: mergedItems.slice(0, 12),
    suggestions,
  };
}

function itemAllowedForProceduralStep(
  step: JarvaProceduralStep,
  item: JarvaNextQuestionItem,
  intake?: JarvaTrustIntake
): boolean {
  const p = item.priority;
  switch (step) {
    case "front_door":
    case "trust_type_choice":
    case "specialty_guidance":
      return false;
    case "review":
      return true;
    case "workspace":
    case "client":
      return false;
    case "parties":
      return [1, 2, 12, 13, 7, 8].includes(p);
    case "assets":
      return (
        [7, 8].includes(p) ||
        p === 22 ||
        /\basset|schedule|schedule items|res\b/i.test(item.question)
      );
    case "provisions": {
      if ([3, 7, 8, 10, 11, 20, 21, 23].includes(p)) return true;
      if (!intake?.grantor?.name?.trim() && p === 1) return true;
      if (!intake?.trustee?.name?.trim() && p === 2) return true;
      if (!intake?.governingState?.trim() && p === 3) return true;
      if (!intake?.beneficiariesSummary?.trim() && p === 12) return true;
      if (!intake?.successorTrusteeNote?.trim() && p === 13) return true;
      return false;
    }
    case "certificate":
      return false;
    default:
      return true;
  }
}

function specialtyGuidancePathQuestions(path: JarvaWorkflowPath): JarvaNextQuestionItem[] {
  switch (path) {
    case "trust_ppm":
      return [
        {
          question:
            "PPM / private placement: do you have a **Trust workspace** and **Client** bound so DRAFT offering materials can attach to a trust id (still not an authorization to issue)?",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "trust_bond":
      return [
        {
          question:
            "Bonds / indenture: confirm **Trust workspace** context and whether a **PPM reference** is expected before bond workflow steps in Trust Records.",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "trust_certificate":
      return [
        {
          question:
            "Certificates: plan to use Trust Records → **Issue** / **Certificates** and **Settings** (prefix/seal) — Jarva does not issue certificates automatically.",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "trust_estate":
      return [
        {
          question:
            "Estate / will: will you use Trust Records **Estate** paths for testamentary drafts (DRAFT for counsel review)?",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    default:
      return [
        {
          question:
            "Do you already have a Trust workspace open? If not, create one in Trust Records or Smart Trust so drafts can attach to a trust id.",
          category: "hard_blocker",
          priority: 1,
        },
      ];
  }
}

/** Procedural-only questions when the intake builder has nothing to offer for this step. */
export function buildProceduralFallbackQuestionItems(
  step: JarvaProceduralStep,
  workflowPath?: JarvaWorkflowPath | null
): JarvaNextQuestionItem[] {
  switch (step) {
    case "front_door":
      return [
        {
          question:
            "What are you working on today — a new trust (which type), certificates, PPM / securities, bonds, or estate instruments?",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "trust_type_choice":
      return [
        {
          question: "Which applies — **Revocable**, **Irrevocable**, or **Ecclesiastical** trust — so I can align Smart Trust / Trust Records vs `/ecclesiastical`?",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "specialty_guidance":
      return workflowPath ? specialtyGuidancePathQuestions(workflowPath) : [
        {
          question:
            "Do you already have a Trust workspace open? If not, create one in Trust Records or Smart Trust so drafts can attach to a trust id.",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "workspace":
      return [
        {
          question:
            "Do you already have a Trust workspace open? If not, create one from Smart Trust (Create Trust Workspace) or Trust Records so Jarva can persist intake to a trust id.",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "client":
      return [
        {
          question:
            "What is the client’s full legal name, and have you created or bound a Client record (Client ID) for this matter in the platform?",
          category: "hard_blocker",
          priority: 1,
        },
      ];
    case "certificate":
      return [
        {
          question:
            "When issuance is appropriate, use Trust Records → Settings (certificate prefix / seal) and Issue → Certificates to document units or beneficial interests. Do you need a walkthrough of that screen?",
          category: "packet_quality",
          priority: 30,
        },
      ];
    default:
      return [];
  }
}

/**
 * Restrict `buildJarvaNextActions` output to the current procedural step so Jarva asks
 * one stage at a time. Falls back to `buildProceduralFallbackQuestionItems` when
 * workspace/client/certificate would otherwise yield no questions.
 */
export function filterJarvaNextActionsForProceduralStep(
  step: JarvaProceduralStep,
  base: JarvaNextActions,
  intake?: JarvaTrustIntake,
  workflowPath?: JarvaWorkflowPath | null
): JarvaNextActions {
  const filteredItems = base.nextQuestionItems.filter((item) => itemAllowedForProceduralStep(step, item, intake));
  let items: JarvaNextQuestionItem[] = filteredItems;

  if (
    items.length === 0 &&
    (step === "front_door" ||
      step === "trust_type_choice" ||
      step === "specialty_guidance" ||
      step === "workspace" ||
      step === "client" ||
      step === "certificate")
  ) {
    items = buildProceduralFallbackQuestionItems(step, workflowPath);
  }

  if (items.length === 0 && step === "assets") {
    items = [
      {
        question:
          "What property will fund this trust (describe each asset class, approximate value, and titling notes)?",
        category: "apply_required",
        priority: 15,
      },
    ];
  }

  items.sort((a, b) => a.priority - b.priority || a.question.localeCompare(b.question));

  const nextQuestions = items.slice(0, 8).map((i) => i.question);

  let suggestions = [...base.suggestions];
  if (step === "front_door" || step === "trust_type_choice" || step === "specialty_guidance") {
    suggestions = [
      "Use **Trust Records** and **Smart Trust** for standard trusts; **Ecclesiastical Trust** at `/ecclesiastical` for ecclesiastical structures.",
      "All Jarva outputs are **DRAFT** for counsel review — not legal advice.",
      ...suggestions.filter((s) => /trust records|smart trust|ecclesiastical/i.test(s)),
    ].slice(0, 6);
  } else if (step === "workspace") {
    suggestions = [
      "Create or open a Trust workspace before chat intake can sync to the platform.",
      ...suggestions.filter((s) => /trust records|smart trust/i.test(s)),
    ].slice(0, 6);
  } else if (step === "client") {
    suggestions = [
      "Use **Create Client** or **Clients → New** to bind a Client ID, then link it in Smart Trust / Ecclesiastical platform binding.",
      ...suggestions,
    ].slice(0, 6);
  } else if (step === "certificate") {
    suggestions = [
      "Trust Records → Certificates / Issue for issuance and registry; Settings for prefix and seal.",
      ...suggestions.filter((s) => /trust records|apply/i.test(s)),
    ].slice(0, 6);
  } else if (step === "review") {
    suggestions = [
      "Run a final review packet export and counsel sign-off before client delivery.",
      ...suggestions,
    ].slice(0, 6);
  }

  let warnings = [...base.warnings];
  if (step === "workspace" || step === "client") {
    warnings = warnings.filter((w) => /securities|ecclesiastical|partial/i.test(w));
  }

  return {
    nextQuestions,
    nextQuestionItems: items.slice(0, 12),
    suggestions,
    warnings: [...new Set(warnings)].slice(0, 8),
  };
}
