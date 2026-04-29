import { GOOGLE_TOOLS_SYSTEM_ADDENDUM } from "@/lib/agent-plugins/google-tool-guidance";

describe("GOOGLE_TOOLS_SYSTEM_ADDENDUM", () => {
  it("mentions confirmation, summaries, duplicates, and reconnect expectations", () => {
    const t = GOOGLE_TOOLS_SYSTEM_ADDENDUM;
    expect(t).toMatch(/confirmed:\s*true/i);
    expect(t).toMatch(/summary/i);
    expect(t).toMatch(/duplicate/i);
    expect(t).toMatch(/reconnect/i);
    expect(t).toMatch(/validation/i);
  });
});
