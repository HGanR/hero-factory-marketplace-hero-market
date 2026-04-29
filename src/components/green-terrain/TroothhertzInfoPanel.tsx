/**
 * TroothhertzInfoPanel.tsx
 * Office directory panel for TROOTHHERTZ LLC.
 * Shows Evaana (receptionist) and Trooth (CEO) with floor info.
 * CEO chat only available when on executive floor.
 */

"use client";

import { useState } from "react";
import { TROOTHHERTZ_AGENTS, type TroothAgent } from "./TroothhertzTower";

interface TroothhertzInfoPanelProps {
  onClose: () => void;
  onAgentChat: (agent: TroothAgent) => void;
  currentFloor: number;
  elevatorUnlocked: boolean;
}

const FLOOR_CONFIG = [
  { floor: 0, label: "Lobby", purpose: "Reception & Guest Services" },
  { floor: 1, label: "Executive Floor", purpose: "CEO Office & Boardroom" },
];

export default function TroothhertzInfoPanel({
  onClose,
  onAgentChat,
  currentFloor,
  elevatorUnlocked,
}: TroothhertzInfoPanelProps) {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  const filteredAgents = selectedFloor !== null
    ? TROOTHHERTZ_AGENTS.filter(a => a.floor === selectedFloor)
    : TROOTHHERTZ_AGENTS;

  const canChatWithAgent = (agent: TroothAgent) => {
    if (agent.id === "troothhertz-evaana") {
      return true;
    }
    if (agent.id === "troothhertz-trooth") {
      return currentFloor === 1 && elevatorUnlocked;
    }
    return true;
  };

  const getAgentStatusMessage = (agent: TroothAgent) => {
    if (agent.id === "troothhertz-trooth" && currentFloor !== 1) {
      return "Visit Executive Floor to chat";
    }
    if (agent.id === "troothhertz-trooth" && !elevatorUnlocked) {
      return "Elevator access required";
    }
    return "Click to chat";
  };

  return (
    <div style={{
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: 420,
      maxHeight: "80vh",
      background: "linear-gradient(135deg, #0a0a14 0%, #1a1020 50%, #0a0a14 100%)",
      border: "2px solid rgba(200,160,0,0.5)",
      borderRadius: 16,
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 12px 60px rgba(0,0,0,0.8), 0 0 40px rgba(200,160,0,0.15)",
      fontFamily: "system-ui, -apple-system, sans-serif",
      zIndex: 9999,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #3a2a00 0%, #c8a000 50%, #3a2a00 100%)",
        padding: "16px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: 0.5 }}>
            🏛️ TROOTHHERTZ LLC.
          </div>
          <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11, marginTop: 2 }}>
            Office Directory
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 8,
            width: 32,
            height: 32,
            color: "#fff",
            fontSize: 16,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >✕</button>
      </div>

      {/* Floor tabs */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid rgba(200,160,0,0.2)",
        background: "rgba(0,0,0,0.3)",
      }}>
        <button
          onClick={() => setSelectedFloor(null)}
          style={{
            flex: 1,
            padding: "10px 0",
            background: selectedFloor === null ? "rgba(200,160,0,0.2)" : "transparent",
            border: "none",
            borderBottom: selectedFloor === null ? "2px solid #c8a000" : "2px solid transparent",
            color: selectedFloor === null ? "#ffd700" : "rgba(255,255,255,0.5)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >All Floors</button>
        {FLOOR_CONFIG.map(f => (
          <button
            key={f.floor}
            onClick={() => setSelectedFloor(f.floor)}
            style={{
              flex: 1,
              padding: "10px 0",
              background: selectedFloor === f.floor ? "rgba(200,160,0,0.2)" : "transparent",
              border: "none",
              borderBottom: selectedFloor === f.floor ? "2px solid #c8a000" : "2px solid transparent",
              color: selectedFloor === f.floor ? "#ffd700" : "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >{f.label}</button>
        ))}
      </div>

      {/* Current location indicator */}
      <div style={{
        padding: "10px 16px",
        background: "rgba(200,160,0,0.1)",
        borderBottom: "1px solid rgba(200,160,0,0.15)",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>📍</span>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>
          You are on: <strong style={{ color: "#ffd700" }}>
            {FLOOR_CONFIG[currentFloor]?.label || "Unknown"}
          </strong>
        </span>
        {!elevatorUnlocked && (
          <span style={{
            marginLeft: "auto",
            background: "rgba(180,50,50,0.3)",
            border: "1px solid rgba(255,100,100,0.4)",
            borderRadius: 6,
            padding: "3px 8px",
            color: "#ff8888",
            fontSize: 10,
            fontWeight: 600,
          }}>🔒 Elevator Locked</span>
        )}
        {elevatorUnlocked && (
          <span style={{
            marginLeft: "auto",
            background: "rgba(50,180,50,0.3)",
            border: "1px solid rgba(100,255,100,0.4)",
            borderRadius: 6,
            padding: "3px 8px",
            color: "#88ff88",
            fontSize: 10,
            fontWeight: 600,
          }}>🔓 Elevator Access</span>
        )}
      </div>

      {/* Agent list */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 16px",
      }}>
        {filteredAgents.map(agent => {
          const canChat = canChatWithAgent(agent);
          const statusMsg = getAgentStatusMessage(agent);
          
          return (
            <div
              key={agent.id}
              onClick={() => canChat && onAgentChat(agent)}
              style={{
                background: canChat
                  ? "linear-gradient(135deg, rgba(200,160,0,0.15), rgba(100,80,0,0.1))"
                  : "rgba(40,40,50,0.5)",
                border: canChat
                  ? "1px solid rgba(200,160,0,0.35)"
                  : "1px solid rgba(100,100,100,0.2)",
                borderRadius: 12,
                padding: "14px 16px",
                marginBottom: 10,
                cursor: canChat ? "pointer" : "not-allowed",
                opacity: canChat ? 1 : 0.6,
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: agent.id === "troothhertz-evaana"
                    ? "linear-gradient(135deg, #6a4a8a, #4a2a6a)"
                    : "linear-gradient(135deg, #c8a000, #8a6a00)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  flexShrink: 0,
                }}>
                  {agent.id === "troothhertz-evaana" ? "👩‍💼" : "👔"}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 700,
                    marginBottom: 2,
                  }}>
                    {agent.name}
                  </div>
                  <div style={{
                    color: "#ffd700",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}>
                    {agent.role}
                  </div>
                  <div style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}>
                    <span style={{
                      background: "rgba(200,160,0,0.2)",
                      border: "1px solid rgba(200,160,0,0.3)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      color: "rgba(255,255,255,0.7)",
                      fontSize: 10,
                    }}>
                      {agent.department}
                    </span>
                    <span style={{
                      background: "rgba(100,100,120,0.3)",
                      border: "1px solid rgba(150,150,170,0.3)",
                      borderRadius: 4,
                      padding: "2px 6px",
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 10,
                    }}>
                      {FLOOR_CONFIG[agent.floor]?.label || `Floor ${agent.floor}`}
                    </span>
                  </div>
                </div>

                {/* Chat status */}
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                }}>
                  {canChat ? (
                    <span style={{
                      background: "linear-gradient(135deg, #c8a000, #8a6a00)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 600,
                    }}>💬 Chat</span>
                  ) : (
                    <span style={{
                      background: "rgba(100,100,100,0.4)",
                      borderRadius: 6,
                      padding: "4px 10px",
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}>🔒 Locked</span>
                  )}
                  <span style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                  }}>{statusMsg}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: "12px 16px",
        background: "rgba(0,0,0,0.4)",
        borderTop: "1px solid rgba(200,160,0,0.15)",
        color: "rgba(255,255,255,0.5)",
        fontSize: 11,
        textAlign: "center",
      }}>
        💡 Speak with Evaana to gain elevator access to the Executive Floor
      </div>
    </div>
  );
}
