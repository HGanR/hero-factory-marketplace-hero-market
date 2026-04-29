/** Shared JSON extraction from LLM text (markdown fences or raw object). */

function stripTrailingCommasInJsonSlice(slice: string): string {
  let s = slice;
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/,(\s*[}\]])/g, "$1");
  }
  return s;
}

/**
 * Second-pass parse: trailing commas and common LLM JSON noise after brace extraction.
 */
export function extractJsonFromLlmTextLenient(text: string): unknown | null {
  if (!text) return null;
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart === -1 || braceEnd <= braceStart) return null;
  const slice = stripTrailingCommasInJsonSlice(text.slice(braceStart, braceEnd + 1));
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

export function extractJsonFromLlmText(text: string): unknown | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const lenientEarly = extractJsonFromLlmTextLenient(text);
    if (lenientEarly) return lenientEarly;
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        try {
          return JSON.parse(stripTrailingCommasInJsonSlice(match[1].trim()));
        } catch {
          /* continue */
        }
      }
    }
    const braceStart = text.indexOf("{");
    const braceEnd = text.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        return JSON.parse(text.slice(braceStart, braceEnd + 1));
      } catch {
        return extractJsonFromLlmTextLenient(text);
      }
    }
  }
  return null;
}
