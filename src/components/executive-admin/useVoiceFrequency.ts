"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceFrequencyState = {
  rms: number;
  /** 0–1 per band, length 0 when no analyser */
  bands: number[];
  speaking: boolean;
  listening: boolean;
  error: string | null;
};

const SMOOTH = 0.14;
const SPEAK = 0.022;

export function useVoiceFrequency() {
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const [state, setState] = useState<VoiceFrequencyState>({
    rms: 0,
    bands: [],
    speaking: false,
    listening: false,
    error: null,
  });

  const stopInternal = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    sourceRef.current = null;
    mediaStreamRef.current = null;
    try {
      void ctxRef.current?.close();
    } catch {
      /* ignore */
    }
    ctxRef.current = null;
    analyserRef.current = null;
    dataRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const data = dataRef.current;
    let rms = 0;
    let bands: number[] = [];
    let speaking = false;
    if (analyser && data && data.length) {
      analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] ?? 0;
      rms = sum / (data.length * 255);
      const step = Math.max(1, Math.floor(data.length / 32));
      bands = Array.from({ length: 32 }, (_, i) => {
        const idx = Math.min(data.length - 1, i * step);
        return (data[idx] ?? 0) / 255;
      });
      speaking = rms > SPEAK;
    } else {
      const t = performance.now() / 1000;
      rms = 0.02 + Math.sin(t * 1.1) * 0.008;
      bands = Array.from({ length: 32 }, (_, i) => 0.04 + 0.03 * Math.sin(i * 0.35 + t * 2));
      speaking = false;
    }
    setState((prev) => ({
      rms: prev.rms + (rms - prev.rms) * SMOOTH,
      bands,
      speaking,
      listening: analyser != null,
      error: prev.error,
    }));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return;
    stopInternal();
    setState((s) => ({ ...s, error: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.72;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setState((s) => ({
        ...s,
        error: e instanceof Error ? e.message : "Microphone unavailable",
        listening: false,
      }));
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [stopInternal, tick]);

  const stopListening = useCallback(() => {
    stopInternal();
    setState({ rms: 0, bands: [], speaking: false, listening: false, error: null });
  }, [stopInternal]);

  useEffect(() => {
    return () => stopInternal();
  }, [stopInternal]);

  const getActiveMediaStream = useCallback(() => mediaStreamRef.current, []);

  return { ...state, startListening, stopListening, getActiveMediaStream };
}
