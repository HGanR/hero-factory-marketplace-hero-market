"use client";

interface WorldViewerDebugProps {
  worldId: string;
  versionType: string | null;
  chunkCount: number;
  platformPlacementCount: number;
  userPlacementCount: number;
  commerceNodeCount?: number;
  linkCount?: number;
  npcCount: number;
  zoneCount: number;
  show: boolean;
}

export function WorldViewerDebug({
  worldId,
  versionType,
  chunkCount,
  platformPlacementCount,
  userPlacementCount,
  commerceNodeCount = 0,
  linkCount = 0,
  npcCount,
  zoneCount,
  show,
}: WorldViewerDebugProps) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        background: "rgba(5,15,35,0.9)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(42,111,189,0.5)",
        borderRadius: 8,
        padding: "10px 14px",
        fontFamily: "monospace",
        fontSize: 11,
        color: "#a0c8f0",
        zIndex: 20,
        pointerEvents: "none",
        maxWidth: 280,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6, color: "#5a9fd4" }}>
        World Viewer Debug
      </div>
      <div>worldId: {worldId}</div>
      <div>version: {versionType ?? "—"}</div>
      <div>chunks: {chunkCount}</div>
      <div>platform placements: {platformPlacementCount}</div>
      <div>user placements: {userPlacementCount}</div>
      <div>commerce nodes: {commerceNodeCount}</div>
      <div>links: {linkCount}</div>
      <div>NPCs: {npcCount}</div>
      <div>platform zones: {zoneCount}</div>
    </div>
  );
}
