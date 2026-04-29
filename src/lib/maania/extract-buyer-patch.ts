import type { BuyerDraft, BuyerFinancingType, BuyerPropertyType } from "@/lib/maania/buyer-draft";

type Patch = Partial<BuyerDraft>;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Parse 450k, $1.2m, 1,250,000 → numbers (buyer-relevant magnitudes). */
export function parseDollarAmounts(text: string): number[] {
  const out: number[] = [];
  const cleaned = text.replace(/,/g, "");
  const lower = cleaned.toLowerCase();

  const tokenRe = /\$?\s*([\d]+(?:\.\d+)?)\s*(k|m|million|thousand)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(lower)) !== null) {
    let n = parseFloat(m[1]);
    if (!Number.isFinite(n)) continue;
    const mult = m[2]?.toLowerCase();
    if (mult === "k" || mult === "thousand") n *= 1000;
    if (mult === "m" || mult === "million") n *= 1_000_000;
    if (n >= 25_000 && n < 250_000_000) out.push(Math.round(n));
  }

  return [...new Set(out)].sort((a, b) => a - b);
}

function pickFinancing(lower: string): BuyerFinancingType | undefined {
  if (/\bcash\b/.test(lower) && !/mortgage|loan|lender|pre/.test(lower)) {
    return "cash";
  }
  if (
    /pre[-\s]?approved|preapproval|pre[-\s]?qual|underwrit|letter\s+from\s+(a\s+)?lender/i.test(lower)
  ) {
    return "preapproved";
  }
  if (/need(s)?\s+(a\s+)?lender|connect\s+me\s+with\s+(a\s+)?lender|find\s+a\s+lender|not\s+sure\s+(about\s+)?(financ|loan)/i.test(lower)) {
    return "needs_lender";
  }
  if (/\bmortgage\b|\bfinanc(ing|e)\b|\bloan\b/.test(lower) && /not|unsure|figure|help/i.test(lower)) {
    return "needs_lender";
  }
  return undefined;
}

function pickPropertyType(lower: string): BuyerPropertyType | undefined {
  if (/\bsingle[-\s]?fam|detached|house\b(?!\s*boat)/i.test(lower)) return "single_family";
  if (/\bcondo\b|\bcondominium\b/i.test(lower)) return "condo";
  if (/\btown\s*home|\btownhouse\b/i.test(lower)) return "townhome";
  if (/\bmulti[-\s]?fam|duplex|triplex|fourplex|2[-\s]?4\s*unit/i.test(lower)) return "multi_family";
  if (/\bland\b|\blot\b|\bacre(s)?\b/i.test(lower)) return "land";
  if (/\bcommercial\b|\bretail\b|\boffice\b(?!\s*chair)/i.test(lower)) return "commercial";
  if (/\bother\b/.test(lower) && /property|home|place/i.test(lower)) return "other";
  return undefined;
}

function extractAreas(text: string): string[] {
  const lower = norm(text);
  const areas: string[] = [];

  const inMatch = lower.match(/\b(?:in|near|around)\s+([^.!?\n]+)/i);
  if (inMatch?.[1]) {
    const chunk = inMatch[1];
    const split = chunk.split(/\s*,\s*|\s+and\s+|\s*&\s*/);
    for (const s of split) {
      const t = s.replace(/\b(the|a|an)\b/gi, "").trim();
      if (t.length > 2 && t.length < 80) areas.push(titleCase(t));
    }
  }

  const cityLike = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*,\s*([A-Z]{2})\b/g);
  if (cityLike) {
    for (const c of cityLike) areas.push(c.trim());
  }

  const pair = text.match(/\b([A-Z][a-z]+)\s+and\s+([A-Z][a-z]+)\b/);
  if (pair) {
    areas.push(pair[1].trim(), pair[2].trim());
  }

  return [...new Set(areas.map((a) => a.trim()).filter(Boolean))];
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function extractBedBathSqft(text: string): Pick<BuyerDraft, "bedrooms" | "bathrooms" | "sqftMin" | "sqftMax"> {
  const patch: Patch = {};
  const lower = norm(text);

  const bed = lower.match(/(\d+(?:\.\d+)?)\s*(?:bed|bedroom|bedrooms|br|bd)\b/);
  if (bed) patch.bedrooms = Math.min(20, parseInt(bed[1], 10));

  const bath = lower.match(/(\d+(?:\.\d+)?)\s*(?:bath|bathroom|bathrooms|ba)\b/);
  if (bath) patch.bathrooms = Math.min(20, parseFloat(bath[1]));

  const sq = lower.match(/(\d{3,5})\s*(?:sq\.?\s*ft|sf|square\s*feet)\b/);
  if (sq) {
    const n = parseInt(sq[1], 10);
    patch.sqftMin = n;
    patch.sqftMax = n;
  }

  const sqRange = lower.match(/(\d{3,5})\s*[-–]\s*(\d{3,5})\s*(?:sq|sf)/);
  if (sqRange) {
    patch.sqftMin = parseInt(sqRange[1], 10);
    patch.sqftMax = parseInt(sqRange[2], 10);
  }

  return patch;
}

function extractTimeline(lower: string): string | undefined {
  if (/asap|right\s*away|immediately|this\s*week/i.test(lower)) return "ASAP";
  if (/next\s+month|within\s+a\s+month|30\s*days/i.test(lower)) return "Within ~30 days";
  if (/3\s*months|90\s*days|quarter/i.test(lower)) return "Within ~3 months";
  if (/6\s*months|half\s*a\s*year/i.test(lower)) return "Within ~6 months";
  if (/next\s+year|12\s*months|a\s+year/i.test(lower)) return "Within ~12 months";
  if (/just\s+(?:browsing|looking|exploring)|no\s+rush|flexible/i.test(lower)) return "Flexible / exploring";
  return undefined;
}

function extractComfort(
  lower: string
): "low" | "medium" | "high" | undefined {
  if (/\b(low|not\s+comfortable|avoid)\b.*\b(offer|bid|compet)/i.test(lower)) return "low";
  if (/\b(high|very\s+comfortable|love\s+to\s+compete)\b/i.test(lower)) return "high";
  if (/\b(medium|moderate|depends|somewhat)\b/i.test(lower)) return "medium";
  return undefined;
}

function extractRepairTol(lower: string): "low" | "medium" | "high" | undefined {
  if (/\b(fixer|needs\s+work|rehab|project|tlc)\b/i.test(lower)) return "high";
  if (/\bmove[-\s]?in\s*ready|turnkey|pristine|no\s+work\b/i.test(lower)) return "low";
  if (/\bopen\s+to\s+(minor|some|cosmetic)\b/i.test(lower)) return "medium";
  return undefined;
}

function extractYesNoBool(lower: string, yesHints: RegExp[], noHints: RegExp[]): boolean | undefined {
  for (const n of noHints) {
    if (n.test(lower)) return false;
  }
  for (const y of yesHints) {
    if (y.test(lower)) return true;
  }
  return undefined;
}

function extractJurisdiction(lower: string): string | undefined {
  const m = lower.match(/\b(in|for)\s+([a-z]{2})\b$/i) || lower.match(/\b([a-z]{2})\s+transaction\b/i);
  if (m && m[2] && m[2].length === 2) return m[2].toUpperCase();

  const states: Record<string, string> = {
    georgia: "GA",
    florida: "FL",
    california: "CA",
    texas: "TX",
    "new york": "NY",
    illinois: "IL",
    colorado: "CO",
    washington: "WA",
    arizona: "AZ",
    tennessee: "TN",
    "north carolina": "NC",
    "south carolina": "SC",
  };
  for (const [name, abbr] of Object.entries(states)) {
    if (new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`, "i").test(lower)) return abbr;
  }
  return undefined;
}

/**
 * Deterministic extraction from a single user turn. Returns only fields grounded in the message.
 */
export function extractBuyerDraftPatchFromMessage(
  userMessage: string,
  _current: BuyerDraft,
  _suggestedNextBuyerQuestion?: string
): Patch {
  void _current;
  void _suggestedNextBuyerQuestion;
  const patch: Patch = {};
  const raw = userMessage.trim();
  if (!raw) return patch;

  const lower = norm(raw);

  const fin = pickFinancing(lower);
  if (fin) patch.financing = fin;

  const amounts = parseDollarAmounts(raw);
  if (amounts.length >= 2) {
    patch.budgetMin = amounts[0];
    patch.budgetMax = amounts[amounts.length - 1];
  } else if (amounts.length === 1) {
    if (/range|between|around|about|up\s*to|under|below|max|at\s+most/i.test(lower)) {
      if (/under|below|max|up\s*to/i.test(lower)) patch.budgetMax = amounts[0];
      else patch.budgetMax = amounts[0];
    } else if (/pre[-\s]?approved|approved\s+for|qualif/i.test(lower)) {
      patch.budgetMax = amounts[0];
    } else {
      patch.budgetMax = amounts[0];
    }
  }

  const monthly = lower.match(/(?:payment|pmt|monthly)\s*(?:of|around|about)?\s*\$?\s*([\d,]+)/i);
  if (monthly) {
    const n = parseInt(monthly[1].replace(/,/g, ""), 10);
    if (n >= 500 && n < 50000) patch.monthlyPaymentTarget = n;
  }

  const areas = extractAreas(raw);
  if (areas.length) patch.targetAreas = areas;

  const pt = pickPropertyType(lower);
  if (pt) patch.propertyType = pt;

  Object.assign(patch, extractBedBathSqft(raw));

  if (/\bmove[-\s]?in\s*ready|turnkey|pristine\b/i.test(lower)) {
    patch.moveInReadyPreference = "move_in_ready";
  } else if (/\bfixer|needs\s+work|rehab|project\b/i.test(lower)) {
    patch.moveInReadyPreference = "open_to_work";
  }

  const must: string[] = [];
  if (/\bmust\s+have\b/i.test(lower)) {
    const m = raw.match(/must\s+have[s]?\s*:?\s*([^.!?\n]+)/i);
    if (m?.[1]) must.push(m[1].trim());
  }
  if (/\bpool\b/i.test(lower) && /must|need|want/i.test(lower)) must.push("Pool");
  if (must.length) patch.mustHaves = must;

  const deal: string[] = [];
  if (/\bno\s+hoa\b|\bdeal[\s-]?breaker\b/i.test(lower)) {
    const m = raw.match(/deal[\s-]?breakers?\s*:?\s*([^.!?\n]+)/i);
    if (m?.[1]) deal.push(m[1].trim());
  }
  if (deal.length) patch.dealBreakers = deal;

  const tl = extractTimeline(lower);
  if (tl) patch.timeline = tl;

  if (/\brent(ing)?\b|\blease\b|\btenant\b/i.test(lower)) {
    patch.currentHousingSituation = "Renting";
  } else if (/\bown\b.*\bhome\b|\bhomeowner\b/i.test(lower)) {
    patch.currentHousingSituation = "Owns current home";
  }

  if (/\bsell\s+(?:my\s+)?(?:house|home|place|property)\s+first|contingent|need\s+to\s+sell\b/i.test(lower)) {
    patch.mustSellFirst = true;
  } else if (/\bnot\s+selling|no\s+contingenc|already\s+sold\b/i.test(lower)) {
    patch.mustSellFirst = false;
  }

  const oc = extractComfort(lower);
  if (oc) patch.offerCompetitionComfort = oc;

  const rt = extractRepairTol(lower);
  if (rt) patch.repairTolerance = rt;

  const offM = extractYesNoBool(
    lower,
    [/\boff[-\s]?market|pocket\s+listing|value[\s-]?add\b/i],
    [/\bonly\s+mls\b|\bno\s+off[-\s]?market\b/i]
  );
  if (offM !== undefined) patch.offMarketInterest = offM;

  if (/\bfirst[-\s]?(time|home)\s+buyer\b|\bfirst\s+home\b/i.test(lower)) {
    patch.experienceLevel = "first_time";
  } else if (/\binvestor\b|\brental\s+portfolio\b/i.test(lower)) {
    patch.experienceLevel = "investor";
  } else if (/\bbought\s+before|second\s+home|previous\s+purchase/i.test(lower)) {
    patch.experienceLevel = "repeat";
  }

  const referrals: string[] = [];
  if (/\blender\b/i.test(lower) && /connect|help|need|want|yes/i.test(lower)) referrals.push("lender");
  if (/\battorney|lawyer|legal\b/i.test(lower) && /connect|help|need|yes/i.test(lower)) referrals.push("attorney");
  if (/\binspect(or|ion)\b/i.test(lower) && /connect|help|need|yes/i.test(lower)) referrals.push("inspector");
  if (/\bno\s+(help|thanks)|not\s+needed|i\s+have\s+(a\s+)?team\b/i.test(lower)) {
    referrals.push("declined");
  }
  if (referrals.length) patch.referralNeeds = referrals;

  if (/\bwife\b|\bhusband\b|\bspouse\b|\bpartner\b|\bfiance\b|\bfiancée\b/i.test(lower)) {
    patch.decisionMakers = "Multiple (e.g. spouse/partner involved)";
  } else if (/\bonly\s+me\b|\bsolo\b|\bjust\s+me\b/i.test(lower)) {
    patch.decisionMakers = "Primary buyer only";
  }

  if (/\bprice\b.*\b(most|first|matters|priority)\b|\bmost\s+important.*price\b/i.test(lower)) {
    patch.primaryDecisionFactor = "price";
  } else if (/\blocation\b.*\b(most|first|matters|priority)\b|\bmost\s+important.*location\b/i.test(lower)) {
    patch.primaryDecisionFactor = "location";
  } else if (/\bcondition\b.*\b(most|first|matters)\b/i.test(lower)) {
    patch.primaryDecisionFactor = "condition";
  } else if (/\blong[\s-]term|appreciation|equity|invest/i.test(lower)) {
    patch.primaryDecisionFactor = "long_term_value";
  }

  const reason = raw.match(
    /\b(?:because|since|we(?:'re|\s+are)|i(?:'m|\s+am))\s+([^.!?\n]{8,160})/i
  );
  if (reason?.[1] && /buy|move|relocat|grow|famil|job|school/i.test(lower)) {
    patch.reasonForBuyingNow = reason[1].trim();
  } else if (/\brelocat|new\s+job|baby|school\s+district|closer\s+to\s+work\b/i.test(lower)) {
    patch.reasonForBuyingNow = raw.slice(0, 200).trim();
  }

  const titleN = extractYesNoBool(
    lower,
    [/\btitle\s+(issue|problem|defect|cloud)\b/i],
    [/\btitle\s+clear\b|\bno\s+title\s+issues\b/i]
  );
  if (titleN !== undefined) patch.knownTitleIssues = titleN;

  const lienN = extractYesNoBool(
    lower,
    [/\blien\b|\bencumbrance\b/i],
    [/\bno\s+lien/i]
  );
  if (lienN !== undefined) patch.knownLienIssues = lienN;

  const mortN = extractYesNoBool(
    lower,
    [/\bmortgage\s+(issue|problem)|underwater\b/i],
    [/\bno\s+mortgage\s+issues\b/i]
  );
  if (mortN !== undefined) patch.knownMortgageComplications = mortN;

  const juris = extractJurisdiction(lower);
  if (juris) patch.jurisdiction = juris;

  if (/\bboth\s+summar|client\s+and\s+advisor|simple\s+and\s+detailed/i.test(lower)) {
    patch.wantsClientSummary = true;
    patch.wantsAdvisorSummary = true;
  } else if (/\badvisor|attorney|detailed\s+version\b/i.test(lower)) {
    patch.wantsAdvisorSummary = true;
  } else if (/\bsimple\s+(summary|version)|client[-\s]facing\b/i.test(lower)) {
    patch.wantsClientSummary = true;
  }

  return patch;
}
