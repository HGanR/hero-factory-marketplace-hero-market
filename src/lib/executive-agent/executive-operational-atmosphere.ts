import type { ChoreographyVisualProfile } from "@/lib/executive-agent/executive-presence-choreography";

export type AtmosphereLayerConfig = {
  gridOpacity: number;
  sweepDurationSec: number;
  scanLineOpacity: number;
  parallaxOffset: number;
  motionEnabled: boolean;
};

export function atmosphereFromProfile(
  profile: ChoreographyVisualProfile,
  opts: { allowScanLines: boolean; animationsPaused: boolean },
): AtmosphereLayerConfig {
  return {
    gridOpacity: profile.atmosphereOpacity * (opts.animationsPaused ? 0.45 : 1),
    sweepDurationSec: profile.scanSpeedSec,
    scanLineOpacity: opts.allowScanLines ? 0.12 + profile.hudIntensity * 0.18 : 0,
    parallaxOffset: profile.parallaxStrength,
    motionEnabled: !opts.animationsPaused,
  };
}

export function atmosphereCssVars(config: AtmosphereLayerConfig, glowRgb: string): Record<string, string> {
  return {
    "--atmo-glow-rgb": glowRgb,
    "--atmo-grid-opacity": String(config.gridOpacity.toFixed(3)),
    "--atmo-sweep-sec": String(config.sweepDurationSec.toFixed(2)),
    "--atmo-scan-opacity": String(config.scanLineOpacity.toFixed(3)),
    "--atmo-parallax": String(config.parallaxOffset.toFixed(3)),
  };
}
