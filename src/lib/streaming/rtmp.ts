import type { StreamPlatform } from "./destinations";
import { getProviderCapabilities } from "./provider-capabilities";

export interface ResolveRtmpInput {
  platform: StreamPlatform;
  /** User-provided ingest base (may be empty for well-known platforms). */
  serverUrl: string;
  streamKey: string;
  /** LiveKit /meet layout hint for orientation warnings. */
  meetingLayout?: string;
  orientationPreference?: string;
}

export interface ResolveRtmpResult {
  finalOutputUrl: string;
  requiresManualGoLive: boolean;
  warnings: string[];
}

function joinRtmpBaseAndKey(base: string, key: string): string {
  const b = base.trim().replace(/\/+$/, "");
  const k = key.trim().replace(/^\/+/, "");
  return `${b}/${k}`;
}

function layoutSuggestsLandscape(layout?: string): boolean {
  if (!layout) return true;
  const l = layout.toLowerCase();
  return l.includes("grid") || l.includes("speaker");
}

function pushUnique(warnings: string[], line: string) {
  if (!warnings.includes(line)) warnings.push(line);
}

/**
 * Default ingest endpoints — verify in provider docs; capability map drives product warnings.
 */
const DEFAULT_BASE: Partial<Record<StreamPlatform, string>> = {
  twitch: "rtmp://live.twitch.tv/app",
  instagram: "rtmps://live-upload.instagram.com:443/rtmp",
  facebook: "",
  tiktok: "rtmp://push.tiktok.com/live",
  pumpfun: "",
  custom: "",
};

export function maskRtmpOutputUrl(fullUrl: string, last4: string): string {
  const u = fullUrl.trim();
  const idx = u.lastIndexOf("/");
  if (idx < 0) return `****${last4}`;
  const base = u.slice(0, idx + 1);
  return `${base}****${last4}`;
}

/** Structural check before LiveKit egress (preflight). */
export function isValidRtmpIngestUrl(url: string): boolean {
  const u = url.trim();
  if (!/^rtmps?:\/\//i.test(u)) return false;
  const withoutScheme = u.replace(/^rtmps?:\/\//i, "");
  return withoutScheme.includes("/") && withoutScheme.length > 3;
}

/** @deprecated Prefer getProviderCapabilities(platform).isStableIngest in new code. */
export function isVariableProviderIngest(platform: string): boolean {
  return !getProviderCapabilities(platform).isStableIngest;
}

export function resolveRtmpDestination(input: ResolveRtmpInput): ResolveRtmpResult {
  const warnings: string[] = [];
  let base = (input.serverUrl ?? "").trim();
  const key = input.streamKey.trim();
  const platform = input.platform;
  const cap = getProviderCapabilities(platform);

  for (const line of cap.resolverWarningLines) {
    pushUnique(warnings, line);
  }

  const orient = (input.orientationPreference ?? "auto").toLowerCase();
  if (cap.supportsPortrait && orient === "auto" && layoutSuggestsLandscape(input.meetingLayout)) {
    pushUnique(
      warnings,
      "Portrait orientation recommended for this provider — set destination orientation or adjust meeting layout if the preview looks wrong."
    );
  }

  if (platform === "twitch") {
    if (!base) base = DEFAULT_BASE.twitch!;
  } else if (platform === "instagram") {
    if (!base) base = DEFAULT_BASE.instagram!;
  } else if (platform === "tiktok") {
    if (!base) base = DEFAULT_BASE.tiktok!;
  } else if (platform === "custom" || platform === "pumpfun") {
    if (!base) {
      return {
        finalOutputUrl: "",
        requiresManualGoLive: cap.requiresManualGoLive,
        warnings: [...warnings, "server_url is required for this platform"],
      };
    }
  } else if (platform === "facebook") {
    if (!base) {
      return {
        finalOutputUrl: "",
        requiresManualGoLive: cap.requiresManualGoLive,
        warnings,
      };
    }
  }

  const finalOutputUrl = joinRtmpBaseAndKey(base, key);

  if (!/^rtmps?:\/\//i.test(finalOutputUrl)) {
    pushUnique(warnings, "Output URL should start with rtmp:// or rtmps://");
  }

  warnings.push(...orientationWarnings(input.orientationPreference ?? "auto", input.meetingLayout));

  return {
    finalOutputUrl,
    requiresManualGoLive: cap.requiresManualGoLive,
    warnings,
  };
}

/** Merge stored orientation_preference into resolver warnings (pure). */
export function orientationWarnings(
  orientationPreference: string,
  meetingLayout?: string
): string[] {
  const o = orientationPreference.toLowerCase();
  const w: string[] = [];
  if (o === "portrait" && layoutSuggestsLandscape(meetingLayout)) {
    w.push("Destination prefers portrait but meeting layout is grid/speaker (landscape-style).");
  }
  if (o === "landscape" && meetingLayout?.toLowerCase().includes("single")) {
    w.push("Destination prefers landscape; single-speaker layout may look tall on some platforms.");
  }
  return w;
}
