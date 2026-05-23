export type ExecutiveAudioCue = "command_accepted" | "warning" | "operational_alert" | "interruption";

const STORAGE_KEY = "executive_cinematic_audio_enabled";

export function isExecutiveAudioPresenceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setExecutiveAudioPresenceEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  gainPeak: number,
  type: OscillatorType = "sine",
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

export class ExecutiveAudioPresenceController {
  private ctx: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (!isExecutiveAudioPresenceEnabled()) return null;
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  play(cue: ExecutiveAudioCue): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (cue) {
      case "command_accepted":
        tone(ctx, 520, t, 0.09, 0.018);
        tone(ctx, 780, t + 0.05, 0.11, 0.012);
        break;
      case "warning":
        tone(ctx, 320, t, 0.14, 0.022, "triangle");
        break;
      case "operational_alert":
        tone(ctx, 280, t, 0.1, 0.02, "square");
        tone(ctx, 220, t + 0.11, 0.12, 0.016, "square");
        break;
      case "interruption":
        tone(ctx, 440, t, 0.08, 0.015);
        tone(ctx, 360, t + 0.07, 0.1, 0.012);
        break;
    }
  }
}

let singleton: ExecutiveAudioPresenceController | null = null;

export function getExecutiveAudioPresence(): ExecutiveAudioPresenceController {
  if (!singleton) singleton = new ExecutiveAudioPresenceController();
  return singleton;
}
