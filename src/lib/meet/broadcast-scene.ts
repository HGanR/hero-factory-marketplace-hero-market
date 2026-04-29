/**
 * V1 broadcast program scene model (metadata + LiveKit layout mapping).
 * Custom compositor / overlays are a later phase; this layer stores intent only.
 */

export const BROADCAST_LAYOUT_MODES = [
  "speaker",
  "gallery",
  "screenshare_focus",
  "portrait_speaker",
  "portrait_split",
] as const;

export type BroadcastLayoutMode = (typeof BROADCAST_LAYOUT_MODES)[number];

export type BroadcastBranding = {
  logoUrl?: string;
  brandName?: string;
  footerText?: string;
  /** Optional #RRGGBB */
  accentHex?: string;
};

export type BroadcastSceneConfig = {
  layoutMode: BroadcastLayoutMode;
  branding: BroadcastBranding;
  showParticipantNames: boolean;
  showMutedIndicators: boolean;
  showFooter: boolean;
  portraitSafe: boolean;
  screenSharePriority: boolean;
};

/** Persisted on sessions; optional preset provenance. */
export type BroadcastSceneSnapshot = BroadcastSceneConfig & {
  appliedPresetId?: number | null;
  appliedPresetName?: string | null;
};

const LEGACY_MEETING_LAYOUT_TO_SCENE: Record<string, BroadcastLayoutMode> = {
  grid: "gallery",
  speaker: "speaker",
  "single-speaker": "portrait_speaker",
};

export function legacyMeetingLayoutToSceneLayout(legacy: string): BroadcastLayoutMode {
  const k = legacy.toLowerCase().trim();
  return LEGACY_MEETING_LAYOUT_TO_SCENE[k] ?? "gallery";
}

/** Infer product scene layout from the LiveKit composite string stored on sessions. */
export function liveKitLayoutToSceneLayout(lk: string): BroadcastLayoutMode {
  switch (lk.toLowerCase().trim()) {
    case "grid":
      return "gallery";
    case "speaker":
      return "speaker";
    case "single-speaker":
      return "portrait_speaker";
    default:
      return "gallery";
  }
}

export function getDefaultSceneConfig(): BroadcastSceneConfig {
  return {
    layoutMode: "gallery",
    branding: {},
    showParticipantNames: true,
    showMutedIndicators: true,
    showFooter: false,
    portraitSafe: false,
    screenSharePriority: false,
  };
}

export function getSceneConfigForOrientation(
  orientation: "portrait" | "landscape" | "auto",
  layoutMode?: BroadcastLayoutMode
): BroadcastSceneConfig {
  const base = getDefaultSceneConfig();
  if (layoutMode) base.layoutMode = layoutMode;
  if (orientation === "portrait") {
    base.layoutMode = base.layoutMode.startsWith("portrait_") ? base.layoutMode : "portrait_speaker";
    base.portraitSafe = true;
  }
  return base;
}

const HEX = /^#?[0-9A-Fa-f]{6}$/;

export function validateSceneConfig(
  input: unknown,
  options: { partial?: boolean } = {}
): { ok: true; config: BroadcastSceneConfig } | { ok: false; errors: string[] } {
  const defaults = getDefaultSceneConfig();
  const errors: string[] = [];
  const partial = Boolean(options.partial);

  if (input == null || typeof input !== "object") {
    if (partial) return { ok: true, config: defaults };
    return { ok: false, errors: ["sceneConfig must be an object"] };
  }

  const o = input as Record<string, unknown>;

  let layoutMode: BroadcastLayoutMode = defaults.layoutMode;
  if (o.layoutMode != null) {
    const lm = String(o.layoutMode).trim();
    if (!BROADCAST_LAYOUT_MODES.includes(lm as BroadcastLayoutMode)) {
      errors.push(`Invalid layoutMode: ${lm}`);
    } else {
      layoutMode = lm as BroadcastLayoutMode;
    }
  } else if (!partial) {
    layoutMode = defaults.layoutMode;
  }

  const brandingIn = o.branding;
  const branding: BroadcastBranding =
    brandingIn != null && typeof brandingIn === "object" ? { ...(brandingIn as BroadcastBranding) } : {};

  if (branding.logoUrl != null) {
    const u = String(branding.logoUrl).trim();
    if (u.length > 2048) errors.push("logoUrl too long");
    else if (u.length > 0 && !/^https:\/\//i.test(u)) errors.push("logoUrl must be https or empty");
    else branding.logoUrl = u || undefined;
  }
  if (branding.brandName != null) {
    const n = String(branding.brandName).trim();
    if (n.length > 120) errors.push("brandName too long");
    else branding.brandName = n || undefined;
  }
  if (branding.footerText != null) {
    const f = String(branding.footerText).trim();
    if (f.length > 240) errors.push("footerText too long");
    else branding.footerText = f || undefined;
  }
  if (branding.accentHex != null) {
    const h = String(branding.accentHex).trim();
    if (h && !HEX.test(h)) errors.push("accentHex must be #RRGGBB");
    else branding.accentHex = h ? (h.startsWith("#") ? h : `#${h}`) : undefined;
  }

  const showParticipantNames =
    o.showParticipantNames != null ? Boolean(o.showParticipantNames) : defaults.showParticipantNames;
  const showMutedIndicators =
    o.showMutedIndicators != null ? Boolean(o.showMutedIndicators) : defaults.showMutedIndicators;
  const showFooter = o.showFooter != null ? Boolean(o.showFooter) : defaults.showFooter;
  const portraitSafe = o.portraitSafe != null ? Boolean(o.portraitSafe) : defaults.portraitSafe;
  const screenSharePriority =
    o.screenSharePriority != null ? Boolean(o.screenSharePriority) : defaults.screenSharePriority;

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    config: {
      layoutMode,
      branding,
      showParticipantNames,
      showMutedIndicators,
      showFooter,
      portraitSafe,
      screenSharePriority,
    },
  };
}

/**
 * Maps product scene layout to LiveKit room composite layout strings (V1).
 */
export function mapBroadcastSceneToLiveKitLayout(layoutMode: BroadcastLayoutMode): {
  liveKitLayout: "grid" | "speaker" | "single-speaker";
  egressMappingWarnings: string[];
} {
  const egressMappingWarnings: string[] = [];
  switch (layoutMode) {
    case "gallery":
      return { liveKitLayout: "grid", egressMappingWarnings };
    case "speaker":
      return { liveKitLayout: "speaker", egressMappingWarnings };
    case "screenshare_focus":
      egressMappingWarnings.push(
        "Screen-share priority is stored as intent; LiveKit egress uses speaker layout until a custom compositor phase."
      );
      return { liveKitLayout: "speaker", egressMappingWarnings };
    case "portrait_speaker":
      return { liveKitLayout: "single-speaker", egressMappingWarnings };
    case "portrait_split":
      egressMappingWarnings.push(
        "Portrait split maps to grid composite for V1 egress; framing may differ from a true split program."
      );
      return { liveKitLayout: "grid", egressMappingWarnings };
    default:
      return { liveKitLayout: "grid", egressMappingWarnings };
  }
}

export function brandingEnabled(config: BroadcastSceneConfig): boolean {
  const b = config.branding;
  return Boolean(
    (b.logoUrl && b.logoUrl.trim()) ||
      (b.brandName && b.brandName.trim()) ||
      (b.footerText && b.footerText.trim()) ||
      (b.accentHex && b.accentHex.trim())
  );
}

export function parseStoredSceneSnapshot(
  raw: unknown,
  liveKitLayoutFallback: string
): BroadcastSceneSnapshot {
  if (raw != null && typeof raw === "object") {
    const v = validateSceneConfig(raw, { partial: true });
    if (v.ok) {
      const r = raw as Record<string, unknown>;
      const pid = r.appliedPresetId;
      const pname = r.appliedPresetName;
      return {
        ...v.config,
        appliedPresetId: typeof pid === "number" && Number.isFinite(pid) ? pid : null,
        appliedPresetName: typeof pname === "string" ? pname.slice(0, 120) : null,
      };
    }
  }
  return {
    ...getDefaultSceneConfig(),
    layoutMode: liveKitLayoutToSceneLayout(liveKitLayoutFallback),
    appliedPresetId: null,
    appliedPresetName: null,
  };
}
