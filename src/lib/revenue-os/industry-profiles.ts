/**
 * Industry profiles: default assumptions + benchmark references.
 * Keys map to /api/revenue-os/benchmarks?industry= (Consulting, SaaS, E-commerce, etc.)
 */
export type IndustryKey =
  | "consulting"
  | "saas"
  | "ecommerce"
  | "b2b"
  | "capital_architecture"
  | "it_services"
  | "software_development"
  | "cybersecurity"
  | "ai_ml_services"
  | "cloud_services"
  | "mobile_apps"
  | "medical_practice"
  | "dental"
  | "mental_health"
  | "pharmacy"
  | "health_tech"
  | "law"
  | "accounting"
  | "architecture"
  | "engineering"
  | "marketing_agency"
  | "pr"
  | "hr_consulting"
  | "design_agency"
  | "content_creation"
  | "photography"
  | "video_production"
  | "music"
  | "real_estate_residential"
  | "real_estate_commercial"
  | "property_management"
  | "financial_planning"
  | "insurance"
  | "fintech"
  | "edtech"
  | "training"
  | "tutoring"
  | "restaurant"
  | "catering"
  | "food_manufacturing"
  | "retail_dtc"
  | "manufacturing"
  | "logistics"
  | "fitness"
  | "beauty_salon"
  | "coaching"
  | "construction"
  | "agriculture"
  | "clean_energy"
  | "nonprofit"
  | "media"
  | "events"
  | "hospitality"
  | "automotive"
  | "telecom"
  | "recruiting"
  | "legal_services"
  | "veterinary"
  | "home_services"
  | "travel"
  | "publishing"
  | "sports"
  | "wellness"
  | "pet_services"
  | "childcare"
  | "senior_care";

export type IndustryProfile = {
  label: string;
  apiKey: string; // sent to benchmarks API
  defaultTraffic: number;
  defaultConversion: number;
  defaultAov: number;
  benchmarks: {
    conversionMedian: number;
    grossMargin: string;
    cacTypical?: number;
  };
};

function profile(
  label: string,
  apiKey: string,
  traffic: number,
  conversion: number,
  aov: number,
  grossMargin: string,
  cac?: number,
  conversionMedian?: number
): IndustryProfile {
  return {
    label,
    apiKey,
    defaultTraffic: traffic,
    defaultConversion: conversion,
    defaultAov: aov,
    benchmarks: {
      conversionMedian: conversionMedian ?? conversion,
      grossMargin,
      cacTypical: cac,
    },
  };
}

export const INDUSTRY_PROFILES: Record<IndustryKey, IndustryProfile> = {
  consulting: profile("Consulting", "Consulting", 8000, 1.5, 5000, "60–75%", 400),
  saas: profile("SaaS", "SaaS", 20000, 2.3, 49, "70–85%", 300),
  ecommerce: profile("E-Commerce", "E-commerce", 50000, 1.8, 95, "40–55%", 45),
  b2b: profile("B2B Services", "B2B Services", 12000, 2.4, 3500, "65–80%", 350),
  capital_architecture: profile("Capital Architecture", "Capital Architecture", 5000, 1.5, 8000, "60–75%", 500),
  it_services: profile("IT Services", "IT Services", 15000, 2.2, 3500, "55–70%", 320),
  software_development: profile("Software Development", "Software Development", 12000, 2.5, 8000, "70–85%", 450),
  cybersecurity: profile("Cybersecurity", "Cybersecurity", 8000, 2.0, 15000, "75–90%", 800),
  ai_ml_services: profile("AI / ML Services", "AI/ML Services", 10000, 2.2, 12000, "70–85%", 600),
  cloud_services: profile("Cloud Services", "Cloud Services", 25000, 2.0, 199, "65–80%", 250),
  mobile_apps: profile("Mobile Apps", "Mobile Apps", 50000, 1.5, 4.99, "85–95%", 15),
  medical_practice: profile("Medical Practice", "Medical Practice", 6000, 3.0, 250, "60–75%", 150),
  dental: profile("Dental", "Dental", 5000, 4.0, 400, "55–70%", 120),
  mental_health: profile("Mental Health", "Mental Health", 4000, 2.5, 150, "70–85%", 80),
  pharmacy: profile("Pharmacy", "Pharmacy", 20000, 2.0, 45, "25–40%", 35),
  health_tech: profile("Health Tech", "Health Tech", 15000, 2.2, 99, "60–75%", 200),
  law: profile("Legal / Law", "Legal", 6000, 2.0, 5000, "65–80%", 500),
  accounting: profile("Accounting", "Accounting", 8000, 2.5, 500, "70–85%", 200),
  architecture: profile("Architecture", "Architecture", 4000, 1.8, 15000, "55–70%", 600),
  engineering: profile("Engineering", "Engineering", 7000, 2.0, 12000, "60–75%", 550),
  marketing_agency: profile("Marketing Agency", "Marketing Agency", 12000, 2.2, 3000, "65–80%", 400),
  pr: profile("PR / Communications", "PR", 5000, 1.8, 5000, "65–80%", 450),
  hr_consulting: profile("HR Consulting", "HR Consulting", 8000, 2.2, 3500, "65–80%", 380),
  design_agency: profile("Design Agency", "Design Agency", 10000, 2.0, 4500, "60–75%", 350),
  content_creation: profile("Content Creation", "Content Creation", 50000, 1.2, 15, "50–70%", 25),
  photography: profile("Photography", "Photography", 8000, 2.5, 800, "55–70%", 100),
  video_production: profile("Video Production", "Video Production", 6000, 2.0, 3500, "50–65%", 400),
  music: profile("Music / Audio", "Music", 20000, 1.0, 25, "60–80%", 30),
  real_estate_residential: profile("Real Estate (Residential)", "Real Estate Residential", 8000, 1.5, 15000, "50–65%", 200),
  real_estate_commercial: profile("Real Estate (Commercial)", "Real Estate Commercial", 4000, 1.2, 50000, "55–70%", 500),
  property_management: profile("Property Management", "Property Management", 6000, 2.5, 200, "60–75%", 80),
  financial_planning: profile("Financial Planning", "Financial Planning", 5000, 2.0, 2000, "70–85%", 350),
  insurance: profile("Insurance", "Insurance", 15000, 2.5, 150, "15–35%", 150),
  fintech: profile("FinTech", "FinTech", 30000, 1.8, 50, "60–80%", 120),
  edtech: profile("EdTech", "EdTech", 25000, 2.0, 29, "65–80%", 180),
  training: profile("Training / Corporate Learning", "Training", 10000, 2.2, 500, "60–75%", 220),
  tutoring: profile("Tutoring", "Tutoring", 6000, 3.0, 80, "70–85%", 60),
  restaurant: profile("Restaurant", "Restaurant", 15000, 3.0, 35, "25–40%", 45),
  catering: profile("Catering", "Catering", 5000, 2.5, 1500, "35–50%", 120),
  food_manufacturing: profile("Food Manufacturing", "Food Manufacturing", 8000, 1.5, 250, "30–45%", 80),
  retail_dtc: profile("Retail / DTC Brands", "Retail DTC", 40000, 2.0, 75, "45–60%", 50),
  manufacturing: profile("Manufacturing", "Manufacturing", 6000, 1.5, 5000, "35–50%", 200),
  logistics: profile("Logistics / Supply Chain", "Logistics", 8000, 1.8, 800, "20–35%", 150),
  fitness: profile("Fitness / Gym", "Fitness", 12000, 2.5, 80, "65–80%", 120),
  beauty_salon: profile("Beauty / Salon", "Beauty", 6000, 3.5, 85, "55–70%", 55),
  coaching: profile("Coaching", "Coaching", 8000, 2.0, 500, "80–95%", 150),
  construction: profile("Construction", "Construction", 5000, 1.5, 25000, "25–45%", 400),
  agriculture: profile("Agriculture / AgTech", "Agriculture", 4000, 1.2, 1500, "20–40%", 180),
  clean_energy: profile("Clean Energy", "Clean Energy", 6000, 1.8, 5000, "40–55%", 350),
  nonprofit: profile("Nonprofit", "Nonprofit", 15000, 1.5, 75, "varies", 50),
  media: profile("Media / Publishing", "Media", 50000, 1.2, 10, "50–70%", 30),
  events: profile("Events", "Events", 6000, 2.0, 2000, "40–55%", 250),
  hospitality: profile("Hospitality", "Hospitality", 20000, 2.5, 150, "25–45%", 90),
  automotive: profile("Automotive", "Automotive", 15000, 1.5, 500, "20–35%", 150),
  telecom: profile("Telecom", "Telecom", 25000, 1.8, 75, "50–65%", 120),
  recruiting: profile("Recruiting / Staffing", "Recruiting", 10000, 2.5, 5000, "25–40%", 400),
  legal_services: profile("Legal Services", "Legal Services", 6000, 2.0, 5000, "65–80%", 500),
  veterinary: profile("Veterinary", "Veterinary", 5000, 3.0, 150, "55–70%", 100),
  home_services: profile("Home Services", "Home Services", 12000, 2.5, 350, "45–60%", 85),
  travel: profile("Travel", "Travel", 30000, 1.5, 800, "15–35%", 120),
  publishing: profile("Publishing", "Publishing", 40000, 1.2, 15, "50–65%", 40),
  sports: profile("Sports / Athletics", "Sports", 15000, 1.8, 100, "50–70%", 90),
  wellness: profile("Wellness", "Wellness", 12000, 2.2, 120, "65–80%", 110),
  pet_services: profile("Pet Services", "Pet Services", 8000, 2.5, 75, "55–70%", 55),
  childcare: profile("Childcare", "Childcare", 5000, 2.8, 1200, "50–65%", 150),
  senior_care: profile("Senior Care", "Senior Care", 4000, 2.0, 4500, "45–60%", 350),
};

export const INDUSTRY_OPTIONS: { value: IndustryKey; label: string }[] = [
  { value: "consulting", label: "Consulting" },
  { value: "saas", label: "SaaS" },
  { value: "ecommerce", label: "E-Commerce" },
  { value: "b2b", label: "B2B Services" },
  { value: "capital_architecture", label: "Capital Architecture" },
  { value: "it_services", label: "IT Services" },
  { value: "software_development", label: "Software Development" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "ai_ml_services", label: "AI / ML Services" },
  { value: "cloud_services", label: "Cloud Services" },
  { value: "mobile_apps", label: "Mobile Apps" },
  { value: "medical_practice", label: "Medical Practice" },
  { value: "dental", label: "Dental" },
  { value: "mental_health", label: "Mental Health" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "health_tech", label: "Health Tech" },
  { value: "law", label: "Legal / Law" },
  { value: "accounting", label: "Accounting" },
  { value: "architecture", label: "Architecture" },
  { value: "engineering", label: "Engineering" },
  { value: "marketing_agency", label: "Marketing Agency" },
  { value: "pr", label: "PR / Communications" },
  { value: "hr_consulting", label: "HR Consulting" },
  { value: "design_agency", label: "Design Agency" },
  { value: "content_creation", label: "Content Creation" },
  { value: "photography", label: "Photography" },
  { value: "video_production", label: "Video Production" },
  { value: "music", label: "Music / Audio" },
  { value: "real_estate_residential", label: "Real Estate (Residential)" },
  { value: "real_estate_commercial", label: "Real Estate (Commercial)" },
  { value: "property_management", label: "Property Management" },
  { value: "financial_planning", label: "Financial Planning" },
  { value: "insurance", label: "Insurance" },
  { value: "fintech", label: "FinTech" },
  { value: "edtech", label: "EdTech" },
  { value: "training", label: "Training / Corporate Learning" },
  { value: "tutoring", label: "Tutoring" },
  { value: "restaurant", label: "Restaurant" },
  { value: "catering", label: "Catering" },
  { value: "food_manufacturing", label: "Food Manufacturing" },
  { value: "retail_dtc", label: "Retail / DTC Brands" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "logistics", label: "Logistics / Supply Chain" },
  { value: "fitness", label: "Fitness / Gym" },
  { value: "beauty_salon", label: "Beauty / Salon" },
  { value: "coaching", label: "Coaching" },
  { value: "construction", label: "Construction" },
  { value: "agriculture", label: "Agriculture / AgTech" },
  { value: "clean_energy", label: "Clean Energy" },
  { value: "nonprofit", label: "Nonprofit" },
  { value: "media", label: "Media / Publishing" },
  { value: "events", label: "Events" },
  { value: "hospitality", label: "Hospitality" },
  { value: "automotive", label: "Automotive" },
  { value: "telecom", label: "Telecom" },
  { value: "recruiting", label: "Recruiting / Staffing" },
  { value: "legal_services", label: "Legal Services" },
  { value: "veterinary", label: "Veterinary" },
  { value: "home_services", label: "Home Services" },
  { value: "travel", label: "Travel" },
  { value: "publishing", label: "Publishing" },
  { value: "sports", label: "Sports / Athletics" },
  { value: "wellness", label: "Wellness" },
  { value: "pet_services", label: "Pet Services" },
  { value: "childcare", label: "Childcare" },
  { value: "senior_care", label: "Senior Care" },
];
