/**
 * BuildingInfoPanel.tsx
 * Building name-tag click → agent roster panel
 * Shows all agents by floor, click agent to open chatbot
 */

"use client";

import { useState, useEffect } from "react";

interface AgentData {
  id: string;
  name: string;
  role: string;
  floor: number;
  floorLabel: string;
  expertise: string;
  avatar: string;
  department: string;
  greeting?: string;
}

interface FloorConfig {
  floor: number;
  label: string;
  color: string;
  purpose: string;
}

interface BuildingInfoPanelProps {
  buildingName: string;
  buildingId: string;
  worldId?: string;
  onClose: () => void;
  onElevatorFloor?: (floor: number) => void;
  onChatWithAgent?: (agent: AgentData) => void;
}

const DEPT_BADGE_COLOR: Record<string, string> = {
  Legal: "#1c6b3a",
  Finance: "#6b1c6b",
  "Human Resources": "#6b3a1c",
  Technology: "#1c3a6b",
  Security: "#6b1c1c",
  Administration: "#1c4a6b",
};

export default function BuildingInfoPanel({
  buildingName,
  buildingId,
  worldId = "default",
  onClose,
  onElevatorFloor,
  onChatWithAgent,
}: BuildingInfoPanelProps) {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [floors, setFloors] = useState<FloorConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/admin/troo-world/npcs?worldId=${worldId}&buildingId=${buildingId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const npcs = data.npcs ?? [];
        const agentList: AgentData[] = npcs.map((n: {
          id: string;
          name: string;
          title?: string;
          floor?: number;
          expertise?: string;
          department?: string;
          systemPrompt?: string;
        }) => ({
          id: n.id,
          name: n.name,
          role: n.title || "Agent",
          floor: n.floor ?? 0,
          floorLabel: n.floor === 0 ? "Lobby" : `Floor ${n.floor}`,
          expertise: n.expertise || "",
          avatar: getAvatarEmoji(n.department),
          department: n.department || "General",
          greeting: n.systemPrompt?.slice(0, 100),
        }));
        setAgents(agentList);

        const uniqueFloors = [...new Set(agentList.map((a) => a.floor))].sort((a, b) => a - b);
        const floorConfigs: FloorConfig[] = uniqueFloors.map((f) => ({
          floor: f,
          label: f === 0 ? "Lobby" : `Floor ${f}`,
          color: "#1a3a5c",
          purpose: f === 0 ? "Reception & Security" : `Floor ${f} Operations`,
        }));
        setFloors(floorConfigs);
      })
      .catch(() => {
        if (!cancelled) {
          setAgents([]);
          setFloors([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [worldId, buildingId]);

  const floorAgents = selectedFloor !== null ? agents.filter((a) => a.floor === selectedFloor) : agents;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 460,
        maxHeight: "80vh",
        background: "#080e1a",
        border: "1px solid rgba(42,111,189,0.4)",
        borderRadius: 16,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 12px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(42,111,189,0.2)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 900,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0d1f35 0%, #1a3a5c 50%, #0d1f35 100%)",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(42,111,189,0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{ color: "#c8a96e", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}
            >
              Corporate Tower
            </div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{buildingName}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
              {agents.length} AI Agents · {floors.length} Floors
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 8,
              color: "#fff",
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            ✕ Close
          </button>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => setSelectedFloor(null)}
            style={{
              background: selectedFloor === null ? "#2a6fbd" : "rgba(255,255,255,0.07)",
              border: `1px solid ${selectedFloor === null ? "#2a6fbd" : "rgba(255,255,255,0.15)"}`,
              borderRadius: 20,
              color: "#fff",
              padding: "4px 12px",
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            All Floors
          </button>
          {floors.map((f) => (
            <button
              key={f.floor}
              onClick={() => {
                setSelectedFloor(f.floor);
                onElevatorFloor?.(f.floor);
              }}
              style={{
                background: selectedFloor === f.floor ? "#2a6fbd" : "rgba(255,255,255,0.07)",
                border: `1px solid ${selectedFloor === f.floor ? "#2a6fbd" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 20,
                color: "#fff",
                padding: "4px 12px",
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}
      >
        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", padding: 20 }}>
            Loading agents...
          </div>
        ) : floorAgents.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center", padding: 20 }}>
            No agents found for this building
          </div>
        ) : (
          <>
            {selectedFloor !== null && floors[selectedFloor] && (
              <div
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 11,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                {floors.find((f) => f.floor === selectedFloor)?.purpose}
              </div>
            )}
            {floorAgents.map((agent) => (
              <div
                key={agent.id}
                onClick={() => onChatWithAgent?.(agent)}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(42,111,189,0.15)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(42,111,189,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                <div style={{ fontSize: 26, lineHeight: 1 }}>{agent.avatar}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{agent.name}</span>
                    <span
                      style={{
                        background: DEPT_BADGE_COLOR[agent.department] || "#1a3a5c",
                        color: "rgba(255,255,255,0.8)",
                        fontSize: 10,
                        padding: "1px 7px",
                        borderRadius: 10,
                      }}
                    >
                      {agent.department}
                    </span>
                  </div>
                  <div style={{ color: "#5a9fd4", fontSize: 12, marginBottom: 2 }}>{agent.role}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                    {agent.floorLabel} · {agent.expertise.split(",")[0]?.trim() || "General"}
                  </div>
                </div>
                <button
                  style={{
                    background: "rgba(42,111,189,0.2)",
                    border: "1px solid rgba(42,111,189,0.4)",
                    borderRadius: 8,
                    color: "#5a9fd4",
                    padding: "5px 10px",
                    fontSize: 11,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  💬 Chat
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>World: {worldId}</span>
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Click an agent to start a conversation</span>
      </div>
    </div>
  );
}

function getAvatarEmoji(department?: string): string {
  switch (department) {
    case "Security":
      return "🛡️";
    case "Legal":
      return "⚖️";
    case "Finance":
      return "💼";
    case "Human Resources":
      return "👥";
    case "Technology":
      return "💻";
    case "Administration":
      return "👩‍💼";
    default:
      return "🏢";
  }
}
