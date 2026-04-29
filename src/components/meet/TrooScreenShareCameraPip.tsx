"use client";

import React from "react";
import { VideoTrack, useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useMeetScreenShareUi } from "./meet-screen-share-ui-context";

const CORNER: Record<string, string> = {
  br: "bottom-20 right-3",
  bl: "bottom-20 left-3",
  tr: "top-3 right-3",
  tl: "top-3 left-3",
};

/**
 * Local camera picture-in-picture while screen sharing (does not change what others receive —
 * they still get separate camera + screen-share tracks). Reduces “lost face” when the main tile is your screen.
 */
export function TrooScreenShareCameraPip() {
  const { pipEnabled, pipCorner } = useMeetScreenShareUi();
  const { localParticipant, cameraTrack, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();

  if (!pipEnabled || !isScreenShareEnabled || !isCameraEnabled || !cameraTrack?.track) {
    return null;
  }

  const trackRef = {
    participant: localParticipant,
    publication: cameraTrack,
    source: Track.Source.Camera,
  };

  return (
    <div
      className={`pointer-events-none absolute z-[60] w-[9.5rem] h-[5.4rem] sm:w-44 sm:h-[6.6rem] rounded-lg overflow-hidden border-2 border-cyan-500/60 shadow-xl bg-black ${CORNER[pipCorner] ?? CORNER.br}`}
      data-testid="troo-screen-share-camera-pip"
      aria-hidden
    >
      <VideoTrack
        trackRef={trackRef}
        className="h-full w-full object-cover [transform:scaleX(-1)]"
      />
    </div>
  );
}
