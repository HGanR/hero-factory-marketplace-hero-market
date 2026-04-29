/**
 * Concise rationale for suggested_next_move — deterministic, evidence-style copy.
 */

import type { AccessStatus, CommercialReadiness } from "./types";

export function buildActionRationale(args: {
  accessStatus: AccessStatus;
  overallCoverageScore: number;
  emailPresent: boolean;
  websitePresent: boolean;
  hasBuyerIntentInComments: boolean;
  commercialReadiness: CommercialReadiness;
  confidenceScore: number;
  opportunityScore: number;
}): string {
  const parts: string[] = [];

  if (args.accessStatus === "public") parts.push("Public profile text was reachable.");
  else parts.push(`Access is ${args.accessStatus} — triage on thinner evidence.`);

  parts.push(
    `Coverage ${(args.overallCoverageScore * 100).toFixed(0)}% aggregates profile, posts, comments, and site (when fetched).`
  );

  if (args.websitePresent) parts.push("Lead or bio links a website — compare on-site capture vs social DMs.");
  else parts.push("No confirmed website on lead/bio — prioritize clarity in the first manual touch.");

  if (args.emailPresent) parts.push("Email on file enables direct outreach when appropriate.");
  else parts.push("No email on lead — rely on public thread or site form paths.");

  if (args.hasBuyerIntentInComments) parts.push("Buyer intent language appears in visible comments.");
  else parts.push("Buyer intent not clearly detected in visible comments — lean on post copy + fit.");

  parts.push(`Commercial readiness ${args.commercialReadiness} (capture + engagement heuristics).`);
  parts.push(`Confidence ${(args.confidenceScore * 100).toFixed(0)}%; opportunity ${(args.opportunityScore * 100).toFixed(0)}%.`);

  const tail =
    args.opportunityScore >= 0.5 && args.confidenceScore >= 0.45
      ? "Next step: one focused manual validation touch aligned to the suggested angle."
      : "Next step: watchlist or light-touch research until surface or capture improves.";

  parts.push(tail);

  const out = parts.join(" ");
  return out.length > 900 ? out.slice(0, 897) + "…" : out;
}
