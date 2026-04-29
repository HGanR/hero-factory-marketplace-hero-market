"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { LiveKitRoom, useParticipants } from "@livekit/components-react";
import "@livekit/components-styles";
import { MeetBroadcastControls } from "@/components/meet/MeetBroadcastControls";
import { MeetLiveKitCameraSync } from "@/components/meet/MeetLiveKitCameraSync";
import { NftVideoPublisher } from "@/components/meet/NftVideoPublisher";
import { TrooVideoConference } from "@/components/meet/TrooVideoConference";

const BRIGHT_ELECTRIC_BLUE = "#00E5FF";
const PhoneOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2v6a2 2 0 01-2 2H6l10-10z" />
  </svg>
);
const LayoutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" strokeWidth={2} rx="1" />
    <rect x="14" y="3" width="7" height="7" strokeWidth={2} rx="1" />
    <rect x="3" y="14" width="7" height="7" strokeWidth={2} rx="1" />
    <rect x="14" y="14" width="7" height="7" strokeWidth={2} rx="1" />
  </svg>
);
const UsersIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const RecIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" />
  </svg>
);
const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

/** LiveKitRoom `video` prop: built-in camera only when not using NFT avatar and camera is required. */
export function getLiveKitRoomVideoEnabled(
  selectedAvatar: string | null,
  isVideoOn: boolean,
  cameraOptional: boolean
): boolean {
  return !selectedAvatar && isVideoOn && !cameraOptional;
}

/** Publish NFT canvas video only when an avatar is selected and video is on (matches camera toggle semantics). */
export function shouldPublishNftAvatarVideo(selectedAvatar: string | null, isVideoOn: boolean): boolean {
  return Boolean(selectedAvatar && isVideoOn);
}

/** Syncs participant list to API for Meeting Minutes when host has toggle on */
function ParticipantRecorder({
  roomId,
  recordParticipants,
  isHost,
}: {
  roomId: string;
  recordParticipants: boolean;
  isHost: boolean;
}) {
  const participants = useParticipants();
  const prevRef = useRef<string>("");

  useEffect(() => {
    if (!recordParticipants || !isHost || !roomId) return;

    const snapshot = participants
      .map((p) => ({
        identity: p.identity,
        name: p.name || p.identity,
        joinedAt: p.joinedAt?.toISOString?.() || new Date().toISOString(),
        walletAddress: null,
      }))
      .sort((a, b) => a.identity.localeCompare(b.identity));
    const key = JSON.stringify(snapshot);
    if (key === prevRef.current) return;
    prevRef.current = key;

    fetch("/api/meet/participants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, participants: snapshot }),
    }).catch((e) => console.error("Participant sync error:", e));
  }, [roomId, recordParticipants, isHost, participants]);

  return null;
}

interface TrooLiveKitMeetingProps {
  token: string;
  serverUrl: string;
  roomId: string;
  roomName: string;
  isHost: boolean;
  meetingLayout: "grid" | "speaker" | "single-speaker";
  setMeetingLayout: (l: "grid" | "speaker" | "single-speaker") => void;
  recordParticipants: boolean;
  setRecordParticipants: (v: boolean) => void;
  egressId: string | null;
  setEgressId: (id: string | null) => void;
  selectedAvatar: string | null;
  isAudioOn: boolean;
  isVideoOn: boolean;
  cameraOptional: boolean;
  onLeave: () => void;
  /** Wallet address from /meet page; used with signed-in account for broadcast APIs. */
  hostWalletAddress: string;
}

export function TrooLiveKitMeeting({
  token,
  serverUrl,
  roomId,
  roomName,
  isHost,
  meetingLayout,
  setMeetingLayout,
  recordParticipants,
  setRecordParticipants,
  egressId,
  setEgressId,
  selectedAvatar,
  isAudioOn,
  isVideoOn,
  cameraOptional,
  onLeave,
  hostWalletAddress,
}: TrooLiveKitMeetingProps) {
  const startRecording = useCallback(async () => {
    if (!isHost) return;
    try {
      const res = await fetch("/api/livekit/egress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          roomName: roomId,
          layout: meetingLayout,
        }),
      });
      const data = await res.json();
      if (data?.egressId) setEgressId(data.egressId);
      else alert(data?.error || "Recording could not start");
    } catch (e) {
      console.error(e);
      alert("Recording failed");
    }
  }, [isHost, roomId, meetingLayout, setEgressId]);

  const stopRecording = useCallback(async () => {
    if (!egressId) return;
    try {
      await fetch("/api/livekit/egress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", egressId }),
      });
      setEgressId(null);
    } catch (e) {
      console.error(e);
    }
  }, [egressId, setEgressId]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-none bg-slate-800 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-lg font-bold">
          <span style={{ color: BRIGHT_ELECTRIC_BLUE }}>TROO</span> Video Meeting · {roomName || roomId}
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          {isHost && (
            <>
              <label className="flex items-center gap-1.5 text-sm">
                <LayoutIcon />
                <span>Layout:</span>
                <select
                  value={meetingLayout}
                  onChange={(e) => setMeetingLayout(e.target.value as "grid" | "speaker" | "single-speaker")}
                  className="rounded bg-slate-700 border border-slate-600 text-white text-sm px-2 py-1"
                >
                  <option value="grid">Grid</option>
                  <option value="speaker">Speaker</option>
                  <option value="single-speaker">Single speaker</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordParticipants}
                  onChange={(e) => setRecordParticipants(e.target.checked)}
                  className="rounded"
                />
                <UsersIcon />
                <span>Record participants</span>
              </label>
              {!egressId ? (
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-sm"
                >
                  <RecIcon />
                  Record
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-sm"
                >
                  Stop recording
                </button>
              )}
              {egressId && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  Recording
                </span>
              )}
              <MeetBroadcastControls
                roomId={roomId}
                layoutMode={meetingLayout}
                hostWalletAddress={hostWalletAddress}
              />
              {recordParticipants && (
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/meet/participants?roomId=${encodeURIComponent(roomId)}`);
                      const data = await res.json();
                      if (!data?.participants) return;
                      const blob = new Blob(
                        [JSON.stringify({ roomId, roomName, participants: data.participants, exportedAt: new Date().toISOString() }, null, 2)],
                        { type: "application/json" }
                      );
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `meeting-participants-${roomId}-${Date.now()}.json`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-sm"
                  title="Download participant list for Meeting Minutes"
                >
                  <DownloadIcon />
                  Export
                </button>
              )}
            </>
          )}
          <button
            onClick={onLeave}
            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-sm flex items-center gap-2"
          >
            <PhoneOffIcon />
            Leave
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect={true}
          audio={isAudioOn}
          video={getLiveKitRoomVideoEnabled(selectedAvatar, isVideoOn, cameraOptional)}
          onDisconnected={onLeave}
          style={{ height: "100%" }}
          className="lk-room"
        >
          <ParticipantRecorder
            roomId={roomId}
            recordParticipants={recordParticipants}
            isHost={isHost}
          />
          <MeetLiveKitCameraSync
            cameraAllowed={getLiveKitRoomVideoEnabled(selectedAvatar, isVideoOn, cameraOptional)}
          />
          {shouldPublishNftAvatarVideo(selectedAvatar, isVideoOn) && selectedAvatar ? (
            <NftVideoPublisher imageUrl={selectedAvatar} />
          ) : null}
          <TrooVideoConference />
        </LiveKitRoom>
      </div>
    </div>
  );
}
