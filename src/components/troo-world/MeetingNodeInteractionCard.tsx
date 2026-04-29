"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { trackMeetingNodeEvent } from "@/lib/troo-world/meeting-node/analytics";

interface MeetingNodeInteractionCardProps {
  node: {
    id: string;
    roomId: string;
    title: string;
    accessType: string;
    capacity: number;
    webEnabled: boolean;
    webxrEnabled: boolean;
    vrEnabled: boolean;
    isActive: boolean;
  };
  participantCount?: number;
  onClose: () => void;
}

export function MeetingNodeInteractionCard({ node, onClose, participantCount: participantCountProp }: MeetingNodeInteractionCardProps) {
  const router = useRouter();
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [participantCount, setParticipantCount] = useState<number | null>(participantCountProp ?? null);

  const fetchParticipants = useCallback(() => {
    fetch(`/api/troo-world/meeting-nodes/${node.id}/participants`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setParticipantCount(d?.count ?? 0))
      .catch(() => setParticipantCount(0));
  }, [node.id]);

  useEffect(() => {
    if (participantCountProp != null) return;
    fetchParticipants();
    const interval = setInterval(fetchParticipants, 15000);
    return () => clearInterval(interval);
  }, [participantCountProp, fetchParticipants]);

  const modes: string[] = [];
  if (node.webEnabled) modes.push("Web");
  if (node.webxrEnabled) modes.push("WebXR");
  if (node.vrEnabled) modes.push("VR");

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 80,
        transform: "translateX(-50%)",
        zIndex: 50,
        width: "min(320px, 90vw)",
        background: "rgba(6,12,24,0.97)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(100,180,255,0.4)",
        borderRadius: 14,
        padding: 16,
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        color: "#e0f4ff",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#aaddff" }}>
            {node.title}
          </h4>
          <span
            style={{
              display: "inline-block",
              marginTop: 4,
              padding: "2px 8px",
              borderRadius: 6,
              fontSize: 10,
              fontWeight: 600,
              background: node.isActive ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)",
              color: node.isActive ? "#86efac" : "#fca5a5",
            }}
          >
            {node.isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#5577aa",
            fontSize: 18,
            cursor: "pointer",
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ fontSize: 12, color: "rgba(224,244,255,0.7)", marginBottom: 8 }}>
        {modes.length > 0 && (
          <span>Modes: {modes.join(", ")}</span>
        )}
        {node.accessType !== "public" && (
          <span style={{ marginLeft: 8 }}>• {node.accessType}</span>
        )}
        <span style={{ marginLeft: 8 }}>• Capacity: {node.capacity}</span>
        <span style={{ marginLeft: 8 }}>• Participants: {participantCount != null ? participantCount : "—"}</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={() => {
            if (!node.isActive) return;
            trackMeetingNodeEvent("enter_meeting_clicked", { nodeId: node.id, roomId: node.roomId });
            router.push(`/meet/${node.roomId}`);
            onClose();
          }}
          disabled={!node.isActive}
          style={{
            flex: 1,
            minWidth: 120,
            padding: "10px 16px",
            background: node.isActive ? "#4488ff" : "rgba(68,68,68,0.5)",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 600,
            cursor: node.isActive ? "pointer" : "not-allowed",
            fontSize: 13,
            opacity: node.isActive ? 1 : 0.7,
          }}
        >
          Enter Meeting
        </button>
        <button
          onClick={async () => {
            const directUrl = typeof window !== "undefined" ? `${window.location.origin}/meet/${node.roomId}` : "";
            trackMeetingNodeEvent("copy_invite_clicked", { nodeId: node.id, roomId: node.roomId });
            setGeneratingInvite(true);
            try {
              const r = await fetch(`/api/troo-world/meeting-nodes/${node.id}/invites`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ expiresInHours: 168 }),
              });
              const data = await r.json().catch(() => ({}));
              const url = r.ok && data?.inviteUrl ? data.inviteUrl : directUrl;
              await navigator.clipboard?.writeText(url).catch(() => {});
              toast.success(r.ok ? "Invite link copied" : "Room link copied");
            } catch {
              navigator.clipboard?.writeText(directUrl).catch(() => {});
              toast.success("Room link copied");
            } finally {
              setGeneratingInvite(false);
              onClose();
            }
          }}
          disabled={generatingInvite}
          style={{
            padding: "10px 16px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(100,180,255,0.4)",
            borderRadius: 8,
            color: "#aaccff",
            cursor: generatingInvite ? "wait" : "pointer",
            fontSize: 13,
            opacity: generatingInvite ? 0.7 : 1,
          }}
        >
          {generatingInvite ? "..." : "Copy Invite"}
        </button>
      </div>
    </div>
  );
}
