/**
 * Common languages for AI agents and NPCs.
 * When selected, the agent/NPC will speak and respond in that language.
 */
export const COMMON_LANGUAGES = [
  { value: "", label: "Default (match user)" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "pt-BR", label: "Portuguese (Brazil)" },
  { value: "zh", label: "Chinese (Simplified)" },
  { value: "zh-TW", label: "Chinese (Traditional)" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "tr", label: "Turkish" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "id", label: "Indonesian" },
] as const;

export type CommonLanguageCode = (typeof COMMON_LANGUAGES)[number]["value"];

export function getLanguageLabel(code: string): string {
  const found = COMMON_LANGUAGES.find((l) => l.value === code);
  return (found?.label) ?? (code || "Default");
}
