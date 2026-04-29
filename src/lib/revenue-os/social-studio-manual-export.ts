import type { SocialStudioPublishMode } from "@/lib/revenue-os/bentley-social-studio-hints";

export type SocialStudioExportPayload = {
  version: 1;
  runId: string;
  campaignId: string | null;
  clientId: string | null;
  topic: string;
  imageTemplate: string;
  imageAspect: string;
  hostPublishReady: boolean;
  publishMode: SocialStudioPublishMode;
  /** Why in-app may be limited */
  directPublishNarrative: string[];
  captions: Record<string, { caption: string; hashtags: string }>;
  image: { url: string | null; hasSvg: boolean; hasDataUrl: boolean };
  postingInstructions: string[];
};

export function buildSocialStudioManualExportPayload(args: {
  runId: string;
  campaignId: string | null;
  clientId: string | null;
  topic: string;
  imageTemplate: string;
  imageAspect: string;
  hostPublishReady: boolean;
  publishMode: { mode: SocialStudioPublishMode; lines: string[] };
  captions: Record<string, { caption: string; hashtags: string }>;
  storageUrl: string | null;
  hasSvg: boolean;
}): SocialStudioExportPayload {
  return {
    version: 1,
    runId: args.runId,
    campaignId: args.campaignId,
    clientId: args.clientId,
    topic: args.topic,
    imageTemplate: args.imageTemplate,
    imageAspect: args.imageAspect,
    hostPublishReady: args.hostPublishReady,
    publishMode: args.publishMode.mode,
    directPublishNarrative: args.publishMode.lines,
    captions: args.captions,
    image: {
      url: args.storageUrl,
      hasSvg: args.hasSvg,
      hasDataUrl: Boolean(args.storageUrl?.startsWith("data:")),
    },
    postingInstructions: [
      "Open each target network in its native app or web composer.",
      "Upload the image (or paste from downloaded SVG/PNG). Paste caption + hashtags.",
      "If the export notes hosted HTTPS is required (Meta/IG), upload the asset to a CDN or enable Pinata for Social Studio first.",
      "If in-app direct publish is unavailable, this package is the consultant handoff — no duplicate rows are created in the planner when posting manually outside Revenue OS.",
    ],
  };
}
