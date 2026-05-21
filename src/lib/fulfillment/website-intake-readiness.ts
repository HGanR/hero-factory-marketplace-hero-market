import type {
  WebsiteIntakeNormalized,
  WebsiteIntakeReadiness,
  WebsiteIntakeReadinessTier,
} from "@/lib/fulfillment/website-intake-types";

type FieldCheck = { key: string; label: string; weight: number; satisfied: boolean };

function hasContact(profile: WebsiteIntakeNormalized): boolean {
  const c = profile.contactInfo;
  return Boolean(c?.email?.trim() || c?.phone?.trim() || c?.website?.trim());
}

function hasSocial(profile: WebsiteIntakeNormalized): boolean {
  return profile.socialLinks.length > 0;
}

function hasBusinessIdentity(profile: WebsiteIntakeNormalized): boolean {
  return Boolean(profile.businessName || profile.businessType);
}

function hasScope(profile: WebsiteIntakeNormalized): boolean {
  return profile.desiredPages.length > 0 || profile.websiteGoals.length > 0;
}

function hasDesign(profile: WebsiteIntakeNormalized): boolean {
  return profile.colorPreferences.length > 0 || profile.stylePreferences.length > 0;
}

export function scoreWebsiteIntakeReadiness(profile: WebsiteIntakeNormalized): WebsiteIntakeReadiness {
  const checks: FieldCheck[] = [
    {
      key: "businessIdentity",
      label: "Business name or type",
      weight: 18,
      satisfied: hasBusinessIdentity(profile),
    },
    {
      key: "industry",
      label: "Industry or niche",
      weight: 10,
      satisfied: Boolean(profile.industry || profile.niche),
    },
    {
      key: "targetAudience",
      label: "Target audience",
      weight: 10,
      satisfied: Boolean(profile.targetAudience),
    },
    {
      key: "scope",
      label: "Desired pages or website goals",
      weight: 16,
      satisfied: hasScope(profile),
    },
    {
      key: "primaryCTA",
      label: "Primary call-to-action",
      weight: 14,
      satisfied: Boolean(profile.primaryCTA),
    },
    {
      key: "contact",
      label: "Contact information",
      weight: 14,
      satisfied: hasContact(profile),
    },
    {
      key: "social",
      label: "Social links",
      weight: 6,
      satisfied: hasSocial(profile),
    },
    {
      key: "design",
      label: "Color or style preferences",
      weight: 8,
      satisfied: hasDesign(profile),
    },
    {
      key: "launchUrgency",
      label: "Launch urgency",
      weight: 4,
      satisfied: profile.launchUrgency != null,
    },
    {
      key: "commerceFlags",
      label: "Booking or e-commerce needs",
      weight: 5,
      satisfied: profile.bookingNeeded != null || profile.ecommerceNeeded != null,
    },
    {
      key: "trustSignals",
      label: "Trust signals",
      weight: 5,
      satisfied: profile.trustSignals.length > 0,
    },
    {
      key: "referenceSites",
      label: "Reference sites",
      weight: 5,
      satisfied: profile.referenceSites.length > 0,
    },
  ];

  const maxScore = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter((c) => c.satisfied).reduce((s, c) => s + c.weight, 0);
  const score = Math.round((earned / maxScore) * 100);

  const missingFields = checks.filter((c) => !c.satisfied).map((c) => c.label);
  const presentFields = checks.filter((c) => c.satisfied).map((c) => c.label);

  const fulfillmentReady =
    hasBusinessIdentity(profile) &&
    (hasContact(profile) || hasSocial(profile)) &&
    hasScope(profile) &&
    (Boolean(profile.primaryCTA) || hasContact(profile)) &&
    score >= 52;

  let tier: WebsiteIntakeReadinessTier = "weak";
  if (score >= 72 && fulfillmentReady) tier = "strong";
  else if (score >= 45 || fulfillmentReady) tier = "medium";

  return {
    tier,
    score,
    fulfillmentReady,
    missingFields,
    presentFields,
  };
}

export function detectMissingIntakeFields(profile: WebsiteIntakeNormalized): string[] {
  return scoreWebsiteIntakeReadiness(profile).missingFields;
}
