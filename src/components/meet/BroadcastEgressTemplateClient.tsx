"use client";

import type { TrackReference } from "@livekit/components-core";
import {
  CarouselLayout,
  FocusLayout,
  GridLayout,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  VideoTrack,
  useRoomContext,
  useTracks,
  useVisualStableUpdate,
} from "@livekit/components-react";
import EgressHelper from "@livekit/egress-sdk";
import { ConnectionState, Track } from "livekit-client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BroadcastCompositorRenderModel } from "@/lib/meet/broadcast-compositor";
import type { BroadcastOverlayRenderPayload } from "@/lib/meet/broadcast-overlays";
import type { BroadcastCountdownRenderPayload } from "@/lib/meet/broadcast-schedule";
import { BROADCAST_REALTIME_EVENT_TYPES } from "@/lib/meet/broadcast-realtime";

const FRAME_DECODE_TIMEOUT = 5000;

/** Render-session poll interval for live scene merges (server truth). Tune with status panel (~4s) — expect multi-second propagation. */
const RENDER_SESSION_POLL_MS = 3000;

function TrooSpeakerLayout({ tracks }: { tracks: TrackReference[] }) {
  const sortedTracks = useVisualStableUpdate(tracks, 1);
  const mainTrack = sortedTracks.shift();
  const remainingTracks = useVisualStableUpdate(sortedTracks, 3);

  if (!mainTrack) {
    return null;
  }
  if (remainingTracks.length === 0) {
    return <VideoTrack trackRef={mainTrack as TrackReference} />;
  }
  return (
    <div className="lk-focus-layout flex h-full w-full gap-2 p-2">
      <div className="flex flex-1 min-w-0 flex-col gap-1 overflow-hidden">
        <CarouselLayout tracks={remainingTracks}>
          <ParticipantTile />
        </CarouselLayout>
      </div>
      <div className="flex-[2] min-w-0">
        <FocusLayout trackRef={mainTrack as TrackReference} />
      </div>
    </div>
  );
}

function TrooSingleSpeakerLayout({ tracks }: { tracks: TrackReference[] }) {
  const sortedReferences = useVisualStableUpdate(tracks, 1);
  if (sortedReferences.length === 0) return null;
  return <VideoTrack trackRef={sortedReferences[0] as TrackReference} />;
}

function BroadcastOverlayLayer({
  model,
  overlays,
}: {
  model: BroadcastCompositorRenderModel;
  overlays: BroadcastOverlayRenderPayload;
}) {
  const brandAccent = model.branding.accentHex?.trim() || "#00d1ff";

  const lt = overlays.lowerThird;
  const tk = overlays.ticker;
  const cta = overlays.ctaBanner;
  const ltAccent = lt.accentHex?.trim() || brandAccent;
  const tkAccent = tk.accentHex?.trim() || brandAccent;
  const ctaAccent = cta.accentHex?.trim() || brandAccent;

  const showLt = lt.visible && Boolean(lt.headline?.trim() || lt.subheadline?.trim());
  const showTk = tk.visible && Boolean(tk.text?.trim());
  const showCta =
    cta.visible && Boolean(cta.text?.trim() || cta.buttonLabel?.trim() || cta.buttonUrl?.trim());

  const ltPos = lt.position === "bottom_center" ? "bottom_center" : "bottom_left";

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between"
      aria-hidden
    >
      {showCta && cta.position === "top" ? (
        <div
          data-testid="broadcast-overlay-cta-banner"
          className="border-b border-white/10 bg-black/80 px-3 py-2 text-center text-sm text-white"
          style={{ borderColor: `${ctaAccent}55` }}
        >
          {cta.text?.trim() ? <div className="font-medium">{cta.text.trim()}</div> : null}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300">
            {cta.buttonLabel?.trim() ? (
              <span className="rounded border border-white/20 px-2 py-0.5">{cta.buttonLabel.trim()}</span>
            ) : null}
            {cta.buttonUrl?.trim() ? (
              <span className="font-mono text-[10px] text-slate-400 break-all">{cta.buttonUrl.trim()}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div />
      )}

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1 pb-1">
        {showCta && cta.position === "bottom" ? (
          <div
            data-testid="broadcast-overlay-cta-banner"
            className="mx-2 rounded border border-white/10 bg-black/80 px-3 py-2 text-center text-sm text-white"
            style={{ borderColor: `${ctaAccent}55` }}
          >
            {cta.text?.trim() ? <div className="font-medium">{cta.text.trim()}</div> : null}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300">
              {cta.buttonLabel?.trim() ? (
                <span className="rounded border border-white/20 px-2 py-0.5">{cta.buttonLabel.trim()}</span>
              ) : null}
              {cta.buttonUrl?.trim() ? (
                <span className="font-mono text-[10px] text-slate-400 break-all">{cta.buttonUrl.trim()}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        {showLt ? (
          <div
            data-testid="broadcast-overlay-lower-third"
            className={`mx-2 max-w-[min(100%,520px)] rounded-md border bg-black/75 px-3 py-2 shadow-lg backdrop-blur-sm ${
              ltPos === "bottom_center" ? "self-center text-center" : "self-start text-left"
            }`}
            style={{ borderColor: ltAccent }}
          >
            {lt.headline?.trim() ? (
              <div className="text-sm font-semibold tracking-tight" style={{ color: ltAccent }}>
                {lt.headline.trim()}
              </div>
            ) : null}
            {lt.subheadline?.trim() ? (
              <div className="mt-0.5 text-[11px] text-slate-200">{lt.subheadline.trim()}</div>
            ) : null}
          </div>
        ) : null}

        {showTk ? (
          <div
            data-testid="broadcast-overlay-ticker"
            className="overflow-hidden border-t bg-black/80 px-3 py-1.5 text-center text-[12px] text-slate-100"
            style={{ borderColor: `${tkAccent}44` }}
            title={tk.text?.trim()}
          >
            {/* Static line (marquee optional later); `speed` reserved for future CSS marquee. */}
            <p className="truncate">{tk.text?.trim()}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BroadcastCountdownLayer({
  countdown,
  portraitSafe,
}: {
  countdown: BroadcastCountdownRenderPayload;
  portraitSafe: boolean;
}) {
  const accent = countdown.accentHex?.trim() || "#00d1ff";
  const pos =
    countdown.position === "top_center"
      ? "top-2 left-1/2 -translate-x-1/2"
      : countdown.position === "bottom_right"
        ? "bottom-2 right-2"
        : "top-2 right-2";

  return (
    <div
      data-testid="broadcast-overlay-countdown"
      className={`pointer-events-none absolute z-[25] flex max-w-[min(100%,280px)] flex-col gap-0.5 rounded border border-white/15 bg-black/80 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-sm ${pos} ${
        portraitSafe ? "text-[11px]" : "text-xs"
      }`}
      style={{ borderColor: `${accent}66` }}
      aria-hidden
    >
      {countdown.label?.trim() ? (
        <div className="truncate font-medium leading-tight text-slate-100">{countdown.label.trim()}</div>
      ) : null}
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-lg font-semibold tracking-tight" style={{ color: accent }}>
          {countdown.displayTime}
        </span>
        {countdown.targetPassed ? (
          <span className="text-[10px] uppercase text-slate-500">done</span>
        ) : null}
      </div>
    </div>
  );
}

function BrandedChrome({
  model,
  children,
}: {
  model: BroadcastCompositorRenderModel;
  children: React.ReactNode;
}) {
  const accent = model.branding.accentHex?.trim() || "#00d1ff";
  const showHeader = Boolean(model.branding.logoUrl || model.branding.brandName);
  const showFooter = model.showFooter && Boolean(model.branding.footerText?.trim());

  return (
    <div
      className={`flex min-h-screen flex-col bg-slate-950 text-white ${
        model.portraitSafe ? "max-w-[720px] mx-auto min-h-screen box-border w-full" : "w-full"
      }`}
      style={{ ["--troo-accent" as string]: accent }}
    >
      {showHeader ? (
        <header
          className="flex items-center gap-3 border-b px-3 py-2"
          style={{ borderColor: accent }}
        >
          {model.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={model.branding.logoUrl} alt="" className="h-8 w-auto max-w-[120px] object-contain" />
          ) : null}
          {model.branding.brandName ? (
            <span className="text-sm font-semibold tracking-wide">{model.branding.brandName}</span>
          ) : null}
        </header>
      ) : null}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {children}
        {model.overlays ? <BroadcastOverlayLayer model={model} overlays={model.overlays} /> : null}
        {model.countdown?.visible ? (
          <BroadcastCountdownLayer countdown={model.countdown} portraitSafe={model.portraitSafe} />
        ) : null}
      </div>
      {showFooter ? (
        <footer className="border-t border-slate-700 px-3 py-1.5 text-center text-[11px] text-slate-400">
          {model.branding.footerText}
        </footer>
      ) : null}
    </div>
  );
}

function LiveSceneSlate({ model }: { model: BroadcastCompositorRenderModel }) {
  const t = model.egressLiveSceneType ?? "program";
  const testId =
    t === "intro"
      ? "broadcast-live-scene-intro"
      : t === "brb"
        ? "broadcast-live-scene-brb"
        : t === "outro"
          ? "broadcast-live-scene-outro"
          : "broadcast-live-scene-holding";
  const headline = model.liveSceneHeadline?.trim() || "";
  const sub = model.liveSceneSubheadline?.trim() || "";

  return (
    <div
      data-testid={testId}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-slate-950 px-6 py-12 text-center"
    >
      <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{headline}</h1>
      {sub ? <p className="max-w-md text-sm text-slate-300 md:text-base">{sub}</p> : null}
    </div>
  );
}

function CompositeBody({
  model,
  layout,
  slateMode,
}: {
  model: BroadcastCompositorRenderModel;
  layout: string;
  slateMode: boolean;
}) {
  const room = useRoomContext();
  const [hasScreenShare, setHasScreenShare] = useState(false);
  const screenshareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true });

  useEffect(() => {
    EgressHelper.setRoom(room);
  }, [room]);

  useEffect(() => {
    if (slateMode) {
      const t = window.setTimeout(() => {
        EgressHelper.startRecording();
      }, 400);
      return () => clearTimeout(t);
    }
    const startTime = Date.now();
    const interval = setInterval(async () => {
      let shouldStartRecording = false;
      let hasVideoTracks = false;
      let hasSubscribedTracks = false;
      let hasDecodedFrames = false;
      for (const p of Array.from(room.remoteParticipants.values())) {
        for (const pub of Array.from(p.trackPublications.values())) {
          if (pub.isSubscribed) {
            hasSubscribedTracks = true;
          }
          if (pub.kind === Track.Kind.Video) {
            hasVideoTracks = true;
            if (pub.videoTrack) {
              const stats = await pub.videoTrack.getRTCStatsReport();
              if (stats) {
                hasDecodedFrames = Array.from(stats).some(
                  (item) => item[1].type === "inbound-rtp" && (item[1] as { framesDecoded?: number }).framesDecoded! > 0
                );
              }
            }
          }
        }
      }

      const timeDelta = Date.now() - startTime;
      if (hasDecodedFrames) {
        shouldStartRecording = true;
      } else if (!hasVideoTracks && hasSubscribedTracks && timeDelta > 500) {
        shouldStartRecording = true;
      } else if (timeDelta > FRAME_DECODE_TIMEOUT && hasSubscribedTracks) {
        shouldStartRecording = true;
      }

      if (shouldStartRecording) {
        EgressHelper.startRecording();
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [room, slateMode]);

  useEffect(() => {
    setHasScreenShare(screenshareTracks.length > 0 && Boolean(screenshareTracks[0]?.publication));
  }, [screenshareTracks]);

  const allTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown], {
    onlySubscribed: true,
  });

  const filteredTracks = useMemo(
    () =>
      allTracks.filter(
        (tr) =>
          tr.publication.kind === Track.Kind.Video && tr.participant.identity !== room.localParticipant.identity
      ),
    [allTracks, room.localParticipant.identity]
  );

  const orderedTracks = useMemo(() => {
    if (model.layoutMode !== "screenshare_focus") return filteredTracks;
    const ss = filteredTracks.filter((t) => t.source === Track.Source.ScreenShare);
    const rest = filteredTracks.filter((t) => t.source !== Track.Source.ScreenShare);
    return [...ss, ...rest];
  }, [filteredTracks, model.layoutMode]);

  let effectiveLayout = layout;
  if (hasScreenShare && effectiveLayout.startsWith("grid")) {
    effectiveLayout = effectiveLayout.replace("grid", "speaker");
  }

  let main: React.ReactNode = null;
  if (slateMode) {
    main = <LiveSceneSlate model={model} />;
  } else if (room.state !== ConnectionState.Disconnected) {
    if (effectiveLayout.startsWith("speaker")) {
      main = <TrooSpeakerLayout tracks={orderedTracks as TrackReference[]} />;
    } else if (effectiveLayout.startsWith("single-speaker")) {
      main = <TrooSingleSpeakerLayout tracks={orderedTracks as TrackReference[]} />;
    } else {
      main = (
        <GridLayout tracks={orderedTracks as TrackReference[]} className="h-full">
          <ParticipantTile />
        </GridLayout>
      );
    }
  }

  return (
    <div
      className="roomContainer dark flex min-h-0 flex-1 flex-col"
      data-testid={slateMode ? undefined : "broadcast-live-scene-program"}
    >
      <div className="min-h-0 flex-1">{main}</div>
      <RoomAudioRenderer />
    </div>
  );
}

export function BroadcastEgressTemplateClient() {
  const sp = useSearchParams();
  const url = sp?.get("url") ?? "";
  const token = sp?.get("token") ?? "";
  const layoutParam = sp?.get("layout") ?? "grid";
  const rsidRaw = sp?.get("rsid") ?? "";
  const rt = sp?.get("rt") ?? "";

  const [model, setModel] = useState<BroadcastCompositorRenderModel | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  /** SSE open — invalidation hints; polling remains authoritative fallback. */
  const [templateRealtimeConnected, setTemplateRealtimeConnected] = useState(false);
  /** True when SSE is down or errored; normal poll interval still runs. */
  const [templateRealtimePollingFallback, setTemplateRealtimePollingFallback] = useState(true);
  const pullRef = useRef<(isInitial: boolean) => Promise<void>>(async () => {});
  const seenRealtimeEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const id = Number(rsidRaw);
    if (!Number.isFinite(id) || !rt) {
      setLoadErr("Missing render session (rsid/rt).");
      return;
    }
    let cancelled = false;

    async function pull(isInitial: boolean) {
      try {
        const r = await fetch(`/api/meet/broadcast/render-session/${id}?token=${encodeURIComponent(rt)}`);
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean;
          model?: BroadcastCompositorRenderModel;
          error?: string;
        };
        if (!r.ok || !j.ok || !j.model) {
          throw new Error(j && typeof j === "object" && "error" in j ? String(j.error) : "load_failed");
        }
        if (!cancelled) {
          setModel(j.model);
          setLoadErr(null);
        }
      } catch {
        if (!cancelled && isInitial) setLoadErr("Could not load program scene.");
      }
    }

    pullRef.current = pull;
    void pull(true);
    const interval = window.setInterval(() => void pull(false), RENDER_SESSION_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rsidRaw, rt]);

  useEffect(() => {
    const id = Number(rsidRaw);
    if (!Number.isFinite(id) || !rt) return;
    seenRealtimeEventIdsRef.current.clear();
    const url = `/api/meet/broadcast/render-events?rsid=${encodeURIComponent(String(id))}&token=${encodeURIComponent(rt)}`;
    const es = new EventSource(url);
    setTemplateRealtimePollingFallback(true);
    es.onopen = () => {
      setTemplateRealtimeConnected(true);
      setTemplateRealtimePollingFallback(false);
    };
    es.onerror = () => {
      setTemplateRealtimeConnected(false);
      setTemplateRealtimePollingFallback(true);
    };
    const trimSeen = () => {
      const s = seenRealtimeEventIdsRef.current;
      if (s.size > 220) {
        seenRealtimeEventIdsRef.current = new Set([...s].slice(110));
      }
    };
    const bump = (ev: MessageEvent) => {
      try {
        const d = JSON.parse(String(ev.data)) as { eventId?: string };
        if (typeof d.eventId === "string" && d.eventId.trim()) {
          const id = d.eventId.trim();
          if (seenRealtimeEventIdsRef.current.has(id)) return;
          seenRealtimeEventIdsRef.current.add(id);
          trimSeen();
        }
      } catch {
        /* ignore */
      }
      void pullRef.current(false);
    };
    for (const t of BROADCAST_REALTIME_EVENT_TYPES) {
      es.addEventListener(t, bump);
    }
    return () => {
      es.close();
      setTemplateRealtimeConnected(false);
      setTemplateRealtimePollingFallback(true);
    };
  }, [rsidRaw, rt]);

  if (!url || !token) {
    return (
      <div className="min-h-screen bg-black text-red-300 flex items-center justify-center p-4 text-sm">
        Missing LiveKit egress parameters (url, token).
      </div>
    );
  }

  if (!rsidRaw.trim() || !rt.trim()) {
    return (
      <div className="min-h-screen bg-black text-amber-200 flex items-center justify-center p-4 text-sm">
        This broadcast template requires rsid and rt query parameters.
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="min-h-screen bg-black text-red-300 flex items-center justify-center p-4 text-sm">{loadErr}</div>
    );
  }

  if (!model) {
    return (
      <div className="min-h-screen bg-black text-slate-300 flex items-center justify-center text-sm">
        Loading program scene…
      </div>
    );
  }

  const slateMode = Boolean(model.egressLiveSceneType && model.egressLiveSceneType !== "program");
  const layout = model.liveKitLayout ?? layoutParam;

  return (
    <div data-testid="broadcast-v2-rendered-compositor" className="min-h-screen">
      <span data-testid="broadcast-realtime-connected" className="sr-only">
        {templateRealtimeConnected ? "yes" : "no"}
      </span>
      <span data-testid="broadcast-realtime-fallback-active" className="sr-only">
        {templateRealtimePollingFallback ? "yes" : "no"}
      </span>
      <BrandedChrome model={model}>
        <LiveKitRoom serverUrl={url} token={token} audio={false} video={false}>
          <CompositeBody model={model} layout={layout} slateMode={slateMode} />
        </LiveKitRoom>
      </BrandedChrome>
    </div>
  );
}
