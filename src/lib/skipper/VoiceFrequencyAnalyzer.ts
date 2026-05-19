/**
 * Web Audio API bridge for voice-reactive visuals (microphone or MediaStream).
 * Drives RMS + FFT bands for orb deformation, ring intensity, and particle speed.
 */
export type VoiceAnalyzerFrame = {
  /** 0–1 smoothed loudness */
  rms: number;
  /** Raw byte frequency data (length = frequencyBinCount) */
  bands: Uint8Array;
  /** Heuristic: user is producing sound above noise floor */
  speaking: boolean;
};

const SMOOTH = 0.12;
const SPEAK_THRESHOLD = 0.018;

export class VoiceFrequencyAnalyzer {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private data: Uint8Array = new Uint8Array(0);
  private smoothedRms = 0;
  private running = false;

  get isRunning(): boolean {
    return this.running;
  }

  async startMicrophone(): Promise<void> {
    if (typeof window === "undefined") return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    await this.attachStream(stream);
  }

  async attachStream(stream: MediaStream): Promise<void> {
    if (typeof window === "undefined") return;
    this.stop();
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.65;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    this.ctx = ctx;
    this.analyser = analyser;
    this.source = source;
    this.data = new Uint8Array(analyser.frequencyBinCount);
    this.running = true;
  }

  stop(): void {
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    this.source = null;
    try {
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.analyser = null;
    this.data = new Uint8Array(0);
    this.running = false;
    this.smoothedRms = 0;
  }

  /** Call once per animation frame while visualizing. */
  sample(): VoiceAnalyzerFrame {
    if (!this.analyser || this.data.length === 0) {
      this.smoothedRms += (0 - this.smoothedRms) * SMOOTH;
      return { rms: this.smoothedRms, bands: new Uint8Array(0), speaking: false };
    }
    this.analyser.getByteFrequencyData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) sum += this.data[i] ?? 0;
    const raw = sum / (this.data.length * 255);
    this.smoothedRms += (raw - this.smoothedRms) * SMOOTH;
    const speaking = this.smoothedRms > SPEAK_THRESHOLD;
    return { rms: this.smoothedRms, bands: this.data, speaking };
  }

  /** Feed synthetic levels (e.g. TTS playback analyser) when no mic. */
  injectSyntheticRms(rms01: number): VoiceAnalyzerFrame {
    const t = Math.max(0, Math.min(1, rms01));
    this.smoothedRms += (t - this.smoothedRms) * SMOOTH * 2;
    return { rms: this.smoothedRms, bands: new Uint8Array(0), speaking: this.smoothedRms > SPEAK_THRESHOLD };
  }
}
