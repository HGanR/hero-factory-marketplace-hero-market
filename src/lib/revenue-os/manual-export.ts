/**
 * Manual export packages for blocked / manual distribution targets.
 */

import type { ConnectorRoutingStatus } from "@/lib/revenue-os/distribution-routing";

export type ManualExportPackage = {
  platform: string;
  format: string;
  captionOrBody: string;
  hashtags: string[];
  cta: string;
  assetInstructions: string;
  postingNotes: string;
  routingStatus: ConnectorRoutingStatus;
};

export type BuildManualExportPackageInput = {
  platform: string;
  targetFormat: string;
  caption?: string;
  body?: string;
  hashtags?: string[];
  cta?: string;
  mediaPrompt?: string;
  assetRefs?: string[];
  routingStatus: ConnectorRoutingStatus;
  extraNotes?: string[];
};

export function buildManualExportPackage(input: BuildManualExportPackageInput): ManualExportPackage {
  const captionOrBody = [input.caption, input.body].filter(Boolean).join("\n\n").trim() || "(no copy — add in native app)";
  const hashtags = (input.hashtags ?? []).map((t) => (t.startsWith("#") ? t : `#${t}`));
  const cta = (input.cta ?? "").trim() || "—";
  const assetParts = [
    input.mediaPrompt ? `Media / creative: ${input.mediaPrompt}` : "",
    input.assetRefs?.length ? `Assets: ${input.assetRefs.join(", ")}` : "",
  ].filter(Boolean);
  const postingNotes = [
    `Export for ${input.platform} (${input.targetFormat}).`,
    ...((input.extraNotes ?? []).filter(Boolean)),
    input.routingStatus === "blocked_no_connector"
      ? "No OAuth connector — paste into the native app."
      : input.routingStatus === "blocked_capability_mismatch"
        ? "Format mismatch — shorten or change asset type before posting."
        : input.routingStatus === "requires_manual_export"
          ? "Automated publish unavailable — use native scheduling or upload."
          : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    platform: input.platform,
    format: input.targetFormat,
    captionOrBody,
    hashtags,
    cta,
    assetInstructions: assetParts.join("\n") || "Attach native image/video per platform specs.",
    postingNotes,
    routingStatus: input.routingStatus,
  };
}
