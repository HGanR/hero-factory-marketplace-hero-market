/**
 * BuildingInfoPanel.tsx
 * Building name-tag click → agent roster panel
 * Fetches agents from database via /api/troo-world/npcs
 * Shows all agents by floor, click agent to open chatbot
 */

"use client";

import { useState, useEffect } from "react";
import AgentChatPanel, { type AgentData } from "./AgentChatPanel";
import { FLOOR_CONFIG } from "@/data/greenTerrainBuildingData";

interface BuildingInfoPanelProps {
  buildingName: string;
  worldId?: string;
  buildingId?: string;
  onClose: () => void;
  onElevatorFloor?: (floor: number) => void;
}

export default function BuildingInfoPanel({ 
  buildingName, 
  worldId = "green-terrain", 
  buildingId = "nexus-corporate-tower",
  onClose, 
  onElevatorFloor 
}: BuildingInfoPanelProps) {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentData | null>(null);
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAgents() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ worldId });
        if (buildingId) params.append("buildingId", buildingId);
        
        const res = await fetch(`/api/troo-world/npcs?${params}`);
        if (res.ok) {
          const data = await res.json();
          setAgents(data.npcs || []);
        }
      } catch (err) {
        console.error("Failed to fetch agents:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, [worldId, buildingId]);

  const floorAgents = selectedFloor !== null ? agents.filter(a => a.floor === selectedFloor) : agents;

  const deptBadgeColor: Record<string, string> = {
    Legal: "#1c6b3a",
    Finance: "#6b1c6b",
    "Human Resources": "#6b3a1c",
    Technology: "#1c3a6b",
    Security: "#6b1c1c",
    Administration: "#1c4a6b",
  };

  return (
    <>
      <div style={{
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
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0d1f35 0%, #1a3a5c 50%, #0d1f35 100%)",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(42,111,189,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ color: "#c8a96e", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Corporate Tower</div>
              <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>{buildingName}</div>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
                {loading ? "Loading..." : `${agents.length} AI Agents · ${FLOOR_CONFIG.length} Floors`}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>✕ Close</button>
          </div>

          {/* Floor selector */}
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
            >All Floors</button>
            {FLOOR_CONFIG.map(f => (
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
              >{f.label}</button>
            ))}
          </div>
        </div>

        {/* Agent list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {selectedFloor !== null && FLOOR_CONFIG[selectedFloor] && (
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
              {FLOOR_CONFIG[selectedFloor].purpose}
            </div>
          )}
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
              Loading agents...
            </div>
          ) : floorAgents.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
              No agents found for this floor
            </div>
          ) : (
            floorAgents.map(agent => (
              <div
                key={agent.id}
                onClick={() => setActiveAgent(agent)}
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
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(42,111,189,0.15)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(42,111,189,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                <div style={{ fontSize: 26, lineHeight: 1 }}>{agent.avatar || agent.avatarEmoji || "🤖"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{agent.name}</span>
                    {agent.department && (
                      <span style={{
                        background: deptBadgeColor[agent.department] || "#1a3a5c",
                        color: "rgba(255,255,255,0.8)",
                        fontSize: 10,
                        padding: "1px 7px",
                        borderRadius: 10,
                      }}>{agent.department}</span>
                    )}
                  </div>
                  <div style={{ color: "#5a9fd4", fontSize: 12, marginBottom: 2 }}>{agent.title || agent.role}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                    {agent.floorLabel || (agent.floor === 0 ? "Lobby" : `Floor ${agent.floor}`)}
                    {agent.expertise && ` · ${agent.expertise.split(",")[0].trim()}`}
                  </div>
                </div>
                <button style={{
                  background: "rgba(42,111,189,0.2)",
                  border: "1px solid rgba(42,111,189,0.4)",
                  borderRadius: 8,
                  color: "#5a9fd4",
                  padding: "5px 10px",
                  fontSize: 11,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}>💬 Chat</button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>World: {worldId}</span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Click an agent to start a conversation</span>
        </div>
      </div>

      {/* Agent chat panel */}
      {activeAgent && (
        <AgentChatPanel
          agent={activeAgent}
          worldId={worldId}
          onClose={() => setActiveAgent(null)}
        />
      )}
    </>
  );
}
