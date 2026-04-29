"use client";

/**
 * NpcPanel.tsx
 * Admin panel to view and manage NPCs/AI agents for the current world.
 * Shows agents grouped by floor with their knowledge base stats.
 */

import { useState, useEffect, useCallback } from "react";

interface NpcData {
  id: number;
  npcId: string;
  name: string;
  role: string;
  title: string | null;
  avatarEmoji: string;
  worldId: string | null;
  buildingId: string | null;
  floor: number | null;
  greeting: string | null;
  voiceStyle: string | null;
  mood: string;
  isActive: boolean;
  knowledgeCount: number;
  personality?: {
    systemPrompt?: string;
    department?: string;
    expertise?: string;
  };
}

interface NpcPanelProps {
  worldId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function NpcPanel({ worldId, isOpen, onClose }: NpcPanelProps) {
  const [npcs, setNpcs] = useState<NpcData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [expandedNpc, setExpandedNpc] = useState<number | null>(null);

  const loadNpcs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/troo-world/npcs?worldId=${worldId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setNpcs(data.npcs || []);
    } catch (error) {
      console.error("Failed to load NPCs:", error);
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    if (isOpen) {
      loadNpcs();
    }
  }, [isOpen, loadNpcs]);

  if (!isOpen) return null;

  // Get unique floors
  const floors = [...new Set(npcs.map((n) => n.floor).filter((f) => f !== null))] as number[];
  floors.sort((a, b) => a - b);

  // Floor labels
  const floorLabels: Record<number, string> = {
    0: "Lobby",
    1: "Floor 1 — Legal",
    2: "Floor 2 — Finance",
    3: "Floor 3 — HR",
    4: "Floor 4 — Tech",
  };

  // Role badge colors
  const roleBadgeColor: Record<string, string> = {
    secretary: "#1c6b3a",
    guide: "#6b1c1c",
    voice_agent: "#1c3a6b",
    avatar: "#6b3a1c",
  };

  // Department badge colors
  const deptBadgeColor: Record<string, string> = {
    Legal: "#1c6b3a",
    Finance: "#6b1c6b",
    "Human Resources": "#6b3a1c",
    Technology: "#1c3a6b",
    Security: "#6b1c1c",
    Administration: "#1c4a6b",
  };

  const filteredNpcs = selectedFloor !== null 
    ? npcs.filter((n) => n.floor === selectedFloor) 
    : npcs;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: 480,
        height: "100vh",
        background: "#080e1a",
        borderLeft: "1px solid rgba(42,111,189,0.3)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, sans-serif",
        zIndex: 1000,
        boxShadow: "-8px 0 40px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
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
              style={{
                color: "#c8a96e",
                fontSize: 11,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              AI Agents
            </div>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>
              NPC Management
            </div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>
              {npcs.length} agents in "{worldId}"
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
          >
            All Floors ({npcs.length})
          </button>
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => setSelectedFloor(f)}
              style={{
                background: selectedFloor === f ? "#2a6fbd" : "rgba(255,255,255,0.07)",
                border: `1px solid ${selectedFloor === f ? "#2a6fbd" : "rgba(255,255,255,0.15)"}`,
                borderRadius: 20,
                color: "#fff",
                padding: "4px 12px",
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {floorLabels[f] || `Floor ${f}`} ({npcs.filter((n) => n.floor === f).length})
            </button>
          ))}
        </div>
      </div>

      {/* NPC list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: 40 }}>
            Loading agents...
          </div>
        ) : filteredNpcs.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.5)", textAlign: "center", padding: 40 }}>
            No agents found for this world.
            <br />
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Run the seed script to add agents.
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredNpcs.map((npc) => (
              <div
                key={npc.id}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${expandedNpc === npc.id ? "rgba(42,111,189,0.5)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {/* NPC header row */}
                <div
                  onClick={() => setExpandedNpc(expandedNpc === npc.id ? null : npc.id)}
                  style={{
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: 28, lineHeight: 1 }}>{npc.avatarEmoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
                        {npc.name}
                      </span>
                      {npc.personality?.department && (
                        <span
                          style={{
                            background: deptBadgeColor[npc.personality.department] || "#1a3a5c",
                            color: "rgba(255,255,255,0.8)",
                            fontSize: 10,
                            padding: "1px 7px",
                            borderRadius: 10,
                          }}
                        >
                          {npc.personality.department}
                        </span>
                      )}
                      {!npc.isActive && (
                        <span
                          style={{
                            background: "#6b1c1c",
                            color: "#fff",
                            fontSize: 9,
                            padding: "1px 6px",
                            borderRadius: 10,
                          }}
                        >
                          Inactive
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#5a9fd4", fontSize: 12, marginBottom: 2 }}>
                      {npc.title || npc.role}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>
                      {floorLabels[npc.floor ?? 0] || `Floor ${npc.floor}`} ·{" "}
                      {npc.knowledgeCount} knowledge docs
                    </div>
                  </div>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.3)",
                      fontSize: 18,
                      transform: expandedNpc === npc.id ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  >
                    ▼
                  </div>
                </div>

                {/* Expanded details */}
                {expandedNpc === npc.id && (
                  <div
                    style={{
                      padding: "0 14px 14px",
                      borderTop: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {/* Greeting */}
                    {npc.greeting && (
                      <div style={{ marginTop: 12 }}>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 10,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Greeting
                        </div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.7)",
                            fontSize: 12,
                            fontStyle: "italic",
                            background: "rgba(255,255,255,0.03)",
                            padding: "8px 10px",
                            borderRadius: 6,
                          }}
                        >
                          "{npc.greeting}"
                        </div>
                      </div>
                    )}

                    {/* Expertise */}
                    {npc.personality?.expertise && (
                      <div style={{ marginTop: 12 }}>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 10,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Expertise
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          {npc.personality.expertise.split(",").map((exp, i) => (
                            <span
                              key={i}
                              style={{
                                background: "rgba(42,111,189,0.2)",
                                border: "1px solid rgba(42,111,189,0.3)",
                                color: "#5a9fd4",
                                fontSize: 10,
                                padding: "2px 8px",
                                borderRadius: 10,
                              }}
                            >
                              {exp.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Role & Voice */}
                    <div style={{ marginTop: 12, display: "flex", gap: 16 }}>
                      <div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 10,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Role Type
                        </div>
                        <span
                          style={{
                            background: roleBadgeColor[npc.role] || "#1a3a5c",
                            color: "#fff",
                            fontSize: 11,
                            padding: "3px 10px",
                            borderRadius: 10,
                          }}
                        >
                          {npc.role}
                        </span>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 10,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Voice Style
                        </div>
                        <span
                          style={{
                            background: "rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.7)",
                            fontSize: 11,
                            padding: "3px 10px",
                            borderRadius: 10,
                          }}
                        >
                          {npc.voiceStyle || "default"}
                        </span>
                      </div>
                      <div>
                        <div
                          style={{
                            color: "rgba(255,255,255,0.4)",
                            fontSize: 10,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          Mood
                        </div>
                        <span
                          style={{
                            background: "rgba(255,255,255,0.1)",
                            color: "rgba(255,255,255,0.7)",
                            fontSize: 11,
                            padding: "3px 10px",
                            borderRadius: 10,
                          }}
                        >
                          {npc.mood}
                        </span>
                      </div>
                    </div>

                    {/* NPC ID for reference */}
                    <div style={{ marginTop: 12 }}>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.3)",
                          fontSize: 10,
                          fontFamily: "monospace",
                        }}
                      >
                        ID: {npc.npcId}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>
          World: {worldId}
        </span>
        <button
          onClick={loadNpcs}
          style={{
            background: "rgba(42,111,189,0.2)",
            border: "1px solid rgba(42,111,189,0.4)",
            borderRadius: 8,
            color: "#5a9fd4",
            padding: "6px 12px",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}
