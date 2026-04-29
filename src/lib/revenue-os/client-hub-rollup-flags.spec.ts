import {
  isSiteIntelligenceSyncOnReadEnabled,
  shouldSyncSiteIntelligenceOnRead,
} from "@/lib/revenue-os/client-hub-rollup";

describe("SITE_INTELLIGENCE_SYNC_ON_READ", () => {
  const prev = process.env.SITE_INTELLIGENCE_SYNC_ON_READ;
  afterEach(() => {
    if (prev === undefined) delete process.env.SITE_INTELLIGENCE_SYNC_ON_READ;
    else process.env.SITE_INTELLIGENCE_SYNC_ON_READ = prev;
  });

  it("defaults to disabled", () => {
    delete process.env.SITE_INTELLIGENCE_SYNC_ON_READ;
    expect(isSiteIntelligenceSyncOnReadEnabled()).toBe(false);
  });

  it("enables only when explicitly true", () => {
    process.env.SITE_INTELLIGENCE_SYNC_ON_READ = "1";
    expect(isSiteIntelligenceSyncOnReadEnabled()).toBe(false);
    process.env.SITE_INTELLIGENCE_SYNC_ON_READ = "true";
    expect(isSiteIntelligenceSyncOnReadEnabled()).toBe(true);
  });

  it("read path skips sync by default", () => {
    delete process.env.SITE_INTELLIGENCE_SYNC_ON_READ;
    expect(shouldSyncSiteIntelligenceOnRead()).toBe(false);
  });

  it("read path syncs only when explicitly enabled and not skipped by call-site opts", () => {
    process.env.SITE_INTELLIGENCE_SYNC_ON_READ = "true";
    expect(shouldSyncSiteIntelligenceOnRead()).toBe(true);
    expect(shouldSyncSiteIntelligenceOnRead({ skipIntelligenceWriteback: true })).toBe(false);
  });
});
