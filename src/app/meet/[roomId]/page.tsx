"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trackMeetingNodeEvent } from "@/lib/troo-world/meeting-node/analytics";

/**
 * /meet/[roomId] — Meeting room entry from world meeting nodes.
 * roomId format: {worldId}:{nodeId} (e.g. default:abc-123)
 * Uses server-side validation API, then redirects to main meet page.
 */

export default function MeetRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = typeof params?.roomId === "string" ? decodeURIComponent(params.roomId) : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      setError("Invalid room");
      return;
    }
    const tryEntry = async () => {
      // Try Troo meeting nodes first (roomId format: worldId:nodeId)
      const trooRes = await fetch(`/api/troo-world/meeting-nodes/entry?roomId=${encodeURIComponent(roomId)}`, { credentials: "include" });
      const trooData = await trooRes.json().catch(() => ({}));
      if (trooRes.ok && trooData?.ok && trooData?.redirectUrl) {
        trackMeetingNodeEvent("room_entry_success", { roomId, worldId: roomId.split(":")[0] });
        window.location.href = trooData.redirectUrl;
        return;
      }
      // Fallback: try venue interior nodes (roomId format: worldId:placementId:nodeId)
      if (trooRes.status === 404 || trooRes.status === 400) {
        const venueRes = await fetch(`/api/worlds/venue-nodes/entry?roomId=${encodeURIComponent(roomId)}`);
        const venueData = await venueRes.json().catch(() => ({}));
        if (venueRes.ok && venueData?.ok && venueData?.redirectUrl) {
          trackMeetingNodeEvent("room_entry_success", { roomId, worldId: roomId.split(":")[0] });
          window.location.href = venueData.redirectUrl;
          return;
        }
      }
      trackMeetingNodeEvent("room_entry_failure", { roomId, payload: { error: trooData?.error, status: trooRes.status } });
      setError(trooData?.error ?? (trooRes.status === 404 ? "Meeting room not found" : trooRes.status === 403 ? "This meeting room is currently disabled" : "Failed to load room"));
    };
    tryEntry().finally(() => setLoading(false));
  }, [roomId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
          <p className="text-cyan-400">Loading meeting room...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-red-400 max-w-md px-4">
          <p className="mb-4 text-lg">{error}</p>
          <button
            onClick={() => router.push("/modeling")}
            className="px-4 py-2 bg-slate-700 rounded-lg hover:bg-slate-600 text-white"
          >
            Back to World
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
        <p className="text-cyan-400">Redirecting to meeting...</p>
      </div>
    </div>
  );
}
