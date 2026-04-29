import { describe, expect, it, jest } from "@jest/globals";
import { createSiteWithDraftHandoff } from "@/lib/site-builder/draft/create-site-handoff";

describe("createSiteWithDraftHandoff", () => {
  it("create site with draft schema saves first version", async () => {
    const saveFirstVersion = jest.fn(async () => {});
    const clearDraftSession = jest.fn();
    const out = await createSiteWithDraftHandoff({
      schemaText: JSON.stringify({ pages: [], metadata: { title: "Draft" } }),
      createSite: async () => ({ site: { id: "site-1" } }),
      saveFirstVersion,
      clearDraftSession,
    });
    expect(out).toEqual({ ok: true, siteId: "site-1", versionSaved: true });
    expect(saveFirstVersion).toHaveBeenCalledTimes(1);
    expect(clearDraftSession).toHaveBeenCalledTimes(1);
  });

  it("failure keeps draft storage (no clear)", async () => {
    const clearDraftSession = jest.fn();
    const out = await createSiteWithDraftHandoff({
      schemaText: JSON.stringify({ pages: [], metadata: { title: "Draft" } }),
      createSite: async () => ({ site: { id: "site-1" } }),
      saveFirstVersion: async () => {
        throw new Error("save failed");
      },
      clearDraftSession,
    });
    expect(out).toMatchObject({ ok: false, stage: "save_version", siteId: "site-1" });
    expect(clearDraftSession).not.toHaveBeenCalled();
  });

  it("success clears draft storage", async () => {
    const clearDraftSession = jest.fn();
    await createSiteWithDraftHandoff({
      schemaText: JSON.stringify({ pages: [{ slug: "/", blocks: [] }], metadata: { title: "x" } }),
      createSite: async () => ({ site: { id: "site-2" } }),
      saveFirstVersion: async () => {},
      clearDraftSession,
    });
    expect(clearDraftSession).toHaveBeenCalledTimes(1);
  });
});
