/**
 * Sample GOLD rows for local testing (paste into the UI or save as .csv).
 * Covers multiple verticals (realtor, tax, med-spa, mechanic) for playbook smoke tests.
 * Re-run analysis after migrations 0045+ (website grade, coverage, lead type, operator enum).
 */

export const SAMPLE_CSV = `business_name,platform,handle,profile_url,email,website_url,notes
Summit Realty Group,instagram,summitrealty,https://www.instagram.com/instagram/,agent@example.com,https://example.com,Open house leads — realtor vertical
Ledger & Lane Tax,linkedin,ledgerlane,https://www.linkedin.com/company/microsoft/,cpa@example.com,,Tax season intake — tax_professional vertical
Glow Med Spa,tiktok,glowmedspa,https://www.tiktok.com/@tiktok,,https://example.org,Aesthetic consults — med_spa vertical
`;

export const SAMPLE_PASTE_BLOCK = `
business_name: Hometown Motors
platform: youtube
handle: hometownmotors
profile_url: https://www.youtube.com/@YouTube
website_url: https://example.com
notes: Synthetic mechanic vertical smoke test
`;
