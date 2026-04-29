/**
 * Agency orchestration: conversion path + launch readiness + queue + deliverables.
 * Runs after Brand Brain so it can read `metadata.brandBrain`.
 */

import type { BrandBrainState } from "@/lib/site-builder/brand-brain-schema";
import {
  type AgencyLaunchState,
  type AgencyTask,
  AgencyLaunchStateSchema,
  type CompanionPageSuggestion,
  type DeliverableSuggestion,
  type LaunchCheck,
} from "@/lib/site-builder/agency-launch-schema";
import { analyzeConversionPath } from "@/lib/site-builder/conversion-path";
import { evaluateLaunchReadiness, suggestCompanionPages } from "@/lib/site-builder/launch-readiness-evaluate";
import { styleModeFromSiteDocument } from "@/lib/site-builder/ai/troothertz-visual-postprocess";
import type { SiteSchemaDocumentType } from "@/lib/site-builder/schema";

const BB_PRIORITY: Record<string, "high" | "medium" | "low"> = {
  cta_tone_inconsistent: "high",
  hero_cta_accent_mismatch: "medium",
  visual_accent_token_drift: "medium",
  proof_overload_mid: "low",
  narrative_weak_cta_placement: "high",
  proof_underuse_home: "medium",
  route_family_inconsistent: "low",
};

function taskFromCheck(
  code: string,
  severity: "info" | "warn",
  scope: AgencyTask["scope"],
  recommendation: string,
  label: string,
  derived: string[],
  opts?: { route?: string; sectionId?: string; linkedBrandBrainCode?: string; refineInstructionHint?: string },
): AgencyTask {
  const priority: AgencyTask["priority"] =
    severity === "warn" ? "high" : code.includes("companion") ? "medium" : "low";
  return {
    id: `agency_check_${code}`.slice(0, 120),
    type: code.startsWith("launch_brand_") || derived.includes("brand_brain") ? "site_fix" : "conversion_improvement",
    priority,
    scope,
    status: "suggested",
    recommendation,
    label,
    derivedFrom: derived,
    route: opts?.route,
    sectionId: opts?.sectionId,
    linkedBrandBrainCode: opts?.linkedBrandBrainCode,
    refineInstructionHint: opts?.refineInstructionHint,
  };
}

function buildDeliverableSuggestions(
  doc: SiteSchemaDocumentType,
  readiness: AgencyLaunchState["readiness"],
  styleMode: string,
): DeliverableSuggestion[] {
  const out: DeliverableSuggestion[] = [];
  const home = doc.pages.find((p) => p.slug === "/");
  if (!home) return out;

  if (readiness !== "launch_ready") {
    out.push({
      id: "deliv_launch_copy",
      label: "I can generate launch copy for this page aligned to your tokens.",
      contextRoute: "/",
      derivedFrom: ["launch_readiness", "deliverable"],
    });
  }

  if (home.blocks.some((b) => String(b.type) === "call_to_action" || String(b.type) === "hero")) {
    out.push({
      id: "deliv_social_teasers",
      label: "This offer story could ship with three short social teasers.",
      contextRoute: "/",
      derivedFrom: ["conversion_path", "deliverable"],
    });
  }

  if (styleMode === "bold" || styleMode === "web3") {
    out.push({
      id: "deliv_hero_variant",
      label: "I can outline a tighter hero variant for ads or paid landing tests.",
      contextRoute: "/",
      derivedFrom: ["deliverable"],
    });
  }

  if (readiness === "launch_ready" || readiness === "needs_attention") {
    out.push({
      id: "deliv_announce_channels",
      label: "This build is close enough to sketch an announcement email or SMS.",
      contextRoute: "/",
      derivedFrom: ["launch_readiness", "deliverable"],
    });
  }

  out.push({
    id: "deliv_proof_or_faq",
    label: "A proof or FAQ slice would reinforce the conversion you’re asking for.",
    contextRoute: "/",
    derivedFrom: ["conversion_path", "deliverable"],
  });

  return out.slice(0, 8);
}

function buildLaunchQueue(
  checks: LaunchCheck[],
  brandBrain: BrandBrainState | undefined,
  companions: CompanionPageSuggestion[],
  deliverables: DeliverableSuggestion[],
): AgencyTask[] {
  const tasks: AgencyTask[] = [];
  const seen = new Set<string>();

  for (const c of checks) {
    if (c.severity === "info" && tasks.length > 14) break;
    const label =
      c.code === "cta_path_weak"
        ? "Clarify the primary next step on home."
        : c.code === "headline_weak_home"
          ? "Strengthen the hero headline before launch."
          : c.code === "conversion_proof_home_weak"
            ? "Add a light trust strip on home."
            : c.code === "page_differentiation_weak"
              ? "Differentiate route roles (story vs conversion)."
              : c.code.startsWith("launch_brand_")
                ? "Align narrative and proof with Brand Brain steer."
                : "Tighten launch narrative.";

    const t = taskFromCheck(c.code, c.severity, c.scope, c.recommendation, label, ["launch_readiness", "conversion_path"], {
      route: c.route,
      sectionId: c.sectionId,
      refineInstructionHint:
        c.code === "cta_path_weak"
          ? "Add a clear primary CTA on the home hero or first band that points to the main conversion action."
          : c.code === "headline_weak_home"
            ? "Rewrite the hero headline to state a concrete outcome for the visitor in one line."
            : c.code === "conversion_proof_home_weak"
              ? "Add a compact trust strip or one proof metric on home above the fold."
              : undefined,
    });
    if (!seen.has(t.id)) {
      seen.add(t.id);
      tasks.push(t);
    }
  }

  if (brandBrain?.improvementQueue?.length) {
    for (const q of brandBrain.improvementQueue) {
      if (q.autoApplied || !q.surfacedAsSuggestion) continue;
      const pri = BB_PRIORITY[q.code] ?? "low";
      if (pri === "low" && tasks.length > 12) continue;
      const id = `agency_bb_${q.code}`.slice(0, 120);
      if (seen.has(id)) continue;
      seen.add(id);
      tasks.push({
        id,
        type: q.fixability === "safe_auto" ? "site_fix" : "conversion_improvement",
        priority: pri,
        scope: q.scope,
        status: "suggested",
        recommendation: q.recommendation,
        label: q.label,
        derivedFrom: ["brand_brain"],
        route: q.route,
        sectionId: q.sectionId,
        linkedBrandBrainCode: q.fixability === "safe_auto" ? q.code : undefined,
        refineInstructionHint:
          q.code === "narrative_weak_cta_placement"
            ? "Add or strengthen a closing CTA section before the footer on this route."
            : undefined,
      });
    }
  }

  for (const comp of companions.slice(0, 4)) {
    const id = `agency_companion_${comp.code}`.slice(0, 120);
    if (seen.has(id)) continue;
    seen.add(id);
    tasks.push({
      id,
      type: "content_asset",
      priority: comp.priority,
      scope: "site",
      status: "suggested",
      recommendation: comp.rationale,
      label: `Consider a ${comp.suggestedSlug} page — ${comp.rationale.slice(0, 80)}`,
      derivedFrom: ["companion_page"],
      refineInstructionHint: `Plan a new ${comp.suggestedSlug} route in a future build; keep tone aligned with home.`,
    });
  }

  for (const d of deliverables.slice(0, 3)) {
    const id = `agency_${d.id}`.slice(0, 120);
    if (seen.has(id)) continue;
    seen.add(id);
    tasks.push({
      id,
      type: "launch_asset",
      priority: "low",
      scope: "site",
      status: "suggested",
      recommendation: d.label,
      label: d.label,
      derivedFrom: d.derivedFrom,
      route: d.contextRoute,
    });
  }

  tasks.sort((a, b) => {
    const p = (x: AgencyTask) => (x.priority === "high" ? 0 : x.priority === "medium" ? 1 : 2);
    const d = p(a) - p(b);
    if (d !== 0) return d;
    return a.id.localeCompare(b.id);
  });

  return tasks.slice(0, 24);
}

export function runAgencyLaunchOrchestration(doc: SiteSchemaDocumentType): void {
  const brandBrain = doc.metadata?.brandBrain;
  const path = analyzeConversionPath(doc);
  const { readiness, checks } = evaluateLaunchReadiness(doc, path, brandBrain ?? null);
  const companionPageSuggestions = suggestCompanionPages(doc, path);
  const styleMode = styleModeFromSiteDocument(doc);
  const deliverableSuggestions = buildDeliverableSuggestions(doc, readiness, styleMode);
  const launchQueue = buildLaunchQueue(checks, brandBrain, companionPageSuggestions, deliverableSuggestions);

  const base = doc.metadata ?? { title: "Site" };
  const state = AgencyLaunchStateSchema.parse({
    version: 1,
    evaluatedAt: new Date().toISOString(),
    readiness,
    checks,
    conversionPathIssues: path.issues,
    companionPageSuggestions,
    launchQueue,
    deliverableSuggestions,
  });
  doc.metadata = { ...base, agencyLaunch: state };
}

export function pickAgencyLaunchActions(
  queue: AgencyTask[],
  dismissed: Set<string>,
  accepted: Set<string>,
  limit = 3,
): AgencyTask[] {
  return queue
    .filter((t) => t.status === "suggested" && !dismissed.has(t.id) && !accepted.has(t.id))
    .slice(0, limit);
}
