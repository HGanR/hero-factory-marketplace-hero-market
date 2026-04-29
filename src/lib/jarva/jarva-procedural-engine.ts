import type { JarvaEntryRoute } from "@/lib/jarva/jarva-entry-router";
import {
  JARVA_PATH_FOCUS_INSTRUCTIONS,
  type JarvaWorkflowPath,
} from "@/lib/jarva/jarva-workflow-path";

/**
 * Procedural intake state for Jarva (trust-advisor): maps platform context to a single
 * "current step" so NPC guidance can align with a trust-specialist workflow.
 * Heuristic — does not replace counsel or Smart Trust export gates.
 */

/** Includes front-door routing (greeting / trust type / specialty) before workspace-bound steps. */
export const JARVA_PROCEDURAL_TOTAL_STEPS = 10;

export type JarvaProceduralStep =
  | "front_door"
  | "trust_type_choice"
  | "specialty_guidance"
  | "workspace"
  | "client"
  | "parties"
  | "assets"
  | "provisions"
  | "certificate"
  | "review";

/** Same booleans as GET /api/trusts/[id]/workspace/summary → checklist */
export type TrustWorkspaceChecklist = {
  partiesAndRoles?: boolean;
  beneficiaries?: boolean;
  assetsAndFundingPlan?: boolean;
};

export type JarvaProceduralInput = {
  trustId?: string | null;
  clientId?: string | null;
  workspaceCounts?: { parties?: number; beneficiaries?: number; assets?: number };
  /** UI-reported progress (e.g. Smart Trust wizard), 0–100 */
  completionPct?: number | null;
  /** From merged Jarva intake after chat extraction, 0–100 */
  jarvaIntakeCompletenessPct?: number | null;
  /** True when core structural intake passes evaluateJarvaIntakeReadiness */
  jarvaIntakeCoreComplete?: boolean;
  /**
   * Trust Records workspace checklist (from summary API or client context).
   * When present, certificate/review require these rows before late milestones (unless only empty object).
   */
  workspaceChecklist?: TrustWorkspaceChecklist | null;
  /** From evaluateJarvaReadinessFull — blocks late steps when non-empty */
  jarvaHardBlockers?: string[] | null;
  /** From buildJarvaApplyReadiness.blockers — blocks late steps when non-empty */
  jarvaApplyBlockers?: string[] | null;
  /**
   * From GET workspace summary `workProduct.issuedAssetCertificateCount` (workflow_asset_certificates rows).
   * When set, certificate/review milestones use real issuance state instead of completeness thresholds alone.
   */
  issuedAssetCertificateCount?: number | null;
  /** From workspace summary — securities module certificate rows (any status). */
  securitiesCertificatesIssuedCount?: number | null;
  /** Securities module certificates with status issued (progress signal). */
  securitiesCertificatesIssuedActiveCount?: number | null;
  /** Securities offerings rows for this trust (any status). */
  securityOfferingCount?: number | null;
  /** Offerings with status draft. */
  securityOfferingDraftCount?: number | null;
  /** Offerings with status finalized. */
  securityOfferingFinalizedCount?: number | null;
  /** trust_debt_instruments rows for this trust. */
  bondInstrumentCount?: number | null;
  /** Bonds in draft … offering_configured (pre-issued pipeline). */
  bondPreIssuanceCount?: number | null;
  /** Bonds with status issued. */
  bondIssuedCount?: number | null;
  /** Offerings with status cancelled / error (Issue Security). */
  securityOfferingCancelledCount?: number | null;
  securityOfferingErrorCount?: number | null;
  /** Securities certificates voided or replaced. */
  securitiesCertificatesVoidedOrReplacedCount?: number | null;
  /** Bonds with status closed (post-issuance). */
  bondClosedCount?: number | null;
  /** Bonds with status voided. */
  bondVoidedCount?: number | null;
  /** Derived flags from workspace summary workProduct (optional). */
  hasDraftOffering?: boolean | null;
  hasFinalizedOffering?: boolean | null;
  hasIssuedSecuritiesCertificate?: boolean | null;
  hasIssuedWorkflowAssetCertificate?: boolean | null;
  hasActiveBondWorkflow?: boolean | null;
  hasIssuedBond?: boolean | null;
  /** Front-door intake router (deterministic); when absent, unbound-trust flow defaults to workspace step. */
  jarvaEntryRoute?: JarvaEntryRoute | null;
  /** Resolved specialist lane after classification (`trust_general` / `unknown` → null). */
  jarvaWorkflowPath?: JarvaWorkflowPath | null;
  /** Count of user messages already in the session before this turn (excludes current message). */
  priorSessionUserMessageCount?: number;
};

export type JarvaProceduralEvaluation = {
  step: JarvaProceduralStep;
  /** 1-based index within the linear checklist */
  stepIndex: number;
  totalSteps: number;
  title: string;
  instructions: string[];
  blockers: string[];
};

function clampPct(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Granular label when offerings exist but none are draft/finalized (cancelled + error rows only). */
function inactiveSecurityOfferingLabel(input: JarvaProceduralInput): "cancelled" | "in error" | "cancelled or in error" {
  const c = input.securityOfferingCancelledCount ?? 0;
  const e = input.securityOfferingErrorCount ?? 0;
  if (c > 0 && e === 0) return "cancelled";
  if (e > 0 && c === 0) return "in error";
  return "cancelled or in error";
}

/** Trust Records workflow certs + securities module issued-status certificates (Issue Security). */
function totalIssuedCertificateLikeCount(input: JarvaProceduralInput): { total: number; known: boolean } {
  const a = input.issuedAssetCertificateCount;
  const b =
    input.securitiesCertificatesIssuedActiveCount ?? input.securitiesCertificatesIssuedCount;
  if (a == null && b == null) return { total: 0, known: false };
  return { total: (a ?? 0) + (b ?? 0), known: true };
}

/**
 * Trust-workflow signals that should gate certificate/review beyond raw intake completeness.
 * When no checklist / no beneficiary count / no blocker arrays are supplied, behavior falls back to thresholds only.
 */
export function lateStepStructuralBlockers(input: JarvaProceduralInput): string[] {
  const blockers: string[] = [];
  const cl = input.workspaceChecklist;
  if (cl && typeof cl === "object") {
    const hasAnySignal =
      cl.partiesAndRoles !== undefined || cl.beneficiaries !== undefined || cl.assetsAndFundingPlan !== undefined;
    if (hasAnySignal) {
      if (cl.partiesAndRoles === false) {
        blockers.push(
          "Trust Records workspace checklist: grantor and trustee roles are not complete — finish parties in Settings / Parties before issuance-oriented milestones."
        );
      }
      if (cl.beneficiaries === false) {
        blockers.push(
          "Workspace checklist shows no beneficiaries — add beneficiaries in Trust Records or Smart Trust before certificate/review milestones."
        );
      }
      if (cl.assetsAndFundingPlan === false) {
        blockers.push(
          "Assets / funding plan is not reflected in the workspace checklist — add assets or funding entries before late milestones."
        );
      }
    }
  }

  const ben = input.workspaceCounts?.beneficiaries;
  if (ben !== undefined && ben < 1) {
    blockers.push(
      "Workspace summary shows zero beneficiaries — add at least one beneficiary before certificate/review milestones."
    );
  }

  const hb = input.jarvaHardBlockers;
  if (Array.isArray(hb) && hb.length > 0) {
    for (const b of hb) {
      if (b && blockers.length < 12) blockers.push(b);
    }
  }
  const ab = input.jarvaApplyBlockers;
  if (Array.isArray(ab) && ab.length > 0) {
    for (const b of ab) {
      if (b && blockers.length < 12) blockers.push(b);
    }
  }

  return blockers;
}

function augmentJarvaProceduralEvaluationWithWorkflowPath(
  evaluation: JarvaProceduralEvaluation,
  path: JarvaWorkflowPath | null | undefined
): JarvaProceduralEvaluation {
  if (!path) return evaluation;
  const extra = JARVA_PATH_FOCUS_INSTRUCTIONS[path];
  if (!extra?.length) return evaluation;
  return { ...evaluation, instructions: [...evaluation.instructions, ...extra] };
}

/** Prepends DB-backed execution cues (progress-aware, not existence-only). */
function augmentJarvaProceduralEvaluationWithExecutionWorkProduct(
  evaluation: JarvaProceduralEvaluation,
  input: JarvaProceduralInput
): JarvaProceduralEvaluation {
  const path = input.jarvaWorkflowPath;
  if (!path) return evaluation;

  const lines: string[] = [];
  const offerings = input.securityOfferingCount;
  const draftC = input.securityOfferingDraftCount;
  const finalized = input.securityOfferingFinalizedCount;
  const bonds = input.bondInstrumentCount;
  const secActive = input.securitiesCertificatesIssuedActiveCount ?? input.securitiesCertificatesIssuedCount;
  const bondPre = input.bondPreIssuanceCount;
  const bondIss = input.bondIssuedCount;
  const bondClosed = input.bondClosedCount ?? 0;
  const bondVoided = input.bondVoidedCount ?? 0;
  const bondSettled = (bondIss ?? 0) + bondClosed > 0 || input.hasIssuedBond === true;
  const certVoided = input.securitiesCertificatesVoidedOrReplacedCount ?? 0;

  if (path === "trust_ppm" && typeof offerings === "number" && offerings > 0) {
    const hasDraft = (draftC ?? 0) > 0 || input.hasDraftOffering === true;
    const hasFinal = (finalized ?? 0) > 0 || input.hasFinalizedOffering === true;
    const hasSecIssued = (secActive ?? 0) > 0 || input.hasIssuedSecuritiesCertificate === true;
    const onlyCancelledOrError = !hasDraft && !hasFinal;

    if (onlyCancelledOrError) {
      const label = inactiveSecurityOfferingLabel(input);
      lines.push(
        `Offering record(s) are **${label}** in workspace — reopen Issue Security to correct or start a new offering (DRAFT; not active issuance).`
      );
    } else if (hasFinal && hasSecIssued) {
      lines.push(
        "An **issued certificate** already exists; move toward **review** and completion — tighten subscription/PPM documentation with counsel (DRAFT; not legal approval)."
      );
      if (certVoided > 0) {
        lines.push(
          "Some certificate rows are **voided or replaced** — confirm the active issued line is the binding record (DRAFT)."
        );
      }
    } else if (hasFinal && !hasSecIssued) {
      lines.push(
        "The offering has been **finalized**; **proceed to certificate issuance** in Issue Security (DRAFT — counsel review)."
      );
    } else if (hasDraft && !hasFinal) {
      lines.push(
        "A **draft offering** exists; continue **structuring** before issuance (DRAFT — counsel review)."
      );
    } else if (hasDraft && hasFinal) {
      lines.push(
        "Workspace shows both **draft** and **finalized** offerings — resolve drafts or proceed to issuance for finalized packages (DRAFT)."
      );
    } else {
      lines.push(
        "Continue the **Issue Security** / package workflow — align subscription documents and counsel review (DRAFT)."
      );
    }
  }

  if (path === "trust_bond" && typeof bonds === "number" && bonds > 0) {
    const pre = (bondPre ?? 0) > 0 || input.hasActiveBondWorkflow === true;
    const unknown = input.bondPreIssuanceCount === undefined && input.bondIssuedCount === undefined;
    const voidedOnly =
      bonds > 0 &&
      bondVoided === bonds &&
      (bondPre ?? 0) === 0 &&
      (bondIss ?? 0) === 0 &&
      bondClosed === 0;

    if (voidedOnly) {
      lines.push(
        "Bond record(s) are **voided** in workspace — do **not** treat as active issuance; review status with counsel (DRAFT)."
      );
    } else if (unknown) {
      lines.push(
        `Workspace shows **${bonds} bond instrument record(s)** — align bond registry, PPM references, and Trust Records Issue flow (DRAFT).`
      );
    } else if (pre && !bondSettled) {
      lines.push(
        "**Bond issuance is underway** — continue authority, resolution, and offering steps in Trust Records (DRAFT — counsel review)."
      );
    } else if (bondSettled && !pre) {
      lines.push(
        "**Bond issuance is complete** — continue **review** and document handling; align registry and Trust Records (DRAFT — counsel review)."
      );
    } else {
      lines.push(
        "Bond instrument(s) span multiple stages — confirm registry, PPM, and debt terms with counsel (DRAFT)."
      );
    }
  }

  if (path === "trust_certificate" && typeof secActive === "number" && secActive > 0) {
    lines.push(
      "Securities module shows **issued certificate(s)** — confirm custody, legends, and Trust Records alignment (DRAFT)."
    );
    if (certVoided > 0) {
      lines.push(
        "Some certificate rows are **voided or replaced** — confirm the active issued line is authoritative (DRAFT)."
      );
    }
  }

  if (lines.length === 0) return evaluation;
  return { ...evaluation, instructions: [...lines, ...evaluation.instructions] };
}

/**
 * Derive the current procedural step from binding + workspace signals + optional Jarva intake metrics.
 */
function evaluateJarvaProceduralStepInner(input: JarvaProceduralInput): JarvaProceduralEvaluation {
  const totalSteps = JARVA_PROCEDURAL_TOTAL_STEPS;
  const trustId = (input.trustId || "").trim();
  const clientId = (input.clientId || "").trim();
  const parties = input.workspaceCounts?.parties ?? 0;
  const assets = input.workspaceCounts?.assets ?? 0;
  const jc = clampPct(input.jarvaIntakeCompletenessPct);
  const ui = clampPct(input.completionPct);
  const completeness = jc ?? ui ?? 0;
  const coreOk = Boolean(input.jarvaIntakeCoreComplete);

  if (!trustId) {
    const entry = input.jarvaEntryRoute;
    const priorN = input.priorSessionUserMessageCount ?? 0;

    if (entry) {
      if (entry.intent === "unknown" && priorN === 0) {
        return {
          step: "front_door",
          stepIndex: 1,
          totalSteps,
          title: "Welcome — intake router",
          instructions: [
            "Jarva routes you through **Trust Records**, **Smart Trust**, and **Ecclesiastical Trust** — no parallel builder.",
            "Say what you’re working on (trust type, certificate, PPM, bond, estate) and I’ll align the next steps. All outputs are **DRAFT** for counsel review.",
          ],
          blockers: ["No Trust ID in context yet — open or create a workspace when you’re ready to bind intake."],
        };
      }
      if (entry.intent === "trust_general" && entry.needsTrustTypeChoice) {
        return {
          step: "trust_type_choice",
          stepIndex: 2,
          totalSteps,
          title: "Choose trust type",
          instructions: [
            "Are you structuring a **Revocable**, **Irrevocable**, or **Ecclesiastical** trust?",
            "Revocable / Irrevocable: **Trust Records** + **Smart Trust**. Ecclesiastical: **`/ecclesiastical`** after workspace + client exist.",
          ],
          blockers: ["No Trust ID in context — create a workspace after you pick a path."],
        };
      }
      if (
        entry.intent === "trust_ppm" ||
        entry.intent === "trust_bond" ||
        entry.intent === "trust_certificate" ||
        entry.intent === "trust_estate"
      ) {
        return {
          step: "specialty_guidance",
          stepIndex: 3,
          totalSteps,
          title: "Trust Records specialty workflow",
          instructions: [
            "Use the existing **Trust Records** tabs (Issue, Certificates, Bonds, Estate, securities) — I’m not inventing a parallel flow.",
            "Still create a **Trust workspace** and bind a **Client** so intake and drafts can sync when you apply.",
          ],
          blockers: ["No Trust ID in context — open or create a workspace to attach drafts."],
        };
      }
    }

    return {
      step: "workspace",
      stepIndex: 4,
      totalSteps,
      title: "Create or open a trust workspace",
      instructions: [
        "Create a Trust workspace from Smart Trust Home (**Create Trust Workspace**) or Trust Records so Jarva can persist intake and drafts to a real trust id.",
        "Until a workspace exists, Jarva cannot run structured intake sync to the platform.",
      ],
      blockers: ["No Trust ID in context — open or create a workspace first."],
    };
  }

  if (!clientId) {
    return {
      step: "client",
      stepIndex: 5,
      totalSteps,
      title: "Link a Client record",
      instructions: [
        "Bind a canonical **Client ID** to this matter (Smart Trust / Ecclesiastical Home → platform binding, or **Create Client Record** → `/clients/new`).",
        "Jarva uses the client + trust linkage for audit trails and Trust Records alignment.",
      ],
      blockers: ["No Client ID — create or bind a client before deep intake."],
    };
  }

  if (parties < 2) {
    return {
      step: "parties",
      stepIndex: 6,
      totalSteps,
      title: "Parties — grantor, trustee, beneficiaries",
      instructions: [
        "Capture **grantor/settlor** and **trustee** (and key beneficiaries where applicable) in Trust Records Settings or Smart Trust / Ecclesiastical wizard parties.",
        "Aim for at least two party rows reflected in workspace counts so downstream drafts stay consistent.",
      ],
      blockers:
        parties === 0
          ? ["Workspace shows no parties yet — add grantor and trustee."]
          : ["Add remaining core party rows (grantor, trustee, key roles)."],
    };
  }

  if (assets < 1) {
    return {
      step: "assets",
      stepIndex: 7,
      totalSteps,
      title: "Trust property (res)",
      instructions: [
        "Add at least one **asset** in Trust Records → Assets or the Smart Trust / Ecclesiastical funding flow so the trust has identifiable property.",
        "Titling and valuation can be refined later; capture enough to describe the corpus.",
      ],
      blockers: ["No assets in workspace summary — add funding / asset entries."],
    };
  }

  if (!coreOk || completeness < 70) {
    return {
      step: "provisions",
      stepIndex: 8,
      totalSteps,
      title: coreOk ? "Refine intake & provisions" : "Intake — core fields & objectives",
      instructions: coreOk
        ? [
            "Tighten remaining intake fields (beneficiaries summary, distributions, special provisions).",
            "Use **Next questions** from Jarva responses to close gaps before apply/export.",
          ]
        : [
            "Continue Jarva chat intake: **grantor name**, **trustee name**, **governing/situs state**, and **objectives / trust name**.",
            "When core fields are complete, Jarva can merge intake into the Smart Trust draft and Trust Records (drafts for review).",
          ],
      blockers: coreOk ? [] : ["Core Jarva intake fields not yet complete — keep answering structured questions in chat."],
    };
  }

  const lateStructural = lateStepStructuralBlockers(input);
  if (lateStructural.length > 0) {
    return {
      step: "provisions",
      stepIndex: 8,
      totalSteps,
      title: "Workspace readiness before certificate / review",
      instructions: [
        "Close the **Trust Records workspace checklist** items (parties, beneficiaries, assets) and resolve any apply/readiness blockers shown below.",
        "Jarva keeps you on provisions until the workspace reflects the five core trust elements in platform state, not chat completeness alone.",
      ],
      blockers: lateStructural.slice(0, 6),
    };
  }

  const path = input.jarvaWorkflowPath;
  const ppmOfferings = input.securityOfferingCount;
  const ppmFinalized = input.securityOfferingFinalizedCount;
  const bondN = input.bondInstrumentCount;

  /** PPM lane — progress from security_offerings.status + security_certificates issuance. */
  if (path === "trust_ppm" && typeof ppmOfferings === "number" && ppmOfferings > 0) {
    const draftRows = (input.securityOfferingDraftCount ?? 0) > 0 || input.hasDraftOffering === true;
    const legacyLikelyDraftOnly =
      input.securityOfferingDraftCount === undefined &&
      ppmOfferings > 0 &&
      (ppmFinalized ?? 0) === 0;
    const hasDraftSignal = draftRows || legacyLikelyDraftOnly;

    const hasFinal = (ppmFinalized ?? 0) > 0 || input.hasFinalizedOffering === true;
    const hasSecIssued =
      (input.securitiesCertificatesIssuedActiveCount ?? 0) > 0 || input.hasIssuedSecuritiesCertificate === true;

    const onlyCancelledOrError = !hasDraftSignal && !hasFinal;

    if (onlyCancelledOrError) {
      const label = inactiveSecurityOfferingLabel(input);
      return {
        step: "provisions",
        stepIndex: 8,
        totalSteps,
        title: "Securities offering (inactive or errored)",
        instructions: [
          `Workspace shows offering rows that are **${label}** — they are **not active issuance**; open Issue Security to review, correct, or start a new offering (DRAFT).`,
          "Nothing here bypasses counsel review or offering gates.",
        ],
        blockers: [],
      };
    }

    if (hasFinal && hasSecIssued) {
      if (completeness < 90) {
        return {
          step: "provisions",
          stepIndex: 8,
          totalSteps,
          title: "Offering finalized — certificates issued",
          instructions: [
            "An **issued certificate** already exists; move toward **review** and completion — tighten intake, disclosures, and subscription/PPM alignment (DRAFT — counsel review).",
            "Use **Next questions** to close gaps that affect subscription or PPM documentation.",
          ],
          blockers: [],
        };
      }
      return {
        step: "review",
        stepIndex: 10,
        totalSteps,
        title: "Review packet & export",
        instructions: [
          "The offering is **finalized** and certificates are **issued** — run counsel review on subscription documents and disclosures before any client-facing deliverable (DRAFT).",
          "Confirm Issue Security outputs and Trust Records match the intended offering structure.",
        ],
        blockers: [],
      };
    }

    if (hasFinal && !hasSecIssued) {
      if (completeness < 90) {
        return {
          step: "provisions",
          stepIndex: 8,
          totalSteps,
          title: "Offering finalized — issuance next",
          instructions: [
            "The offering has been **finalized**; **proceed to certificate issuance** in Issue Security (DRAFT — counsel review).",
            "Use **Next questions** to close intake gaps that affect subscription or PPM documentation.",
          ],
          blockers: [],
        };
      }
      return {
        step: "certificate",
        stepIndex: 9,
        totalSteps,
        title: "Certificate issuance (next)",
        instructions: [
          "The offering package is **finalized** — proceed to **issue securities certificates** in Issue Security (DRAFT).",
          "Jarva does not issue certificates; the Issue Security wizard performs issuance.",
        ],
        blockers: [],
      };
    }

    if (hasDraftSignal && !hasFinal) {
      return {
        step: "provisions",
        stepIndex: 8,
        totalSteps,
        title: "Draft offering — structuring",
        instructions: [
          "A **draft offering** exists; continue **structuring** before issuance in Issue Security (DRAFT — counsel review).",
          "Finalize the package when structure and counsel are ready; then proceed to issuance.",
        ],
        blockers: [],
      };
    }

    if (hasDraftSignal && hasFinal) {
      return {
        step: "provisions",
        stepIndex: 8,
        totalSteps,
        title: "Securities offering (mixed)",
        instructions: [
          "Workspace shows both **draft** and **finalized** offerings — finalize or archive drafts, then continue issuance for finalized packages (DRAFT).",
          "Use **Next questions** where intake still affects offering narrative.",
        ],
        blockers: [],
      };
    }
  }

  /** Bond lane — progress from trust_debt_instruments.status pipeline. */
  if (path === "trust_bond" && typeof bondN === "number" && bondN > 0) {
    const preIssuance =
      (input.bondPreIssuanceCount ?? 0) > 0 || input.hasActiveBondWorkflow === true;
    const bondClosed = input.bondClosedCount ?? 0;
    const bondIssuedN = input.bondIssuedCount ?? 0;
    const bondVoidedN = input.bondVoidedCount ?? 0;
    const bondSettled = bondIssuedN + bondClosed > 0 || input.hasIssuedBond === true;
    const bondProgressUnknown =
      input.bondPreIssuanceCount === undefined && input.bondIssuedCount === undefined;

    const bondVoidedOnly =
      bondN > 0 &&
      bondVoidedN === bondN &&
      (input.bondPreIssuanceCount ?? 0) === 0 &&
      bondIssuedN === 0 &&
      bondClosed === 0;

    if (bondVoidedOnly) {
      return {
        step: "provisions",
        stepIndex: 8,
        totalSteps,
        title: "Bond instruments (voided)",
        instructions: [
          "Bond record(s) are **voided** — do **not** treat as active issuance; confirm next steps with counsel (DRAFT).",
          "Nothing here implies legal approval or final registry status.",
        ],
        blockers: [],
      };
    }

    if (bondProgressUnknown) {
      if (completeness < 90) {
        return {
          step: "provisions",
          stepIndex: 8,
          totalSteps,
          title: "Bond instruments (active)",
          instructions: [
            "Workspace shows **bond instrument record(s)** — continue bond registry alignment, PPM/debt references, and Trust Records Issue flow (DRAFT).",
            "Close remaining intake gaps with **Next questions** where they affect covenant or collateral description.",
          ],
          blockers: [],
        };
      }
      return {
        step: "review",
        stepIndex: 10,
        totalSteps,
        title: "Review packet & export",
        instructions: [
          "Bond instrument(s) exist in workspace — confirm registration, legend, and covenant language with counsel before any final deliverable (DRAFT).",
          "Align Smart Trust / Trust Records drafts with the recorded debt terms.",
        ],
        blockers: [],
      };
    }

    if (preIssuance && !bondSettled) {
      if (completeness < 90) {
        return {
          step: "provisions",
          stepIndex: 8,
          totalSteps,
          title: "Bond issuance (underway)",
          instructions: [
            "**Bond issuance is underway** — continue the authority, resolution, and offering steps in Trust Records (DRAFT — counsel review).",
            "Use **Next questions** where intake affects covenant or collateral description.",
          ],
          blockers: [],
        };
      }
      return {
        step: "review",
        stepIndex: 10,
        totalSteps,
        title: "Review packet & export",
        instructions: [
          "Pre-issuance bond work is advanced — confirm authority, resolutions, and offering configuration with counsel before closing (DRAFT).",
          "Align registry entries with Trust Records Issue flow.",
        ],
        blockers: [],
      };
    }

    if (bondSettled && !preIssuance) {
      const settledLabel =
        bondClosed > 0 && bondIssuedN === 0 ? "closed" : bondIssuedN > 0 ? "issued" : "issued or closed";
      if (completeness < 90) {
        return {
          step: "provisions",
          stepIndex: 8,
          totalSteps,
          title: "Bond issuance complete — documentation",
          instructions: [
            `**Bond issuance is complete** (status: **${settledLabel}**) — continue **review** and document handling; align Smart Trust / Trust Records drafts and registry entries (DRAFT).`,
            "Use **Next questions** to close remaining intake gaps.",
          ],
          blockers: [],
        };
      }
      return {
        step: "review",
        stepIndex: 10,
        totalSteps,
        title: "Review packet & export",
        instructions: [
          "**Bond issuance is complete** — continue **review** and document handling; confirm registration, legend, and covenant language with counsel (DRAFT).",
          "Align Smart Trust / Trust Records drafts with the recorded debt terms.",
        ],
        blockers: [],
      };
    }

    return {
      step: "provisions",
      stepIndex: 8,
      totalSteps,
      title: "Bond instruments (mixed stages)",
      instructions: [
        "Bond instrument(s) span **multiple lifecycle stages** — reconcile pre-issuance and issued/closed bonds in Trust Records (DRAFT).",
        "Confirm authority, resolutions, and registry entries with counsel.",
      ],
      blockers: [],
    };
  }

  const { total: certTotal, known: certCountKnown } = totalIssuedCertificateLikeCount(input);

  /** Real DB signal: workflow asset certs and/or securities module issued-status certificates. Skips certificate milestone. */
  if (certCountKnown && certTotal > 0) {
    const wfPart = input.issuedAssetCertificateCount ?? 0;
    const secPart =
      (input.securitiesCertificatesIssuedActiveCount ?? input.securitiesCertificatesIssuedCount) ?? 0;
    const certNarrative =
      wfPart > 0 && secPart > 0
        ? "Trust workflow **and** Issue Security show **issued certificate(s)**"
        : wfPart > 0
          ? "The workspace shows **issued trust workflow certificate(s)**"
          : "Issue Security shows **issued securities certificate(s)**";

    if (completeness < 90) {
      return {
        step: "provisions",
        stepIndex: 8,
        totalSteps,
        title: "Refine intake & provisions",
        instructions: [
          `${certNarrative} — issuance has started; continue tightening intake and draft alignment (DRAFT).`,
          "Use **Next questions** to close gaps before review packet / export (DRAFT; counsel review still required).",
        ],
        blockers: [],
      };
    }
    return {
      step: "review",
      stepIndex: 10,
      totalSteps,
      title: "Review packet & export",
      instructions: [
        "Generate the **review packet** (Jarva / platform export) and run counsel review before any client-facing final deliverable.",
        `${certNarrative} — confirm custody, legends, and Trust Records alignment before any final deliverable (DRAFT).`,
      ],
      blockers: [],
    };
  }

  /**
   * Real signal: zero certificate-like issuance while intake completeness is high — keep certificate milestone
   * instead of jumping to review on percentage alone.
   */
  if (certCountKnown && certTotal === 0 && completeness >= 90) {
    return {
      step: "certificate",
      stepIndex: 9,
      totalSteps,
      title: "Certificates & issuance (milestone)",
      instructions: [
        "Intake looks complete in chat, but **no asset certificates** are recorded yet — use Trust Records → Issue / Certificates when your workflow requires documented units or beneficial interests.",
        "Path: Trust Records → Issue / Certificates (and Settings for prefixes). Jarva does not issue certificates automatically.",
      ],
      blockers: [],
    };
  }

  if (coreOk && completeness < 90) {
    return {
      step: "certificate",
      stepIndex: 9,
      totalSteps,
      title: "Certificates & issuance (milestone)",
      instructions: [
        "When the workspace is ready, issue or manage **certificates** from Trust Records if your workflow uses cert issuance for units or beneficial interests.",
        "Path: Trust Records → Issue / Certificates (and Settings for prefixes). Jarva does not issue certificates automatically.",
      ],
      blockers: [],
    };
  }

  return {
    step: "review",
    stepIndex: 10,
    totalSteps,
    title: "Review packet & export",
    instructions: [
      "Generate the **review packet** (Jarva / platform export) and run counsel review before any client-facing final deliverable.",
      "Confirm Smart Trust and Ecclesiastical drafts match the signed plan; use Trust Records for authoritative workspace state.",
    ],
    blockers: [],
  };
}

export function evaluateJarvaProceduralStep(input: JarvaProceduralInput): JarvaProceduralEvaluation {
  const inner = evaluateJarvaProceduralStepInner(input);
  const withPath = augmentJarvaProceduralEvaluationWithWorkflowPath(inner, input.jarvaWorkflowPath);
  return augmentJarvaProceduralEvaluationWithExecutionWorkProduct(withPath, input);
}

/**
 * Short markdown banner to prepend to trust-advisor replies (context-first gating).
 */
export function formatProceduralJarvaBanner(evaluation: JarvaProceduralEvaluation): string {
  const lines = [
    `**Trust workflow — Step ${evaluation.stepIndex} of ${evaluation.totalSteps}: ${evaluation.title}**`,
    ...evaluation.instructions.map((s) => `- ${s}`),
  ];
  if (evaluation.blockers.length) {
    lines.push(`- **Gate:** ${evaluation.blockers.join(" ")}`);
  }
  lines.push(`- **Advisory:** DRAFT — not legal advice. Use draft assembly, proceed to issuance, and review assembly only in platform screens (counsel review applies).`);
  return lines.join("\n");
}

/** Flat fields for NPC/chat `ChatContext` (trust-advisor + LLM system prompt). */
export function getJarvaProceduralContextPatch(input: JarvaProceduralInput): {
  jarvaProceduralStep: JarvaProceduralStep;
  jarvaProceduralTitle: string;
  jarvaProceduralIndex: number;
  jarvaProceduralTotalSteps: number;
  jarvaProceduralBlockers: string[];
  jarvaWorkflowPath?: JarvaWorkflowPath;
} {
  const e = evaluateJarvaProceduralStep(input);
  const patch: {
    jarvaProceduralStep: JarvaProceduralStep;
    jarvaProceduralTitle: string;
    jarvaProceduralIndex: number;
    jarvaProceduralTotalSteps: number;
    jarvaProceduralBlockers: string[];
    jarvaWorkflowPath?: JarvaWorkflowPath;
  } = {
    jarvaProceduralStep: e.step,
    jarvaProceduralTitle: e.title,
    jarvaProceduralIndex: e.stepIndex,
    jarvaProceduralTotalSteps: e.totalSteps,
    jarvaProceduralBlockers: e.blockers,
  };
  if (input.jarvaWorkflowPath) {
    patch.jarvaWorkflowPath = input.jarvaWorkflowPath;
  }
  return patch;
}
