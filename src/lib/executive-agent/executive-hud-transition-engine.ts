import type { ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";

export type HudTransitionPhase = "idle" | "activating" | "active" | "scanning" | "transitioning";

export type HudTransitionTokens = {
  phase: HudTransitionPhase;
  overlayOpacity: number;
  contentTranslateY: number;
  scanActive: boolean;
  hologramShift: number;
  borderGlow: number;
};

export function hudTransitionForPrompt(
  activePromptId: ExecutiveCommandPromptId | null,
  previousId: ExecutiveCommandPromptId | null,
  activating: boolean,
): HudTransitionTokens {
  if (!activePromptId) {
    return {
      phase: "idle",
      overlayOpacity: 0.08,
      contentTranslateY: 0,
      scanActive: false,
      hologramShift: 0,
      borderGlow: 0.25,
    };
  }
  const transitioning = previousId != null && previousId !== activePromptId;
  return {
    phase: activating ? "activating" : transitioning ? "transitioning" : "active",
    overlayOpacity: activating ? 0.22 : transitioning ? 0.16 : 0.12,
    contentTranslateY: activating ? 8 : transitioning ? 4 : 0,
    scanActive: activating || transitioning,
    hologramShift: activating ? 1 : transitioning ? 0.6 : 0.25,
    borderGlow: activating ? 0.55 : transitioning ? 0.42 : 0.35,
  };
}

export function hudTransitionClassNames(tokens: HudTransitionTokens): string {
  const parts = ["executive-hud-shell"];
  parts.push(`executive-hud-phase-${tokens.phase}`);
  if (tokens.scanActive) parts.push("executive-hud-scanning");
  return parts.join(" ");
}

export function hudTransitionStyleRecord(tokens: HudTransitionTokens): Record<string, string | number> {
  return {
    ["--hud-overlay-opacity"]: String(tokens.overlayOpacity),
    ["--hud-translate-y"]: `${tokens.contentTranslateY}px`,
    ["--hud-hologram"]: String(tokens.hologramShift),
    ["--hud-border-glow"]: String(tokens.borderGlow),
  };
}
