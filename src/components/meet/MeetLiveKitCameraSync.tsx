"use client";

import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";

/**
 * LiveKitRoom applies `video` only from the SignalConnected handler; changing the prop after
 * connect does not run setCameraEnabled again. Sync explicitly so switching camera ↔ NFT mid-call
 * does not leave a duplicate built-in camera publication alongside the NFT canvas track.
 */
export function MeetLiveKitCameraSync({ cameraAllowed }: { cameraAllowed: boolean }) {
  const room = useRoomContext();

  useEffect(() => {
    const lp = room?.localParticipant;
    if (!lp) return;

    void lp.setCameraEnabled(cameraAllowed).catch((err) => {
      console.warn("[meet] LiveKit setCameraEnabled failed:", err);
    });
  }, [room, cameraAllowed]);

  return null;
}
