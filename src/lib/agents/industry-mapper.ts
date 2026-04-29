/**
 * Industry mapper for AI agents.
 * Groups industries by vertical for clean, industry-standard UI.
 */
import type { IndustryKey } from "@/lib/revenue-os/industry-profiles";

export type { IndustryKey };
import { INDUSTRY_OPTIONS } from "@/lib/revenue-os/industry-profiles";

export type IndustryGroup = {
  id: string;
  label: string;
  industries: { value: IndustryKey; label: string }[];
};

const GROUPS: IndustryGroup[] = [
  {
    id: "professional",
    label: "Professional Services",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["consulting", "law", "accounting", "architecture", "engineering", "hr_consulting", "legal_services"].includes(o.value)
    ),
  },
  {
    id: "technology",
    label: "Technology",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["saas", "it_services", "software_development", "cybersecurity", "ai_ml_services", "cloud_services", "mobile_apps", "edtech", "health_tech"].includes(o.value)
    ),
  },
  {
    id: "healthcare",
    label: "Healthcare & Wellness",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["medical_practice", "dental", "mental_health", "pharmacy", "fitness", "wellness", "veterinary", "senior_care"].includes(o.value)
    ),
  },
  {
    id: "finance",
    label: "Finance & Insurance",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["financial_planning", "insurance", "fintech", "capital_architecture"].includes(o.value)
    ),
  },
  {
    id: "creative",
    label: "Creative & Media",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["marketing_agency", "pr", "design_agency", "content_creation", "photography", "video_production", "music", "media", "publishing"].includes(o.value)
    ),
  },
  {
    id: "real_estate",
    label: "Real Estate",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["real_estate_residential", "real_estate_commercial", "property_management"].includes(o.value)
    ),
  },
  {
    id: "retail",
    label: "Retail & E-Commerce",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["ecommerce", "retail_dtc", "b2b"].includes(o.value)
    ),
  },
  {
    id: "food",
    label: "Food & Hospitality",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["restaurant", "catering", "food_manufacturing", "hospitality", "events"].includes(o.value)
    ),
  },
  {
    id: "services",
    label: "Services",
    industries: INDUSTRY_OPTIONS.filter((o) =>
      ["training", "tutoring", "coaching", "home_services", "beauty_salon", "pet_services", "childcare", "recruiting", "travel", "logistics"].includes(o.value)
    ),
  },
  {
    id: "other",
    label: "Other",
    industries: INDUSTRY_OPTIONS.filter((o) => {
      const used = new Set([
        "consulting", "law", "accounting", "architecture", "engineering", "hr_consulting", "legal_services",
        "saas", "it_services", "software_development", "cybersecurity", "ai_ml_services", "cloud_services", "mobile_apps", "edtech", "health_tech",
        "medical_practice", "dental", "mental_health", "pharmacy", "fitness", "wellness", "veterinary", "senior_care",
        "financial_planning", "insurance", "fintech", "capital_architecture",
        "marketing_agency", "pr", "design_agency", "content_creation", "photography", "video_production", "music", "media", "publishing",
        "real_estate_residential", "real_estate_commercial", "property_management",
        "ecommerce", "retail_dtc", "b2b",
        "restaurant", "catering", "food_manufacturing", "hospitality", "events",
        "training", "tutoring", "coaching", "home_services", "beauty_salon", "pet_services", "childcare", "recruiting", "travel", "logistics",
      ]);
      return !used.has(o.value);
    }),
  },
];

export const INDUSTRY_MAPPER_GROUPS = GROUPS;

export function parseIndustriesJson(json: string | null | undefined): IndustryKey[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is IndustryKey => typeof v === "string" && v.length > 0)
      : [];
  } catch {
    return [];
  }
}

export function stringifyIndustries(industries: IndustryKey[]): string {
  return JSON.stringify([...new Set(industries)]);
}

const LABEL_MAP = new Map(INDUSTRY_OPTIONS.map((o) => [o.value, o.label]));

export function getIndustryLabels(keys: IndustryKey[]): string[] {
  return keys.map((k) => LABEL_MAP.get(k) ?? k).filter(Boolean);
}
