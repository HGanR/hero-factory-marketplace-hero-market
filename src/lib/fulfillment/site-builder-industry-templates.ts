import type { WebsiteIntakeNormalized } from "@/lib/fulfillment/website-intake-types";

/** WEBSITE Site Builder archetypes — no Trust/Bentley/Content360. */
export const SITE_BUILDER_BUSINESS_ARCHETYPES = [
  "local_service",
  "professional",
  "restaurant",
  "retail",
  "health_wellness",
  "creative",
  "default",
] as const;

export type SiteBuilderBusinessArchetype = (typeof SITE_BUILDER_BUSINESS_ARCHETYPES)[number];

export type IndustrySectionPlan = {
  archetype: SiteBuilderBusinessArchetype;
  recommendedSections: string[];
  optionalSections: string[];
  planningNotes: string[];
};

export type IndustryPromptTemplate = {
  archetype: SiteBuilderBusinessArchetype;
  tone: string;
  emphasis: string[];
  avoid: string[];
};

export type ConversionChecklistItem = {
  id: string;
  label: string;
  weight: number;
};

const ARCHETYPE_KEYWORDS: Record<SiteBuilderBusinessArchetype, RegExp[]> = {
  local_service: [
    /\b(plumber|electrician|hvac|landscap|cleaning|roofing|contractor|local service|home service)\b/i,
  ],
  professional: [/\b(law|legal|accounting|consult|coach|agency|firm|advisor|cpa|attorney)\b/i],
  restaurant: [/\b(restaurant|cafe|bakery|food|catering|menu|dine)\b/i],
  retail: [/\b(retail|shop|store|boutique|ecommerce|e-commerce|product)\b/i],
  health_wellness: [/\b(clinic|dental|medical|therapy|wellness|spa|fitness|gym|health)\b/i],
  creative: [/\b(photograph|design studio|artist|creative|portfolio|brand)\b/i],
  default: [],
};

export function resolveBusinessArchetype(profile: WebsiteIntakeNormalized): SiteBuilderBusinessArchetype {
  const haystack = [
    profile.businessType,
    profile.industry,
    profile.niche,
    profile.businessName,
    ...profile.websiteGoals,
  ]
    .filter(Boolean)
    .join(" ");

  for (const archetype of SITE_BUILDER_BUSINESS_ARCHETYPES) {
    if (archetype === "default") continue;
    if (ARCHETYPE_KEYWORDS[archetype].some((re) => re.test(haystack))) return archetype;
  }

  if (profile.bookingNeeded) return "local_service";
  if (profile.ecommerceNeeded) return "retail";
  return "default";
}

export function getIndustryPromptTemplate(archetype: SiteBuilderBusinessArchetype): IndustryPromptTemplate {
  switch (archetype) {
    case "local_service":
      return {
        archetype,
        tone: "Clear, trustworthy, and action-oriented — emphasize service area and fast contact.",
        emphasis: ["service area", "licensed/insured if applicable", "before/after proof", "click-to-call"],
        avoid: ["vague corporate jargon", "stock-photo filler without local context"],
      };
    case "professional":
      return {
        archetype,
        tone: "Authoritative and calm — credentials first, then outcomes.",
        emphasis: ["credentials", "process clarity", "case outcomes", "consultation CTA"],
        avoid: ["hype without proof", "missing compliance-friendly disclaimers where needed"],
      };
    case "restaurant":
      return {
        archetype,
        tone: "Warm and sensory — menu, hours, and reservation path above the fold.",
        emphasis: ["hero food imagery", "hours/location", "reservation or order CTA", "reviews"],
        avoid: ["buried menu", "missing mobile tap-to-call"],
      };
    case "retail":
      return {
        archetype,
        tone: "Product-forward — collections, offers, and shipping/returns clarity.",
        emphasis: ["featured products", "promotions", "trust badges", "shipping/returns"],
        avoid: ["wall of text without product hierarchy"],
      };
    case "health_wellness":
      return {
        archetype,
        tone: "Reassuring and professional — empathy plus credibility.",
        emphasis: ["provider bios", "services", "insurance/booking", "patient-friendly language"],
        avoid: ["medical claims without substantiation"],
      };
    case "creative":
      return {
        archetype,
        tone: "Visual portfolio-led — show work, then package pricing or inquiry.",
        emphasis: ["portfolio grid", "process", "packages", "inquiry CTA"],
        avoid: ["generic template copy that hides the craft"],
      };
    default:
      return {
        archetype: "default",
        tone: "Direct and benefit-led — one primary offer, one primary CTA.",
        emphasis: ["value proposition", "social proof", "contact path"],
        avoid: ["multiple competing CTAs without hierarchy"],
      };
  }
}

export function planIndustrySections(
  archetype: SiteBuilderBusinessArchetype,
  profile: WebsiteIntakeNormalized
): IndustrySectionPlan {
  const base: Record<SiteBuilderBusinessArchetype, { recommended: string[]; optional: string[]; notes: string[] }> = {
    local_service: {
      recommended: ["Hero + primary CTA", "Services", "Service area map", "Why choose us", "Reviews", "Contact"],
      optional: ["FAQ", "Gallery", "Financing"],
      notes: ["Lead with phone/booking CTA on mobile.", "Mention neighborhoods served."],
    },
    professional: {
      recommended: ["Hero", "Practice areas", "Process", "Team/credentials", "Results", "Consultation CTA"],
      optional: ["Resources", "FAQ", "Testimonials"],
      notes: ["Use outcome-oriented headlines, not feature lists."],
    },
    restaurant: {
      recommended: ["Hero", "Menu highlights", "Hours & location", "Reservations/order", "Gallery", "Reviews"],
      optional: ["Events", "Catering", "Gift cards"],
      notes: ["Sticky mobile CTA for call or order."],
    },
    retail: {
      recommended: ["Hero", "Featured collection", "Offers", "Trust signals", "Shipping/returns", "Newsletter"],
      optional: ["Lookbook", "Store locator", "FAQ"],
      notes: ["Surface primary offer above the fold."],
    },
    health_wellness: {
      recommended: ["Hero", "Services", "Providers", "Insurance/booking", "Patient resources", "Contact"],
      optional: ["FAQ", "Blog", "Testimonials"],
      notes: ["Accessibility and calm visual hierarchy."],
    },
    creative: {
      recommended: ["Hero portfolio", "Selected work", "Services/packages", "Process", "About", "Inquiry"],
      optional: ["Press", "FAQ", "Blog"],
      notes: ["Let imagery carry the first screen."],
    },
    default: {
      recommended: ["Hero", "Value proposition", "Services/products", "Proof", "CTA band", "Contact"],
      optional: ["FAQ", "Blog", "Team"],
      notes: ["Single primary conversion goal per page."],
    },
  };

  const plan = base[archetype];
  const recommended = [...plan.recommended];
  if (profile.desiredPages.length) {
    for (const page of profile.desiredPages.slice(0, 8)) {
      if (!recommended.some((s) => s.toLowerCase().includes(page.toLowerCase()))) {
        recommended.push(`Page: ${page}`);
      }
    }
  }

  return {
    archetype,
    recommendedSections: recommended,
    optionalSections: plan.optional,
    planningNotes: plan.notes,
  };
}

export function suggestPrimaryCtas(
  archetype: SiteBuilderBusinessArchetype,
  profile: WebsiteIntakeNormalized
): string[] {
  if (profile.primaryCTA?.trim()) {
    return [profile.primaryCTA.trim(), ...fallbackCtas(archetype)].slice(0, 4);
  }
  return fallbackCtas(archetype);
}

function fallbackCtas(archetype: SiteBuilderBusinessArchetype): string[] {
  switch (archetype) {
    case "local_service":
      return ["Call now", "Get a free quote", "Book a service visit"];
    case "professional":
      return ["Schedule a consultation", "Request a callback", "Download guide"];
    case "restaurant":
      return ["Reserve a table", "Order online", "View menu"];
    case "retail":
      return ["Shop collection", "See today's offer", "Join VIP list"];
    case "health_wellness":
      return ["Book appointment", "Verify insurance", "Contact front desk"];
    case "creative":
      return ["Start a project", "View portfolio", "Request a quote"];
    default:
      return ["Get started", "Contact us", "Learn more"];
  }
}

export function suggestTrustSignals(
  archetype: SiteBuilderBusinessArchetype,
  profile: WebsiteIntakeNormalized
): string[] {
  const fromIntake = profile.trustSignals.slice(0, 8);
  const defaults: Record<SiteBuilderBusinessArchetype, string[]> = {
    local_service: ["Licensed & insured", "Local reviews", "Satisfaction guarantee", "Same-week availability"],
    professional: ["Years in practice", "Client testimonials", "Professional associations", "Clear engagement process"],
    restaurant: ["Star rating snippet", "Press mentions", "Food safety commitment", "Popular dishes"],
    retail: ["Secure checkout", "Easy returns", "Customer reviews", "Free shipping threshold"],
    health_wellness: ["Board-certified providers", "Patient reviews", "Accepted insurance", "HIPAA-aware intake"],
    creative: ["Client logos", "Award mentions", "Case study outcomes", "Response-time promise"],
    default: ["Customer testimonials", "Years in business", "Transparent pricing", "Contact guarantee"],
  };
  return dedupeStrings([...fromIntake, ...defaults[archetype]], 12);
}

export function extractOffersFromIntake(
  profile: WebsiteIntakeNormalized,
  salesSummary?: string | null
): string[] {
  const offers: string[] = [];
  const text = [salesSummary, ...profile.websiteGoals, profile.targetAudience].filter(Boolean).join(" ");

  const patterns = [
    /\b(\d{1,2}%\s*off[^.!?\n]{0,80})/gi,
    /\b(free\s+[^.!?\n]{3,60})/gi,
    /\b(limited[- ]time[^.!?\n]{3,60})/gi,
    /\b(new client(?:\s+special)?[^.!?\n]{0,60})/gi,
    /\b(\$\d+\s+[^.!?\n]{3,40})/gi,
  ];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const t = m[1]?.trim();
      if (t) offers.push(t.slice(0, 120));
    }
  }

  if (profile.bookingNeeded) offers.push("Online booking available");
  if (profile.ecommerceNeeded) offers.push("Shop products online");

  return dedupeStrings(offers, 8);
}

export function getHeroEnhancementHints(
  archetype: SiteBuilderBusinessArchetype,
  profile: WebsiteIntakeNormalized
): string[] {
  const hints = [
    `Headline names the outcome for ${profile.businessName ?? "the business"}.`,
    "Subhead clarifies who it is for and why now.",
    "One dominant CTA button — secondary links demoted.",
  ];
  switch (archetype) {
    case "local_service":
      hints.push("Show service area or city in hero.", "Add click-to-call on mobile.");
      break;
    case "restaurant":
      hints.push("Feature signature dish or ambiance photo.", "Surface hours near CTA.");
      break;
    case "retail":
      hints.push("Highlight hero product or seasonal offer.");
      break;
    case "professional":
      hints.push("Credential line under headline (years, certification).");
      break;
    default:
      break;
  }
  return hints;
}

export function getLocalBusinessOptimizationHints(
  archetype: SiteBuilderBusinessArchetype,
  profile: WebsiteIntakeNormalized
): string[] {
  const hints: string[] = [];
  const hasAddress = Boolean(profile.contactInfo?.address?.trim());
  const hasPhone = Boolean(profile.contactInfo?.phone?.trim());

  if (archetype === "local_service" || archetype === "restaurant" || archetype === "health_wellness") {
    hints.push("Embed map or service-area list.");
    hints.push("NAP consistency: name, address, phone match Google Business Profile.");
    hints.push("Local SEO: city + service keywords in H1/H2.");
  }
  if (!hasAddress) hints.push("Missing: street address or service-area statement.");
  if (!hasPhone) hints.push("Missing: click-to-call phone in header and footer.");
  if (profile.contactInfo?.website) {
    hints.push("Link existing domain only as reference — no auto DNS changes.");
  }
  return dedupeStrings(hints, 10);
}

export function getMobileFirstRecommendations(profile: WebsiteIntakeNormalized): string[] {
  const recs = [
    "Thumb-friendly CTA (min 44px tap target).",
    "Hero copy ≤ 2 short lines on mobile.",
    "Collapse secondary nav; keep phone CTA visible.",
    "Compress hero media; lazy-load below-fold galleries.",
  ];
  if (profile.bookingNeeded) recs.push("Booking widget above fold on mobile.");
  if (profile.socialLinks.length) recs.push("Social icons in footer only — do not compete with primary CTA.");
  return recs;
}

export function getConversionChecklist(archetype: SiteBuilderBusinessArchetype): ConversionChecklistItem[] {
  const common: ConversionChecklistItem[] = [
    { id: "hero_cta", label: "Single clear hero CTA", weight: 12 },
    { id: "value_prop", label: "Value proposition in first screen", weight: 10 },
    { id: "trust_proof", label: "Trust proof (reviews, badges, logos)", weight: 10 },
    { id: "contact_path", label: "Contact/booking path obvious", weight: 10 },
    { id: "mobile_cta", label: "Mobile-friendly primary action", weight: 8 },
    { id: "offer_clarity", label: "Offer or next step stated plainly", weight: 8 },
  ];
  const extra: Record<SiteBuilderBusinessArchetype, ConversionChecklistItem[]> = {
    local_service: [{ id: "service_area", label: "Service area visible", weight: 6 }],
    professional: [{ id: "credentials", label: "Credentials or outcomes shown", weight: 6 }],
    restaurant: [{ id: "hours_menu", label: "Hours/menu easy to find", weight: 6 }],
    retail: [{ id: "product_grid", label: "Featured products above fold", weight: 6 }],
    health_wellness: [{ id: "booking", label: "Appointment path clear", weight: 6 }],
    creative: [{ id: "portfolio", label: "Portfolio sample above fold", weight: 6 }],
    default: [],
  };
  return [...common, ...(extra[archetype] ?? [])];
}

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
