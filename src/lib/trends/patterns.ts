/**
 * Format detection rules for inferring Trend Packet from trend card title/description.
 * Maps winning content patterns to format + hook type.
 */
export const FORMAT_RULES: Array<{
  match: RegExp;
  format: "how_to" | "mistakes" | "pov" | "hacks" | "tools_stack" | "case_study" | "worth_it_debate";
  hookType: "pov" | "contrarian" | "fear_avoidance" | "curiosity" | "do_this_not_that" | "proof_first";
}> = [
  {
    match: /beginner|roadmap|how to start/i,
    format: "how_to",
    hookType: "curiosity",
  },
  {
    match: /mistakes to avoid|top \d+|avoid/i,
    format: "mistakes",
    hookType: "fear_avoidance",
  },
  {
    match: /^pov:/i,
    format: "pov",
    hookType: "pov",
  },
  {
    match: /hacks|in \d+ seconds|3 tips/i,
    format: "hacks",
    hookType: "do_this_not_that",
  },
  {
    match: /tools stack|stack|tool/i,
    format: "tools_stack",
    hookType: "proof_first",
  },
  {
    match: /case study|here's what happened|i tried/i,
    format: "case_study",
    hookType: "proof_first",
  },
  {
    match: /worth it|\?$/i,
    format: "worth_it_debate",
    hookType: "contrarian",
  },
];
