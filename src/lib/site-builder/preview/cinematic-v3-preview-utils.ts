/**
 * Pure helpers for Cinematic Rendering v3 (Site Builder live preview only).
 * No planner / layout-family / variant-engine changes.
 */

export type CinematicMotionType = "parallax" | "fade" | "slide";

export type CinematicMotionPayload = {
  type: CinematicMotionType;
  /** 0–1, default 0.5 */
  intensity: number;
};

const DEFAULT_INTENSITY = 0.5;

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Read `content.motion.cinematic` from a preview block.
 */
export function parseCinematicMotionFromBlock(block: unknown): CinematicMotionPayload | null {
  const b = block as { content?: unknown } | null | undefined;
  const c = b?.content;
  if (!isRecord(c)) return null;
  const m = c.motion;
  if (!isRecord(m)) return null;
  const cin = m.cinematic;
  if (!isRecord(cin)) return null;
  const type = typeof cin.type === "string" ? cin.type : "";
  if (type !== "parallax" && type !== "fade" && type !== "slide") return null;
  const raw = typeof cin.intensity === "number" && Number.isFinite(cin.intensity) ? cin.intensity : DEFAULT_INTENSITY;
  const intensity = Math.max(0, Math.min(1, raw));
  return { type, intensity };
}

/** Unsplash source — abstract texture; no API key. */
const UNSPLASH_OVERLAY_IDS = [
  "photo-1451187580459-43490279c0fa",
  "photo-1506318137071-a8e063b4bec0",
  "photo-1614850523459-c2f4c699c52e",
  "photo-1534796636912-3b95b0ab2306",
];

export function getCinematicImageOverlayPlaceholderUrl(seed: string, width = 1920): string {
  const id = Math.abs(simpleHash(seed)) % UNSPLASH_OVERLAY_IDS.length;
  const key = UNSPLASH_OVERLAY_IDS[id]!;
  return `https://images.unsplash.com/${key}?auto=format&fit=crop&w=${width}&q=80`;
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function previewMotionIntensityFromTheme(
  visualBoost: { motionIntensity?: number; motionHint?: string } | null | undefined,
  theme?: { motionHint?: string; gradientStyle?: string },
): number {
  if (typeof visualBoost?.motionIntensity === "number" && Number.isFinite(visualBoost.motionIntensity)) {
    return Math.max(0, Math.min(1, visualBoost.motionIntensity));
  }
  const hint = theme?.motionHint || visualBoost?.motionHint;
  if (hint === "floating-orbs" || theme?.gradientStyle === "neon-radial") return 0.88;
  if (hint === "scroll-reveal" || hint === "subtle-parallax") return 0.6;
  if (hint && hint !== "none") return 0.45;
  return 0.4;
}

export function shouldRunHeavyCinematicPreview(opts: {
  prefersReducedMotion: boolean;
  saveData: boolean;
  lowMemory: boolean;
}): boolean {
  if (opts.prefersReducedMotion) return false;
  if (opts.saveData) return false;
  if (opts.lowMemory) return false;
  return true;
}

export function detectLowDeviceMemoryHeuristic(): boolean {
  if (typeof window === "undefined" || !("deviceMemory" in navigator)) return false;
  const dm = (navigator as { deviceMemory?: number }).deviceMemory;
  return typeof dm === "number" && dm <= 4;
}

export function detectSaveDataConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const c = (navigator as { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}
