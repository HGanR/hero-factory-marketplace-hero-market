import { mergeCrmContactCustomFields } from "@/lib/widget/crm-logger";

describe("mergeCrmContactCustomFields", () => {
  it("merges and drops undefined patch keys", () => {
    const a = mergeCrmContactCustomFields(
      { foo: 1, sourceSiteName: "old" },
      { sourceSiteName: "new", sourceAgentName: "Agent" },
    );
    expect(a.sourceSiteName).toBe("new");
    expect(a.sourceAgentName).toBe("Agent");
    expect(a.foo).toBe(1);
  });

  it("removes keys when patch sets null or undefined", () => {
    const a = mergeCrmContactCustomFields(
      { sourceAgentName: "X", keep: "y" },
      { sourceAgentName: null },
    );
    expect(a.sourceAgentName).toBeUndefined();
    expect((a as { keep?: string }).keep).toBe("y");
  });
});
