/**
 * Preset TTS voices catalog.
 * Provider: openai = OpenAI TTS (tts-1 / tts-1-hd).
 * Add elevenlabs/playht when API keys are configured.
 */

export type VoiceGender = "male" | "female" | "neutral";

export interface PresetVoice {
  id: string;
  name: string;
  description: string;
  provider: "openai";
  providerVoiceId: string;
  language: string;
  accent: string;
  gender: VoiceGender;
  highQuality: boolean;
}

export const PRESET_VOICES: PresetVoice[] = [
  { id: "alloy", name: "Alloy", description: "Neutral & balanced", provider: "openai", providerVoiceId: "alloy", language: "English", accent: "American", gender: "neutral", highQuality: true },
  { id: "echo", name: "Echo", description: "Friendly guy next door", provider: "openai", providerVoiceId: "echo", language: "English", accent: "American", gender: "male", highQuality: true },
  { id: "fable", name: "Fable", description: "Warm & reflective", provider: "openai", providerVoiceId: "fable", language: "English", accent: "British", gender: "male", highQuality: true },
  { id: "onyx", name: "Onyx", description: "Deep & authoritative", provider: "openai", providerVoiceId: "onyx", language: "English", accent: "American", gender: "male", highQuality: true },
  { id: "nova", name: "Nova", description: "Clear & professional", provider: "openai", providerVoiceId: "nova", language: "English", accent: "American", gender: "female", highQuality: true },
  { id: "shimmer", name: "Shimmer", description: "Warm & approachable", provider: "openai", providerVoiceId: "shimmer", language: "English", accent: "American", gender: "female", highQuality: true },
  { id: "ash", name: "Ash", description: "Calm & measured", provider: "openai", providerVoiceId: "ash", language: "English", accent: "American", gender: "male", highQuality: true },
  { id: "coral", name: "Coral", description: "Enthusiastic & engaging", provider: "openai", providerVoiceId: "coral", language: "English", accent: "American", gender: "female", highQuality: true },
  { id: "sage", name: "Sage", description: "Thoughtful & steady", provider: "openai", providerVoiceId: "sage", language: "English", accent: "American", gender: "male", highQuality: true },
  { id: "verse", name: "Verse", description: "Articulate & expressive", provider: "openai", providerVoiceId: "verse", language: "English", accent: "American", gender: "male", highQuality: true },
  { id: "ballad", name: "Ballad", description: "Smooth & lyrical", provider: "openai", providerVoiceId: "ballad", language: "English", accent: "American", gender: "male", highQuality: true },
  { id: "marin", name: "Marin", description: "Natural & conversational", provider: "openai", providerVoiceId: "marin", language: "English", accent: "American", gender: "female", highQuality: true },
  { id: "cedar", name: "Cedar", description: "Confident & direct", provider: "openai", providerVoiceId: "cedar", language: "English", accent: "American", gender: "male", highQuality: true },
];

export function filterPresetVoices(opts: {
  language?: string;
  accent?: string;
  gender?: string;
  highQualityOnly?: boolean;
  search?: string;
}): PresetVoice[] {
  let out = [...PRESET_VOICES];
  if (opts.language && opts.language !== "all") {
    out = out.filter((v) => v.language.toLowerCase() === opts.language!.toLowerCase());
  }
  if (opts.accent && opts.accent !== "all") {
    out = out.filter((v) => v.accent.toLowerCase() === opts.accent!.toLowerCase());
  }
  if (opts.gender && opts.gender !== "all") {
    out = out.filter((v) => v.gender === opts.gender);
  }
  if (opts.highQualityOnly) {
    out = out.filter((v) => v.highQuality);
  }
  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim().toLowerCase();
    out = out.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.accent.toLowerCase().includes(q)
    );
  }
  return out;
}
