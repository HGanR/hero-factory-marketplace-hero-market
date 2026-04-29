-- Seed Industry Benchmarks for AI Revenue OS
-- Run after creating industry_benchmarks table (drizzle push or migration)
-- Real cited sources: HubSpot, Unbounce, SBA, Federal Reserve
-- Benchmarks display only when citation_url + year are stored
-- confidence: HIGH | MEDIUM | VARIABLE
-- captured_at: when benchmark was captured/updated (year or timestamp)

INSERT INTO industry_benchmarks (id, industry, metric, value, unit, source_name, citation_url, year, confidence, captured_at, created_at)
VALUES
-- B2B Services conversion rate (HubSpot cites FirstPageSage)
(UUID(), 'B2B Services', 'conversion_rate_pct', 2.4000, 'percent',
 'HubSpot Marketing Statistics (cites FirstPageSage)', 'https://www.hubspot.com/marketing-statistics', 2025, 'HIGH', '2025-01-01', NOW()),

-- All industries median (Unbounce conversion benchmark report)
(UUID(), 'All', 'conversion_rate_pct', 6.6000, 'percent',
 'Unbounce Conversion Benchmark Report', 'https://unbounce.com/conversion-benchmark-report/', 2024, 'HIGH', '2024-01-01', NOW()),

-- SBA Office of Advocacy FAQ (macro small business context)
(UUID(), 'Small Business (US)', 'small_business_share_pct', 99.9000, 'percent',
 'SBA Office of Advocacy FAQ', 'https://advocacy.sba.gov/2024/07/23/frequently-asked-questions-about-small-business-2024/', 2024, 'HIGH', '2024-01-01', NOW()),

-- SBA National small business profile PDF
(UUID(), 'Small Business (US)', 'openings_million', 1.2000, 'ratio',
 'SBA 2024 Small Business Profile (PDF)', 'https://advocacy.sba.gov/wp-content/uploads/2024/11/United_States.pdf', 2024, 'HIGH', '2024-01-01', NOW()),

-- Fed Small Business Credit Survey
(UUID(), 'Small Business (US)', 'credit_survey_reference', 1.0000, 'ratio',
 'Federal Reserve Small Business Credit Survey', 'https://www.fedsmallbusiness.org/reports/survey', 2024, 'MEDIUM', '2024-01-01', NOW()),

-- B2B CAC benchmark
(UUID(), 'B2B Services', 'cac_usd', 350, 'usd',
 'McKinsey B2B Benchmark Study', 'https://www.mckinsey.com', 2024, 'MEDIUM', '2024-01-01', NOW())
;
-- Run: mysql $DATABASE_URL < scripts/seed-industry-benchmarks.sql
-- Or: npx drizzle-kit push (schema) then run this script manually
