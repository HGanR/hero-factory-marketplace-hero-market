/**
 * Platform-specific copy blocks for manual posting (no API automation).
 */

import type { ContentEngineOutput } from "@/lib/revenue-os/content-engine-types";

export type DeployPlatformPreset = "tiktok" | "instagram" | "youtube" | "generic";

export function inferDeployPreset(platformLabel: string): DeployPlatformPreset {
  const p = platformLabel.toLowerCase();
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("instagram")) return "instagram";
  if (p.includes("youtube")) return "youtube";
  return "generic";
}

export function splitHookCaptionCta(output: ContentEngineOutput): {
  hook: string;
  caption: string;
  cta: string;
} {
  const hook =
    output.captions?.hook?.trim() ||
    output.hooks?.[0]?.trim() ||
    output.fullPost?.caption?.split("\n")[0]?.trim() ||
    "";
  const caption = output.fullPost?.caption?.trim() || output.captions?.shortViral?.trim() || "";
  const cta =
    output.fullPost?.content?.split("\n").slice(-3).join("\n").trim() ||
    output.captions?.curiosity?.trim() ||
    "Comment below to continue the conversation.";
  return { hook, caption, cta };
}

export function formatDeployPlainText(
  preset: DeployPlatformPreset,
  output: ContentEngineOutput,
  businessLabel: string
): string {
  const { hook, caption, cta } = splitHookCaptionCta(output);
  const tags = (output.fullPost?.hashtags ?? []).join(" ");

  const header =
    preset === "tiktok"
      ? "[TikTok — short on-screen + caption]"
      : preset === "instagram"
        ? "[Instagram — caption + first-line hook]"
        : preset === "youtube"
          ? "[YouTube — title + description + pinned comment]"
          : "[Generic]";

  const lines = [
    header,
    "",
    `Hook: ${hook}`,
    "",
    `Caption / body:`,
    caption,
    "",
    `CTA:`,
    cta,
    "",
    tags ? `Hashtags: ${tags}` : "",
    "",
    `— Packaged from Content Engine for ${businessLabel}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export function buildContentDeployPayload(output: ContentEngineOutput, platformLabel: string) {
  const preset = inferDeployPreset(platformLabel);
  const split = splitHookCaptionCta(output);
  return {
    preset,
    platformLabel,
    ...split,
    fullPost: output.fullPost,
    captions: output.captions,
    hooks: output.hooks?.slice(0, 10),
    viralIdeas: output.viralIdeas,
    imagePrompts: output.imagePrompts,
  };
}
