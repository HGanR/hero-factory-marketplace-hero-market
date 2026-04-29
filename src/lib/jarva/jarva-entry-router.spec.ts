import { describe, expect, it } from "@jest/globals";
import { classifyJarvaEntry, formatJarvaEntryRouterReply } from "./jarva-entry-router";

describe("classifyJarvaEntry", () => {
  it("classifies generic trust as needing type choice", () => {
    const r = classifyJarvaEntry("trust");
    expect(r.intent).toBe("trust_general");
    expect(r.needsTrustTypeChoice).toBe(true);
  });

  it("classifies revocable trust directly", () => {
    const r = classifyJarvaEntry("I need a revocable trust");
    expect(r.intent).toBe("trust_revocable");
    expect(r.needsTrustTypeChoice).toBe(false);
    expect(r.trustStyle).toBe("revocable");
  });

  it("classifies ecclesiastical trust", () => {
    const r = classifyJarvaEntry("ecclesiastical trust setup");
    expect(r.intent).toBe("trust_ecclesiastical");
    expect(r.trustStyle).toBe("ecclesiastical");
  });

  it("classifies PPM / private placement", () => {
    expect(classifyJarvaEntry("private placement").intent).toBe("trust_ppm");
    expect(classifyJarvaEntry("ppm").intent).toBe("trust_ppm");
  });

  it("classifies bond / indenture", () => {
    expect(classifyJarvaEntry("bond issuance").intent).toBe("trust_bond");
    expect(classifyJarvaEntry("indenture").intent).toBe("trust_bond");
  });

  it("resolves type from combined history", () => {
    const r = classifyJarvaEntry("trust\nrevocable");
    expect(r.intent).toBe("trust_revocable");
  });
});

describe("formatJarvaEntryRouterReply", () => {
  it("returns greeting on first unknown message", () => {
    const text = formatJarvaEntryRouterReply({
      message: "hi",
      combinedUserText: "hi",
      entryRoute: { intent: "unknown", needsTrustTypeChoice: false },
      hasTrustId: false,
      isFirstSessionMessage: true,
    });
    expect(text).toContain("Hello");
  });

  it("asks trust type when trust_general needs choice on first message", () => {
    const text = formatJarvaEntryRouterReply({
      message: "trust",
      combinedUserText: "trust",
      entryRoute: { intent: "trust_general", needsTrustTypeChoice: true },
      hasTrustId: false,
      isFirstSessionMessage: true,
    });
    expect(text).toContain("Revocable");
    expect(text).toContain("Irrevocable");
    expect(text).toContain("Ecclesiastical");
  });

  it("returns null when trust id is bound", () => {
    expect(
      formatJarvaEntryRouterReply({
        message: "trust",
        combinedUserText: "trust",
        entryRoute: { intent: "trust_general", needsTrustTypeChoice: true },
        hasTrustId: true,
        isFirstSessionMessage: true,
      })
    ).toBeNull();
  });

  it("routes PPM without trust id", () => {
    const text = formatJarvaEntryRouterReply({
      message: "ppm",
      combinedUserText: "ppm",
      entryRoute: { intent: "trust_ppm", needsTrustTypeChoice: false },
      hasTrustId: false,
      isFirstSessionMessage: false,
    });
    expect(text?.toLowerCase()).toContain("private placement");
  });
});
