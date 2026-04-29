/**
 * Vertical inference + playbook sharpening — deterministic, no outreach execution.
 */

import { mapOfferAngle } from "./mapOfferAngle";
import type {
  BusinessVertical,
  CommercialReadiness,
  InferredLeadType,
  NormalizedLead,
  PublicSocialSurface,
  ScoreBundle,
  WeakSpotTag,
} from "./types";

const RULES: { vertical: BusinessVertical; weight: number; re: RegExp }[] = [
  { vertical: "realtor", weight: 3, re: /\b(realtor|real\s*estate|homes?\s*for\s*sale|mls|listing|broker|kw\b|remax)\b/i },
  { vertical: "tax_professional", weight: 3, re: /\b(tax|cpa|enrolled\s*agent|irs|bookkeeping|1040|llc\s*tax)\b/i },
  { vertical: "med_spa", weight: 3, re: /\b(med\s*spa|aesthetic|botox|filler|laser|injectable|derma)\b/i },
  { vertical: "salon", weight: 2, re: /\b(salon|stylist|hair|balayage|extensions|nails?)\b/i },
  { vertical: "contractor", weight: 3, re: /\b(contractor|roofing|hvac|plumb|electric|remodel|construction)\b/i },
  { vertical: "mechanic", weight: 3, re: /\b(auto\s*repair|mechanic|brakes|tires?|oil\s*change|shop)\b/i },
  { vertical: "barber", weight: 3, re: /\b(barber|barbershop|fade|cutz)\b/i },
  { vertical: "insurance", weight: 3, re: /\b(insurance|allstate|state\s*farm|policy|premium|coverage)\b/i },
];

/** Collapse all text signals into one lowercase blob. */
export function buildCorpusForVertical(args: {
  lead: NormalizedLead;
  social: PublicSocialSurface;
  websiteTitle?: string;
  websiteDescription?: string;
  postSnippets: string[];
}): string {
  const parts = [
    args.lead.businessName,
    args.lead.notes ?? "",
    args.social.bio ?? "",
    args.social.displayName ?? "",
    args.websiteTitle ?? "",
    args.websiteDescription ?? "",
    ...args.postSnippets,
  ];
  return parts.join(" \n ").toLowerCase();
}

export function inferVertical(corpus: string): BusinessVertical {
  let best: BusinessVertical = "general_service_business";
  let score = 0;
  for (const r of RULES) {
    if (r.re.test(corpus)) {
      if (r.weight > score) {
        score = r.weight;
        best = r.vertical;
      }
    }
  }
  return best;
}

/** Move vertical-relevant weak spots earlier for triage. */
export function prioritizeWeakSpotsForVertical(
  vertical: BusinessVertical,
  spots: WeakSpotTag[]
): WeakSpotTag[] {
  const rank = (tag: WeakSpotTag): number => {
    const v = vertical;
    if (v === "realtor" || v === "insurance") {
      if (tag === "no_lead_capture" || tag === "weak_cta") return 0;
      if (tag === "no_reviews_visible") return 1;
    }
    if (v === "tax_professional") {
      if (tag === "no_lead_capture" || tag === "no_email_capture") return 0;
      if (tag === "manual_follow_up_risk") return 1;
    }
    if (v === "med_spa" || v === "salon" || v === "barber") {
      if (tag === "no_booking_system" || tag === "dm_booking_only") return 0;
      if (tag === "weak_offer_clarity") return 1;
    }
    if (v === "contractor" || v === "mechanic") {
      if (tag === "no_reviews_visible" || tag === "weak_cta") return 0;
      if (tag === "no_website") return 1;
    }
    return 5;
  };
  const uniq = [...new Set(spots)];
  uniq.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return uniq;
}

/** Second-pass ordering by lead archetype (after vertical pass). */
export function prioritizeWeakSpotsForLeadType(leadType: InferredLeadType, spots: WeakSpotTag[]): WeakSpotTag[] {
  const rank = (tag: WeakSpotTag): number => {
    const lt = leadType;
    if (lt === "agency" || lt === "creator_brand") {
      if (tag === "weak_offer_clarity" || tag === "weak_cta") return 0;
    }
    if (lt === "clinic" || lt === "storefront") {
      if (tag === "no_booking_system" || tag === "dm_booking_only") return 0;
    }
    if (lt === "contractor") {
      if (tag === "no_reviews_visible" || tag === "weak_cta") return 0;
    }
    if (lt === "solo_operator") {
      if (tag === "manual_follow_up_risk" || tag === "no_booking_system") return 0;
    }
    if (lt === "local_service_business") {
      if (tag === "no_lead_capture" || tag === "manual_follow_up_risk") return 0;
    }
    return 5;
  };
  const uniq = [...new Set(spots)];
  uniq.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return uniq;
}

export function sharpenOfferAngleWithLeadContext(
  base: string,
  leadType: InferredLeadType,
  readiness: CommercialReadiness
): string {
  const tail = (s: string) => (s.length > 300 ? s.slice(0, 297) + "…" : s);
  let s = base;
  if (readiness === "low") s += " Readiness: low — anchor on proof + one concrete next step.";
  if (readiness === "high") s += " Readiness: high — scheduling + capture upgrades are in play.";
  if (leadType === "agency") s += " Lead type: agency — emphasize pipeline, reporting, and SLAs.";
  if (leadType === "creator_brand") s += " Lead type: creator brand — packaging + conversion path clarity.";
  if (leadType === "clinic") s += " Lead type: clinic — keep intake HIPAA-safe; no PHI in public threads.";
  if (leadType === "storefront") s += " Lead type: storefront — hours, location, and inventory signals.";
  if (leadType === "contractor") s += " Lead type: contractor — quotes, license, and service area.";
  if (leadType === "solo_operator") s += " Lead type: solo operator — protect time; template FAQs.";
  return tail(s);
}

export function sharpenOfferAngle(
  vertical: BusinessVertical,
  base: string,
  weakSpots: WeakSpotTag[]
): string {
  const tail = (s: string) => (s.length > 220 ? s.slice(0, 217) + "…" : s);

  switch (vertical) {
    case "realtor":
      return tail(
        `${base} Vertical: real estate — prioritize listing urgency + neighborhood proof; capture consults with one calendar link.`
      );
    case "tax_professional":
      return tail(
        `${base} Vertical: tax — emphasize compliance deadlines, document checklist, and secure intake (no sensitive data in DMs).`
      );
    case "med_spa":
    case "salon":
    case "barber":
      return tail(
        `${base} Vertical: appointment-based — reduce DM ping-pong with explicit booking + policy links in bio.`
      );
    case "contractor":
    case "mechanic":
      return tail(
        `${base} Vertical: trades — trust signals (reviews, license, service area) + one clear “get a quote” path.`
      );
    case "insurance":
      return tail(
        `${base} Vertical: insurance — clarify coverage scope in first touch; avoid quoting rates in public threads.`
      );
    default:
      return base;
  }
}

export function sharpenManualAngles(
  vertical: BusinessVertical,
  lead: NormalizedLead,
  social: PublicSocialSurface,
  scores: ScoreBundle,
  bestOfferAngle: string,
  opts?: { inferredLeadType?: InferredLeadType; commercialReadiness?: CommercialReadiness }
): {
  suggestedCommentAngle: string;
  suggestedFollowMessageAngle: string;
  suggestedEmailAngle: string;
  suggestedNextMove: string;
} {
  const name = lead.businessName || lead.handle;
  const baseComment =
    social.accessStatus === "public"
      ? `Thread: reference one visible post, tie to ${bestOfferAngle.split("—")[0].trim()}.`
      : `Limited surface: neutral, specific question; no pitch stack.`;

  const vComment = (() => {
    switch (vertical) {
      case "realtor":
        return `${baseComment} Ask about timeline + price band (public-safe).`;
      case "tax_professional":
        return `${baseComment} Ask entity type + filing complexity (no SSN/tax details in comments).`;
      case "med_spa":
      case "salon":
      case "barber":
        return `${baseComment} Ask service goal + timing for appointment.`;
      case "contractor":
      case "mechanic":
        return `${baseComment} Ask job scope + ZIP/service area match.`;
      case "insurance":
        return `${baseComment} Ask coverage goal (auto/home/life) at high level.`;
      default:
        return baseComment;
    }
  })();

  const vFollow = `Save note: vertical=${vertical}; friction=${scores.frictionScore.toFixed(2)}; ${bestOfferAngle.slice(0, 100)}`;

  const vEmail = lead.email
    ? (() => {
        switch (vertical) {
          case "tax_professional":
            return `Subject: quick question on ${name} — intake. Body: 3 bullets: what you saw publicly, one hypothesis, request a secure intake link (no attachments with sensitive data).`;
          case "realtor":
            return `Subject: ${name} — neighborhood fit. Body: compliment one listing/post signal, ask for consult booking + pre-approval status.`;
          case "insurance":
            return `Subject: coverage review — ${name}. Body: state what you observed, ask for a licensed review call (no rate promises).`;
          default:
            return `Subject ties to visible buyer theme. Body: 3 bullets + one ask — manual send only.`;
        }
      })()
    : `No email on lead — capture via site form or manual lookup; do not harvest private emails.`;

  const lt = opts?.inferredLeadType;
  const rd = opts?.commercialReadiness;
  const vNext =
    scores.opportunityScore >= 0.5
      ? `Ops: ${name} · ${vertical}${lt ? ` · lead=${lt}` : ""} · validate offer angle in one manual touch this week.`
      : `Watchlist: ${name} — revisit when surface or capture improves.`;
  const vNext2 =
    rd === "low"
      ? `${vNext} (Readiness low — keep one narrow ask.)`
      : rd === "high"
        ? `${vNext} (Readiness high — can propose structured next step.)`
        : vNext;

  return {
    suggestedCommentAngle: vComment,
    suggestedFollowMessageAngle: vFollow,
    suggestedEmailAngle: vEmail,
    suggestedNextMove: vNext2,
  };
}

/** Re-export for callers that only need base angle before sharpening. */
export function baseOfferFromWeakSpots(weakSpots: WeakSpotTag[], businessHint: string): string {
  return mapOfferAngle(weakSpots, businessHint);
}
