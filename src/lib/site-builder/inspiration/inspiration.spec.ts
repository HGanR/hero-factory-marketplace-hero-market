import { describe, expect, it } from "@jest/globals";
import { extractInspirationSignalsFromHtml, isPrivateOrLocalUrlForTests } from "@/lib/site-builder/inspiration/extract-inspiration-signals";
import { summarizeInspirationSignals, summarizeIndustryOnly } from "@/lib/site-builder/inspiration/inspiration-summarizer";
import { InspirationBriefSchema } from "@/lib/site-builder/inspiration/inspiration-brief-schema";

describe("inspiration private URL block", () => {
  it("flags localhost and private hosts", () => {
    expect(isPrivateOrLocalUrlForTests("localhost")).toBe(true);
    expect(isPrivateOrLocalUrlForTests("127.0.0.1")).toBe(true);
    expect(isPrivateOrLocalUrlForTests("10.0.0.1")).toBe(true);
  });
});

describe("extractInspirationSignalsFromHtml", () => {
  it("pulls headings and CTA-like labels from sample HTML", () => {
    const html = `<!doctype html><html><head><title>ACME | Enterprise CRM</title>
    <meta name="description" content="Ship pipeline faster" /></head><body>
    <nav><a href="/a">Product</a><a href="/b">Book demo</a></nav>
    <h1>Close deals in half the time</h1>
    <p>We help revenue teams get clarity without spreadsheets and silence.</p>
    <h2>Why teams trust us</h2>
    <button>Book a 20 minute consult</button>
    </body></html>`;
    const s = extractInspirationSignalsFromHtml(html);
    expect(s.pageTitle).toMatch(/acme|crm/i);
    expect(s.headings.some((h) => h.text.toLowerCase().includes("deals"))).toBe(true);
    expect(s.ctaLabels.join(" ")).toMatch(/book|demo|consult/i);
  });
});

describe("summarizeInspirationSignals", () => {
  it("produces a valid brief and avoids echoing the full H1 as copy", () => {
    const s = extractInspirationSignalsFromHtml(`<html><head><title>Protocol</title></head><body>
    <h1>Audit-ready Web3 security for shipping teams</h1>
    <h2>How the engagement works</h2>
    <h2>Pricing and plans</h2>
    <button>Get a security review</button>
    <p>On-chain monitoring and runbooks for incident response in production.</p>
    </body></html>`);
    const b = summarizeInspirationSignals(s, { industry: "blockchain security" });
    const parsed = InspirationBriefSchema.parse(b);
    expect(parsed.layoutPatterns.length).toBeGreaterThan(0);
    expect(parsed.doNotCopyNotice).toBe(true);
    expect(parsed.heroPattern).not.toContain("Audit-ready Web3");
  });

  it("industry-only path yields keyword themes from industry", () => {
    const b = summarizeIndustryOnly("B2B SaaS analytics for RevOps");
    const p = InspirationBriefSchema.parse(b);
    expect(p.keywordThemes.length).toBeGreaterThan(0);
  });
});
