import type { StreamDestinationRow } from "@/lib/db/schema";

export const STREAM_PLATFORMS = [
  "instagram",
  "facebook",
  "twitch",
  "tiktok",
  "pumpfun",
  "custom",
] as const;

export type StreamPlatform = (typeof STREAM_PLATFORMS)[number];

export function normalizeStreamPlatform(raw: string): StreamPlatform | null {
  const p = raw.trim().toLowerCase();
  if (p === "pump.fun" || p === "pump_fun") return "pumpfun";
  if ((STREAM_PLATFORMS as readonly string[]).includes(p)) return p as StreamPlatform;
  return null;
}

export interface DestinationInput {
  platform: string;
  label?: string;
  serverUrl?: string;
  streamKey: string;
  orientationPreference?: string;
  isActive?: boolean;
}

export interface DestinationValidationResult {
  ok: boolean;
  errors: string[];
  platform: StreamPlatform | null;
}

const ORIENTATIONS = new Set(["auto", "portrait", "landscape"]);

export function validateDestinationInput(input: DestinationInput): DestinationValidationResult {
  const errors: string[] = [];
  const platform = normalizeStreamPlatform(input.platform);
  if (!platform) errors.push("Invalid platform");

  const streamKey = (input.streamKey ?? "").trim();
  if (!streamKey) errors.push("Stream key is required");

  const label = (input.label ?? "").trim();
  if (label.length > 120) errors.push("Label too long");

  const serverUrl = (input.serverUrl ?? "").trim();
  if (platform === "custom" && !serverUrl) {
    errors.push("Custom platform requires server URL");
  }
  if (serverUrl.length > 1024) errors.push("Server URL too long");

  const orientation = (input.orientationPreference ?? "auto").trim().toLowerCase();
  if (!ORIENTATIONS.has(orientation)) {
    errors.push("orientationPreference must be auto, portrait, or landscape");
  }

  return {
    ok: errors.length === 0,
    errors,
    platform,
  };
}

/** Stable JSON `code` when POST/PATCH cannot persist credentials (client + support). */
export const STREAM_DESTINATION_ENCRYPTION_NOT_CONFIGURED = "stream_destination_encryption_not_configured" as const;

/** Public shape for API responses — never includes ciphertext or full key. */
export function toPublicDestination(row: StreamDestinationRow) {
  return {
    id: row.id,
    platform: row.platform,
    label: row.label,
    serverUrl: row.serverUrl,
    streamKeyLast4: row.streamKeyLast4,
    orientationPreference: row.orientationPreference,
    isActive: Boolean(row.isActive),
    requiresManualGoLive: Boolean(row.requiresManualGoLive),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastTestedAt: row.lastTestedAt,
  };
}
