import type { ExecutiveCommandPromptId } from "@/lib/executive-agent/executive-command-prompts";

export type CommandFocusState = {
  active: boolean;
  dimSurroundings: number;
  hudScale: number;
  orbFocusGlow: number;
  railOpacity: number;
};

export function commandFocusFromPrompt(activePromptId: ExecutiveCommandPromptId | null): CommandFocusState {
  if (!activePromptId) {
    return {
      active: false,
      dimSurroundings: 0,
      hudScale: 1,
      orbFocusGlow: 0.28,
      railOpacity: 1,
    };
  }
  return {
    active: true,
    dimSurroundings: 0.42,
    hudScale: 1.012,
    orbFocusGlow: 0.52,
    railOpacity: 0.72,
  };
}

export function commandFocusCssVars(focus: CommandFocusState): Record<string, string> {
  return {
    ["--cmd-focus-dim"]: String(focus.dimSurroundings),
    ["--cmd-focus-hud-scale"]: String(focus.hudScale),
    ["--cmd-focus-orb-glow"]: String(focus.orbFocusGlow),
    ["--cmd-focus-rail-opacity"]: String(focus.railOpacity),
  };
}
