/**
 * Heuristic 0–100 scores for the 5-system model. Pure — call from effects / after pipeline only.
 */

import type { BentleySnapshot } from "@/lib/revenue-os/bentley-orchestrator";
import type { BentleyWorkflowState } from "@/lib/revenue-os/bentley-workflow";
import type { ResearchResult } from "@/components/ai-revenue-os/ResearchAssistantSection";
import type { TrendsResponse } from "@/lib/revenue-os/trends-schema";
import type { RevenueOsSystemSignals } from "@/lib/revenue-os/revenue-os-system-signals-types";
import { coerceTrimmedString } from "@/lib/revenue-os/bentley-string-coerce";

export type DeriveSystemSignalsContext = {
  trends: TrendsResponse | null | undefined;
  research: ResearchResult | null | undefined;
  workflow: BentleyWorkflowState;
  snapshot: BentleySnapshot;
};

const PRICE_HINT = /\$|usd|monthly|\/mo|retainer|package|subscription|mrr|recurring/i;
const HIGH_TICKET = /high[- ]?ticket|enterprise|\$[0-9]{3,4}\b|10k|15k|20k|cohort|group program/i;
const SCALE_HINT = /scalable|leverage|recurring|membership|saas|license/i;

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Returns partial signals — only keys with enough context to score meaningfully.
 */
export function deriveSystemSignals(ctx: DeriveSystemSignalsContext): RevenueOsSystemSignals {
  const { trends, research, workflow: wf, snapshot: snap } = ctx;
  const out: RevenueOsSystemSignals = {};

  const audience = coerceTrimmedString(snap.targetAudience);
  const core = coerceTrimmedString(snap.coreOffer);
  const transform = coerceTrimmedString(snap.transformation);
  const notes = coerceTrimmedString(snap.campaignNotes);
  const biz = coerceTrimmedString(snap.businessName);

  // --- Opportunity ---
  let opp = 0;
  const itemCount = trends?.items?.length ?? 0;
  if (itemCount >= 9) opp += 38;
  else if (itemCount >= 5) opp += 28;
  else if (itemCount >= 1) opp += 18;
  const wantN = research?.whatPeopleWant?.length ?? 0;
  if (wantN >= 5) opp += 28;
  else if (wantN >= 3) opp += 20;
  else if (research && wantN > 0) opp += 12;
  if (audience.length >= 24) opp += 18;
  else if (audience.length >= 8) opp += 10;
  if (itemCount > 0 || wantN > 0 || research) {
    out.opportunityScore = clamp(opp);
  }

  // --- Offer ---
  let offer = 0;
  if (core.length >= 40) offer += 32;
  else if (core.length >= 16) offer += 22;
  else if (core.length >= 6) offer += 12;
  if (transform.length >= 28) offer += 26;
  else if (transform.length >= 12) offer += 16;
  if (notes.length >= 120) offer += 22;
  else if (notes.length >= 40) offer += 12;
  if (biz.length >= 2) offer += 10;
  if (PRICE_HINT.test(`${core} ${notes}`)) offer += 12;
  if (core.length >= 6 || notes.length >= 20 || transform.length >= 8) {
    out.offerStrengthScore = clamp(offer);
  }

  // --- Traffic ---
  let traffic = 0;
  if (wf.artifacts.contentEngine) traffic += 36;
  const pp = snap.postingPlatforms?.length ?? 0;
  const qp = snap.platforms?.length ?? 0;
  if (pp >= 2) traffic += 22;
  else if (pp === 1) traffic += 14;
  if (qp >= 2) traffic += 14;
  else if (qp === 1) traffic += 8;
  const angles = trends?.campaignAngles?.length ?? 0;
  if (angles >= 4) traffic += 18;
  else if (angles >= 1) traffic += 10;
  if (itemCount >= 1 || wf.artifacts.contentEngine || pp > 0 || qp > 0) {
    out.trafficReadinessScore = clamp(traffic);
  }

  // --- Execution gap (high = more gap / risk) ---
  const hasRichInputs =
    core.length >= 10 && audience.length >= 6 && (biz.length >= 2 || coerceTrimmedString(snap.contentIndustry).length >= 2);
  const campaignDone = Boolean(wf.completed.campaign_generation || wf.artifacts.campaign);
  const contentDone = Boolean(wf.artifacts.contentEngine);
  let gap = 15;
  if (hasRichInputs) {
    if (!contentDone) gap += 35;
    if (!campaignDone) gap += 30;
  }
  if (wf.lastFailedPhase) gap += 12;
  if (hasRichInputs || wf.artifacts.research || wf.artifacts.trends) {
    out.executionGapScore = clamp(gap);
  }

  // --- Capital (low default, bump on hints) ---
  let cap = 12;
  if (SCALE_HINT.test(`${core} ${notes}`)) cap += 28;
  if (HIGH_TICKET.test(`${core} ${notes}`)) cap += 24;
  if (PRICE_HINT.test(notes) && notes.length > 40) cap += 14;
  out.capitalReadinessScore = clamp(cap);

  return out;
}
