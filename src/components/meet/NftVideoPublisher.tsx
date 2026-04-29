"use client";

import React, { useEffect, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";

export const NFT_AVATAR_LOG = "[meet nft avatar]";

/** Publishes an NFT image as a Camera-source video track so TrooVideoConference / useTracks includes it in the grid. */
export function NftVideoPublisher({ imageUrl }: { imageUrl: string }) {
  const room = useRoomContext();
  const trackRef = useRef<MediaStreamTrack | null>(null);
  /** Bumps when this effect is superseded or cleaned up so async image/publish cannot commit stale work. */
  const effectGenerationRef = useRef(0);

  useEffect(() => {
    if (!room || !imageUrl) return;

    const effectId = ++effectGenerationRef.current;
    let cancelled = false;

    const el = document.createElement("canvas");
    el.width = 640;
    el.height = 480;
    const ctx = el.getContext("2d");
    if (!ctx) {
      console.warn(`${NFT_AVATAR_LOG} Canvas 2D context unavailable; cannot publish avatar video.`);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onerror = () => {
      const detail =
        process.env.NODE_ENV === "development" ? ` url=${imageUrl.slice(0, 120)}` : "";
      console.warn(`${NFT_AVATAR_LOG} Image failed to load (CORS, 404, or blocked).${detail}`);
    };

    img.onload = async () => {
      if (cancelled || effectId !== effectGenerationRef.current || !room.localParticipant) return;

      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, el.width, el.height);
      const scale = Math.min(el.width / img.width, el.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (el.width - w) / 2, (el.height - h) / 2, w, h);

      try {
        const stream = el.captureStream(15);
        const track = stream.getVideoTracks()[0];
        if (!track) {
          console.warn(`${NFT_AVATAR_LOG} captureStream returned no video track.`);
          return;
        }
        if (cancelled || effectId !== effectGenerationRef.current) {
          track.stop();
          return;
        }
        await room.localParticipant.publishTrack(track, {
          name: "nft-avatar",
          source: Track.Source.Camera,
        });
        if (cancelled || effectId !== effectGenerationRef.current) {
          await room.localParticipant.unpublishTrack(track).catch((err) => {
            console.warn(`${NFT_AVATAR_LOG} unpublishTrack after superseded publish failed:`, err);
          });
          track.stop();
          return;
        }
        trackRef.current = track;
      } catch (e) {
        console.warn(`${NFT_AVATAR_LOG} publishTrack failed:`, e);
      }
    };

    img.src = imageUrl;

    return () => {
      cancelled = true;
      const t = trackRef.current;
      if (t && room?.localParticipant) {
        room.localParticipant.unpublishTrack(t).catch((err) => {
          console.warn(`${NFT_AVATAR_LOG} unpublishTrack on cleanup failed:`, err);
        });
        t.stop();
      }
      trackRef.current = null;
    };
  }, [room, imageUrl]);

  return null;
}
