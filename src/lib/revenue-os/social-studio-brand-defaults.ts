export type SocialStudioBrandDefaults = {
  brandName: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  /** Short tone note for copy (optional) */
  toneHint: string | null;
};

const DEFAULT_ACCENT = "#00D1FF";
const DEFAULT_BG = "#0b1224";

function pickString(o: unknown, ...keys: string[]): string | null {
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function isHexColor(s: string): boolean {
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(s);
}

/**
 * Resolves display + color defaults for Social Studio native cards from governed campaign (and optional Bentleys JSON).
 * Never throws — always returns safe strings for SVG.
 */
export function resolveSocialStudioBrandDefaults(camp: {
  name: string | null;
  bentleyGenerationJson?: unknown;
}): SocialStudioBrandDefaults {
  const brandName = typeof camp.name === "string" && camp.name.trim() ? camp.name.trim() : "Your brand";
  const gen = (camp as { bentleyGenerationJson?: unknown }).bentleyGenerationJson;
  let primaryColor = pickString(gen, "accentColor", "primaryColor", "brandAccent", "accent") ?? DEFAULT_ACCENT;
  if (!isHexColor(primaryColor)) primaryColor = DEFAULT_ACCENT;
  let secondaryColor = pickString(gen, "backgroundColor", "secondaryColor", "pageBackground") ?? DEFAULT_BG;
  if (!isHexColor(secondaryColor)) secondaryColor = DEFAULT_BG;
  const logoUrl = pickString(gen, "logoUrl", "brandLogoUrl");
  const toneHint = pickString(gen, "brandTone", "tone", "voiceTone");
  return {
    brandName,
    primaryColor,
    secondaryColor: secondaryColor,
    logoUrl: logoUrl && /^https?:\/\//i.test(logoUrl) ? logoUrl : null,
    toneHint,
  };
}
