import {
  ClaudeWebsiteIntakeSchema,
  type ClaudeWebsiteIntake,
  type WebsiteIntakeNormalized,
} from "@/lib/fulfillment/website-intake-types";

const EMPTY_NORMALIZED: WebsiteIntakeNormalized = {
  businessName: null,
  businessType: null,
  industry: null,
  niche: null,
  targetAudience: null,
  desiredPages: [],
  websiteGoals: [],
  colorPreferences: [],
  stylePreferences: [],
  primaryCTA: null,
  contactInfo: null,
  socialLinks: [],
  bookingNeeded: null,
  ecommerceNeeded: null,
  trustSignals: [],
  referenceSites: [],
  launchUrgency: null,
};

function dedupeStrings(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) return m[1].trim().slice(0, 200);
  }
  return null;
}

function extractFromSalesText(text: string): Partial<ClaudeWebsiteIntake> {
  const lower = text.toLowerCase();
  const out: Partial<ClaudeWebsiteIntake> = {};

  const email = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  const phone = text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/)?.[0];
  if (email || phone) {
    out.contactInfo = {
      ...(email ? { email: email.slice(0, 320) } : {}),
      ...(phone ? { phone: phone.slice(0, 40) } : {}),
    };
  }

  const urls = [...text.matchAll(/\bhttps?:\/\/[^\s<>"']+/gi)].map((m) => m[0].slice(0, 500));
  if (urls.length) {
    out.referenceSites = dedupeStrings(urls, 10);
    const socialPlatforms: Array<{ platform: string; pattern: RegExp }> = [
      { platform: "instagram", pattern: /instagram\.com/i },
      { platform: "facebook", pattern: /facebook\.com/i },
      { platform: "linkedin", pattern: /linkedin\.com/i },
      { platform: "tiktok", pattern: /tiktok\.com/i },
      { platform: "youtube", pattern: /youtube\.com/i },
      { platform: "x", pattern: /(?:twitter|x)\.com/i },
    ];
    const social: ClaudeWebsiteIntake["socialLinks"] = [];
    for (const url of urls) {
      const hit = socialPlatforms.find((s) => s.pattern.test(url));
      if (hit) social.push({ platform: hit.platform, url });
    }
    if (social.length) out.socialLinks = social.slice(0, 12);
  }

  out.businessName =
    firstMatch(text, [
      /(?:business\s*name|company\s*name|brand\s*name)\s*[:=-]\s*([^\n.]{2,120})/i,
      /^([A-Z][A-Za-z0-9&'.\-\s]{2,80})(?:\s+(?:is|needs|wants|looking))/m,
    ]) ?? undefined;

  out.industry =
    firstMatch(text, [
      /(?:industry|vertical|sector|niche)\s*[:=-]\s*([^\n.]{2,120})/i,
    ]) ?? undefined;

  out.targetAudience =
    firstMatch(text, [
      /(?:target\s*audience|ideal\s*customer|customers?\s*are)\s*[:=-]\s*([^\n]{8,500})/i,
    ]) ?? undefined;

  out.primaryCTA =
    firstMatch(text, [
      /(?:primary\s*cta|call\s*to\s*action|main\s*cta)\s*[:=-]\s*([^\n.]{2,200})/i,
      /\b(book\s+(?:a\s+)?call|schedule\s+(?:a\s+)?consult|get\s+started|contact\s+us|sign\s+up)\b/i,
    ]) ?? undefined;

  const pageHints = [
    ...text.matchAll(/\b(?:home|about|services|contact|pricing|blog|portfolio|faq|team)\s*page\b/gi),
  ].map((m) => `${m[1]!.charAt(0).toUpperCase()}${m[1]!.slice(1).toLowerCase()}`);
  const pagesList = text.match(/pages?\s*[:=-]\s*([^\n.]{3,200})/i)?.[1];
  if (pagesList) {
    const fromList = pagesList.split(/[,;|]/).map((p) => {
      const t = p.trim();
      if (!t) return "";
      return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    });
    pageHints.push(...fromList);
  }
  if (pageHints.length) out.desiredPages = dedupeStrings(pageHints.filter(Boolean), 20);

  const goalLines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^(?:goal|objective|want|need)s?\s*[:=-]/i.test(l))
    .map((l) => l.replace(/^(?:goal|objective|want|need)s?\s*[:=-]\s*/i, "").slice(0, 300));
  if (goalLines.length) out.websiteGoals = dedupeStrings(goalLines, 15);

  if (/\b(e-?commerce|online\s+store|sell\s+products|shop)\b/i.test(lower)) {
    out.ecommerceNeeded = true;
  }
  if (/\b(booking|appointments?|scheduling|calendly)\b/i.test(lower)) {
    out.bookingNeeded = true;
  }
  if (/\b(urgent|rush|asap|this\s+week)\b/i.test(lower)) {
    out.launchUrgency = "rush";
  } else if (/\b(high\s+priority|soon|next\s+month)\b/i.test(lower)) {
    out.launchUrgency = "high";
  }

  const colors = text.match(/\b(?:brand\s+)?colors?\s*[:=-]\s*([^\n.]{2,120})/i)?.[1];
  if (colors) out.colorPreferences = dedupeStrings(colors.split(/[,;|]/), 10);

  const styles = text.match(/\b(?:style|look\s+and\s+feel|design\s+style)\s*[:=-]\s*([^\n.]{2,120})/i)?.[1];
  if (styles) {
    out.stylePreferences = dedupeStrings(styles.split(/[,;|]/), 10);
  }

  const trust = text.match(/\b(?:trust\s+signals?|credentials?|certifications?)\s*[:=-]\s*([^\n]{4,200})/i)?.[1];
  if (trust) out.trustSignals = dedupeStrings(trust.split(/[,;|]/), 15);

  return out;
}

function mergeIntake(
  explicit: ClaudeWebsiteIntake | null | undefined,
  inferred: Partial<ClaudeWebsiteIntake>
): ClaudeWebsiteIntake {
  return {
    businessName: explicit?.businessName ?? inferred.businessName,
    businessType: explicit?.businessType ?? inferred.businessType,
    industry: explicit?.industry ?? inferred.industry,
    niche: explicit?.niche ?? inferred.niche,
    targetAudience: explicit?.targetAudience ?? inferred.targetAudience,
    desiredPages: explicit?.desiredPages?.length ? explicit.desiredPages : inferred.desiredPages,
    websiteGoals: explicit?.websiteGoals?.length ? explicit.websiteGoals : inferred.websiteGoals,
    colorPreferences: explicit?.colorPreferences?.length
      ? explicit.colorPreferences
      : inferred.colorPreferences,
    stylePreferences: explicit?.stylePreferences?.length
      ? explicit.stylePreferences
      : inferred.stylePreferences,
    primaryCTA: explicit?.primaryCTA ?? inferred.primaryCTA,
    contactInfo: explicit?.contactInfo ?? inferred.contactInfo,
    socialLinks: explicit?.socialLinks?.length ? explicit.socialLinks : inferred.socialLinks,
    bookingNeeded: explicit?.bookingNeeded ?? inferred.bookingNeeded,
    ecommerceNeeded: explicit?.ecommerceNeeded ?? inferred.ecommerceNeeded,
    trustSignals: explicit?.trustSignals?.length ? explicit.trustSignals : inferred.trustSignals,
    referenceSites: explicit?.referenceSites?.length ? explicit.referenceSites : inferred.referenceSites,
    launchUrgency: explicit?.launchUrgency ?? inferred.launchUrgency,
  };
}

export function toNormalizedProfile(raw: ClaudeWebsiteIntake): WebsiteIntakeNormalized {
  return {
    businessName: raw.businessName?.trim() || null,
    businessType: raw.businessType?.trim() || null,
    industry: raw.industry?.trim() || null,
    niche: raw.niche?.trim() || null,
    targetAudience: raw.targetAudience?.trim() || null,
    desiredPages: dedupeStrings(raw.desiredPages ?? [], 20),
    websiteGoals: dedupeStrings(raw.websiteGoals ?? [], 15),
    colorPreferences: dedupeStrings(raw.colorPreferences ?? [], 10),
    stylePreferences: dedupeStrings(raw.stylePreferences ?? [], 10),
    primaryCTA: raw.primaryCTA?.trim() || null,
    contactInfo: raw.contactInfo
      ? {
          email: raw.contactInfo.email?.trim() || undefined,
          phone: raw.contactInfo.phone?.trim() || undefined,
          address: raw.contactInfo.address?.trim() || undefined,
          website: raw.contactInfo.website?.trim() || undefined,
        }
      : null,
    socialLinks: (raw.socialLinks ?? []).slice(0, 12),
    bookingNeeded: raw.bookingNeeded ?? null,
    ecommerceNeeded: raw.ecommerceNeeded ?? null,
    trustSignals: dedupeStrings(raw.trustSignals ?? [], 15),
    referenceSites: dedupeStrings(raw.referenceSites ?? [], 10),
    launchUrgency: raw.launchUrgency ?? null,
  };
}

export function normalizeWebsiteIntake(input: {
  websiteIntake?: unknown;
  salesSummaryText?: string | null;
  requestedDeliverableJson?: string | null;
}): WebsiteIntakeNormalized {
  let explicit: ClaudeWebsiteIntake | null = null;
  if (input.websiteIntake != null) {
    const parsed = ClaudeWebsiteIntakeSchema.safeParse(input.websiteIntake);
    if (parsed.success) explicit = parsed.data;
  }

  const sales = input.salesSummaryText?.trim() ?? "";
  const inferred = sales ? extractFromSalesText(sales) : {};

  if (!explicit && input.requestedDeliverableJson?.trim()) {
    try {
      const d = JSON.parse(input.requestedDeliverableJson) as { title?: string; notes?: string };
      if (d.notes?.trim() && !inferred.websiteGoals?.length) {
        inferred.websiteGoals = dedupeStrings([d.notes.trim()], 15);
      }
      if (d.title?.trim() && !inferred.businessName) {
        inferred.businessName = d.title.trim().slice(0, 200);
      }
    } catch {
      /* ignore */
    }
  }

  if (!explicit && !sales) return { ...EMPTY_NORMALIZED };

  const merged = mergeIntake(explicit, inferred);
  return toNormalizedProfile(merged);
}

export function parseWebsiteIntakeFromHandoffJson(
  executiveHandoffJson: string | null | undefined
): ClaudeWebsiteIntake | null {
  if (!executiveHandoffJson?.trim()) return null;
  try {
    const v = JSON.parse(executiveHandoffJson) as {
      websiteIntake?: unknown;
      intake?: { normalized?: WebsiteIntakeNormalized };
    };
    if (v.websiteIntake) {
      const parsed = ClaudeWebsiteIntakeSchema.safeParse(v.websiteIntake);
      if (parsed.success) return parsed.data;
    }
  } catch {
    return null;
  }
  return null;
}
