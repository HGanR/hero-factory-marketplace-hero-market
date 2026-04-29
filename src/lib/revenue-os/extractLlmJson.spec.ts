import { describe, expect, it } from "@jest/globals";
import { extractJsonFromLlmText, extractJsonFromLlmTextLenient } from "@/lib/revenue-os/extractLlmJson";

describe("extractJsonFromLlmText", () => {
  it("parses object with trailing comma after lenient pass", () => {
    const raw = 'Here is JSON:\n```json\n{\n  "a": 1,\n}\n```';
    const v = extractJsonFromLlmText(raw) as { a?: number };
    expect(v?.a).toBe(1);
  });

  it("extractJsonFromLlmTextLenient handles trailing commas in brace slice", () => {
    const raw = 'noise {"ok":true,} tail';
    const v = extractJsonFromLlmTextLenient(raw) as { ok?: boolean };
    expect(v?.ok).toBe(true);
  });
});
