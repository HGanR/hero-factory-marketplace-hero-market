import type { StreamPlatform } from "./destinations";
import { normalizeStreamPlatform } from "./destinations";

export type ProviderCapabilities = {
  platform: string;
  isStableIngest: boolean;
  requiresManualGoLive: boolean;
  supportsPortrait: boolean;
  notes: string;
  /** Appended by RTMP resolver (preflight / UI copy). Keep non-technical product language. */
  resolverWarningLines: string[];
};

type CapabilityRow = Omit<ProviderCapabilities, "platform">;

const CUSTOM_DEFAULT: CapabilityRow = {
  isStableIngest: false,
  requiresManualGoLive: false,
  supportsPortrait: false,
  notes: "Custom RTMP depends entirely on the provider; verify URL, key rotation, and go-live steps in their docs.",
  resolverWarningLines: [
    "Custom RTMP: confirm ingest URL and stream key with your provider — behavior varies by service.",
  ],
};

/**
 * Canonical provider capability map (UI + resolver + audits).
 * `isStableIngest: false` → “Best effort” in product UI.
 */
export const PROVIDER_CAPABILITIES: Record<StreamPlatform, CapabilityRow> = {
  twitch: {
    isStableIngest: true,
    requiresManualGoLive: false,
    supportsPortrait: false,
    notes: "Twitch RTMP ingest is well-documented and typically stable for encoder-style workflows.",
    resolverWarningLines: [],
  },
  facebook: {
    isStableIngest: false,
    requiresManualGoLive: true,
    supportsPortrait: false,
    notes: "Meta Live Producer varies by page and region; go-live often required in the Meta UI after connect.",
    resolverWarningLines: [
      "Facebook / Meta: ingest host is usually page-specific — paste server URL from Live Producer.",
      "Facebook typically requires manual Go Live in Meta after the encoder connects.",
    ],
  },
  instagram: {
    isStableIngest: false,
    requiresManualGoLive: true,
    supportsPortrait: true,
    notes: "Instagram Live is mobile/Creator Studio–centric; RTMP is secondary and flows change.",
    resolverWarningLines: [
      "Instagram typically requires manual go-live from the app or Creator Studio; RTMP alone may not start the public Live.",
      "Portrait orientation is often recommended for Instagram Live — check preview on device.",
    ],
  },
  tiktok: {
    isStableIngest: false,
    requiresManualGoLive: true,
    supportsPortrait: true,
    notes: "TikTok RTMP URLs and keys expire; Live Center UX changes frequently.",
    resolverWarningLines: [
      "TikTok ingest may not be stable — URL and key often expire between sessions; confirm in Live Center.",
      "TikTok may require confirming Go Live in the app after the encoder connects.",
      "Portrait orientation is commonly expected for TikTok Live.",
    ],
  },
  pumpfun: {
    isStableIngest: false,
    requiresManualGoLive: true,
    supportsPortrait: false,
    notes: "No standardized public RTMP contract; treat as custom ingest with provider guidance.",
    resolverWarningLines: [
      "Pump.fun: public RTMP ingest is not standardized here — use a provider-supplied URL or custom platform.",
    ],
  },
  custom: CUSTOM_DEFAULT,
};

export function getProviderCapabilities(platform: string): ProviderCapabilities {
  const norm = normalizeStreamPlatform(platform);
  const key = norm ?? "custom";
  const row = PROVIDER_CAPABILITIES[key] ?? CUSTOM_DEFAULT;
  return { platform: key, ...row };
}

/** Compact snapshot for audits (no secrets). e.g. "twitch:stable|tiktok:best_effort" */
export function providerCapabilitiesSnapshot(platforms: string[]): string {
  const uniq = [...new Set(platforms.map((p) => p.toLowerCase()))];
  const parts = uniq.map((p) => {
    const c = getProviderCapabilities(p);
    return `${c.platform}:${c.isStableIngest ? "stable" : "best_effort"}`;
  });
  return parts.join("|").slice(0, 500);
}
