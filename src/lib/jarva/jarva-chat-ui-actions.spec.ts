import {
  buildJarvaSpecialtyActions,
  isJarvaSpecialtyEntryIntent,
  JARVA_TRUST_TYPE_CHOICE_BUTTONS,
  parseJarvaEntryIntent,
  parseJarvaTrustStyleHint,
  shouldShowJarvaTrustTypeButtons,
} from "@/lib/jarva/jarva-chat-ui-actions";

describe("jarva-chat-ui-actions", () => {
  it("parseJarvaEntryIntent and parseJarvaTrustStyleHint accept API payloads", () => {
    expect(parseJarvaEntryIntent("trust_ppm")).toBe("trust_ppm");
    expect(parseJarvaEntryIntent("bad")).toBe(null);
    expect(parseJarvaTrustStyleHint("revocable")).toBe("revocable");
    expect(parseJarvaTrustStyleHint("nope")).toBe(null);
  });

  it("trust type buttons use classifier-friendly messages", () => {
    expect(JARVA_TRUST_TYPE_CHOICE_BUTTONS.map((b) => b.message)).toEqual([
      "Revocable trust",
      "Irrevocable trust",
      "Ecclesiastical trust",
    ]);
  });

  it("trust_general is not a specialty intent", () => {
    expect(isJarvaSpecialtyEntryIntent("trust_general")).toBe(false);
  });

  it("trust-type fast actions are hidden when a trust workspace is bound", () => {
    expect(shouldShowJarvaTrustTypeButtons("trust-advisor", true, false)).toBe(true);
    expect(shouldShowJarvaTrustTypeButtons("trust-advisor", true, true)).toBe(false);
    expect(shouldShowJarvaTrustTypeButtons("other-npc", true, false)).toBe(false);
  });

  it("specialty intents are recognized", () => {
    expect(isJarvaSpecialtyEntryIntent("trust_certificate")).toBe(true);
    expect(isJarvaSpecialtyEntryIntent("trust_ppm")).toBe(true);
    expect(isJarvaSpecialtyEntryIntent("trust_bond")).toBe(true);
    expect(isJarvaSpecialtyEntryIntent("trust_estate")).toBe(true);
  });

  it("trust_certificate actions include Trust Records and optional issue-security when trustId set", () => {
    const noTid = buildJarvaSpecialtyActions("trust_certificate", null);
    expect(noTid.find((a) => a.kind === "link" && a.label === "Open Trust Records")?.href).toBe(
      "/trust-records?tab=issue"
    );
    expect(noTid.some((a) => a.kind === "link" && a.href.includes("/issue-security"))).toBe(false);

    const withTid = buildJarvaSpecialtyActions("trust_certificate", "tid-1");
    expect(
      withTid.find((a) => a.kind === "link" && a.label === "Issue / securities")?.href
    ).toBe("/trusts/tid-1/issue-security");
  });

  it("trust_bond links to bonds tab", () => {
    const a = buildJarvaSpecialtyActions("trust_bond", "x");
    expect(a.find((x) => x.kind === "link" && x.label === "Open Bonds area")?.href).toBe(
      "/trust-records?trustId=x&tab=bonds"
    );
  });

  it("trust_estate includes estate/will route and optional jarva deep link", () => {
    const a = buildJarvaSpecialtyActions("trust_estate", undefined);
    expect(a.some((x) => x.kind === "link" && x.href === "/trust-records/estate/will")).toBe(true);
    expect(a.some((x) => x.kind === "link" && x.href.includes("/trust-records/jarva"))).toBe(false);

    const b = buildJarvaSpecialtyActions("trust_estate", "t2");
    expect(b.some((x) => x.kind === "link" && x.href.includes("trustId=t2") && x.href.includes("jarva"))).toBe(
      true
    );
  });

  it("trust_ppm includes issue tab and smart-trust", () => {
    const a = buildJarvaSpecialtyActions("trust_ppm", "p1");
    expect(a.find((x) => x.kind === "link" && x.label === "Open Issue / Securities")?.href).toContain("tab=issue");
    expect(a.find((x) => x.kind === "link" && x.label === "Open Smart Trust")?.href).toContain("trustId=p1");
  });
});
