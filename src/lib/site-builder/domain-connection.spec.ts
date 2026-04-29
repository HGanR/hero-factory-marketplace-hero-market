import { describe, expect, it } from "@jest/globals";
import { domainConnectionRowToMetadata } from "@/lib/site-builder/domain-connection-schema-sync";
import { sanitizeDomainName, sanitizeTargetUrlInput } from "@/lib/site-builder/domain-connection-sanitize";
import { verifyDomainResolution } from "@/lib/site-builder/domain-connection-verify";
import { buildFreenameWeb3SetupInstructions } from "@/lib/site-builder/domain-connection-freename";
import { isBlockedPrivateOrLocalHost } from "@/lib/site-builder/domain-connection-sanitize";
import { mapExecuteIntentMessage } from "@/lib/site-builder/assistant/map-execute-intent-message";
import type { SiteDomainConnectionRow } from "@/lib/site-builder/site-domain-connections-repository";

describe("domain-connection-sanitize", () => {
  it("accepts example.com and web3 TLDs", () => {
    expect(sanitizeDomainName("Example.COM")).toEqual({ ok: true, domain: "example.com" });
    expect(sanitizeDomainName("brand.crypto")).toEqual({ ok: true, domain: "brand.crypto" });
  });

  it("rejects localhost and private hosts", () => {
    expect(sanitizeDomainName("localhost").ok).toBe(false);
    expect(sanitizeTargetUrlInput("https://127.0.0.1/foo").ok).toBe(false);
    expect(isBlockedPrivateOrLocalHost("192.168.0.1")).toBe(true);
  });
});

describe("freename instructions", () => {
  it("includes target URL in markdown", () => {
    const p = buildFreenameWeb3SetupInstructions({ domain: "x.crypto", targetUrl: "https://a.vercel.app" });
    expect(p.instructionsMarkdown).toMatch(/x\.crypto/);
    expect(p.instructionsMarkdown).toMatch(/a\.vercel\.app/);
  });
});

describe("metadata projection", () => {
  it("maps DB row to schema metadata", () => {
    const row = {
      domain: "d.crypto",
      domainType: "freename_web3",
      provider: "freename",
      targetUrl: "https://t.vercel.app",
      status: "instructions_ready",
      requiredRecordsJson: JSON.stringify({ records: [{ type: "CNAME", name: "@", value: "x.vercel.app" }] }),
      lastCheckedAt: null,
    } as unknown as SiteDomainConnectionRow;
    const m = domainConnectionRowToMetadata(row);
    expect(m.domain).toBe("d.crypto");
    expect(m.requiredRecords?.[0]?.value).toContain("vercel");
  });
});

describe("assistant map — domain connection", () => {
  it("maps Freename / crypto phrasing to upsert_domain_connection", () => {
    const out = mapExecuteIntentMessage({
      message: "Connect my Freename domain brand.crypto to https://myapp.vercel.app",
      schema: { pages: [{ slug: "/", blocks: [] }], metadata: { title: "S", governance: {} } },
      editContext: { lastPageSlug: "/", lastSectionIds: [] },
    });
    const act = out.actions.find((a) => a.action === "upsert_domain_connection");
    expect(act).toBeDefined();
    if (act && act.action === "upsert_domain_connection") {
      expect(act.domain).toBe("brand.crypto");
      expect(act.targetUrl).toBe("https://myapp.vercel.app");
    }
  });
});

describe("DNS verify (mocked)", () => {
  it("marks web3 manual confirm as connected", async () => {
    const r = await verifyDomainResolution({
      domain: "brand.crypto",
      domainType: "freename_web3",
      targetUrl: "https://x.vercel.app",
      manualWeb3Confirm: true,
    });
    expect(r.status).toBe("connected");
  });
});

